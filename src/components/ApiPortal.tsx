import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
    Search, Activity, ShieldAlert, Crosshair, Database, Server, Info, RefreshCw,
    LayoutGrid, Terminal, Target, AlertTriangle, Globe, Lock, Cpu, DollarSign, Fingerprint,
    ChevronDown, ChevronRight, AlertCircle, Hexagon
} from "lucide-react";
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarTrigger } from "@/components/ui/menubar";
import ShadowspotDashboard from "./ShadowspotDashboard";
import DarkflashDashboard from "./DarkflashDashboard";
import BrandsafeDashboard from "./BrandsafeDashboard";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Legend } from "recharts";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// --- API FETCHERS ---
// The /api/cyberx proxy requires the Supabase session Token.
const getAuthHeader = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
        'Authorization': session?.access_token ? `Bearer ${session.access_token}` : ''
    };
};

const fetchDarkflash = async () => {
    const headers = await getAuthHeader();
    const res = await fetch('/api/cyberx/incidents/api/v1/darkflash/incidents', { headers });
    if (!res.ok) throw new Error("Failed to fetch Darkflash");
    return res.json();
};

const fetchBrandsafe = async () => {
    const headers = await getAuthHeader();
    const res = await fetch('/api/cyberx/incidents/api/v1/brandsafe/incidents', { headers });
    if (!res.ok) throw new Error("Failed to fetch Brandsafe");
    return res.json();
};

const fetchShadowspot = async () => {
    const headers = await getAuthHeader();
    const res = await fetch('/api/cyberx/incidents/api/v1/shadowspot/findings', { headers });
    if (!res.ok) throw new Error("Failed to fetch Shadowspot");
    return res.json();
};

const fetchThreatBoltEnrichment = async (ioc: string) => {
    const headers = await getAuthHeader();
    const res = await fetch(`/api/cyberx/threatbolt/api/v1/ioc/enrichment-summary?ioc=${encodeURIComponent(ioc)}`, { headers });
    if (!res.ok) throw new Error("Failed to fetch Enrichment");
    return res.json();
};

const fetchThreatBoltFeed = async (type: string) => {
    const headers = await getAuthHeader();
    // Using dummy JSON response as requested by user
    return {
        "data": [
            {
                "ioc_summary": {
                    "type": "ip",
                    "value": "185.220.101.1",
                    "location": "",
                    "recent_reference_time": "Feb 27, 2026"
                },
                "xtron_threat_intel": {
                    "name": "Log4j",
                    "category": "Attack Method",
                    "risk_score": 60,
                    "risk_level": "Medium",
                    "capability": {
                        "threat_capability": [
                            "Exploit Apache log4j vulnerability"
                        ],
                        "mitre_ttps": []
                    },
                    "intent": {
                        "intent": [
                            "Malicious"
                        ]
                    },
                    "impact": {
                        "confidentiality_impact": [
                            "Data Stealing",
                            "Credential Theft"
                        ],
                        "integrity_impact": [
                            "File Modification"
                        ],
                        "availability_impact": []
                    }
                },
                "third_party_threat_intel": {
                    "virustotal": {
                        "malicious": 10,
                        "suspicious": 20,
                        "harmless": 50,
                        "undetected": 10
                    },
                    "otx": {
                        "malicious": 8,
                        "suspicious": 15,
                        "harmless": 40,
                        "undetected": 12
                    },
                    "abuse_ch": {
                        "malicious": 5,
                        "suspicious": 10,
                        "harmless": 60,
                        "undetected": 5
                    },
                    "xforce": {
                        "malicious": 12,
                        "suspicious": 18,
                        "harmless": 45,
                        "undetected": 15
                    }
                }
            }
        ]
    };
};

const SeverityBadge = ({ severity }: { severity: string }) => {
    const sev = severity?.toLowerCase() || 'medium';
    if (sev === 'critical') return <span className="px-2 py-1 bg-red-500/10 text-red-500 border border-red-500/20 rounded font-mono text-[10px] uppercase font-bold tracking-wider">Critical</span>;
    if (sev === 'high') return <span className="px-2 py-1 bg-orange-500/10 text-orange-500 border border-orange-500/20 rounded font-mono text-[10px] uppercase font-bold tracking-wider">High</span>;
    if (sev === 'medium') return <span className="px-2 py-1 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded font-mono text-[10px] uppercase font-bold tracking-wider">Medium</span>;
    return <span className="px-2 py-1 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded font-mono text-[10px] uppercase font-bold tracking-wider">Low</span>;
};

const IncidentTable = ({ title, fetcher, queryKey }: { title: string, fetcher: () => Promise<any>, queryKey: string }) => {
    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: [queryKey],
        queryFn: fetcher,
    });
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

    const incidents = data?.data || [];

    const toggleRow = (id: string) => {
        setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const renderDetailField = (label: string, value: any) => {
        if (!value || value === "") return null;
        return (
            <div className="mb-4">
                <div className="text-cyan-400 text-[10px] font-bold uppercase tracking-wider mb-1">{label}</div>
                <div className="text-gray-300 text-xs font-sans whitespace-pre-wrap leading-relaxed">{value}</div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-[#0a0a0f] p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <ShieldAlert className="w-5 h-5 text-cyan-400" />
                    <h2 className="text-xl font-bold font-mono text-white tracking-widest uppercase">{title}</h2>
                    <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded-md text-xs font-mono text-gray-400">
                        {incidents.length} Records
                    </span>
                </div>
                <button onClick={() => refetch()} className="flex items-center gap-2 px-3 py-1.5 bg-cyan-900/30 border border-cyan-500/30 text-cyan-400 text-xs font-mono uppercase rounded hover:bg-cyan-500/20 transition-all">
                    <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''} `} /> Refresh
                </button>
            </div>

            <div className="flex-1 overflow-auto border border-white/10 rounded-lg bg-black/50">
                {isLoading ? (
                    <div className="flex items-center justify-center p-12 text-cyan-400 font-mono text-sm animate-pulse">
                        <Activity className="w-4 h-4 mr-2" /> Loading records...
                    </div>
                ) : isError ? (
                    <div className="flex items-center justify-center p-12 text-red-400 font-mono text-sm">
                        <AlertCircle className="w-4 h-4 mr-2" /> Error loading data. API might be unreachable.
                    </div>
                ) : incidents.length === 0 ? (
                    <div className="flex items-center justify-center p-12 text-gray-500 font-mono text-sm">
                        No records found.
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse font-mono text-sm table-fixed">
                        <thead className="sticky top-0 bg-[#13141c] z-10 border-b border-white/10">
                            <tr>
                                <th className="p-4 w-10"></th>
                                <th className="p-4 text-xs font-bold text-gray-400 uppercase w-1/3">Key / Title</th>
                                <th className="p-4 text-xs font-bold text-gray-400 uppercase w-1/6">Type</th>
                                <th className="p-4 text-xs font-bold text-gray-400 uppercase w-32">Severity</th>
                                <th className="p-4 text-xs font-bold text-gray-400 uppercase w-48">Status</th>
                                <th className="p-4 text-xs font-bold text-gray-400 uppercase text-right w-40">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {incidents.map((inc: any) => {
                                const uid = inc.id || inc.ticket_key || inc.taskKey || Math.random().toString();
                                const isExpanded = expandedRows[uid];
                                const tKey = inc.ticket_key || inc.taskKey;
                                const dateVal = inc.created_at ? inc.created_at * 1000 : (inc.createdDt ? inc.createdDt * 1000 : null);
                                const statusVal = inc.status_label || inc.status_description || inc.status;
                                const typeVal = inc.type || inc.taskType_name || inc.category_name || "N/A";
                                const sevVal = inc.severity || inc.severity_label;

                                return (
                                    <React.Fragment key={uid}>
                                        <tr onClick={() => toggleRow(uid)} className="hover:bg-white/5 transition-colors group cursor-pointer">
                                            <td className="p-4 text-center">
                                                {isExpanded ? <ChevronDown className="w-4 h-4 text-cyan-400" /> : <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-cyan-400" />}
                                            </td>
                                            <td className="p-4">
                                                <div className="text-cyan-400 font-bold mb-1">{tKey}</div>
                                                <div className="text-gray-300 text-xs truncate max-w-sm">{inc.title}</div>
                                            </td>
                                            <td className="p-4 text-gray-400 text-xs">{typeVal}</td>
                                            <td className="p-4"><SeverityBadge severity={sevVal} /></td>
                                            <td className="p-4 text-xs text-gray-300 border-l border-white/5">
                                                <span className="flex items-center gap-1.5">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${statusVal?.includes("Pending") ? "bg-yellow-500" : "bg-emerald-500"} `} />
                                                    {statusVal}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right text-xs text-gray-500 shrink-0">
                                                {dateVal ? format(new Date(dateVal), "dd MMM yyyy, HH:mm") : "N/A"}
                                                {inc.updatedDt && (
                                                    <div className="text-[9px] text-gray-600 mt-1">
                                                        Upd: {format(new Date(inc.updatedDt * 1000), "dd MMM, HH:mm")}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr className="bg-cyan-900/5">
                                                <td colSpan={6} className="p-0 border-t border-cyan-500/10">
                                                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-top-2 duration-300">
                                                        <div>
                                                            {renderDetailField("Description", inc.description)}
                                                            {renderDetailField("Impact", inc.impact)}
                                                            {renderDetailField("Recommendation / Remediation", inc.recommendation || inc.remediation)}
                                                        </div>
                                                        <div className="bg-black/40 p-4 rounded border border-white/5 h-fit">
                                                            <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-2 text-cyan-400 text-xs font-mono uppercase font-bold">
                                                                <Info className="w-4 h-4" /> Technical Indicators
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-xs font-mono">
                                                                {inc.keyword && <div><div className="text-gray-500 mb-1">Keyword</div><div className="text-gray-300">{inc.keyword}</div></div>}
                                                                {(inc.source || inc.publisher_source) && <div><div className="text-gray-500 mb-1">Source</div><div className="text-gray-300">{inc.source || inc.publisher_source}</div></div>}
                                                                {inc.brand_domain && <div><div className="text-gray-500 mb-1">Brand Domain</div><div className="text-purple-400">{inc.brand_domain}</div></div>}
                                                                {inc.platform && <div><div className="text-gray-500 mb-1">Platform</div><div className="text-gray-300">{inc.platform}</div></div>}
                                                                {inc.ip_address && <div><div className="text-gray-500 mb-1">IP Address</div><div className="text-red-400">{inc.ip_address}</div></div>}
                                                                {inc.cvss && <div><div className="text-gray-500 mb-1">CVSS</div><div className="text-red-400">{inc.cvss}</div></div>}
                                                                {inc.epss && <div><div className="text-gray-500 mb-1">EPSS Score</div><div className="text-orange-400">{inc.epss}</div></div>}
                                                                {inc.assets && <div className="col-span-2"><div className="text-gray-500 mb-1">Assets Affected</div><div className="text-gray-300">{inc.assets}</div></div>}
                                                            </div>
                                                            {(inc.raw_data || inc.retrieved_data) && (
                                                                <div className="mt-4">
                                                                    <div className="text-gray-500 text-[10px] uppercase font-bold mb-1 tracking-widest">Retrieved Raw Data</div>
                                                                    <pre className="bg-[#050608] p-3 rounded border border-white/5 text-gray-400 text-[10px] whitespace-pre-wrap font-mono break-all max-h-40 overflow-y-auto">
                                                                        {inc.raw_data || inc.retrieved_data}
                                                                    </pre>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

const IocEnrichmentSearch = () => {
    const [searchIoc, setSearchIoc] = useState("");
    const [activeIoc, setActiveIoc] = useState("185.220.101.1"); // Default mock data shown 

    const { data: enrichmentData, isLoading: enrichmentLoading, error: enrichmentError } = useQuery({
        queryKey: ['threatbolt-enrichment', activeIoc],
        queryFn: () => fetchThreatBoltEnrichment(activeIoc),
        enabled: !!activeIoc,
        retry: false
    });

    return (
        <div className="flex flex-col h-full bg-[#0a0a0f] p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Search className="w-5 h-5 text-purple-400" />
                    <h2 className="text-xl font-bold font-mono text-white tracking-widest uppercase">IOC Enrichment Analysis</h2>
                </div>
            </div>

            <div className="mb-6 flex gap-2">
                <input
                    type="text"
                    value={searchIoc}
                    onChange={(e) => setSearchIoc(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchIoc && setActiveIoc(searchIoc)}
                    placeholder="Enter IP, Hash, URL, or Domain for deep analysis..."
                    className="flex-1 bg-black/50 border border-white/10 rounded-lg px-4 py-2 font-mono text-sm text-white focus:outline-none focus:border-purple-500/50"
                />
                <button
                    onClick={() => searchIoc && setActiveIoc(searchIoc)}
                    className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-lg font-mono text-sm font-bold uppercase transition-colors"
                >
                    Analyze
                </button>
            </div>

            <div className="flex-1 overflow-auto border border-white/10 rounded-lg bg-black/50 relative">
                {/* ENRICHMENT RESULTS PANEL */}
                {activeIoc ? (
                    <div className="p-4 bg-purple-900/10 min-h-full">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-purple-500/20">
                            <div className="flex items-center gap-2 text-purple-400 font-mono text-sm uppercase">
                                <Search className="w-4 h-4" /> IOC Enrichment Result: <span className="text-white bg-black/50 px-2 py-0.5 rounded ml-2">{activeIoc}</span>
                            </div>
                        </div>

                        {enrichmentLoading ? (
                            <div className="flex items-center justify-center p-6 text-purple-400 font-mono text-sm animate-pulse">
                                <Activity className="w-4 h-4 mr-2" /> Analyzing IOC against CyberXTron Intelligence...
                            </div>
                        ) : enrichmentError ? (
                            <div className="flex flex-col items-center justify-center p-6 text-red-400 font-mono text-xs bg-red-900/10 border border-red-500/20 rounded">
                                <ShieldAlert className="w-6 h-6 mb-2 text-red-500" />
                                <div className="font-bold uppercase tracking-widest mb-1">Intelligence Access Denied</div>
                                <div className="max-w-xl text-center break-words opacity-80">{(enrichmentError as Error).message}</div>
                            </div>
                        ) : enrichmentData?.success && enrichmentData?.data ? (
                            <div className="flex flex-col gap-6 font-mono">
                                {/* --- HEADER ROW: IOC & RISK --- */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {/* IOC Card */}
                                    <div className="col-span-1 md:col-span-2 bg-[#0d0e15] border border-purple-500/30 rounded-lg p-5 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl group-hover:bg-purple-500/20 transition-all duration-500" />
                                        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-purple-400 to-transparent" />

                                        <div className="flex items-start justify-between relative z-10">
                                            <div>
                                                <div className="text-purple-400 font-bold uppercase tracking-widest text-xs mb-1 flex items-center gap-2">
                                                    <Fingerprint className="w-4 h-4" /> Analyzed Indicator
                                                </div>
                                                <div className="text-3xl font-black text-white tracking-wider mb-2 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] break-all">
                                                    {enrichmentData.data.ioc_summary?.value || '-'}
                                                </div>
                                                <div className="flex flex-wrap gap-3 text-xs">
                                                    <div className="bg-black/40 px-3 py-1 rounded border border-white/5 text-gray-400">
                                                        Type: <span className="text-white uppercase">{enrichmentData.data.ioc_summary?.type || '-'}</span>
                                                    </div>
                                                    <div className="bg-black/40 px-3 py-1 rounded border border-white/5 text-gray-400">
                                                        Last Seen: <span className="text-white">{enrichmentData.data.ioc_summary?.recent_reference_time || '-'}</span>
                                                    </div>
                                                    <div className={`px-3 py-1 rounded border ${enrichmentData.data.is_whitelisted ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-black/40 border-white/5 text-gray-500'} `}>
                                                        Whitelisted: {enrichmentData.data.is_whitelisted ? 'YES' : 'NO'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Risk Score Card */}
                                    <div className="bg-[#150e10] border border-red-500/30 rounded-lg p-5 relative overflow-hidden group flex flex-col justify-center items-center text-center">
                                        <div className="absolute inset-0 bg-red-500/5 group-hover:bg-red-500/10 transition-colors" />
                                        <AlertTriangle className="absolute -bottom-4 -right-4 w-32 h-32 text-red-500/5 rotate-12" />

                                        <div className="text-red-400 font-bold uppercase tracking-widest text-[10px] mb-2 relative z-10">XTron Threat Risk</div>

                                        <div className="relative z-10 flex items-end justify-center gap-1 mb-1">
                                            <span className="text-5xl font-black text-white drop-shadow-[0_0_15px_rgba(255,0,0,0.6)]">
                                                {enrichmentData.data.xtron_threat_intel?.risk_score || 0}
                                            </span>
                                            <span className="text-red-500/50 font-bold mb-1">/100</span>
                                        </div>

                                        <div className="relative z-10">
                                            <span className={`px-4 py-1 rounded-full text-xs font-bold tracking-widest border shadow-[0_0_10px_rgba(0, 0, 0, 0.5)] ${enrichmentData.data.xtron_threat_intel?.risk_level === 'Critical' ? 'bg-red-500/20 text-red-400 border-red-500/50' : enrichmentData.data.xtron_threat_intel?.risk_level === 'High' ? 'bg-orange-500/20 text-orange-400 border-orange-500/50' : enrichmentData.data.xtron_threat_intel?.risk_level === 'Medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' : 'bg-blue-500/20 text-blue-400 border-blue-500/50'} `}>
                                                {enrichmentData.data.xtron_threat_intel?.risk_level || 'UNKNOWN'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* --- THREAT INTEL DETAILS --- */}
                                {enrichmentData.data.xtron_threat_intel ? (
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                                        {/* Left Column: Context & Summary */}
                                        <div className="lg:col-span-2 flex flex-col gap-6">
                                            <div className="bg-[#0d0e15] border border-white/10 rounded-lg p-5">
                                                <div className="flex items-center gap-3 border-b border-white/5 pb-4 mb-4">
                                                    <div className="p-2 bg-red-500/20 rounded-md border border-red-500/30 text-red-400">
                                                        <Terminal className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-lg font-bold text-white tracking-widest uppercase">{enrichmentData.data.xtron_threat_intel.name || 'Unknown Intel'}</h3>
                                                        <div className="text-red-400 text-xs tracking-wider uppercase">{enrichmentData.data.xtron_threat_intel.category || 'Uncategorized'}</div>
                                                    </div>
                                                </div>

                                                {enrichmentData.data.xtron_threat_intel.summary && (
                                                    <div className="prose prose-invert prose-p:text-gray-300 prose-p:text-xs prose-p:leading-relaxed prose-headings:text-white prose-headings:font-mono prose-headings:uppercase prose-strong:text-cyan-400 max-w-none text-sm font-sans" dangerouslySetInnerHTML={{ __html: enrichmentData.data.xtron_threat_intel.summary.replace(/\n\n/g, '<br/><br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/### (.*?)<br\/>/g, '<h4 class="text-cyan-400 mt-4 mb-2 font-bold bg-cyan-900/20 inline-block px-2 py-1">$1</h4>') }} />
                                                )}
                                            </div>
                                        </div>

                                        {/* Right Column: Vectors, Impact, Targets */}
                                        <div className="flex flex-col gap-4">

                                            {/* Capabilities */}
                                            {enrichmentData.data.xtron_threat_intel.capability?.threat_capability?.length > 0 && (
                                                <div className="bg-[#0f0a0c] border border-orange-500/20 rounded-lg p-4">
                                                    <div className="text-orange-400 text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                                                        <Cpu className="w-3.5 h-3.5" /> Known Capabilities
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        {enrichmentData.data.xtron_threat_intel.capability.threat_capability.map((cap: string, i: number) => (
                                                            <div key={i} className="flex items-start gap-2 bg-black/40 p-2 rounded border border-white/5 text-xs text-gray-300">
                                                                <div className="mt-1 w-1.5 h-1.5 bg-orange-500 rounded-full shrink-0 shadow-[0_0_5px_#f97316]" />
                                                                {cap}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Business Impact */}
                                            <div className="bg-[#0a0f12] border border-cyan-500/20 rounded-lg p-4">
                                                <div className="text-cyan-400 text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                                                    <Target className="w-3.5 h-3.5" /> Potential Impact Vectors
                                                </div>

                                                <div className="space-y-4">
                                                    {enrichmentData.data.xtron_threat_intel.impact?.confidentiality_impact?.length > 0 && (
                                                        <div>
                                                            <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Lock className="w-3 h-3 text-cyan-500/70" /> Confidentiality</div>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {enrichmentData.data.xtron_threat_intel.impact.confidentiality_impact.map((imp: string, i: number) => (
                                                                    <span key={i} className="bg-cyan-900/20 text-cyan-300 px-2 py-1 rounded text-[10px] border border-cyan-500/30 hover:bg-cyan-900/40 transition-colors cursor-default">{imp}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {enrichmentData.data.xtron_threat_intel.impact?.availability_impact?.length > 0 && (
                                                        <div>
                                                            <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Server className="w-3 h-3 text-purple-500/70" /> Availability</div>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {enrichmentData.data.xtron_threat_intel.impact.availability_impact.map((imp: string, i: number) => (
                                                                    <span key={i} className="bg-purple-900/20 text-purple-300 px-2 py-1 rounded text-[10px] border border-purple-500/30 hover:bg-purple-900/40 transition-colors cursor-default">{imp}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Targets */}
                                            {enrichmentData.data.xtron_threat_intel.target?.target_country?.length > 0 && (
                                                <div className="bg-black/60 border border-white/10 rounded-lg p-4">
                                                    <div className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                                                        <Globe className="w-3.5 h-3.5" /> Target Geography
                                                    </div>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {enrichmentData.data.xtron_threat_intel.target.target_country.map((country: string, i: number) => (
                                                            <span key={i} className="bg-white/5 text-gray-300 px-2 py-1 rounded text-[10px] border border-white/10">{country}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-black/40 p-12 rounded border border-white/5 flex flex-col items-center justify-center text-gray-500">
                                        <Fingerprint className="w-8 h-8 opacity-20 mb-3" />
                                        <span className="uppercase tracking-widest font-bold text-xs">No Threat Profile</span>
                                        <span className="text-[10px] mt-1 opacity-70">Intelligence database returned empty for this indicator's profile.</span>
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-black/30">
                        <Crosshair className="w-12 h-12 text-gray-600 mb-4 opacity-50" />
                        <div className="text-gray-400 font-bold uppercase tracking-widest mb-2">Awaiting Target Selection</div>
                        <div className="text-gray-500 text-sm max-w-md">Enter an Indicator of Compromise (IOC) above to initiate a deep enrichment scan against the CyberXTron global threat intelligence database.</div>
                    </div>
                )}
            </div>
        </div>
    );
};

const ThreatBoltFeed = ({ type }: { type: 'ip' | 'hash' | 'url' | 'domain' }) => {
    const { data: feedData, isLoading: feedLoading, error: feedError, refetch } = useQuery({
        queryKey: ['threatbolt', type],
        queryFn: () => fetchThreatBoltFeed(type),
    });

    // Handle string API errors visually as JSON if parsing fails
    const feedResponse = feedData?.data;
    const isWafBlock = feedError?.message?.includes("Access Denied") || feedError?.message?.includes("Forbidden");

    return (
        <div className="flex flex-col h-full bg-[#0a0a0f] p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Database className="w-5 h-5 text-purple-400" />
                    <h2 className="text-xl font-bold font-mono text-white tracking-widest uppercase">
                        Malicious {type.toUpperCase()} Feed
                    </h2>
                </div>
                <button onClick={() => refetch()} className="flex items-center gap-2 px-3 py-1.5 bg-purple-900/30 border border-purple-500/30 text-purple-400 text-xs font-mono uppercase rounded hover:bg-purple-500/20 transition-all">
                    <RefreshCw className={`w-3 h-3 ${feedLoading ? 'animate-spin' : ''} `} /> Refresh
                </button>
            </div>

            <div className="flex-1 overflow-auto border border-white/10 rounded-lg bg-black/50 relative">
                {feedLoading ? (
                    <div className="flex flex-col items-center justify-center h-full text-purple-400 font-mono text-sm animate-pulse">
                        <Activity className="w-8 h-8 mb-4 opacity-50" />
                        Syncing Intelligence Feed...
                    </div>
                ) : feedError ? (
                    <div className="flex flex-col items-center justify-center h-full p-6 text-red-400 font-mono text-xs bg-red-900/10 border border-red-500/20">
                        <ShieldAlert className="w-8 h-8 mb-3 text-red-500" />
                        <div className="font-bold uppercase tracking-widest mb-2 text-sm">{isWafBlock ? "WAF Block Detected" : "Data Retrieval Failed"}</div>
                        <div className="max-w-xl text-center break-words opacity-80 whitespace-pre-wrap bg-black/50 p-4 rounded border border-red-500/30">
                            {(feedError as Error).message}
                        </div>
                    </div>
                ) : !feedResponse || feedResponse.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full p-12 text-gray-500 font-mono text-sm">
                        <Database className="w-8 h-8 mb-3 opacity-20" />
                        No feeds available for this type.
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse font-mono text-sm">
                        <thead className="sticky top-0 bg-[#13141c] z-10 border-b border-white/10">
                            <tr>
                                <th className="p-4 text-xs font-bold text-gray-400 uppercase">Indicator (IOC)</th>
                                <th className="p-4 text-xs font-bold text-gray-400 uppercase">Tags / Description</th>
                                <th className="p-4 text-xs font-bold text-gray-400 uppercase">Severity</th>
                                <th className="p-4 text-xs font-bold text-gray-400 uppercase text-right">Detected</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {feedResponse.map((ioc: any, i: number) => (
                                <tr key={i} className="hover:bg-white/5 transition-colors">
                                    <td className="p-4 font-bold text-purple-400 break-all">{ioc.ioc_summary?.value || ioc.ioc || ioc.value || ioc.indicator || "Unknown IOC"}</td>
                                    <td className="p-4 text-xs text-gray-400">
                                        <div className="font-bold text-gray-300">{ioc.xtron_threat_intel?.name || ioc.description || ioc.campaign || "—"}</div>
                                        <div className="text-gray-500 mt-1">{ioc.xtron_threat_intel?.capability?.threat_capability?.[0] || ioc.tags?.join(", ") || ""}</div>
                                    </td>
                                    <td className="p-4"><SeverityBadge severity={ioc.xtron_threat_intel?.risk_level || ioc.severity || "high"} /></td>
                                    <td className="p-4 text-right text-xs text-gray-500 whitespace-nowrap">
                                        {ioc.ioc_summary?.recent_reference_time || (ioc.date || ioc.timestamp ? format(new Date(ioc.date || ioc.timestamp), "dd MMM yyyy, HH:mm") : "Recent")}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

const DashboardSummary = () => {
    // Fetch data from the 3 modules for the dashboard aggregation
    const { data: darkflashData, isLoading: isDLoading } = useQuery({ queryKey: ['darkflash_dash'], queryFn: fetchDarkflash, retry: false });
    const { data: shadowspotData, isLoading: isSLoading } = useQuery({ queryKey: ['shadowspot_dash'], queryFn: fetchShadowspot, retry: false });
    const { data: brandsafeData, isLoading: isBLoading } = useQuery({ queryKey: ['brandsafe_dash'], queryFn: fetchBrandsafe, retry: false });

    const isLoading = isDLoading || isSLoading || isBLoading;

    const stats = {
        darkflash: darkflashData?.data?.length || 0,
        shadowspot: shadowspotData?.data?.length || 0,
        brandsafe: brandsafeData?.data?.length || 0,
    };
    const totalThreats = stats.darkflash + stats.shadowspot + stats.brandsafe;

    // Aggregate Severity data for BarChart
    const severityCount = { Critical: 0, High: 0, Medium: 0, Low: 0 };

    const countSeverity = (items: any[]) => {
        if (!items) return;
        items.forEach(i => {
            const sev = (i.severity || i.severity_label || "Low").toString().toLowerCase();
            if (sev.includes("critical")) severityCount.Critical++;
            else if (sev.includes("high")) severityCount.High++;
            else if (sev.includes("medium")) severityCount.Medium++;
            else severityCount.Low++;
        });
    };

    countSeverity(darkflashData?.data);
    countSeverity(shadowspotData?.data);
    countSeverity(brandsafeData?.data);

    const severityChartData = [
        { name: 'Critical', value: severityCount.Critical, fill: '#ef4444' }, // Red
        { name: 'High', value: severityCount.High, fill: '#f97316' },     // Orange
        { name: 'Medium', value: severityCount.Medium, fill: '#facc15' },   // Yellow
        { name: 'Low', value: severityCount.Low, fill: '#22c55e' },      // Green
    ];

    const moduleChartData = [
        { name: 'Darkflash', value: stats.darkflash, fill: '#ef4444' },
        { name: 'Shadowspot', value: stats.shadowspot, fill: '#06b6d4' },
        { name: 'Brandsafe', value: stats.brandsafe, fill: '#a855f7' },
    ];

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center w-full h-full p-8 animate-in fade-in duration-500">
                <div className="relative w-16 h-16 mb-6">
                    <svg className="absolute inset-0 w-full h-full text-cyan-500/20 animate-[spin_4s_linear_infinite]" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 8" />
                        <circle cx="50" cy="50" r="35" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 4" />
                    </svg>
                    <svg className="absolute inset-0 w-full h-full text-cyan-400 animate-[spin_3s_linear_infinite_reverse]" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="70 200" strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-ping"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col w-full h-full p-8 animate-in fade-in duration-500 overflow-y-auto">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center border border-cyan-500/30 bg-cyan-500/10">
                        <Hexagon className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold font-mono text-white tracking-wide mb-1">Overview</h1>
                        <p className="text-xs font-mono text-gray-400">Threat Intelligence Summary</p>
                    </div>
                </div>
            </div>

            {/* TOP METRICS ROW */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="card-panel p-5 group">
                    <div className="text-xs text-gray-400 font-mono uppercase font-bold mb-2 flex items-center gap-2 tracking-widest">
                        <AlertTriangle className="w-4 h-4 text-cyan-500" /> Total Threats
                    </div>
                    <div className="text-4xl font-black text-white font-mono">{totalThreats}</div>
                </div>
                <div className="card-panel p-5 group">
                    <div className="text-xs text-gray-400 font-mono uppercase font-bold mb-2 flex items-center gap-2 tracking-widest">
                        <ShieldAlert className="w-4 h-4 text-cyan-500" /> Darkflash
                    </div>
                    <div className="text-3xl font-bold text-white font-mono">{stats.darkflash} <span className="text-sm font-normal text-gray-500">Leaks</span></div>
                </div>
                <div className="card-panel p-5 group">
                    <div className="text-xs text-gray-400 font-mono uppercase font-bold mb-2 flex items-center gap-2 tracking-widest">
                        <Server className="w-4 h-4 text-cyan-500" /> Shadowspot
                    </div>
                    <div className="text-3xl font-bold text-white font-mono">{stats.shadowspot} <span className="text-sm font-normal text-gray-500">Vulns</span></div>
                </div>
                <div className="card-panel p-5 group">
                    <div className="text-xs text-gray-400 font-mono uppercase font-bold mb-2 flex items-center gap-2 tracking-widest">
                        <Search className="w-4 h-4 text-cyan-500" /> Brandsafe
                    </div>
                    <div className="text-3xl font-bold text-white font-mono">{stats.brandsafe} <span className="text-sm font-normal text-gray-500">Mentions</span></div>
                </div>
            </div>

            {/* CHARTS ROW */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[350px]">
                {/* DONUT CHART */}
                <div className="card-panel p-5 flex flex-col h-[350px]">
                    <div className="text-sm font-mono text-gray-400 font-bold mb-4 uppercase">Threat Distribution by Module</div>
                    {totalThreats === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-gray-500 font-mono text-xs">No active threats detected.</div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={moduleChartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {moduleChartData.map((entry, index) => (
                                        <Cell key={`cell-${index} `} fill={entry.fill} style={{ filter: `drop-shadow(0px 0px 8px ${entry.fill}60)` }} />
                                    ))}
                                </Pie>
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: 'rgba(5, 6, 8, 0.9)', borderColor: 'rgba(255,255,255,0.1)', color: '#fff', fontFamily: 'monospace', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontFamily: 'monospace', fontSize: '11px', color: '#9ca3af' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* BAR CHART */}
                <div className="card-panel p-5 flex flex-col h-[350px]">
                    <div className="text-sm font-mono text-gray-400 font-bold mb-4 uppercase tracking-wider">Global Severity Breakdown</div>
                    {totalThreats === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-gray-500 font-mono text-xs">No active threats detected.</div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={severityChartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                <XAxis dataKey="name" stroke="#4b5563" tick={{ fill: '#9ca3af', fontFamily: 'monospace', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis stroke="#4b5563" tick={{ fill: '#9ca3af', fontFamily: 'monospace', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <RechartsTooltip
                                    cursor={{ fill: 'rgba(0,240,255,0.05)' }}
                                    contentStyle={{ backgroundColor: 'rgba(5, 6, 8, 0.95)', borderColor: 'rgba(0,240,255,0.3)', color: '#fff', fontFamily: 'monospace', borderRadius: '8px', boxShadow: '0 0 15px rgba(0,240,255,0.1)' }}
                                />
                                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={60}>
                                    {severityChartData.map((entry, index) => (
                                        <Cell key={`cell-${index} `} fill={entry.fill} style={{ filter: `drop-shadow(0px 0px 8px ${entry.fill}40)` }} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>
        </div>
    );
};


// --- MAIN PORTAL COMPONENT ---
export default function ApiPortal() {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'shadowspot' | 'darkflash' | 'brandsafe' | 'threatbolt_enrichment' | 'threatbolt_ip' | 'threatbolt_hash' | 'threatbolt_url' | 'threatbolt_domain'>('dashboard');

    const isDrpActive = ['shadowspot', 'darkflash', 'brandsafe'].includes(activeTab);
    const isCtiActive = activeTab.startsWith('threatbolt_');

    return (
        <div className="w-full h-screen flex flex-col bg-[#13131A] overflow-hidden font-sans">
            {/* --- TOP MENU BAR --- */}
            <div className="w-full border-b border-white/10 bg-black/80 backdrop-blur-md px-6 py-2.5 flex items-center shadow-[0_4px_30px_rgba(0,0,0,0.5)] z-10 flex-shrink-0 relative">
                <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />



                <Menubar className="border-none bg-transparent gap-2">
                    <MenubarMenu>
                        <MenubarTrigger onClick={() => setActiveTab("dashboard")} className={`cursor-pointer font-mono text-xs font-bold uppercase tracking-wider transition-all outline-none rounded py-2 px-3 focus: bg-transparent flex items-center ${activeTab === 'dashboard' ? 'text-white bg-white/10 shadow-[0_0_15px_rgba(255,255,255,0.05)] border border-white/20 data-[state=open]:bg-white/10 data-[state=open]:text-white' : 'text-gray-500 hover:text-gray-200 hover:bg-white/5 data-[state=open]:bg-white/5 data-[state=open]:text-gray-200 border border-transparent'} `}>
                            <LayoutGrid className="w-3.5 h-3.5 mr-2" />
                            Dashboard
                        </MenubarTrigger>
                    </MenubarMenu>

                    <MenubarMenu>
                        <MenubarTrigger className={`cursor-pointer font-mono text-xs font-bold uppercase tracking-wider transition-all outline-none rounded py-2 px-3 focus: bg-transparent flex items-center ${isDrpActive ? 'text-white bg-white/10 shadow-[0_0_15px_rgba(255,255,255,0.05)] border border-white/20 data-[state=open]:bg-white/10 data-[state=open]:text-white' : 'text-gray-500 hover:text-gray-200 hover:bg-white/5 data-[state=open]:bg-white/5 data-[state=open]:text-gray-200 border border-transparent'} `}>
                            <ShieldAlert className="w-3.5 h-3.5 mr-2" />
                            Digital Risk Protection
                        </MenubarTrigger>
                        <MenubarContent className="bg-[#050608]/95 backdrop-blur-xl border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.8)] rounded-md font-mono text-[10px] uppercase font-bold min-w-[200px] p-1">
                            <MenubarItem onClick={() => setActiveTab("shadowspot")} className={`cursor-pointer py-2.5 px-3 outline-none rounded transition-all tracking-widest flex items-center justify-between ${activeTab === 'shadowspot' ? 'text-white bg-white/10' : 'text-gray-400 hover:bg-white/5 focus:bg-white/5 hover:text-gray-200 focus:text-gray-200'} `}>
                                E-ASM (Shadowspot)
                                {activeTab === 'shadowspot' && <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_#ffffff]"></span>}
                            </MenubarItem>
                            <MenubarItem onClick={() => setActiveTab("darkflash")} className={`cursor-pointer py-2.5 px-3 outline-none rounded transition-all tracking-widest flex items-center justify-between ${activeTab === 'darkflash' ? 'text-white bg-white/10' : 'text-gray-400 hover:bg-white/5 focus:bg-white/5 hover:text-gray-200 focus:text-gray-200'} `}>
                                Incidents (Darkflash)
                                {activeTab === 'darkflash' && <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_#ffffff]"></span>}
                            </MenubarItem>
                            <MenubarItem onClick={() => setActiveTab("brandsafe")} className={`cursor-pointer py-2.5 px-3 outline-none rounded transition-all tracking-widest flex items-center justify-between ${activeTab === 'brandsafe' ? 'text-white bg-white/10' : 'text-gray-400 hover:bg-white/5 focus:bg-white/5 hover:text-gray-200 focus:text-gray-200'} `}>
                                Brandsafe
                                {activeTab === 'brandsafe' && <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_#ffffff]"></span>}
                            </MenubarItem>
                        </MenubarContent>
                    </MenubarMenu>

                    <MenubarMenu>
                        <MenubarTrigger className={`cursor-pointer font-mono text-xs font-bold uppercase tracking-wider transition-all outline-none rounded py-2 px-3 focus: bg-transparent flex items-center ${isCtiActive ? 'text-white bg-white/10 shadow-[0_0_15px_rgba(255,255,255,0.05)] border border-white/20 data-[state=open]:bg-white/10 data-[state=open]:text-white' : 'text-gray-500 hover:text-gray-200 hover:bg-white/5 data-[state=open]:bg-white/5 data-[state=open]:text-gray-200 border border-transparent'} `}>
                            <Hexagon className="w-3.5 h-3.5 mr-2" />
                            Global CTI (ThreatBolt)
                        </MenubarTrigger>
                        <MenubarContent className="bg-[#050608]/95 backdrop-blur-xl border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.8)] rounded-md font-mono text-[10px] uppercase font-bold min-w-[200px] p-1">
                            <MenubarItem onClick={() => setActiveTab("threatbolt_enrichment")} className={`cursor-pointer py-2.5 px-3 outline-none rounded transition-all tracking-widest flex items-center justify-between ${activeTab === 'threatbolt_enrichment' ? 'text-white bg-white/10' : 'text-gray-400 hover:bg-white/5 focus:bg-white/5 hover:text-gray-200 focus:text-gray-200'} `}>
                                IOC Enrichment API
                                {activeTab === 'threatbolt_enrichment' && <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_#ffffff]"></span>}
                            </MenubarItem>
                            <MenubarItem onClick={() => setActiveTab("threatbolt_ip")} className={`cursor-pointer py-2.5 px-3 outline-none rounded transition-all tracking-widest flex items-center justify-between ${activeTab === 'threatbolt_ip' ? 'text-white bg-white/10' : 'text-gray-400 hover:bg-white/5 focus:bg-white/5 hover:text-gray-200 focus:text-gray-200'} `}>
                                Malicious IPs Feed
                                {activeTab === 'threatbolt_ip' && <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_#ffffff]"></span>}
                            </MenubarItem>
                            <MenubarItem onClick={() => setActiveTab("threatbolt_domain")} className={`cursor-pointer py-2.5 px-3 outline-none rounded transition-all tracking-widest flex items-center justify-between ${activeTab === 'threatbolt_domain' ? 'text-white bg-white/10' : 'text-gray-400 hover:bg-white/5 focus:bg-white/5 hover:text-gray-200 focus:text-gray-200'} `}>
                                Malicious Domains Feed
                                {activeTab === 'threatbolt_domain' && <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_#ffffff]"></span>}
                            </MenubarItem>
                            <MenubarItem onClick={() => setActiveTab("threatbolt_url")} className={`cursor-pointer py-2.5 px-3 outline-none rounded transition-all tracking-widest flex items-center justify-between ${activeTab === 'threatbolt_url' ? 'text-white bg-white/10' : 'text-gray-400 hover:bg-white/5 focus:bg-white/5 hover:text-gray-200 focus:text-gray-200'} `}>
                                Malicious URLs Feed
                                {activeTab === 'threatbolt_url' && <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_#ffffff]"></span>}
                            </MenubarItem>
                            <MenubarItem onClick={() => setActiveTab("threatbolt_hash")} className={`cursor-pointer py-2.5 px-3 outline-none rounded transition-all tracking-widest flex items-center justify-between ${activeTab === 'threatbolt_hash' ? 'text-white bg-white/10' : 'text-gray-400 hover:bg-white/5 focus:bg-white/5 hover:text-gray-200 focus:text-gray-200'} `}>
                                Malicious Hashes Feed
                                {activeTab === 'threatbolt_hash' && <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_#ffffff]"></span>}
                            </MenubarItem>
                        </MenubarContent>
                    </MenubarMenu>
                </Menubar>

                <div className="ml-auto flex items-center gap-3 border-l border-white/10 pl-4 py-1">
                    <span className="text-[9px] font-mono text-gray-500 tracking-widest">ACTIVE NATIVE MODULE</span>
                    <div className="px-2 py-0.5 rounded bg-cyan-900/30 border border-cyan-500/30 text-[10px] font-mono font-bold text-cyan-400 shadow-[0_0_10px_rgba(0,240,255,0.15)] flex items-center gap-1.5 uppercase">
                        {activeTab.replace("_", " ")}
                    </div>
                </div>
            </div>

            {/* --- MAIN CONTENT AREA --- */}
            <div className="flex-1 relative overflow-hidden bg-[#13131A] text-left">
                {activeTab === 'dashboard' && <DashboardSummary />}
                {activeTab === 'shadowspot' && <ShadowspotDashboard />}
                {activeTab === 'darkflash' && <DarkflashDashboard />}
                {activeTab === 'brandsafe' && <BrandsafeDashboard />}

                {activeTab === 'threatbolt_enrichment' && <IocEnrichmentSearch />}
                {activeTab === 'threatbolt_ip' && <ThreatBoltFeed type="ip" />}
                {activeTab === 'threatbolt_hash' && <ThreatBoltFeed type="hash" />}
                {activeTab === 'threatbolt_url' && <ThreatBoltFeed type="url" />}
                {activeTab === 'threatbolt_domain' && <ThreatBoltFeed type="domain" />}
            </div>
        </div>
    );
}

