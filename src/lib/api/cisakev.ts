// ─────────────────────────────────────────────
// CISA KEV — Known Exploited Vulnerabilities
// Free, no key, static JSON feed
// Fetched once per session, looked up locally
// ─────────────────────────────────────────────
import type { CISAKEVEntry, CISAKEVCatalog } from "../types";

const KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";

let cachedCatalog: CISAKEVEntry[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 3600_000; // 1 hour

async function fetchCatalog(): Promise<CISAKEVEntry[]> {
    if (cachedCatalog && Date.now() - cacheTime < CACHE_TTL) {
        return cachedCatalog;
    }

    try {
        const res = await fetch(KEV_URL);
        if (!res.ok) return cachedCatalog || [];

        const data: CISAKEVCatalog = await res.json();
        cachedCatalog = data.vulnerabilities || [];
        cacheTime = Date.now();
        return cachedCatalog;
    } catch {
        return cachedCatalog || [];
    }
}

/**
 * Check if CVE IDs are in the CISA KEV catalog
 */
export async function lookupCISAKEV(cveIds: string[]): Promise<CISAKEVEntry[]> {
    const catalog = await fetchCatalog();
    const cveSet = new Set(cveIds.map(id => id.toUpperCase()));
    return catalog.filter(entry => cveSet.has(entry.cveID.toUpperCase()));
}

/**
 * Get full catalog count for stats
 */
export async function getCISAKEVCount(): Promise<number> {
    const catalog = await fetchCatalog();
    return catalog.length;
}
