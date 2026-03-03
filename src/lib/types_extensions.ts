
import {
    ScanState, ScanEvent, VTResult, ShodanResult, GeoIPResult,
    DNSResult, URLhausResult, ThreatMinerData, MalwareBazaarResult,
    CVESearchResult, FeodoResult, CompositeScore, MitreMapping,
    GreyNoiseResult, ThreatFoxResult, AbuseIPDBResult, CrtShEntry,
    CISAKEVEntry, EPSSResult, NoiseClassification, ConfidenceAssessment,
    InfraCluster, ThreatContext, TimelineEvent
} from "./types";

export interface ScanHistoryRecord {
    id: string;
    created_at: string;
    target: string;
    scan_type: "ip" | "domain" | "url" | "hash";
    risk_score?: number;
    risk_level?: string;
    scan_data: ScanState["results"];
    ai_analysis?: any;
}

export interface Watchlist {
    id: string;
    created_at: string;
    target: string;
    type: "ip" | "domain" | "hash";
    notes?: string;
    status: "active" | "archived";
    last_checked?: string;
    tags?: string[];
}

export interface GraphNode {
    id: string;
    label: string;
    type: "ip" | "domain" | "hash" | "url" | "email" | "asn" | "malware" | "actor";
    risk?: "safe" | "low" | "medium" | "high" | "critical";
    val?: number; // size
    color?: string;
    data?: any;
}

export interface GraphLink {
    source: string;
    target: string;
    label?: string;
    type?: "resolves_to" | "communicates_with" | "hosted_on" | "related_to" | "delivered_by";
    color?: string;
}

export interface ThreatGraphData {
    nodes: GraphNode[];
    links: GraphLink[];
}
