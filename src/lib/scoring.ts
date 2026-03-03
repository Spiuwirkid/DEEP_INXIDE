import type {
    ScanState,
    CompositeScore,
    ScoreFactor,
} from "./types";

/**
 * Calculate a composite threat score from all available scan results.
 * This is the core intelligence scoring engine.
 *
 * Factors:
 *  1. VT Malicious Detections (weight: critical)
 *  2. VT Suspicious Detections (weight: high)
 *  3. Feed Presence — URLhaus, Feodo (weight: high)
 *  4. Malware Association — MalwareBazaar (weight: high)
 *  5. Vulnerability Exposure — Shodan CVEs (weight: medium)
 *  6. Infrastructure Risk — open ports, services (weight: medium)
 *  7. Campaign Linkage — ThreatMiner related samples (weight: medium)
 *  8. Cross-Source Confirmation (weight: high)
 */
export function calculateCompositeScore(state: ScanState): CompositeScore {
    const factors: ScoreFactor[] = [];
    let sourcesChecked = 0;
    let sourcesWithData = 0;
    let sourcesAgreeMalicious = 0;

    const r = state.results;

    // ── Factor 1: VT Malicious Detections ──
    if (r.vt) {
        sourcesChecked++;
        sourcesWithData++;
        const total = r.vt.stats.malicious + r.vt.stats.suspicious + r.vt.stats.harmless + r.vt.stats.undetected;
        const malPct = total > 0 ? (r.vt.stats.malicious / total) * 100 : 0;

        let score = 0;
        if (r.vt.stats.malicious >= 10) score = 100;
        else if (r.vt.stats.malicious >= 5) score = 80;
        else if (r.vt.stats.malicious >= 3) score = 60;
        else if (r.vt.stats.malicious >= 1) score = 30;

        if (r.vt.stats.malicious > 0) sourcesAgreeMalicious++;

        factors.push({
            name: "Malicious Detections",
            weight: "critical",
            score,
            maxScore: 100,
            detail: `${r.vt.stats.malicious}/${total} engines flagged (${malPct.toFixed(0)}%)`,
        });
    }

    // ── Factor 2: VT Suspicious Detections ──
    if (r.vt && r.vt.stats.suspicious > 0) {
        const score = Math.min(r.vt.stats.suspicious * 15, 60);
        factors.push({
            name: "Suspicious Detections",
            weight: "high",
            score,
            maxScore: 60,
            detail: `${r.vt.stats.suspicious} engines flagged suspicious`,
        });
    }

    // ── Factor 3: Threat Feed Presence ──
    if (r.urlhaus) {
        sourcesChecked++;
        const isListed = r.urlhaus.query_status !== "no_results";
        if (isListed) {
            sourcesWithData++;
            sourcesAgreeMalicious++;
            const isOnline = r.urlhaus.url_status === "online";
            factors.push({
                name: "URLhaus Listing",
                weight: "high",
                score: isOnline ? 80 : 50,
                maxScore: 80,
                detail: `Listed as ${r.urlhaus.threat || "threat"} (${r.urlhaus.url_status || "unknown"})`,
            });
        }
    }

    if (r.feodo) {
        sourcesChecked++;
        if (r.feodo.found) {
            sourcesWithData++;
            sourcesAgreeMalicious++;
            const malwares = [...new Set(r.feodo.entries.map(e => e.malware))];
            factors.push({
                name: "Feodo C2 Match",
                weight: "critical",
                score: 95,
                maxScore: 100,
                detail: `Known C2 for ${malwares.join(", ")}`,
            });
        }
    }

    // ── Factor 4: Malware Association ──
    if (r.malwareBazaar) {
        sourcesChecked++;
        if (r.malwareBazaar.query_status === "ok" && r.malwareBazaar.data?.length) {
            sourcesWithData++;
            sourcesAgreeMalicious++;
            const families = [...new Set(r.malwareBazaar.data.map(s => s.signature).filter(Boolean))];
            factors.push({
                name: "Malware Association",
                weight: "high",
                score: 85,
                maxScore: 100,
                detail: families.length > 0
                    ? `Linked to: ${families.slice(0, 3).join(", ")}${families.length > 3 ? ` +${families.length - 3}` : ""}`
                    : `${r.malwareBazaar.data.length} sample(s) found`,
            });
        }
    }

    // ── Factor 5: Vulnerability Exposure ──
    if (r.shodan) {
        sourcesChecked++;
        sourcesWithData++;
        const vulnCount = r.shodan.vulns.length;
        if (vulnCount > 0) {
            let score = 0;
            if (vulnCount >= 10) score = 70;
            else if (vulnCount >= 5) score = 50;
            else if (vulnCount >= 1) score = 25;

            // Boost if CVE details show high CVSS
            if (r.cveDetails) {
                const criticalCVEs = r.cveDetails.cves.filter(c => (c.cvss3 || c.cvss || 0) >= 9.0);
                if (criticalCVEs.length > 0) score = Math.min(score + 20, 80);
            }

            factors.push({
                name: "Vulnerability Exposure",
                weight: "medium",
                score,
                maxScore: 80,
                detail: `${vulnCount} CVEs on exposed services`,
            });
        }
    }

    // ── Factor 6: Infrastructure Risk ──
    if (r.shodan) {
        const riskyPorts = [23, 445, 3389, 1433, 3306, 5432, 27017, 6379, 5900];
        const exposedRisky = r.shodan.ports.filter(p => riskyPorts.includes(p));

        if (exposedRisky.length > 0 || r.shodan.ports.length > 10) {
            const score = Math.min(exposedRisky.length * 10 + (r.shodan.ports.length > 10 ? 15 : 0), 50);
            factors.push({
                name: "Infrastructure Risk",
                weight: "medium",
                score,
                maxScore: 50,
                detail: `${r.shodan.ports.length} ports open${exposedRisky.length > 0 ? `, ${exposedRisky.length} high-risk` : ""}`,
            });
        }
    }

    // ── Factor 7: Campaign / Sample Linkage ──
    if (r.threatMiner) {
        sourcesChecked++;
        if (r.threatMiner.relatedSamples.length > 0) {
            sourcesWithData++;
            const sampleCount = r.threatMiner.relatedSamples.length;
            const score = Math.min(sampleCount * 5, 60);
            factors.push({
                name: "Related Malware Samples",
                weight: "medium",
                score,
                maxScore: 60,
                detail: `${sampleCount} sample(s) linked via ThreatMiner`,
            });
            if (sampleCount >= 3) sourcesAgreeMalicious++;
        }
    }

    // ── Factor 8: Cross-Source Confirmation ──
    if (sourcesAgreeMalicious >= 3) {
        factors.push({
            name: "Cross-Source Confirmation",
            weight: "high",
            score: 90,
            maxScore: 100,
            detail: `${sourcesAgreeMalicious} independent sources confirm malicious activity`,
        });
    } else if (sourcesAgreeMalicious >= 2) {
        factors.push({
            name: "Cross-Source Confirmation",
            weight: "high",
            score: 50,
            maxScore: 100,
            detail: `${sourcesAgreeMalicious} sources flag malicious activity`,
        });
    }

    // ── Factor 9: ThreatFox Campaign Association ──
    if (r.threatfox?.data?.length) {
        sourcesAgreeMalicious++;
        const maxConf = Math.max(...r.threatfox.data.map(d => d.confidence_level));
        const families = [...new Set(r.threatfox.data.map(d => d.malware_printable))];
        factors.push({
            name: "Campaign Association",
            weight: "high",
            score: Math.min(maxConf, 90),
            maxScore: 100,
            detail: `ThreatFox: ${families.slice(0, 2).join(", ")} (confidence ${maxConf}%)`,
        });
    }

    // ── Factor 10: Noise Classification ──
    if (r.noiseClassification) {
        const nc = r.noiseClassification;
        if (nc.category === "BENIGN_SCANNER" || nc.category === "NOISE") {
            // Reduce score for known benign/noise
            factors.push({
                name: "Noise Reduction",
                weight: "high",
                score: -30,  // negative = reduces total
                maxScore: 0,
                detail: `${nc.category}: ${nc.reasoning.slice(0, 80)}`,
            });
        } else if (nc.category === "ACTIVE_EXPLOITATION" || nc.category === "C2_INFRASTRUCTURE") {
            factors.push({
                name: "Active Threat Classification",
                weight: "critical",
                score: 90,
                maxScore: 100,
                detail: `${nc.category}: ${nc.reasoning.slice(0, 80)}`,
            });
        }
    }

    // ── Factor 11: CISA KEV Match ──
    if (r.cisakev && r.cisakev.length > 0) {
        const ransomwareLinked = r.cisakev.filter(k => k.knownRansomwareCampaignUse === "Known");
        factors.push({
            name: "Known Exploited Vulnerability",
            weight: "critical",
            score: ransomwareLinked.length > 0 ? 95 : 80,
            maxScore: 100,
            detail: `${r.cisakev.length} CISA KEV match${r.cisakev.length > 1 ? "es" : ""}${ransomwareLinked.length > 0 ? ` (${ransomwareLinked.length} ransomware-linked)` : ""}`,
        });
    }

    // ── Factor 12: EPSS Exploitation Probability ──
    if (r.epss?.scores?.length) {
        const maxEPSS = Math.max(...r.epss.scores.map(s => s.epss));
        if (maxEPSS > 0.1) {
            factors.push({
                name: "Exploitation Probability",
                weight: "medium",
                score: Math.min(Math.round(maxEPSS * 100), 80),
                maxScore: 80,
                detail: `EPSS: ${(maxEPSS * 100).toFixed(1)}% exploitation probability`,
            });
        }
    }

    // ── Factor 13: AbuseIPDB Community Reports ──
    if (r.abuseipdb && r.abuseipdb.totalReports > 0) {
        sourcesAgreeMalicious++;
        const score = Math.min(r.abuseipdb.abuseConfidenceScore, 80);
        factors.push({
            name: "Community Abuse Reports",
            weight: "medium",
            score,
            maxScore: 80,
            detail: `${r.abuseipdb.totalReports} reports from ${r.abuseipdb.numDistinctUsers} users (${r.abuseipdb.abuseConfidenceScore}% confidence)`,
        });
    }


    // ── Calculate Total ──
    const weightMultiplier: Record<string, number> = {
        critical: 3.0,
        high: 2.0,
        medium: 1.0,
        low: 0.5,
    };

    let weightedSum = 0;
    let weightedMax = 0;

    for (const f of factors) {
        const mult = weightMultiplier[f.weight] || 1;
        weightedSum += f.score * mult;
        weightedMax += f.maxScore * mult;
    }

    const total = weightedMax > 0 ? Math.round((weightedSum / weightedMax) * 100) : 0;

    // ── Risk Level ──
    let level: CompositeScore["level"] = "low";
    if (total >= 71) level = "critical";
    else if (total >= 41) level = "high";
    else if (total >= 16) level = "moderate";

    // ── Confidence ──
    let confidence: CompositeScore["confidence"] = "unverified";
    if (sourcesWithData >= 4 && sourcesAgreeMalicious >= 3) confidence = "confirmed";
    else if (sourcesWithData >= 3 && sourcesAgreeMalicious >= 2) confidence = "probable";
    else if (sourcesWithData >= 2) confidence = "possible";

    return {
        total,
        level,
        confidence,
        factors,
        sourceCount: sourcesChecked,
        sourcesAgreeing: sourcesAgreeMalicious,
    };
}
