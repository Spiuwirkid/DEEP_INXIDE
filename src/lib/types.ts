// ─── Shodan InternetDB ───
export interface ShodanResult {
    cpes: string[];
    hostnames: string[];
    ip: string;
    ports: number[];
    tags: string[];
    vulns: string[];
}

// ─── IP Geolocation (ip-api.com) ───
export interface GeoIPResult {
    status: string;
    country: string;
    countryCode: string;
    region: string;
    regionName: string;
    city: string;
    zip: string;
    lat: number;
    lon: number;
    timezone: string;
    isp: string;
    org: string;
    as: string;
    query: string;
}

// ─── URLhaus (abuse.ch) ───
export interface URLhausResult {
    query_status: string;
    urlhaus_reference?: string;
    url?: string;
    url_status?: string;
    host?: string;
    date_added?: string;
    threat?: string;
    blacklists?: {
        spamhaus_dbl?: string;
        surbl?: string;
    };
    tags?: string[] | null;
    urls?: URLhausEntry[];
    urls_online?: number;
    urls_offline?: number;
}

export interface URLhausEntry {
    id: string;
    urlhaus_reference: string;
    url: string;
    url_status: string;
    date_added: string;
    threat: string;
    reporter: string;
    larted: string;
    tags: string[] | null;
}

// ─── VirusTotal (via Supabase) ───
export interface VTAnalysisStats {
    malicious: number;
    suspicious: number;
    harmless: number;
    undetected: number;
}

export interface VTVendorResult {
    category: string;
    result: string | null;
    engine_name: string;
    engine_version?: string;
    method?: string;
}

export interface VTResult {
    stats: VTAnalysisStats;
    vendorResults: Record<string, VTVendorResult>;
    threatScore: number;
}

// ─── DNS Resolution (Google DoH) ───
export interface DNSRecord {
    name: string;
    type: number;
    TTL: number;
    data: string;
}

export interface DNSResult {
    Status: number;
    Answer?: DNSRecord[];
    Authority?: DNSRecord[];
    Question?: { name: string; type: number }[];
}

// ─── ThreatMiner ───
export interface ThreatMinerResponse {
    status_code: string; // "200", "404", etc.
    status_message: string;
    results: any[];
}

export interface ThreatMinerPassiveDNS {
    ip: string;
    domain: string;
    first_seen: string;
    last_seen: string;
}

export interface ThreatMinerWhois {
    domain: string;
    is_subdomain: boolean;
    whois?: {
        registrant?: string;
        registrar?: string;
        creation_date?: string;
        expiration_date?: string;
        nameservers?: string[];
    };
}

export interface ThreatMinerData {
    passiveDNS: ThreatMinerPassiveDNS[];
    whois: ThreatMinerWhois | null;
    subdomains: string[];
    relatedSamples: string[];
    uris: string[];
}

// ─── MalwareBazaar (abuse.ch) ───
export interface MalwareBazaarSample {
    sha256_hash: string;
    sha1_hash: string;
    md5_hash: string;
    first_seen: string;
    last_seen: string | null;
    file_name: string | null;
    file_size: number | null;
    file_type: string | null;
    file_type_mime: string | null;
    signature: string | null; // malware family name
    reporter: string;
    tags: string[] | null;
    intelligence?: {
        clamav?: string[] | null;
        downloads?: string;
        uploads?: string;
        mail?: {
            generic?: string[];
        };
    };
    delivery_method?: string | null;
}

export interface MalwareBazaarResult {
    query_status: string;
    data: MalwareBazaarSample[] | null;
}

// ─── CIRCL CVE Search ───
export interface CVEDetail {
    id: string;
    summary: string;
    cvss: number | null;
    cvss3: number | null;
    Published: string;
    Modified: string;
    references: string[];
    vulnerable_product: string[];
    access?: {
        vector?: string;
        complexity?: string;
        authentication?: string;
    };
    impact?: {
        confidentiality?: string;
        integrity?: string;
        availability?: string;
    };
}

export interface CVESearchResult {
    cves: CVEDetail[];
    totalCount: number;
}

// ─── Feodo Tracker (abuse.ch) ───
export interface FeodoEntry {
    ip_address: string;
    port: number;
    status: string; // "online", "offline"
    hostname: string | null;
    as_number: number | null;
    as_name: string | null;
    country: string | null;
    first_seen: string;
    last_online: string | null;
    malware: string; // "Dridex", "TrickBot", etc.
}

export interface FeodoResult {
    found: boolean;
    entries: FeodoEntry[];
}

// ─── Composite Threat Score ───
export interface ScoreFactor {
    name: string;
    weight: "low" | "medium" | "high" | "critical";
    score: number;    // 0-100 contribution
    maxScore: number;  // max possible
    detail: string;
}

export interface CompositeScore {
    total: number;           // 0-100
    level: "low" | "moderate" | "high" | "critical";
    confidence: "unverified" | "possible" | "probable" | "confirmed";
    factors: ScoreFactor[];
    sourceCount: number;
    sourcesAgreeing: number;
}

// ─── MITRE ATT&CK ───
export interface MitreTechnique {
    id: string;          // e.g. "T1566.001"
    name: string;        // e.g. "Spear-Phishing Attachment"
    tactic: string;      // e.g. "Initial Access"
    description: string;
    source: string;      // what data triggered this mapping
}

export interface MitreMapping {
    techniques: MitreTechnique[];
    tacticsUsed: string[];
}

// ─── GreyNoise Community ───
export interface GreyNoiseResult {
    ip: string;
    noise: boolean;
    riot: boolean;
    classification: "benign" | "malicious" | "unknown";
    name: string;
    link: string;
    last_seen: string;
    message?: string;
}

// ─── ThreatFox (abuse.ch) ───
export interface ThreatFoxIOC {
    id: string;
    ioc: string;
    threat_type: string;    // "botnet_cc", "payload_delivery", etc.
    ioc_type: string;       // "ip:port", "domain", "url", "md5_hash", etc.
    malware: string;        // "win.emotet", "win.cobalt_strike", etc.
    malware_printable: string;
    malware_alias: string | null;
    malware_malpedia: string | null;
    confidence_level: number; // 0-100
    first_seen: string;
    last_seen: string | null;
    reporter: string;
    reference: string | null;
    tags: string[] | null;
}

export interface ThreatFoxResult {
    query_status: string;  // "ok", "no_result", etc.
    data: ThreatFoxIOC[] | null;
}

// ─── AbuseIPDB ───
export interface AbuseIPDBResult {
    ipAddress: string;
    isPublic: boolean;
    abuseConfidenceScore: number; // 0-100
    countryCode: string;
    usageType: string;
    isp: string;
    domain: string;
    totalReports: number;
    numDistinctUsers: number;
    lastReportedAt: string | null;
    isWhitelisted: boolean;
}

// ─── crt.sh (Certificate Transparency) ───
export interface CrtShEntry {
    id: number;
    issuer_ca_id: number;
    issuer_name: string;
    common_name: string;
    name_value: string;
    not_before: string;
    not_after: string;
    serial_number: string;
    result_count: number;
}

// ─── CISA KEV (Known Exploited Vulnerabilities) ───
export interface CISAKEVEntry {
    cveID: string;
    vendorProject: string;
    product: string;
    vulnerabilityName: string;
    dateAdded: string;
    shortDescription: string;
    requiredAction: string;
    dueDate: string;
    knownRansomwareCampaignUse: "Known" | "Unknown";
}

export interface CISAKEVCatalog {
    title: string;
    catalogVersion: string;
    dateReleased: string;
    count: number;
    vulnerabilities: CISAKEVEntry[];
}

// ─── FIRST EPSS ───
export interface EPSSScore {
    cve: string;
    epss: number;      // 0-1 probability
    percentile: number; // 0-1
    date: string;
}

export interface EPSSResult {
    scores: EPSSScore[];
}

// ─── Noise Classification (engine output) ───
export type NoiseCategory =
    | "BENIGN_SCANNER"
    | "MASS_SCANNER"
    | "NOISE"
    | "TARGETED_SCAN"
    | "ACTIVE_EXPLOITATION"
    | "C2_INFRASTRUCTURE"
    | "UNKNOWN";

export interface NoiseClassification {
    category: NoiseCategory;
    confidence: number;  // 0-100
    reasoning: string;
    sources: string[];
    recommendedAction: "dismiss" | "low_priority" | "investigate" | "respond" | "block";
    greynoiseRaw?: GreyNoiseResult;
}

// ─── Multi-Source Confidence (engine output) ───
export type ConfidenceLevel = "confirmed" | "high" | "moderate" | "low" | "unverified";

export interface SourceEvidence {
    source: string;
    tier: 1 | 2 | 3;
    verdict: "malicious" | "suspicious" | "clean" | "unknown";
    freshness: "live" | "recent" | "stale" | "outdated";
    lastSeen?: string;
}

export interface ConfidenceAssessment {
    level: ConfidenceLevel;
    score: number;   // 0-100
    sourceCount: number;
    agreeing: number;
    disagreeing: number;
    evidence: SourceEvidence[];
    freshestData: string;
    explanation: string;
}

// ─── Infrastructure Cluster (engine output) ───
export interface ClusterSignal {
    type: "shared_subnet" | "shared_nameserver" | "shared_cert" | "port_fingerprint" | "naming_pattern" | "asn_density";
    detail: string;
    strength: "strong" | "moderate" | "weak";
    relatedIOCs: string[];
}

export interface InfraCluster {
    clusterSize: number;
    signals: ClusterSignal[];
    relatedDomains: string[];
    relatedIPs: string[];
    sharedCerts: string[];
    sharedNameservers: string[];
    footprintScale: "individual" | "small_group" | "campaign" | "large_operation";
    confidence: number;
}

// ─── Threat Actor / Campaign Context (engine output) ───
export interface ThreatActorInfo {
    name: string;
    aliases: string[];
    motivation: string;
    targetedIndustries: string[];
    targetedRegions: string[];
    knownMalware: string[];
    description: string;
}

export interface CampaignInfo {
    name: string;
    actor: string;
    malwareFamily: string;
    firstSeen: string;
    objective: string;
    description: string;
}

export interface ThreatContext {
    actors: ThreatActorInfo[];
    campaigns: CampaignInfo[];
    killChainStage: string;
    riskNarrative: string;
    relatedFamilies: string[];
}

// ─── Timeline (engine output) ───
export interface TimelineEvent {
    date: string;
    source: string;
    event: string;
    type: "first_seen" | "last_seen" | "feed_appearance" | "service_change" | "campaign" | "report";
}

// ─── Unified Scan State ───
export type ScanStep =
    | "idle"
    | "resolving"
    | "virustotal"
    | "portscan"
    | "geolookup"
    | "urlhaus"
    | "threatminer"
    | "malwarebazaar"
    | "cve"
    | "feodo"
    | "greynoise"
    | "threatfox"
    | "abuseipdb"
    | "crtsh"
    | "cisakev"
    | "epss"
    | "scoring"
    | "complete"
    | "error";

export interface ScanEvent {
    id: string;
    step: ScanStep;
    label: string;
    status: "pending" | "running" | "success" | "warning" | "error";
    detail?: string;
    timestamp: number;
}

export interface ScanState {
    query: string;
    type: "ip" | "domain" | "url" | "hash";
    resolvedIP?: string;
    currentStep: ScanStep;
    events: ScanEvent[];
    results: {
        vt?: VTResult;
        shodan?: ShodanResult;
        geo?: GeoIPResult;
        dns?: DNSResult;
        urlhaus?: URLhausResult;
        threatMiner?: ThreatMinerData;
        malwareBazaar?: MalwareBazaarResult;
        cveDetails?: CVESearchResult;
        feodo?: FeodoResult;
        compositeScore?: CompositeScore;
        mitre?: MitreMapping;
        // ── New sources ──
        greynoise?: GreyNoiseResult;
        threatfox?: ThreatFoxResult;
        abuseipdb?: AbuseIPDBResult;
        crtsh?: CrtShEntry[];
        cisakev?: CISAKEVEntry[];
        epss?: EPSSResult;
        // ── Engine outputs ──
        noiseClassification?: NoiseClassification;
        confidence?: ConfidenceAssessment;
        infraCluster?: InfraCluster;
        threatContext?: ThreatContext;
        timeline?: TimelineEvent[];
    };
}

