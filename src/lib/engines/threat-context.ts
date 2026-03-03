// ─────────────────────────────────────────────
// Threat Actor & Campaign Context Engine
// Maps indicators to adversary intelligence
// ─────────────────────────────────────────────
import type {
    ScanState,
    ThreatContext,
    ThreatActorInfo,
    CampaignInfo,
    TimelineEvent,
} from "../types";

// ── Threat Actor Knowledge Base ──
const ACTOR_DB: Record<string, ThreatActorInfo> = {
    emotet: {
        name: "TA542 (Mummy Spider)",
        aliases: ["Mummy Spider", "TA542", "MealyBug"],
        motivation: "Financial — malware distribution as a service",
        targetedIndustries: ["Banking", "Healthcare", "Government", "Manufacturing"],
        targetedRegions: ["North America", "Europe", "Japan"],
        knownMalware: ["Emotet", "TrickBot", "Ryuk", "Conti"],
        description: "Major malware distribution network operating Emotet as initial access broker. Often precedes ransomware deployment.",
    },
    trickbot: {
        name: "Wizard Spider",
        aliases: ["Wizard Spider", "UNC1878", "GOLD BLACKBURN"],
        motivation: "Financial — ransomware operations",
        targetedIndustries: ["Healthcare", "Financial Services", "Government", "Education"],
        targetedRegions: ["North America", "Europe", "Australia"],
        knownMalware: ["TrickBot", "Ryuk", "Conti", "BazarLoader", "Anchor"],
        description: "Russian-speaking group operating TrickBot botnet and Ryuk/Conti ransomware. Major ransomware threat to enterprise organizations.",
    },
    qakbot: {
        name: "TA577",
        aliases: ["TA577", "Gold Lagoon"],
        motivation: "Financial — initial access broker",
        targetedIndustries: ["Financial Services", "Technology", "Healthcare"],
        targetedRegions: ["North America", "Europe"],
        knownMalware: ["Qakbot", "QBot", "ProLock", "Egregor", "REvil"],
        description: "Operates Qakbot banking trojan as initial access vector. Sells access to ransomware affiliates.",
    },
    cobalt_strike: {
        name: "Multiple Actors",
        aliases: ["Various APT and cybercrime groups"],
        motivation: "Varies — red team tool widely abused by threat actors",
        targetedIndustries: ["All sectors"],
        targetedRegions: ["Global"],
        knownMalware: ["Cobalt Strike", "Beacon"],
        description: "Commercial penetration testing tool heavily abused by both nation-state and cybercriminal actors for post-exploitation.",
    },
    agenttesla: {
        name: "Multiple Cybercrime Groups",
        aliases: ["Various opportunistic actors"],
        motivation: "Financial — credential theft and espionage",
        targetedIndustries: ["Manufacturing", "Energy", "Logistics", "Government"],
        targetedRegions: ["Global — especially developing economies"],
        knownMalware: ["Agent Tesla", "FormBook", "LokiBot"],
        description: "Widely deployed info-stealer sold on underground forums. Used by low to mid-sophistication actors for mass credential harvesting.",
    },
    dridex: {
        name: "Evil Corp (INDRIK SPIDER)",
        aliases: ["INDRIK SPIDER", "Evil Corp", "Dridex Gang"],
        motivation: "Financial — banking fraud and ransomware",
        targetedIndustries: ["Banking", "Financial Services", "Government"],
        targetedRegions: ["North America", "Europe", "UK"],
        knownMalware: ["Dridex", "BitPaymer", "WastedLocker", "DoppelPaymer"],
        description: "Russian cybercriminal group behind Dridex banking trojan and multiple ransomware families. Subject to US sanctions.",
    },
    raccoon: {
        name: "Raccoon Stealer Operators",
        aliases: ["raccoonstealer"],
        motivation: "Financial — stealer-as-a-service",
        targetedIndustries: ["Consumer", "Technology", "Gaming"],
        targetedRegions: ["Global"],
        knownMalware: ["Raccoon Stealer", "Raccoon v2"],
        description: "Info-stealer sold as malware-as-a-service. Harvests browser credentials, cryptocurrency wallets, and session cookies.",
    },
    redline: {
        name: "RedLine Stealer Operators",
        aliases: ["REDGlade"],
        motivation: "Financial — credential theft for resale",
        targetedIndustries: ["Gaming", "Technology", "Cryptocurrency"],
        targetedRegions: ["Global"],
        knownMalware: ["RedLine Stealer"],
        description: "Mass-market info-stealer distributed via malvertising, cracked software, and phishing. Primary source of stolen credentials on dark web marketplaces.",
    },
    asyncrat: {
        name: "Various Cybercrime Operators",
        aliases: [],
        motivation: "Financial / Espionage — remote access",
        targetedIndustries: ["Government", "Technology", "Small Business"],
        targetedRegions: ["Middle East", "South America", "Southeast Asia"],
        knownMalware: ["AsyncRAT", "NJRAT", "QuasarRAT"],
        description: "Open-source RAT used by diverse threat actors ranging from script kiddies to organized cybercriminals. Often distributed via phishing.",
    },
    remcos: {
        name: "Various Cybercrime Operators",
        aliases: [],
        motivation: "Financial / Espionage — surveillance and control",
        targetedIndustries: ["Government", "Defense", "Energy"],
        targetedRegions: ["Middle East", "Europe", "South America"],
        knownMalware: ["Remcos RAT"],
        description: "Commercially sold 'remote administration tool' heavily abused for surveillance and data theft. Common in targeted spear-phishing attacks.",
    },
};

// Normalize family name for KB lookup
function normalizeFamily(family: string): string {
    return family
        .toLowerCase()
        .replace(/^win\./, "")
        .replace(/[^a-z0-9]/g, "")
        .replace(/stealer$/, "")
        .replace(/rat$/, "");
}

/**
 * Build threat context from scan results.
 */
export function buildThreatContext(state: ScanState): ThreatContext {
    const actors: ThreatActorInfo[] = [];
    const campaigns: CampaignInfo[] = [];
    const relatedFamilies: string[] = [];
    const seenActors = new Set<string>();
    const r = state.results;

    // ── 1. Malware family from MalwareBazaar ──
    if (r.malwareBazaar?.data?.length) {
        for (const sample of r.malwareBazaar.data) {
            if (sample.signature) {
                const normalized = normalizeFamily(sample.signature);
                relatedFamilies.push(sample.signature);

                // Check against KB
                for (const [key, actor] of Object.entries(ACTOR_DB)) {
                    if (normalized.includes(key) && !seenActors.has(actor.name)) {
                        actors.push(actor);
                        seenActors.add(actor.name);
                    }
                }
            }
        }
    }

    // ── 2. ThreatFox IOC data ──
    if (r.threatfox?.data?.length) {
        for (const ioc of r.threatfox.data) {
            const malName = ioc.malware_printable || ioc.malware;
            const normalized = normalizeFamily(malName);
            if (!relatedFamilies.includes(malName)) relatedFamilies.push(malName);

            // Actor lookup
            for (const [key, actor] of Object.entries(ACTOR_DB)) {
                if (normalized.includes(key) && !seenActors.has(actor.name)) {
                    actors.push(actor);
                    seenActors.add(actor.name);
                }
            }

            // Campaign creation from ThreatFox tags
            if (ioc.tags && ioc.tags.length > 0) {
                campaigns.push({
                    name: ioc.tags.join(", "),
                    actor: actors[0]?.name || "Unknown",
                    malwareFamily: malName,
                    firstSeen: ioc.first_seen,
                    objective: ioc.threat_type === "botnet_cc" ? "Command & Control" :
                        ioc.threat_type === "payload_delivery" ? "Payload Distribution" :
                            ioc.threat_type || "Unknown",
                    description: `${malName} — ${ioc.threat_type} (confidence: ${ioc.confidence_level}%)`,
                });
            }
        }
    }

    // ── 3. Feodo match ──
    if (r.feodo?.found) {
        for (const entry of r.feodo.entries) {
            const normalized = normalizeFamily(entry.malware);
            if (!relatedFamilies.includes(entry.malware)) relatedFamilies.push(entry.malware);

            for (const [key, actor] of Object.entries(ACTOR_DB)) {
                if (normalized.includes(key) && !seenActors.has(actor.name)) {
                    actors.push(actor);
                    seenActors.add(actor.name);
                }
            }
        }
    }

    // ── Determine kill chain stage ──
    let killChainStage = "Unknown";
    if (r.feodo?.found) killChainStage = "Command & Control";
    else if (r.malwareBazaar?.data?.length) killChainStage = "Weaponization / Delivery";
    else if (r.urlhaus?.query_status !== "no_results") killChainStage = "Delivery";
    else if (r.threatfox?.data?.length) {
        const types = r.threatfox.data.map(d => d.threat_type);
        if (types.includes("botnet_cc")) killChainStage = "Command & Control";
        else if (types.includes("payload_delivery")) killChainStage = "Delivery";
    }

    // ── Risk narrative ──
    let riskNarrative = "No significant threat actor or campaign context identified.";
    if (actors.length > 0) {
        const actorNames = actors.map(a => a.name).join(", ");
        const families = relatedFamilies.join(", ");
        riskNarrative = `Associated with ${actorNames}. Malware families: ${families}. ` +
            `Kill chain stage: ${killChainStage}. ` +
            `${actors[0]?.motivation || "Motivation unknown"}.`;
    }

    return {
        actors,
        campaigns,
        killChainStage,
        riskNarrative,
        relatedFamilies,
    };
}

/**
 * Build timeline events from all available temporal data.
 */
export function buildTimeline(state: ScanState): TimelineEvent[] {
    const events: TimelineEvent[] = [];
    const r = state.results;

    // MalwareBazaar samples
    r.malwareBazaar?.data?.forEach(s => {
        if (s.first_seen) events.push({ date: s.first_seen, source: "MalwareBazaar", event: `Sample ${s.sha256_hash.slice(0, 12)}… first seen`, type: "first_seen" });
    });

    // ThreatFox IOCs
    r.threatfox?.data?.forEach(ioc => {
        if (ioc.first_seen) events.push({ date: ioc.first_seen, source: "ThreatFox", event: `${ioc.malware_printable} IOC reported`, type: "feed_appearance" });
    });

    // Feodo
    r.feodo?.entries?.forEach(e => {
        if (e.first_seen) events.push({ date: e.first_seen, source: "Feodo Tracker", event: `C2 for ${e.malware} — port ${e.port}`, type: "feed_appearance" });
        if (e.last_online) events.push({ date: e.last_online, source: "Feodo Tracker", event: `C2 last online`, type: "last_seen" });
    });

    // Passive DNS
    r.threatMiner?.passiveDNS.forEach(p => {
        if (p.first_seen) events.push({ date: p.first_seen, source: "ThreatMiner", event: `DNS: ${p.domain} → ${p.ip}`, type: "first_seen" });
        if (p.last_seen) events.push({ date: p.last_seen, source: "ThreatMiner", event: `DNS last seen: ${p.domain}`, type: "last_seen" });
    });

    // URLhaus
    if (r.urlhaus?.date_added) {
        events.push({ date: r.urlhaus.date_added, source: "URLhaus", event: `Threat feed entry: ${r.urlhaus.threat || "malicious URL"}`, type: "feed_appearance" });
    }

    // GreyNoise last seen
    if (r.greynoise?.last_seen) {
        events.push({ date: r.greynoise.last_seen, source: "GreyNoise", event: `Last observed scanning: ${r.greynoise.name || "unknown"}`, type: "last_seen" });
    }

    // CVE publish dates
    r.cveDetails?.cves.forEach(cve => {
        if (cve.Published) events.push({ date: cve.Published, source: "CIRCL CVE", event: `${cve.id} published (CVSS ${cve.cvss ?? "N/A"})`, type: "report" });
    });

    // CISA KEV
    r.cisakev?.forEach(kev => {
        events.push({ date: kev.dateAdded, source: "CISA KEV", event: `${kev.cveID} added to KEV — ${kev.vulnerabilityName}`, type: "campaign" });
    });

    // AbuseIPDB
    if (r.abuseipdb?.lastReportedAt) {
        events.push({ date: r.abuseipdb.lastReportedAt, source: "AbuseIPDB", event: `Last abuse report (${r.abuseipdb.totalReports} total)`, type: "report" });
    }

    // Sort chronologically (most recent first)
    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return events;
}
