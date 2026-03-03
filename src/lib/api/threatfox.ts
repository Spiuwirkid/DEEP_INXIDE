// ─────────────────────────────────────────────
// ThreatFox (abuse.ch) — free, no key
// IOC-to-malware & campaign mapping
// ─────────────────────────────────────────────
import type { ThreatFoxResult } from "../types";

import { supabase } from "@/integrations/supabase/client";

const THREATFOX_API_BASE = "https://threatfox-api.abuse.ch/api/v1/";

async function getThreatFoxConfig() {
    const isProd = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    let url = THREATFOX_API_BASE;
    let headers: Record<string, string> = { "Content-Type": "application/json" };

    if (isProd) {
        url = "/api.php?req=/threatfox";
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
            headers["Authorization"] = `Bearer ${session.access_token}`;
        }
    }
    return { url, headers };
}

export async function lookupThreatFox(
    query: string,
    type: "ip" | "domain" | "url" | "hash"
): Promise<ThreatFoxResult> {
    try {
        const body: Record<string, string> = { query: "search_ioc", search_term: query };

        const { url, headers } = await getThreatFoxConfig();
        const res = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
        });

        if (!res.ok) return { query_status: "error", data: null };

        const data = await res.json();
        return {
            query_status: data.query_status || "no_result",
            data: data.data || null,
        };
    } catch {
        return { query_status: "error", data: null };
    }
}

/**
 * Get recent IOCs from ThreatFox (last 24h) for trend detection
 */
export async function getThreatFoxRecent(limit: number = 50): Promise<ThreatFoxResult> {
    try {
        const { url, headers } = await getThreatFoxConfig();
        const res = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({ query: "get_iocs", days: 1 }),
        });

        if (!res.ok) return { query_status: "error", data: null };

        const data = await res.json();
        const iocs = data.data || [];
        return {
            query_status: data.query_status || "no_result",
            data: iocs.slice(0, limit),
        };
    } catch {
        return { query_status: "error", data: null };
    }
}
