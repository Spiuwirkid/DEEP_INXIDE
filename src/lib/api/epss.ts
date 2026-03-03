// ─────────────────────────────────────────────
// FIRST EPSS — Exploit Prediction Scoring
// Free, no key, batch support
// ─────────────────────────────────────────────
import type { EPSSScore, EPSSResult } from "../types";

const EPSS_API = "https://api.first.org/data/v1/epss";

/**
 * Fetch EPSS scores for one or more CVEs (batch up to 100)
 */
export async function lookupEPSS(cveIds: string[]): Promise<EPSSResult> {
    if (cveIds.length === 0) return { scores: [] };

    try {
        // EPSS API accepts comma-separated CVE IDs
        const batch = cveIds.slice(0, 100);
        const url = `${EPSS_API}?cve=${batch.join(",")}`;

        const res = await fetch(url, {
            headers: { Accept: "application/json" },
        });

        if (!res.ok) return { scores: [] };

        const data = await res.json();
        const rawScores: any[] = data.data || [];

        const scores: EPSSScore[] = rawScores.map((s) => ({
            cve: s.cve,
            epss: parseFloat(s.epss) || 0,
            percentile: parseFloat(s.percentile) || 0,
            date: s.date || "",
        }));

        return { scores };
    } catch {
        return { scores: [] };
    }
}
