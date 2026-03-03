// ─────────────────────────────────────────────
// Infrastructure Clustering Engine
// Groups related infrastructure by reuse signals
// ─────────────────────────────────────────────
import type {
    ScanState,
    InfraCluster,
    ClusterSignal,
} from "../types";

/**
 * Analyze scan results for infrastructure clustering signals.
 * Detects shared infrastructure patterns from passive DNS, certs, WHOIS.
 */
export function analyzeInfraCluster(state: ScanState): InfraCluster {
    const signals: ClusterSignal[] = [];
    const relatedDomains = new Set<string>();
    const relatedIPs = new Set<string>();
    const sharedCerts = new Set<string>();
    const sharedNS = new Set<string>();
    const r = state.results;

    // ── 1. Passive DNS → shared subnet / related domains ──
    if (r.threatMiner?.passiveDNS.length) {
        const ips = r.threatMiner.passiveDNS.map(e => e.ip);
        const domains = r.threatMiner.passiveDNS.map(e => e.domain);

        // Group by /24 subnet
        const subnets: Record<string, string[]> = {};
        for (const ip of ips) {
            const parts = ip.split(".");
            if (parts.length === 4) {
                const subnet = `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
                if (!subnets[subnet]) subnets[subnet] = [];
                subnets[subnet].push(ip);
            }
        }

        for (const [subnet, subnetIPs] of Object.entries(subnets)) {
            if (subnetIPs.length >= 2) {
                signals.push({
                    type: "shared_subnet",
                    detail: `${subnetIPs.length} IPs observed in ${subnet}`,
                    strength: subnetIPs.length >= 5 ? "strong" : "moderate",
                    relatedIOCs: subnetIPs,
                });
            }
            subnetIPs.forEach(ip => relatedIPs.add(ip));
        }

        domains.forEach(d => relatedDomains.add(d));
    }

    // ── 2. Certificate transparency → shared certs ──
    if (r.crtsh && r.crtsh.length > 0) {
        // Group by issuer
        const issuers: Record<string, string[]> = {};
        for (const cert of r.crtsh) {
            const issuer = cert.issuer_name;
            if (!issuers[issuer]) issuers[issuer] = [];
            issuers[issuer].push(cert.common_name);
            sharedCerts.add(cert.common_name);
        }

        // Extract unique subdomains
        const subdomainsFromCerts = new Set(r.crtsh.map(c => c.common_name).filter(c => !c.startsWith("*")));
        if (subdomainsFromCerts.size > 5) {
            signals.push({
                type: "shared_cert",
                detail: `${subdomainsFromCerts.size} unique hostnames in CT logs`,
                strength: subdomainsFromCerts.size >= 20 ? "strong" : "moderate",
                relatedIOCs: Array.from(subdomainsFromCerts).slice(0, 20),
            });
        }

        subdomainsFromCerts.forEach(d => relatedDomains.add(d));
    }

    // ── 3. WHOIS → shared nameservers ──
    if (r.threatMiner?.whois?.whois?.nameservers) {
        const ns = r.threatMiner.whois.whois.nameservers;
        ns.forEach(n => sharedNS.add(n));

        if (ns.length > 0) {
            signals.push({
                type: "shared_nameserver",
                detail: `Nameservers: ${ns.join(", ")}`,
                strength: "moderate",
                relatedIOCs: ns,
            });
        }
    }

    // ── 4. Subdomains → naming pattern analysis ──
    if (r.threatMiner?.subdomains && r.threatMiner.subdomains.length > 3) {
        const subs = r.threatMiner.subdomains;
        subs.forEach(s => relatedDomains.add(s));

        // Entropy check for DGA-like patterns
        const avgLen = subs.reduce((s, d) => s + d.length, 0) / subs.length;
        const hasNumericPattern = subs.filter(s => /\d{3,}/.test(s)).length > subs.length * 0.3;

        if (hasNumericPattern || avgLen > 20) {
            signals.push({
                type: "naming_pattern",
                detail: `${subs.length} subdomains detected — ${hasNumericPattern ? "numeric patterns suggest DGA" : "long names may indicate automated generation"}`,
                strength: hasNumericPattern ? "strong" : "weak",
                relatedIOCs: subs.slice(0, 10),
            });
        }
    }

    // ── 5. Port fingerprint → service signature ──
    if (r.shodan && r.shodan.ports.length > 0) {
        const fingerprint = r.shodan.ports.sort((a, b) => a - b).join(",");
        signals.push({
            type: "port_fingerprint",
            detail: `Service profile: ports [${fingerprint}]`,
            strength: "weak",
            relatedIOCs: [state.query],
        });
    }

    // ── 6. ASN density signal ──
    if (r.geo?.as) {
        const abuseScore = r.abuseipdb?.abuseConfidenceScore ?? 0;
        if (abuseScore >= 50) {
            signals.push({
                type: "asn_density",
                detail: `ASN ${r.geo.as} — AbuseIPDB confidence ${abuseScore}% suggests high abuse density`,
                strength: abuseScore >= 80 ? "strong" : "moderate",
                relatedIOCs: [r.geo.as],
            });
        }
    }

    // ── Calculate footprint ──
    const clusterSize = relatedDomains.size + relatedIPs.size;
    let footprintScale: InfraCluster["footprintScale"] = "individual";
    if (clusterSize >= 50) footprintScale = "large_operation";
    else if (clusterSize >= 20) footprintScale = "campaign";
    else if (clusterSize >= 5) footprintScale = "small_group";

    const strongSignals = signals.filter(s => s.strength === "strong").length;
    const clusterConfidence = Math.min(
        30 + strongSignals * 20 + signals.length * 5 + Math.min(clusterSize, 50),
        100
    );

    return {
        clusterSize,
        signals,
        relatedDomains: Array.from(relatedDomains),
        relatedIPs: Array.from(relatedIPs),
        sharedCerts: Array.from(sharedCerts),
        sharedNameservers: Array.from(sharedNS),
        footprintScale,
        confidence: clusterConfidence,
    };
}
