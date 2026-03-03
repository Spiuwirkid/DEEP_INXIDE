/**
 * Client-side Gemini AI analysis API.
 * Calls the server-side proxy at /api/gemini-analyze to keep the API key secure.
 */

import type { ScanState } from "@/lib/types";

export interface GeminiAnalysis {
    analysis: string;
    timestamp: number;
}

export async function analyzeWithGemini(scanState: ScanState): Promise<GeminiAnalysis> {
    const scanData = {
        query: scanState.query,
        type: scanState.type,
        resolvedIP: scanState.resolvedIP,
        compositeScore: scanState.results.compositeScore || null,
        vt: scanState.results.vt ? {
            stats: scanState.results.vt.stats,
        } : null,
        shodan: scanState.results.shodan || null,
        geo: scanState.results.geo || null,
        dns: scanState.results.dns || null,
        noiseClassification: scanState.results.noiseClassification || null,
        mitre: scanState.results.mitre || null,
        threatContext: scanState.results.threatContext || null,
        urlhaus: scanState.results.urlhaus ? {
            query_status: scanState.results.urlhaus.query_status,
            urls_online: (scanState.results.urlhaus as any).urls_online,
            threat: (scanState.results.urlhaus as any).threat,
        } : null,
        threatfox: scanState.results.threatfox ? {
            data: scanState.results.threatfox.data?.slice(0, 5),
        } : null,
        cveDetails: scanState.results.cveDetails ? {
            cves: scanState.results.cveDetails.cves.slice(0, 10),
            totalCount: scanState.results.cveDetails.totalCount,
        } : null,
    };

    const response = await fetch("/api/gemini-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanData }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Network error" }));
        throw new Error(err.error || `Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return {
        analysis: data.analysis,
        timestamp: Date.now(),
    };
}
