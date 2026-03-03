import React, { useState } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { Download, Search, ChevronDown, AlertCircle, CornerDownRight, X, ExternalLink } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Legend, LabelList } from "recharts";
import { supabase } from "@/lib/supabase";

const fetchShadowspotFeed = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {};

    const res = await fetch('/api/cyberx/incidents/api/v1/shadowspot/findings', { headers });
    const data = await res.json();
    if (!res.ok || data.error) {
        throw new Error(data.error?.message || "Failed to load ShadowSpot data.");
    }
    return data;
};

const SEV_COLORS: Record<string, string> = {
    Critical: "#ef4444", // Red
    High: "#f97316", // Orange
    Medium: "#facc15", // Yellow
    Low: "#22c55e", // Green
};

const PILLS: Record<string, string> = {
    P1: "bg-[#ef4444] text-white",
    P2: "bg-[#f97316] text-white",
    P3: "bg-[#facc15] text-black",
    P4: "bg-[#22c55e] text-white",
};

const renderFormattedText = (text: string | null | undefined, boldClass: string = "text-white font-bold") => {
    if (!text) return null;
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index} className={boldClass}>{part.slice(2, -2)}</strong>;
        }
        return <span key={index}>{part}</span>;
    });
};

export default function ShadowspotDashboard() {
    const { data: qData, isLoading, isError, error } = useQuery({
        queryKey: ['shadowspot'],
        queryFn: fetchShadowspotFeed,
        retry: false
    });

    const [selectedIssue, setSelectedIssue] = useState<any | null>(null);

    const data = qData?.data || [];

    // Aggregations for charts based strictly on API payload
    const statusObj: Record<string, number> = {};
    const monthGroups: Record<string, any> = {};

    data.forEach((d: any) => {
        // Status pie chart calculation
        const stat = d.status_label || d.status_description || d.status || "Open";
        statusObj[stat] = (statusObj[stat] || 0) + 1;

        // Bar chart calculation
        let ts = d.created_at || d.createdDt || Date.now();
        // If it's in seconds (like 1769058092), multiply by 1000 to get milliseconds
        if (ts < 1e12) ts *= 1000;

        const date = new Date(ts);
        const mKey = format(date, "MMM");
        if (!monthGroups[mKey]) {
            monthGroups[mKey] = { name: mKey, Critical: 0, High: 0, Medium: 0, Low: 0 };
        }

        const severityStr = d.severity || d.severity_label;
        if (severityStr) {
            monthGroups[mKey][severityStr] = (monthGroups[mKey][severityStr] || 0) + 1;
        }
    });

    const statusCounts = Object.entries(statusObj).map(([name, value]) => ({
        name, value, fill: "#f59e0b" // We can keep a uniform color or math logic later
    }));

    const barData = Object.values(monthGroups).sort((a: any, b: any) => {
        // Quick month sort visually
        return new Date(`01 ${a.name} 2000`).getTime() - new Date(`01 ${b.name} 2000`).getTime();
    });

    const SkeletonUI = () => (
        <div className="w-full h-full bg-[#0a0a0f] p-6 rounded-tl-xl overflow-hidden animate-pulse">
            <div className="h-6 w-1/4 bg-white/10 rounded mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr,2fr] gap-4 mb-6">
                <div className="bg-[#13141c] rounded shadow border border-white/5 h-[280px]"></div>
                <div className="bg-[#13141c] rounded shadow border border-white/5 h-[280px]"></div>
            </div>
            <div className="h-8 w-32 bg-white/10 rounded mb-3"></div>
            <div className="bg-[#0a0a0f] rounded overflow-hidden border border-white/5">
                <div className="h-10 bg-[#0d0e15]"></div>
                <div className="h-10 bg-[#0d0e15] border-t border-white/5"></div>
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-12 border-t border-white/5 bg-[#13141c]"></div>
                ))}
            </div>
        </div>
    );

    if (isLoading) {
        return <SkeletonUI />;
    }

    if (isError) {
        return (
            <div className="w-full h-full bg-[#0a0a0f] relative">
                <div className="absolute inset-0 opacity-20 pointer-events-none">
                    <SkeletonUI />
                </div>
                <div className="absolute inset-0 flex items-center justify-center p-6 z-10 backdrop-blur-[2px]">
                    <div className="bg-red-900/20 border border-red-500/50 p-8 rounded-xl max-w-lg shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col items-center text-center">
                        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
                        <h2 className="text-xl font-bold font-mono text-white mb-2 uppercase tracking-widest">API Endpoint Error</h2>
                        <p className="text-sm font-sans text-red-200">
                            {error instanceof Error ? error.message : "The upstream API refused the connection or returned an invalid payload."}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full bg-[#0a0a0f] overflow-y-auto text-gray-200 font-sans p-6 rounded-tl-xl shadow-inner scrollbar-hide">

            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div className="text-gray-400 text-sm font-medium">
                    ShadowSpot &gt; <span className="text-white hover:underline cursor-pointer">Findings</span>
                </div>
                <div className="text-gray-400 text-sm">
                    Last Assesment Completed on: <span className="text-white border-b border-white border-dotted pb-[1px]">25 Feb 2026 4:32 PM</span>
                </div>
            </div>

            {/* Top Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr,2fr] gap-4 mb-6">
                {/* Donut Chart Panel */}
                <div className="card-panel p-4 flex flex-col h-[280px]">
                    <h3 className="text-gray-300 text-sm font-semibold mb-2">Status of Issue</h3>
                    <div className="flex-1 flex flex-col items-center justify-center relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={statusCounts}
                                    cx="50%"
                                    cy="42%"
                                    innerRadius={55}
                                    outerRadius={80}
                                    stroke="none"
                                    dataKey="value"
                                >
                                    {statusCounts.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: '#0a0a0f', border: '1px solid #333', color: '#fff', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute bottom-1 w-full flex flex-col items-center gap-1.5 text-xs text-gray-300">
                            {statusCounts.map((sc, i) => (
                                <span key={i} className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 inline-block rounded-full shadow-sm" style={{ backgroundColor: sc.fill }}></span>
                                    {sc.name}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Bar Chart Panel */}
                <div className="card-panel p-4 flex flex-col h-[280px]">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h3 className="text-gray-300 text-sm font-semibold">Security Issues by Scan Date</h3>
                            <p className="text-[10px] text-gray-500 mt-1">Dec till Jan (showing last 2 scans)</p>
                        </div>
                        {/* Custom Legend to match screenshot tightly */}
                        <div className="flex items-center gap-4 text-xs font-medium text-gray-300">
                            <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#ef4444]" /> Critical</span>
                            <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#f97316]" /> High</span>
                            <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#facc15]" /> Medium</span>
                            <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#22c55e]" /> Low</span>
                        </div>
                    </div>
                    <div className="flex-1 -ml-4 -mr-4 mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={barData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }} barSize={25} barGap={8}>
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#e5e7eb', fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#e5e7eb', fontSize: 12 }} domain={[0, 3]} ticks={[0, 1, 2, 3]} />
                                <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#0a0a0f', border: '1px solid #444' }} />
                                <Bar dataKey="Critical" fill="#ef4444" radius={[2, 2, 0, 0]}>
                                    <LabelList dataKey="Critical" position="top" fill="#fff" fontSize={11} formatter={(v: number) => v === 0 ? '' : v} />
                                </Bar>
                                <Bar dataKey="High" fill="#f97316" radius={[2, 2, 0, 0]}>
                                    <LabelList dataKey="High" position="top" fill="#fff" fontSize={11} formatter={(v: number) => v === 0 ? '' : v} />
                                </Bar>
                                <Bar dataKey="Medium" fill="#facc15" radius={[2, 2, 0, 0]}>
                                    <LabelList dataKey="Medium" position="top" fill="#fff" fontSize={11} formatter={(v: number) => v === 0 ? '' : v} />
                                </Bar>
                                <Bar dataKey="Low" fill="#22c55e" radius={[2, 2, 0, 0]}>
                                    <LabelList dataKey="Low" position="top" fill="#fff" fontSize={11} formatter={(v: number) => v === 0 ? '' : v} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Table Mid-Section */}
            <div className="flex justify-between items-center mb-3">
                <span className="text-gray-200 font-semibold">Issues ({data.length})</span>
                <button className="flex items-center gap-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-xs px-3 py-1.5 rounded-md transition-colors border border-cyan-500/20 shadow-[-5px_0px_20px_rgba(0,240,255,0.05)]">
                    Download Report <Download className="w-3.5 h-3.5 ml-1" />
                </button>
            </div>

            {/* Table */}
            <div className="card-panel overflow-hidden">
                <table className="w-full text-left text-xs whitespace-nowrap table-fixed">
                    <thead className="bg-[#0d0e15] text-gray-200">
                        <tr>
                            <th className="font-semibold p-2 pt-3 w-40">Reported Date</th>
                            <th className="font-semibold p-2 pt-3 w-32">Severity</th>
                            <th className="font-semibold p-2 pt-3 w-72">Issue Name</th>
                            <th className="font-semibold p-2 pt-3 w-48">Issue Type</th>
                            <th className="font-semibold p-2 pt-3 w-24">Asset(s)</th>
                            <th className="font-semibold p-2 pt-3 w-32">Patch Priority</th>
                            <th className="font-semibold p-2 pt-3 w-48">Status</th>
                        </tr>
                        {/* Search Row */}
                        <tr className="bg-[#0d0e15]">
                            <td className="p-2 pb-3"><div className="bg-[#13141c] text-gray-400 border border-t border-[#0a0a0f] rounded px-2 py-1 flex items-center gap-1 text-[11px]"><Search className="w-3 h-3" /> Search</div></td>
                            <td className="p-2 pb-3"><div className="bg-[#13141c] text-gray-400 border border-t border-[#0a0a0f] rounded px-2 py-1 flex items-center justify-between gap-1 text-[11px]">Search <ChevronDown className="w-3 h-3" /></div></td>
                            <td className="p-2 pb-3"><div className="bg-[#13141c] text-gray-400 border border-t border-[#0a0a0f] rounded px-2 py-1 flex items-center gap-1 text-[11px]"><Search className="w-3 h-3" /> Search</div></td>
                            <td className="p-2 pb-3"><div className="bg-[#13141c] text-gray-400 border border-t border-[#0a0a0f] rounded px-2 py-1 flex items-center justify-between gap-1 text-[11px]">Search <ChevronDown className="w-3 h-3" /></div></td>
                            <td className="p-2 pb-3"><div className="bg-[#13141c] text-gray-400 border border-t border-[#0a0a0f] rounded px-2 py-1 flex items-center gap-1 text-[11px]"><Search className="w-3 h-3" /> Search</div></td>
                            <td className="p-2 pb-3"><div className="bg-[#13141c] text-gray-400 border border-t border-[#0a0a0f] rounded px-2 py-1 flex items-center justify-between gap-1 text-[11px]">Search <ChevronDown className="w-3 h-3" /></div></td>
                            <td className="p-2 pb-3"><div className="bg-[#13141c] text-gray-400 border border-t border-[#0a0a0f] rounded px-2 py-1 flex items-center justify-between gap-1 text-[11px]">Search <ChevronDown className="w-3 h-3" /></div></td>
                        </tr>
                    </thead>
                    <tbody className="bg-[#13141c]">
                        {data.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="p-8 text-center text-gray-500 text-xs italic">No vulnerabilities or findings reported from API.</td>
                            </tr>
                        ) : data.map((item: any, idx: number) => {
                            let ts = item.created_at || item.createdDt || Date.now();
                            if (ts < 1e12) ts *= 1000;
                            const dtString = format(new Date(ts), "MMM dd, yyyy - HH:mm:ss");

                            const actualSeverity = item.severity || item.severity_label || "Unknown";
                            const sevColor = SEV_COLORS[actualSeverity] || "#9ca3af";

                            const actualPriority = item.priority || item.priorty || "N/A";
                            const pillClass = PILLS[actualPriority] || "bg-gray-600 text-white";

                            return (
                                <tr
                                    key={idx}
                                    className="border-t border-white/5 hover:bg-[#1a1c23] transition-colors cursor-pointer"
                                    onClick={() => setSelectedIssue(item)}
                                >
                                    <td className="p-3 text-gray-200 text-[11px] font-mono whitespace-nowrap">
                                        {dtString}
                                    </td>
                                    <td className="p-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: sevColor }}></div>
                                            <span className="text-gray-300 text-[11px] font-medium">{actualSeverity}</span>
                                        </div>
                                    </td>
                                    <td className="p-3 text-gray-200 text-[11px] truncate whitespace-normal leading-relaxed" title={item.title}>
                                        <div className="text-cyan-400 font-mono text-[10px] mb-0.5">{item.ticket_key || item.taskKey}</div>
                                        {item.title}
                                    </td>
                                    <td className="p-3 text-gray-200 text-[11px] truncate">{item.type || item.category_name || item.taskType_name || "N/A"}</td>
                                    <td className="p-3 text-gray-200 text-[11px] text-center max-w-[120px] truncate" title={item.assets}>{item.assets || "N/A"}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${pillClass}`}>
                                            {actualPriority}
                                        </span>
                                    </td>
                                    <td className="p-3 text-gray-200 text-[11px]">
                                        <div className="flex items-center gap-1.5">
                                            <span className={`w-1.5 h-1.5 rounded-full ${item.status_label?.includes("Pending") || item.status_description?.includes("Pending") ? "bg-yellow-500" : "bg-emerald-500"}`} />
                                            {item.status_label || item.status_description || item.status || "N/A"}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="h-10"></div>

            {/* Selected Issue Details Modal */}
            {selectedIssue && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 md:p-8 anim-fade-in" onClick={() => setSelectedIssue(null)}>
                    <div
                        className="card-panel w-full max-w-5xl flex flex-col max-h-full overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-white/5 flex justify-between items-start shrink-0">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="text-cyan-400 font-mono text-sm tracking-widest">{selectedIssue.ticket_key || selectedIssue.taskKey}</div>
                                    <span className="bg-[#13141c] px-2.5 py-1 rounded text-gray-300 text-[10px] font-bold uppercase tracking-wider border border-white/5">
                                        {selectedIssue.type || selectedIssue.category_name || selectedIssue.taskType_name || "Vulnerability"}
                                    </span>
                                </div>
                                <h2 className="text-xl font-semibold text-white tracking-tight leading-snug">{selectedIssue.title}</h2>
                            </div>
                            <button
                                onClick={() => setSelectedIssue(null)}
                                className="text-gray-500 hover:text-white bg-[#1a1c23] hover:bg-[#34363a] p-2 rounded-full transition-colors border border-transparent hover:border-white/10"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                {/* Left Side: Primary Descriptions (Spans 2 cols) */}
                                <div className="md:col-span-2 space-y-8">

                                    <section>
                                        <div className="text-gray-500 text-[11px] uppercase font-bold mb-3 tracking-widest flex items-center gap-2">
                                            <CornerDownRight className="w-4 h-4 text-cyan-500/80" />
                                            Vulnerability Description
                                        </div>
                                        <div className="text-gray-300 text-[13px] leading-relaxed whitespace-pre-wrap font-sans bg-[#0a0a0f] border border-white/5 p-5 rounded-lg shadow-inner">
                                            {renderFormattedText(selectedIssue.description || "No detailed description provided by the scanner.", "text-white font-bold")}
                                        </div>
                                    </section>

                                    {selectedIssue.impact && (
                                        <section>
                                            <div className="text-red-400/80 text-[11px] uppercase font-bold mb-3 tracking-widest">Business & Security Impact</div>
                                            <div className="text-red-200/90 text-[13px] leading-relaxed whitespace-pre-wrap font-sans bg-red-950/20 border border-red-900/40 p-5 rounded-lg">
                                                {renderFormattedText(selectedIssue.impact, "text-red-400 font-bold drop-shadow-[0_0_8px_rgba(248,113,113,0.3)]")}
                                            </div>
                                        </section>
                                    )}

                                    {selectedIssue.remediation && (
                                        <section>
                                            <div className="text-emerald-400/80 text-[11px] uppercase font-bold mb-3 tracking-widest">Remediation Steps</div>
                                            <div className="text-emerald-200/90 text-[13px] leading-relaxed whitespace-pre-wrap font-sans bg-emerald-950/20 border border-emerald-900/40 p-5 rounded-lg">
                                                {renderFormattedText(selectedIssue.remediation, "text-emerald-400 font-bold drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]")}
                                            </div>
                                        </section>
                                    )}
                                </div>

                                {/* Right Side: Meta Data & Verification */}
                                <div className="space-y-6">
                                    <div className="bg-[#13141c] rounded-lg p-5 border border-cyan-500/20 shadow-[0_0_15px_rgba(0,240,255,0.05)] space-y-5">
                                        <h3 className="text-gray-100 text-sm font-semibold border-b border-cyan-500/20 pb-3 mb-4">Metadata</h3>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <div className="text-gray-500 text-[10px] uppercase font-bold mb-1 tracking-widest">Severity</div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SEV_COLORS[selectedIssue.severity || selectedIssue.severity_label] || "#9ca3af" }}></div>
                                                    <span className="text-gray-200 text-sm font-medium">{selectedIssue.severity || selectedIssue.severity_label || "Unknown"}</span>
                                                </div>
                                            </div>
                                            {selectedIssue.cvss_score && (
                                                <div>
                                                    <div className="text-gray-500 text-[10px] uppercase font-bold mb-1 tracking-widest">CVSS Score</div>
                                                    <span className="text-white text-sm font-mono font-bold">{selectedIssue.cvss_score}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <div className="text-gray-500 text-[10px] uppercase font-bold mb-1 tracking-widest">Status / Priority</div>
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`w-2 h-2 rounded-full ${selectedIssue.status_label?.includes("Pending") ? "bg-yellow-500" : "bg-emerald-500"}`} />
                                                    <span className="text-gray-200 text-sm">{selectedIssue.status_label || selectedIssue.status || "Open"}</span>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${PILLS[selectedIssue.priority || selectedIssue.priorty] || "bg-gray-600 text-white"}`}>
                                                    {selectedIssue.priority || selectedIssue.priorty || "N/A"}
                                                </span>
                                            </div>
                                        </div>

                                        {selectedIssue.domain && (
                                            <div>
                                                <div className="text-gray-500 text-[10px] uppercase font-bold mb-1 tracking-widest">Domain Name</div>
                                                <span className="text-cyan-400 font-mono text-sm">{selectedIssue.domain}</span>
                                            </div>
                                        )}

                                        {selectedIssue.assets && (
                                            <div>
                                                <div className="text-gray-500 text-[10px] uppercase font-bold mb-1 tracking-widest">Affected Asset</div>
                                                <span className="text-gray-300 font-mono text-xs break-all">{selectedIssue.assets}</span>
                                            </div>
                                        )}

                                        {selectedIssue.url && (
                                            <div>
                                                <div className="text-gray-500 text-[10px] uppercase font-bold mb-1 tracking-widest">Target URL</div>
                                                <a href={selectedIssue.url.trim()} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1.5 font-mono text-xs break-all">
                                                    {selectedIssue.url.trim()} <ExternalLink className="w-3 h-3 shrink-0" />
                                                </a>
                                            </div>
                                        )}
                                    </div>

                                    {selectedIssue.verification_details && (
                                        <div className="bg-[#13141c] rounded-lg border border-cyan-500/20 shadow-[0_0_15px_rgba(0,240,255,0.05)] flex flex-col overflow-hidden">
                                            <div className="bg-[#1a1c23] p-3 text-cyan-400 text-[11px] font-semibold uppercase tracking-wider flex justify-between items-center border-b border-cyan-500/10">
                                                Verification Command
                                            </div>
                                            <div className="p-0">
                                                <pre className="bg-[#020204] p-4 text-gray-400 text-xs whitespace-pre-wrap font-mono break-all max-h-60 overflow-y-auto">
                                                    {selectedIssue.verification_details}
                                                </pre>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
