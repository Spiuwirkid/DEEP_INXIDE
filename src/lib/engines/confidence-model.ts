// ─────────────────────────────────────────────
// Multi-Source Intelligence Confidence Model
// Evaluates finding reliability across sources
// ─────────────────────────────────────────────
import type {
    ScanState,
    ConfidenceAssessment,
    ConfidenceLevel,
    SourceEvidence,
} from "../types";

function getFreshness(dateStr?: string | null): SourceEvidence["freshness"] {
    if (!dateStr) return "outdated";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "outdated";
    const ageMs = Date.now() - d.getTime();
    const days = ageMs / 86400_000;
    if (days < 1) return "live";
    if (days < 30) return "recent";
    if (days < 180) return "stale";
    return "outdated";
}

/**
 * Build a multi-source confidence assessment.
 *
 * Factors (weighted):
 *  - Source count (25%)
 *  - Cross-source agreement (25%)
 *  - Data freshness (20%)
 *  - Source credibility tier (15%)
 *  - Detection consistency (15%)
 */
export function assessConfidence(state: ScanState): ConfidenceAssessment {
    const evidence: SourceEvidence[] = [];
    const r = state.results;

    // ── Collect source evidence ──

    // Tier 1: VirusTotal
    if (r.vt) {
        const total = r.vt.stats.malicious + r.vt.stats.suspicious + r.vt.stats.harmless + r.vt.stats.undetected;
        let verdict: SourceEvidence["verdict"] = "unknown";
        if (r.vt.stats.malicious > 5) verdict = "malicious";
        else if (r.vt.stats.suspicious > 3) verdict = "suspicious";
        else if (r.vt.stats.harmless > total * 0.5) verdict = "clean";
        evidence.push({ source: "VirusTotal", tier: 1, verdict, freshness: "live" });
    }

    // Tier 1: Shodan
    if (r.shodan) {
        const hasCVEs = r.shodan.vulns.length > 0;
        evidence.push({
            source: "Shodan InternetDB",
            tier: 1,
            verdict: hasCVEs ? "suspicious" : "clean",
            freshness: "live",
        });
    }

    // Tier 1: GreyNoise
    if (r.greynoise) {
        let verdict: SourceEvidence["verdict"] = "unknown";
        if (r.greynoise.classification === "malicious") verdict = "malicious";
        else if (r.greynoise.classification === "benign" || r.greynoise.riot) verdict = "clean";
        evidence.push({
            source: "GreyNoise",
            tier: 1,
            verdict,
            freshness: getFreshness(r.greynoise.last_seen),
            lastSeen: r.greynoise.last_seen || undefined,
        });
    }

    // Tier 1: MalwareBazaar
    if (r.malwareBazaar) {
        const hasSamples = r.malwareBazaar.query_status === "ok" && r.malwareBazaar.data?.length;
        evidence.push({
            source: "MalwareBazaar",
            tier: 1,
            verdict: hasSamples ? "malicious" : "clean",
            freshness: hasSamples ? getFreshness(r.malwareBazaar.data![0].first_seen) : "live",
            lastSeen: hasSamples ? r.malwareBazaar.data![0].first_seen : undefined,
        });
    }

    // Tier 1: URLhaus
    if (r.urlhaus) {
        const isThreat = r.urlhaus.query_status !== "no_results";
        evidence.push({
            source: "URLhaus",
            tier: 1,
            verdict: isThreat ? "malicious" : "clean",
            freshness: isThreat ? getFreshness(r.urlhaus.date_added) : "live",
            lastSeen: r.urlhaus.date_added || undefined,
        });
    }

    // Tier 1: Feodo
    if (r.feodo) {
        evidence.push({
            source: "Feodo Tracker",
            tier: 1,
            verdict: r.feodo.found ? "malicious" : "clean",
            freshness: r.feodo.found ? getFreshness(r.feodo.entries[0]?.first_seen) : "live",
            lastSeen: r.feodo.found ? r.feodo.entries[0]?.first_seen : undefined,
        });
    }

    // Tier 1: ThreatFox
    if (r.threatfox) {
        const hasData = r.threatfox.query_status === "ok" && r.threatfox.data?.length;
        evidence.push({
            source: "ThreatFox",
            tier: 1,
            verdict: hasData ? "malicious" : "clean",
            freshness: hasData ? getFreshness(r.threatfox.data![0].first_seen) : "live",
            lastSeen: hasData ? r.threatfox.data![0].first_seen : undefined,
        });
    }

    // Tier 2: AbuseIPDB
    if (r.abuseipdb) {
        let verdict: SourceEvidence["verdict"] = "unknown";
        if (r.abuseipdb.abuseConfidenceScore >= 50) verdict = "malicious";
        else if (r.abuseipdb.abuseConfidenceScore >= 20) verdict = "suspicious";
        else if (r.abuseipdb.isWhitelisted) verdict = "clean";
        evidence.push({
            source: "AbuseIPDB",
            tier: 2,
            verdict,
            freshness: getFreshness(r.abuseipdb.lastReportedAt),
            lastSeen: r.abuseipdb.lastReportedAt || undefined,
        });
    }

    // Tier 2: ThreatMiner
    if (r.threatMiner) {
        const hasIntel = r.threatMiner.relatedSamples.length > 0 || r.threatMiner.passiveDNS.length > 0;
        evidence.push({
            source: "ThreatMiner",
            tier: 2,
            verdict: r.threatMiner.relatedSamples.length > 0 ? "suspicious" : "clean",
            freshness: hasIntel && r.threatMiner.passiveDNS.length > 0
                ? getFreshness(r.threatMiner.passiveDNS[0]?.last_seen) : "stale",
        });
    }

    // ── Score calculation ──
    const sourceCount = evidence.length;
    const malicious = evidence.filter(e => e.verdict === "malicious").length;
    const suspicious = evidence.filter(e => e.verdict === "suspicious").length;
    const clean = evidence.filter(e => e.verdict === "clean").length;
    const agreeing = Math.max(malicious + suspicious, clean);
    const disagreeing = sourceCount - agreeing;

    // Factor 1: Source count (25%)
    const sourceScore = Math.min(sourceCount / 6, 1) * 25;

    // Factor 2: Cross-source agreement (25%)
    const agreementRatio = sourceCount > 0 ? agreeing / sourceCount : 0;
    const agreementScore = agreementRatio * 25;

    // Factor 3: Data freshness (20%)
    const freshnessWeights = { live: 1, recent: 0.7, stale: 0.3, outdated: 0.1 };
    const avgFreshness = evidence.length > 0
        ? evidence.reduce((sum, e) => sum + freshnessWeights[e.freshness], 0) / evidence.length
        : 0;
    const freshnessScore = avgFreshness * 20;

    // Factor 4: Source credibility tier (15%)
    const tierWeights = { 1: 1, 2: 0.6, 3: 0.3 };
    const avgTier = evidence.length > 0
        ? evidence.reduce((sum, e) => sum + tierWeights[e.tier], 0) / evidence.length
        : 0;
    const tierScore = avgTier * 15;

    // Factor 5: Detection consistency (15%)
    const consistencyScore = (1 - (disagreeing / Math.max(sourceCount, 1))) * 15;

    const totalScore = Math.round(sourceScore + agreementScore + freshnessScore + tierScore + consistencyScore);

    // Determine level
    let level: ConfidenceLevel;
    if (totalScore >= 90) level = "confirmed";
    else if (totalScore >= 70) level = "high";
    else if (totalScore >= 40) level = "moderate";
    else if (totalScore >= 20) level = "low";
    else level = "unverified";

    // Find freshest data
    const allDates = evidence.filter(e => e.lastSeen).map(e => e.lastSeen!);
    const freshestData = allDates.length > 0
        ? allDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
        : "No temporal data";

    // Generate explanation
    const explanation = `${sourceCount} sources queried. ${agreeing}/${sourceCount} agree on verdict (${malicious > clean ? "malicious" : "clean"} dominant). ` +
        `Data freshness: ${(avgFreshness * 100).toFixed(0)}%. ` +
        `${evidence.filter(e => e.tier === 1).length} Tier-1 sources contributing.`;

    return {
        level,
        score: totalScore,
        sourceCount,
        agreeing,
        disagreeing,
        evidence,
        freshestData,
        explanation,
    };
}
