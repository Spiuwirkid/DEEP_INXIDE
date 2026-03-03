// ─────────────────────────────────────────────
// Noise Classification Engine
// Categorizes IPs into behavioral classes
// ─────────────────────────────────────────────
import type {
    ScanState,
    NoiseClassification,
    NoiseCategory,
} from "../types";

/**
 * Classify an IP into a behavioral noise category.
 *
 * Priority logic:
 * 1. Feodo C2 match → C2_INFRASTRUCTURE
 * 2. GreyNoise RIOT (known good infra) → BENIGN_SCANNER
 * 3. GreyNoise noise=true + benign → MASS_SCANNER
 * 4. GreyNoise noise=true + malicious → ACTIVE_EXPLOITATION
 * 5. High VT malicious + no noise → TARGETED_SCAN
 * 6. Some VT detections → TARGETED_SCAN
 * 7. AbuseIPDB high confidence → context boost
 * 8. Fallback → UNKNOWN
 */
export function classifyNoise(state: ScanState): NoiseClassification {
    const { greynoise, feodo, vt, abuseipdb } = state.results;
    const sources: string[] = [];
    let category: NoiseCategory = "UNKNOWN";
    let confidence = 0;
    let reasoning = "";
    let recommendedAction: NoiseClassification["recommendedAction"] = "investigate";

    // ── 1. Feodo C2 match — highest priority ──
    if (feodo?.found) {
        category = "C2_INFRASTRUCTURE";
        confidence = 95;
        reasoning = `Known C2 infrastructure for ${feodo.entries[0]?.malware || "banking trojan"}. Feodo Tracker confirmed.`;
        recommendedAction = "block";
        sources.push("Feodo Tracker");
    }

    // ── 2. GreyNoise classification ──
    else if (greynoise) {
        sources.push("GreyNoise");

        if (greynoise.riot) {
            // RIOT = known good business infrastructure (Google, Microsoft, etc.)
            category = "BENIGN_SCANNER";
            confidence = 90;
            reasoning = `Identified as known good infrastructure: ${greynoise.name || "RIOT dataset"}. Safe to dismiss.`;
            recommendedAction = "dismiss";
        } else if (greynoise.noise && greynoise.classification === "benign") {
            category = "MASS_SCANNER";
            confidence = 80;
            reasoning = `Known internet-wide scanner: ${greynoise.name || "mass scanner"}. Observed scanning the internet — not targeted.`;
            recommendedAction = "low_priority";
        } else if (greynoise.noise && greynoise.classification === "malicious") {
            category = "ACTIVE_EXPLOITATION";
            confidence = 85;
            reasoning = `Malicious scanner detected by GreyNoise. Actively probing internet — potential exploit delivery.`;
            recommendedAction = "respond";
        } else if (!greynoise.noise && greynoise.classification === "malicious") {
            category = "TARGETED_SCAN";
            confidence = 75;
            reasoning = `Classified malicious by GreyNoise but NOT part of mass scanning. Likely targeted activity.`;
            recommendedAction = "investigate";
        } else if (!greynoise.noise && greynoise.classification === "unknown") {
            // Not seen by GreyNoise — check VT
            category = "UNKNOWN";
            confidence = 30;
            reasoning = `Not observed in GreyNoise dataset. Further analysis required.`;
            recommendedAction = "investigate";
        }
    }

    // ── 3. VT overlay — boost or override if GreyNoise is unknown ──
    if (vt) {
        sources.push("VirusTotal");
        const total = vt.stats.malicious + vt.stats.suspicious + vt.stats.harmless + vt.stats.undetected;
        const malRatio = total > 0 ? vt.stats.malicious / total : 0;

        if (category === "UNKNOWN") {
            if (vt.stats.malicious > 10) {
                category = "TARGETED_SCAN";
                confidence = 70;
                reasoning = `${vt.stats.malicious}/${total} engines flagged malicious. No mass scanning observed — likely targeted.`;
                recommendedAction = "investigate";
            } else if (vt.stats.malicious === 0 && vt.stats.suspicious === 0) {
                category = "NOISE";
                confidence = 50;
                reasoning = `No detections across ${total} engines. Likely background noise or benign traffic.`;
                recommendedAction = "low_priority";
            }
        } else if (category === "MASS_SCANNER" && malRatio > 0.15) {
            // Upgrade from mass scanner if VT shows significant detections
            category = "ACTIVE_EXPLOITATION";
            confidence = Math.min(confidence + 10, 95);
            reasoning += ` However, ${vt.stats.malicious}/${total} VT engines flag as malicious — potential weaponized scanning.`;
            recommendedAction = "respond";
        }
    }

    // ── 4. AbuseIPDB context boost ──
    if (abuseipdb) {
        sources.push("AbuseIPDB");
        if (abuseipdb.abuseConfidenceScore >= 80 && category === "UNKNOWN") {
            category = "TARGETED_SCAN";
            confidence = 65;
            reasoning = `AbuseIPDB confidence ${abuseipdb.abuseConfidenceScore}% with ${abuseipdb.totalReports} reports from ${abuseipdb.numDistinctUsers} users.`;
            recommendedAction = "investigate";
        } else if (abuseipdb.isWhitelisted && category === "UNKNOWN") {
            category = "BENIGN_SCANNER";
            confidence = 70;
            reasoning = `Whitelisted on AbuseIPDB. Likely a known research or business scanner.`;
            recommendedAction = "dismiss";
        }
    }

    return {
        category,
        confidence,
        reasoning,
        sources,
        recommendedAction,
        greynoiseRaw: greynoise || undefined,
    };
}
