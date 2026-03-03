import type { ScanState, MitreMapping, MitreTechnique } from "./types";

/**
 * MITRE ATT&CK mapping engine.
 *
 * Maps scan results to ATT&CK techniques based on:
 * - Exposed services → attack surface techniques
 * - Malware families → known TTPs
 * - CVEs → exploitation techniques
 * - Infrastructure patterns → adversary behavior
 */

// ── Known malware family → TTP mappings ──
const MALWARE_TTPS: Record<string, MitreTechnique[]> = {
    emotet: [
        { id: "T1566.001", name: "Spear-Phishing Attachment", tactic: "Initial Access", description: "Emotet commonly spreads via malicious email attachments", source: "Malware Family" },
        { id: "T1059.005", name: "Visual Basic", tactic: "Execution", description: "Uses VBA macros in Office documents for execution", source: "Malware Family" },
        { id: "T1071.001", name: "Web Protocols", tactic: "Command and Control", description: "Uses HTTP/HTTPS for C2 communication", source: "Malware Family" },
        { id: "T1105", name: "Ingress Tool Transfer", tactic: "Command and Control", description: "Downloads additional payloads (TrickBot, Ryuk)", source: "Malware Family" },
    ],
    trickbot: [
        { id: "T1566.001", name: "Spear-Phishing Attachment", tactic: "Initial Access", description: "Often delivered via phishing or Emotet", source: "Malware Family" },
        { id: "T1059.001", name: "PowerShell", tactic: "Execution", description: "Uses PowerShell for payload execution", source: "Malware Family" },
        { id: "T1055", name: "Process Injection", tactic: "Defense Evasion", description: "Injects into legitimate processes", source: "Malware Family" },
        { id: "T1573.002", name: "Asymmetric Cryptography", tactic: "Command and Control", description: "Uses encrypted C2 channels", source: "Malware Family" },
    ],
    qakbot: [
        { id: "T1566.002", name: "Spear-Phishing Link", tactic: "Initial Access", description: "Distributed via phishing links", source: "Malware Family" },
        { id: "T1059.001", name: "PowerShell", tactic: "Execution", description: "Uses PowerShell for execution", source: "Malware Family" },
        { id: "T1071.001", name: "Web Protocols", tactic: "Command and Control", description: "HTTP-based C2", source: "Malware Family" },
        { id: "T1041", name: "Exfiltration Over C2 Channel", tactic: "Exfiltration", description: "Exfiltrates data via C2", source: "Malware Family" },
    ],
    raccoon: [
        { id: "T1566", name: "Phishing", tactic: "Initial Access", description: "Distributed via phishing campaigns", source: "Malware Family" },
        { id: "T1555", name: "Credentials from Password Stores", tactic: "Credential Access", description: "Steals credentials from browsers", source: "Malware Family" },
        { id: "T1539", name: "Steal Web Session Cookie", tactic: "Credential Access", description: "Steals browser session cookies", source: "Malware Family" },
    ],
    cobalt: [
        { id: "T1059.001", name: "PowerShell", tactic: "Execution", description: "Cobalt Strike commonly uses PowerShell", source: "Malware Family" },
        { id: "T1071.001", name: "Web Protocols", tactic: "Command and Control", description: "HTTP/HTTPS beaconing for C2", source: "Malware Family" },
        { id: "T1055", name: "Process Injection", tactic: "Defense Evasion", description: "Injects into processes for evasion", source: "Malware Family" },
        { id: "T1573.001", name: "Symmetric Cryptography", tactic: "Command and Control", description: "Encrypted C2 traffic", source: "Malware Family" },
        { id: "T1021.002", name: "SMB/Windows Admin Shares", tactic: "Lateral Movement", description: "Lateral movement via SMB", source: "Malware Family" },
    ],
    dridex: [
        { id: "T1566.001", name: "Spear-Phishing Attachment", tactic: "Initial Access", description: "Delivered via malicious Office documents", source: "Malware Family" },
        { id: "T1059.005", name: "Visual Basic", tactic: "Execution", description: "Uses VBA macros", source: "Malware Family" },
        { id: "T1185", name: "Browser Session Hijacking", tactic: "Collection", description: "Man-in-the-browser for banking fraud", source: "Malware Family" },
    ],
    agenttesla: [
        { id: "T1566.001", name: "Spear-Phishing Attachment", tactic: "Initial Access", description: "Spread via phishing emails", source: "Malware Family" },
        { id: "T1056.001", name: "Keylogging", tactic: "Collection", description: "Records keystrokes", source: "Malware Family" },
        { id: "T1113", name: "Screen Capture", tactic: "Collection", description: "Captures screenshots", source: "Malware Family" },
        { id: "T1555", name: "Credentials from Password Stores", tactic: "Credential Access", description: "Extracts saved credentials", source: "Malware Family" },
    ],
    redline: [
        { id: "T1555", name: "Credentials from Password Stores", tactic: "Credential Access", description: "Steals browser credentials", source: "Malware Family" },
        { id: "T1539", name: "Steal Web Session Cookie", tactic: "Credential Access", description: "Steals session cookies", source: "Malware Family" },
        { id: "T1005", name: "Data from Local System", tactic: "Collection", description: "Collects files and system info", source: "Malware Family" },
    ],
};

// ── Service-based technique inference ──
const PORT_TECHNIQUES: Record<number, MitreTechnique> = {
    22: { id: "T1021.004", name: "SSH", tactic: "Lateral Movement", description: "SSH service exposed — potential for brute force or credential-based access", source: "Exposed Service" },
    23: { id: "T1021", name: "Remote Services", tactic: "Lateral Movement", description: "Telnet exposed — cleartext credentials, high risk", source: "Exposed Service" },
    445: { id: "T1021.002", name: "SMB/Windows Admin Shares", tactic: "Lateral Movement", description: "SMB exposed — EternalBlue, lateral movement vector", source: "Exposed Service" },
    3389: { id: "T1021.001", name: "Remote Desktop Protocol", tactic: "Lateral Movement", description: "RDP exposed — brute force and credential-based attacks", source: "Exposed Service" },
    3306: { id: "T1190", name: "Exploit Public-Facing Application", tactic: "Initial Access", description: "MySQL database directly exposed to internet", source: "Exposed Service" },
    5432: { id: "T1190", name: "Exploit Public-Facing Application", tactic: "Initial Access", description: "PostgreSQL database directly exposed to internet", source: "Exposed Service" },
    27017: { id: "T1190", name: "Exploit Public-Facing Application", tactic: "Initial Access", description: "MongoDB exposed — common target for data theft", source: "Exposed Service" },
    6379: { id: "T1190", name: "Exploit Public-Facing Application", tactic: "Initial Access", description: "Redis exposed — often unauthenticated, RCE risk", source: "Exposed Service" },
    5900: { id: "T1021.005", name: "VNC", tactic: "Lateral Movement", description: "VNC exposed — remote desktop access", source: "Exposed Service" },
};

/**
 * Generate MITRE ATT&CK mappings from scan results.
 */
export function generateMitreMapping(state: ScanState): MitreMapping {
    const techniques: MitreTechnique[] = [];
    const seen = new Set<string>();

    function addTechnique(t: MitreTechnique) {
        if (!seen.has(t.id)) {
            seen.add(t.id);
            techniques.push(t);
        }
    }

    const r = state.results;

    // ── Map exposed ports to techniques ──
    if (r.shodan) {
        for (const port of r.shodan.ports) {
            const technique = PORT_TECHNIQUES[port];
            if (technique) addTechnique(technique);
        }

        // CVEs → exploitation technique
        if (r.shodan.vulns.length > 0) {
            addTechnique({
                id: "T1190",
                name: "Exploit Public-Facing Application",
                tactic: "Initial Access",
                description: `${r.shodan.vulns.length} CVEs on exposed services — active exploitation risk`,
                source: `Shodan (${r.shodan.vulns.join(", ")})`,
            });
        }
    }

    // ── Map malware families to TTPs ──
    if (r.malwareBazaar?.data) {
        const families = new Set<string>();
        for (const sample of r.malwareBazaar.data) {
            if (sample.signature) {
                families.add(sample.signature.toLowerCase());
            }
        }

        for (const family of families) {
            // Check exact match first, then partial match
            const key = Object.keys(MALWARE_TTPS).find(k =>
                family.includes(k) || k.includes(family)
            );
            if (key) {
                for (const t of MALWARE_TTPS[key]) {
                    addTechnique({ ...t, source: `Malware: ${family}` });
                }
            }
        }
    }

    // ── Map Feodo C2 ──
    if (r.feodo?.found) {
        const malwares = [...new Set(r.feodo.entries.map(e => e.malware.toLowerCase()))];
        addTechnique({
            id: "T1071.001",
            name: "Web Protocols",
            tactic: "Command and Control",
            description: `Known C2 server for ${r.feodo.entries[0]?.malware || "banking trojan"}`,
            source: "Feodo Tracker",
        });

        for (const m of malwares) {
            const key = Object.keys(MALWARE_TTPS).find(k => m.includes(k) || k.includes(m));
            if (key) {
                for (const t of MALWARE_TTPS[key]) {
                    addTechnique({ ...t, source: `Feodo: ${m}` });
                }
            }
        }
    }

    // ── Map URLhaus threats ──
    if (r.urlhaus && r.urlhaus.query_status !== "no_results") {
        addTechnique({
            id: "T1566.002",
            name: "Spear-Phishing Link",
            tactic: "Initial Access",
            description: "URL/host listed in URLhaus — used for malware distribution",
            source: "URLhaus",
        });
        addTechnique({
            id: "T1105",
            name: "Ingress Tool Transfer",
            tactic: "Command and Control",
            description: "Infrastructure used to deliver malware payloads",
            source: "URLhaus",
        });
    }

    // ── Map related samples from ThreatMiner ──
    if (r.threatMiner && r.threatMiner.relatedSamples.length > 0) {
        addTechnique({
            id: "T1588.001",
            name: "Obtain Capabilities: Malware",
            tactic: "Resource Development",
            description: `${r.threatMiner.relatedSamples.length} malware samples linked to this infrastructure`,
            source: "ThreatMiner",
        });
    }

    // ── Extract unique tactics ──
    const tacticsUsed = [...new Set(techniques.map(t => t.tactic))];

    // Sort by tactic kill chain order
    const TACTIC_ORDER = [
        "Reconnaissance", "Resource Development", "Initial Access", "Execution",
        "Persistence", "Privilege Escalation", "Defense Evasion", "Credential Access",
        "Discovery", "Lateral Movement", "Collection", "Command and Control",
        "Exfiltration", "Impact",
    ];

    tacticsUsed.sort((a, b) => TACTIC_ORDER.indexOf(a) - TACTIC_ORDER.indexOf(b));
    techniques.sort((a, b) => TACTIC_ORDER.indexOf(a.tactic) - TACTIC_ORDER.indexOf(b.tactic));

    return { techniques, tacticsUsed };
}
