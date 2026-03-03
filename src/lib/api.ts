import { supabase } from "@/integrations/supabase/client";
import type {
    ShodanResult,
    GeoIPResult,
    URLhausResult,
    DNSResult,
    VTAnalysisStats,
    VTVendorResult,
    VTResult,
    MalwareBazaarResult,
    CVEDetail,
    CVESearchResult,
    FeodoEntry,
    FeodoResult,
    ThreatMinerData,
    ThreatMinerPassiveDNS,
} from "./types";

// ─────────────────────────────────────────────
// Shodan InternetDB — completely free, no key
// ─────────────────────────────────────────────
export async function lookupShodanInternetDB(ip: string): Promise<ShodanResult> {
    // Shodan requires a valid IPv4. If a domain was passed, skip without hitting 404
    if (!ip || !/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip)) {
        return { cpes: [], hostnames: [], ip, ports: [], tags: [], vulns: [] };
    }
    const res = await proxyFetch(`/shodan?ip=${encodeURIComponent(ip)}`);
    if (!res.ok) {
        if (res.status === 404) {
            return { cpes: [], hostnames: [], ip, ports: [], tags: [], vulns: [] };
        }
        throw new Error(`Shodan InternetDB error: ${res.status}`);
    }
    return res.json();
}

// Helper to invoke generic APIs via proxy in production to bypass CORS
async function proxyFetch(path: string, options: RequestInit = {}): Promise<Response> {
    const isProd = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

    if (isProd) {
        const { data: { session } } = await supabase.auth.getSession();
        const headers = new Headers(options.headers);
        if (session?.access_token) {
            headers.set("Authorization", `Bearer ${session.access_token}`);
        }

        const [basePath, queryStr] = path.split('?');
        const proxyUrl = `/api.php?req=${encodeURIComponent(basePath)}${queryStr ? '&' + queryStr : ''}`;

        return fetch(proxyUrl, {
            ...options,
            headers
        });
    } else {
        // Local dev via vite dev server proxy
        return fetch(`/api${path}`, options);
    }
}

// Helper to invoke Supabase functions via proxy in production to bypass CORS
async function invokeSupabaseFunction(functionName: string, body: any) {
    const isProd = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

    if (isProd) {
        try {
            const res = await proxyFetch(`/supabase/${functionName}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });
            if (res.ok) {
                const data = await res.json();
                return { data, error: null };
            }
            return { data: null, error: `Proxy HTTP ${res.status}` };
        } catch (e: any) {
            return { data: null, error: e.message };
        }
    } else {
        return supabase.functions.invoke(functionName, { body });
    }
}

// ─────────────────────────────────────────────
// IP Geolocation — ip-api.com, free, no key
// ─────────────────────────────────────────────
export async function lookupGeoIP(ip: string): Promise<GeoIPResult> {
    const res = await proxyFetch(`/geo?ip=${ip}`);
    if (!res.ok) throw new Error(`GeoIP error: ${res.status}`);
    const data: GeoIPResult = await res.json();
    if (data.status === "fail") throw new Error(`GeoIP lookup failed for ${ip}`);
    return data;
}

// ─────────────────────────────────────────────
// URLhaus (abuse.ch) — free, no key
// ─────────────────────────────────────────────
export async function lookupURLhaus(query: string, type: "url" | "host"): Promise<URLhausResult> {
    const res = await proxyFetch(`/urlhaus?type=${type}&query=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`URLhaus error: ${res.status}`);
    return res.json();
}

// ─────────────────────────────────────────────
// DNS Resolution — API Proxy (Bypasses ISP blocks on dns.google)
// ─────────────────────────────────────────────
export async function resolveDNS(domain: string, type: number = 1): Promise<DNSResult> {
    try {
        const res = await proxyFetch(`/dns?domain=${encodeURIComponent(domain)}&type=${type}`);
        if (!res.ok) throw new Error("Google DNS Proxy Failed");
        return await res.json();
    } catch {
        // Fallback to Cloudflare DoH (Direct if proxy fails or local)
        const res = await fetch(
            `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`,
            { headers: { Accept: "application/dns-json" } }
        );
        if (!res.ok) throw new Error(`DNS resolution error: ${res.status}`);
        return await res.json();
    }
}

export async function resolveHostToIP(domain: string): Promise<string | null> {
    const dns = await resolveDNS(domain, 1);
    if (dns.Answer && dns.Answer.length > 0) {
        const aRecord = dns.Answer.find((r) => r.type === 1);
        return aRecord?.data ?? null;
    }
    return null;
}

// ─────────────────────────────────────────────
// VirusTotal — via existing Supabase Edge Fn
// ─────────────────────────────────────────────
export async function lookupVirusTotal(
    type: string,
    query: string
): Promise<VTResult | null> {
    let rawData = null;

    // 1. Try Local Proxy first (Bypass Supabase Edge Function in Dev)
    try {
        const proxyRes = await fetch(`/api/virustotal?type=${type}&query=${query}`);
        if (proxyRes.ok) {
            rawData = await proxyRes.json();
        }
    } catch (e) {
        console.warn("[VT] Local proxy lookup failed, falling back to Supabase...");
    }

    // 2. Fallback to Supabase Proxy if dev local proxy failed/wasn't used
    if (!rawData) {
        const response = await invokeSupabaseFunction("virustotal-lookup", { type, query });

        if (response.error) {
            console.error("VT Supabase Error:", response.error);
            // Don't throw immediately, let it return null if really failed
            return null;
        }
        rawData = response.data;
    }

    const data = rawData;
    if (data?.error) {
        console.error("VT API Error:", data.error);
        return null; // Return null instead of throwing to prevent crashing the whole scan
    }

    const attrs = data?.data?.attributes;
    if (!attrs) return null;

    const analysisStats = attrs.last_analysis_stats;
    let stats: VTAnalysisStats = { malicious: 0, suspicious: 0, harmless: 0, undetected: 0 };
    let threatScore = 0;

    if (analysisStats) {
        stats = {
            malicious: analysisStats.malicious || 0,
            suspicious: analysisStats.suspicious || 0,
            harmless: analysisStats.harmless || 0,
            undetected: analysisStats.undetected || 0,
        };
        const total = stats.malicious + stats.suspicious + stats.harmless + stats.undetected;
        threatScore =
            total > 0
                ? Math.round(((stats.malicious * 2 + stats.suspicious) / (total * 2)) * 100)
                : 0;
    }

    const vendorResults: Record<string, VTVendorResult> = attrs.last_analysis_results || {};

    return { stats, vendorResults, threatScore };
}

// ─────────────────────────────────────────────
// MalwareBazaar (abuse.ch) — free, no key
// Supports: hash lookup, tag search, signature search
// ─────────────────────────────────────────────
export async function lookupMalwareBazaar(
    query: string,
    type: "hash" | "tag" | "signature"
): Promise<MalwareBazaarResult> {
    const body = new URLSearchParams();

    switch (type) {
        case "hash":
            body.append("query", "get_info");
            body.append("hash", query);
            break;
        case "tag":
            body.append("query", "get_taginfo");
            body.append("tag", query);
            body.append("limit", "10");
            break;
        case "signature":
            body.append("query", "get_siginfo");
            body.append("signature", query);
            body.append("limit", "10");
            break;
    }

    const res = await fetch("https://mb-api.abuse.ch/api/v1/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
    });

    if (!res.ok) throw new Error(`MalwareBazaar error: ${res.status}`);
    return res.json();
}

// ─────────────────────────────────────────────
// CIRCL CVE Search — free, no key
// ─────────────────────────────────────────────
export async function lookupCVE(cveId: string): Promise<CVEDetail | null> {
    const res = await fetch(`https://cve.circl.lu/api/cve/${cveId}`);
    if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`CVE search error: ${res.status}`);
    }
    const data = await res.json();
    if (!data || !data.id) return null;
    return {
        id: data.id || cveId,
        summary: data.summary || "",
        cvss: data.cvss ?? null,
        cvss3: data.cvss3 ?? null,
        Published: data.Published || "",
        Modified: data.Modified || "",
        references: data.references || [],
        vulnerable_product: data.vulnerable_product || [],
        access: data.access || {},
        impact: data.impact || {},
    };
}

// Batch CVE lookup — fetches details for multiple CVE IDs
export async function lookupCVEBatch(cveIds: string[]): Promise<CVESearchResult> {
    const limited = cveIds.slice(0, 10); // limit to 10 to avoid rate limits
    const results = await Promise.allSettled(
        limited.map((id) => lookupCVE(id))
    );

    const cves: CVEDetail[] = [];
    for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
            cves.push(result.value);
        }
    }

    return { cves, totalCount: cveIds.length };
}

// ─────────────────────────────────────────────
// Feodo Tracker (abuse.ch) — free, no key
// Check if an IP is a known banking trojan C2
// ─────────────────────────────────────────────
export async function lookupFeodoTracker(ip: string): Promise<FeodoResult> {
    try {
        const res = await fetch(`/api/feodo?query=${ip}`);
        if (!res.ok) {
            return { found: false, entries: [] };
        }

        const data = await res.json();
        if (data.query_status === "no_results" || !data.data) {
            return { found: false, entries: [] };
        }

        const entries: FeodoEntry[] = (data.data || []).map((e: any) => ({
            ip_address: e.ip_address || ip,
            port: e.port || 0,
            status: e.status || "unknown",
            hostname: e.hostname || null,
            as_number: e.as_number || null,
            as_name: e.as_name || null,
            country: e.country || null,
            first_seen: e.first_seen || "",
            last_online: e.last_online || null,
            malware: e.malware || "Unknown",
        }));

        return { found: entries.length > 0, entries };
    } catch {
        return { found: false, entries: [] };
    }
}

// ─────────────────────────────────────────────
// ThreatMiner — via Supabase proxy (CORS blocked)
// Provides: passive DNS, WHOIS, subdomains,
// related samples, URIs
// ─────────────────────────────────────────────
async function threatMinerQuery(
    entityType: "domain" | "ip" | "sample",
    query: string,
    rt: number
): Promise<any[]> {
    try {
        const response = await invokeSupabaseFunction("threat-intel-proxy", {
            source: "threatminer", entityType, query, rt
        });
        if (response.error) return [];
        const data = response.data;
        if (data?.status_code === "200" && Array.isArray(data?.results)) {
            return data.results;
        }
        return [];
    } catch {
        return [];
    }
}

export async function lookupThreatMiner(
    query: string,
    type: "ip" | "domain" | "hash"
): Promise<ThreatMinerData> {
    const data: ThreatMinerData = {
        passiveDNS: [],
        whois: null,
        subdomains: [],
        relatedSamples: [],
        uris: [],
    };

    if (type === "domain") {
        // rt=2: passive DNS, rt=1: WHOIS, rt=5: subdomains, rt=4: related samples, rt=3: URIs
        const [pdns, whoisRaw, subs, samples, uris] = await Promise.allSettled([
            threatMinerQuery("domain", query, 2),
            threatMinerQuery("domain", query, 1),
            threatMinerQuery("domain", query, 5),
            threatMinerQuery("domain", query, 4),
            threatMinerQuery("domain", query, 3),
        ]);

        if (pdns.status === "fulfilled") {
            data.passiveDNS = (pdns.value || []).map((r: any) => ({
                ip: r.ip || "",
                domain: r.domain || query,
                first_seen: r.first_seen || "",
                last_seen: r.last_seen || "",
            }));
        }

        if (whoisRaw.status === "fulfilled" && whoisRaw.value?.[0]) {
            const w = whoisRaw.value[0];
            data.whois = {
                domain: query,
                is_subdomain: w.is_subdomain || false,
                whois: {
                    registrant: w.whois?.registrant || w.registrant || undefined,
                    registrar: w.whois?.registrar || w.registrar || undefined,
                    creation_date: w.whois?.date_created || w.create_date || undefined,
                    expiration_date: w.whois?.expiration_date || undefined,
                    nameservers: w.whois?.nameservers || undefined,
                },
            };
        }

        if (subs.status === "fulfilled") {
            data.subdomains = (subs.value || []).filter((s: any) => typeof s === "string");
        }

        if (samples.status === "fulfilled") {
            data.relatedSamples = (samples.value || []).filter((s: any) => typeof s === "string").slice(0, 20);
        }

        if (uris.status === "fulfilled") {
            data.uris = (uris.value || []).filter((s: any) => typeof s === "string").slice(0, 20);
        }
    } else if (type === "ip") {
        // rt=2: passive DNS, rt=4: related samples, rt=5: SSL certs
        const [pdns, samples] = await Promise.allSettled([
            threatMinerQuery("ip", query, 2),
            threatMinerQuery("ip", query, 4),
        ]);

        if (pdns.status === "fulfilled") {
            data.passiveDNS = (pdns.value || []).map((r: any) => ({
                ip: query,
                domain: r.domain || r || "",
                first_seen: r.first_seen || "",
                last_seen: r.last_seen || "",
            }));
        }

        if (samples.status === "fulfilled") {
            data.relatedSamples = (samples.value || []).filter((s: any) => typeof s === "string").slice(0, 20);
        }
    } else if (type === "hash") {
        // rt=1: metadata, rt=3: HTTP traffic, rt=7: mutants
        const [samples] = await Promise.allSettled([
            threatMinerQuery("sample", query, 1),
        ]);

        if (samples.status === "fulfilled" && samples.value) {
            data.relatedSamples = (samples.value || []).filter((s: any) => typeof s === "string").slice(0, 20);
        }
    }

    return data;
}

// ─────────────────────────────────────────────
// Utility: detect input type
// ─────────────────────────────────────────────
export function detectInputType(input: string): "ip" | "domain" | "url" | "hash" {
    const trimmed = input.trim();

    if (/^https?:\/\//i.test(trimmed)) return "url";
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(trimmed)) return "ip";
    if (/^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/.test(trimmed)) return "ip";
    if (/^[a-fA-F0-9]{32}$/.test(trimmed)) return "hash";
    if (/^[a-fA-F0-9]{40}$/.test(trimmed)) return "hash";
    if (/^[a-fA-F0-9]{64}$/.test(trimmed)) return "hash";

    return "domain";
}

// ─────────────────────────────────────────────
// Port service name mapping
// ─────────────────────────────────────────────
const PORT_NAMES: Record<number, string> = {
    21: "FTP",
    22: "SSH",
    23: "Telnet",
    25: "SMTP",
    53: "DNS",
    80: "HTTP",
    110: "POP3",
    143: "IMAP",
    443: "HTTPS",
    445: "SMB",
    993: "IMAPS",
    995: "POP3S",
    1433: "MSSQL",
    1521: "Oracle",
    3306: "MySQL",
    3389: "RDP",
    5432: "PostgreSQL",
    5900: "VNC",
    6379: "Redis",
    8080: "HTTP-Alt",
    8443: "HTTPS-Alt",
    27017: "MongoDB",
};

export function getPortServiceName(port: number): string {
    return PORT_NAMES[port] || `Port ${port}`;
}

// ─────────────────────────────────────────────
// History & Storage (Supabase)
// ─────────────────────────────────────────────

/**
 * Saves the complete scan result to Supabase.
 * Returns the generated history ID (UUID) or null if failed.
 */
export async function saveScanResult(scanState: any): Promise<string | null> {
    try {
        const payload = {
            target: scanState.query,
            scan_type: scanState.type,
            scan_data: scanState.results, // Stores all raw results as JSONB
            risk_score: scanState.results.compositeScore?.total || 0,
            risk_level: scanState.results.compositeScore?.level || "unknown",
            created_at: new Date().toISOString()
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
            .from('scan_history')
            .insert([payload])
            .select('id')
            .single();

        if (error) {
            console.error('[History] Save error:', error.message);
            return null;
        }
        return data?.id;
    } catch (err) {
        console.error('[History] Save exception:', err);
        return null; // Fail gracefully
    }
}

/**
 * Updates an existing history record with AI analysis results.
 */
export async function updateScanWithAI(scanId: string, analysis: any): Promise<void> {
    if (!scanId) return;
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
            .from('scan_history')
            .update({ ai_analysis: analysis })
            .eq('id', scanId);

        if (error) console.error('[History] Update AI error:', error.message);
        else console.log('[History] AI analysis saved.');
    } catch (err) {
        console.error('[History] Update AI exception:', err);
    }
}

/**
 * Fetches recent scan history (metadata only).
 */
export async function getScanHistory(): Promise<any[]> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
            .from('scan_history')
            .select('id, target, scan_type, risk_score, risk_level, created_at')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            console.error('[History] Fetch list error:', error.message);
            return [];
        }
        return data || [];
    } catch (err) {
        console.error('[History] Fetch list exception:', err);
        return [];
    }
}

/**
 * Fetches a complete scan record by ID.
 */
export async function getScanById(id: string): Promise<any> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
            .from('scan_history')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    } catch (err) {
        console.error('[History] Fetch detail exception:', err);
        return null;
    }
}

// ─────────────────────────────────────────────
// Watchlist Functions
// ─────────────────────────────────────────────

export async function addToWatchlist(item: { target: string, type: string, notes?: string }) {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
            .from('watchlist')
            .insert([{ ...item, status: 'active' }])
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (err) {
        console.error('[Watchlist] Add error:', err);
        throw err;
    }
}

export async function getWatchlist() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
            .from('watchlist')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('[Watchlist] Fetch error:', err);
        return [];
    }
}

export async function removeFromWatchlist(id: string) {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
            .from('watchlist')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return true;
    } catch (err) {
        console.error('[Watchlist] Remove error:', err);
        return false;
    }
}

