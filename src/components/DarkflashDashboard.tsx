import React, { useState } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { Download, Search, ChevronDown, ChevronRight, ChevronLeft, Target, X, CornerDownRight } from "lucide-react";

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

import { supabase } from "@/lib/supabase";

// The fetcher matching ApiPortal implementation
const fetchDarkflash = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {};

    const res = await fetch('/api/cyberx/incidents/api/v1/darkflash/incidents', { headers });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to load Darkflash data.");
    }
    return res.json();
};

export default function DarkflashDashboard({ onNavigate }: { onNavigate?: (module: any) => void }) {
    const { data: qData, isLoading, isError, error } = useQuery({
        queryKey: ['darkflash'],
        queryFn: fetchDarkflash,
        retry: false
    });

    const data = qData?.data || [];

    // Filter states
    const [filterId, setFilterId] = useState("");
    const [filterKeyword, setFilterKeyword] = useState("All");
    const [filterSeenIn, setFilterSeenIn] = useState("All");
    const [filterStatus, setFilterStatus] = useState("All");
    const [filterCategory, setFilterCategory] = useState("All");
    const [filterSource, setFilterSource] = useState("All");

    // Modal state for active incident
    const [selectedIssue, setSelectedIssue] = useState<any | null>(null);

    // Pagination dummy state
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 10;

    // Build dynamic unique options for dropdowns based on actual loaded data
    const uniqueKeywords = ["All", ...Array.from(new Set(data.map((d: any) => d.keyword || d.domain || "N/A")))];
    const uniqueCategories = ["All", ...Array.from(new Set(data.map((d: any) => d.category_name || d.type || "N/A")))];
    const uniqueSources = ["All", ...Array.from(new Set(data.map((d: any) => d.source || d.publisher_source || "N/A")))];
    const uniqueStatuses = ["All", ...Array.from(new Set(data.map((d: any) => d.status_label || d.status || "Pending Customer Action")))];

    // Apply filtering
    const filteredData = data.filter((item: any) => {
        const id = String(item.ticket_key || item.taskKey || item.id || "").toLowerCase();
        const keyword = item.keyword || item.domain || "N/A";
        const category = item.category_name || item.type || "N/A";
        const source = item.source || item.publisher_source || "N/A";
        const status = item.status_label || item.status || "Pending Customer Action";

        // Time parsing (if Breach Seen In isn't "All")
        let timeMatch = true;
        if (filterSeenIn !== "All") {
            let ts = item.created_at || item.createdDt;
            if (ts) {
                if (ts < 1e12) ts *= 1000;
                const date = new Date(ts);
                const now = new Date();
                const diffDays = (now.getTime() - date.getTime()) / (1000 * 3600 * 24);

                if (filterSeenIn === "Last 24 Hours" && diffDays > 1) timeMatch = false;
                if (filterSeenIn === "Last 7 Days" && diffDays > 7) timeMatch = false;
                if (filterSeenIn === "Last 30 Days" && diffDays > 30) timeMatch = false;
            }
        }

        if (filterId && !id.includes(filterId.toLowerCase())) return false;
        if (filterKeyword !== "All" && keyword !== filterKeyword) return false;
        if (filterCategory !== "All" && category !== filterCategory) return false;
        if (filterSource !== "All" && source !== filterSource) return false;
        if (filterStatus !== "All" && status !== filterStatus) return false;
        if (!timeMatch) return false;

        return true;
    });

    const totalPages = Math.ceil(filteredData.length / rowsPerPage) || 1;
    const paginatedData = filteredData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    const SkeletonUI = () => (
        <div className="w-full h-full bg-[#0a0a0f] p-6 rounded-tl-xl overflow-hidden animate-pulse">
            <div className="h-10 w-48 bg-white/10 rounded mb-8 mx-auto mt-4"></div>
            <div className="card-panel h-32 mb-6"></div>
            <div className="card-panel h-64"></div>
        </div>
    );

    if (isLoading) {
        return <SkeletonUI />;
    }

    if (isError) {
        return (
            <div className="w-full h-full bg-[#0a0a0f] relative flex items-center justify-center p-6 text-center">
                <div className="bg-red-900/20 border border-red-500/50 p-8 rounded-xl max-w-lg shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col items-center">
                    <Target className="w-16 h-16 text-red-500 mb-4" />
                    <h2 className="text-xl font-bold font-mono text-white mb-2 uppercase tracking-widest">API Endpoint Error</h2>
                    <p className="text-sm font-sans text-red-200">
                        {error instanceof Error ? error.message : "The upstream API refused the connection."}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full bg-[#0a0a0f] overflow-y-auto text-gray-200 font-sans p-6 md:p-10 rounded-tl-xl shadow-inner custom-scrollbar">

            {/* Header: Breadcrumb */}
            <div className="flex items-center gap-2 mb-8 text-sm">
                <button
                    onClick={() => onNavigate && onNavigate('dashboard')}
                    className="text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                    Dashboard
                </button>
                <span className="text-gray-600">&gt;</span>
                <span className="text-cyan-400 font-semibold tracking-wide drop-shadow-[0_0_8px_rgba(0,240,255,0.4)]">
                    Darkflash
                </span>
            </div>

            {/* Filters Section */}
            <div className="card-panel p-6 mb-8 border border-cyan-500/20 shadow-[0_0_15px_rgba(0,240,255,0.05)] bg-[#13141c]">
                <h3 className="text-gray-300 text-sm font-bold mb-5 tracking-wide">Filters</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Filter fields mapping to standard Deep Inxide inputs */}
                    <div className="flex flex-col gap-2">
                        <label className="text-gray-400 text-xs font-semibold">Search by Incident ID</label>
                        <input
                            type="text"
                            placeholder="Enter incident ID to search"
                            value={filterId}
                            onChange={(e) => { setFilterId(e.target.value); setCurrentPage(1); }}
                            className="bg-[#0a0a0f] border border-white/10 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 rounded-md px-3 py-2.5 text-xs text-white placeholder:text-gray-600 outline-none transition-all font-mono"
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-gray-400 text-xs font-semibold">Keyword</label>
                        <div className="relative">
                            <select
                                value={filterKeyword}
                                onChange={(e) => { setFilterKeyword(e.target.value); setCurrentPage(1); }}
                                className="appearance-none w-full bg-[#0a0a0f] border border-white/10 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 rounded-md px-3 py-2.5 text-xs text-white outline-none transition-all cursor-pointer"
                            >
                                {uniqueKeywords.map((k, i) => <option key={i} value={k as string}>{k as string}</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-gray-500 pointer-events-none" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-gray-400 text-xs font-semibold">Breach Seen in</label>
                        <div className="relative">
                            <select
                                value={filterSeenIn}
                                onChange={(e) => { setFilterSeenIn(e.target.value); setCurrentPage(1); }}
                                className="appearance-none w-full bg-[#0a0a0f] border border-white/10 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 rounded-md px-3 py-2.5 text-xs text-white outline-none transition-all cursor-pointer"
                            >
                                <option value="All">All Time</option>
                                <option value="Last 24 Hours">Last 24 Hours</option>
                                <option value="Last 7 Days">Last 7 Days</option>
                                <option value="Last 30 Days">Last 30 Days</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-gray-500 pointer-events-none" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-gray-400 text-xs font-semibold">Status</label>
                        <div className="relative">
                            <select
                                value={filterStatus}
                                onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                                className="appearance-none w-full bg-[#0a0a0f] border border-white/10 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 rounded-md px-3 py-2.5 text-xs text-white outline-none transition-all cursor-pointer"
                            >
                                {uniqueStatuses.map((s, i) => <option key={i} value={s as string}>{s as string}</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-gray-500 pointer-events-none" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-gray-400 text-xs font-semibold">Breach Category</label>
                        <div className="relative">
                            <select
                                value={filterCategory}
                                onChange={(e) => { setFilterCategory(e.target.value); setCurrentPage(1); }}
                                className="appearance-none w-full bg-[#0a0a0f] border border-white/10 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 rounded-md px-3 py-2.5 text-xs text-white outline-none transition-all cursor-pointer"
                            >
                                {uniqueCategories.map((c, i) => <option key={i} value={c as string}>{c as string}</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-gray-500 pointer-events-none" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-gray-400 text-xs font-semibold">Publisher / Source</label>
                        <div className="relative">
                            <select
                                value={filterSource}
                                onChange={(e) => { setFilterSource(e.target.value); setCurrentPage(1); }}
                                className="appearance-none w-full bg-[#0a0a0f] border border-white/10 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 rounded-md px-3 py-2.5 text-xs text-white outline-none transition-all cursor-pointer"
                            >
                                {uniqueSources.map((s, i) => <option key={i} value={s as string}>{s as string}</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-gray-500 pointer-events-none" />
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div className="flex flex-col justify-end">
                        <button className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:border-cyan-400 transition-all font-semibold rounded-md py-2.5 text-xs w-32 shadow-[0_0_15px_rgba(0,240,255,0.05)]">
                            Submit
                        </button>
                    </div>
                </div>
            </div>

            {/* Incidents Box */}
            <div className="card-panel flex flex-col overflow-hidden border border-cyan-500/20 shadow-[0_0_15px_rgba(0,240,255,0.05)] bg-[#13141c]">

                {/* Header row inside table panel */}
                <div className="px-6 py-5 flex justify-between items-center border-b border-white/5 bg-[#0a0a0f]">
                    <span className="text-gray-200 font-bold text-sm tracking-wide">Incidents ({filteredData.length})</span>
                    <button className="flex items-center gap-2 bg-[#222327] hover:bg-[#2b2d31] text-gray-300 text-xs px-4 py-2 rounded transition-colors border border-white/10 shadow-sm">
                        Download Report <Download className="w-3.5 h-3.5 ml-1" />
                    </button>
                </div>

                {/* Table Container */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                        <thead className="bg-[#0a0a0f] text-gray-400 border-b border-white/10">
                            <tr>
                                <th className="font-semibold p-4 uppercase tracking-wider text-[11px]">ID</th>
                                <th className="font-semibold p-4 uppercase tracking-wider text-[11px]">Keyword</th>
                                <th className="font-semibold p-4 uppercase tracking-wider text-[11px]">Breach Category</th>
                                <th className="font-semibold p-4 uppercase tracking-wider text-[11px]">Publisher / Sources</th>
                                <th className="font-semibold p-4 uppercase tracking-wider text-[11px]">Retrieved Data</th>
                                <th className="font-semibold p-4 uppercase tracking-wider text-[11px]">Status</th>
                                <th className="font-semibold p-4 uppercase tracking-wider text-[11px]">Breach Seen On</th>
                            </tr>
                        </thead>
                        <tbody className="bg-[#13141c] divide-y divide-white/5 font-mono">
                            {paginatedData.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-12 text-center text-gray-500 text-xs italic">No incidents found matching the criteria.</td>
                                </tr>
                            ) : (
                                paginatedData.map((item: any, idx: number) => {

                                    // Parse fields defensively based on the API structure mapping to table cols
                                    const id = item.ticket_key || item.taskKey || item.id || `DFINC-${Math.floor(Math.random() * 100000).toString().padStart(6, '0')}`;
                                    const keyword = item.keyword || item.domain || "N/A";
                                    const category = item.category_name || item.type || "N/A";
                                    const publisher = item.source || item.publisher_source || "N/A";
                                    const retrievedData = item.retrieved_data || item.raw_data || item.description || "N/A";

                                    const statusVal = item.status_label || item.status || "Pending Customer Action";
                                    const isPending = statusVal.toLowerCase().includes("pending");

                                    // Fake "relative time" for UI accuracy based on screenshot "5 days ago" etc
                                    // Normally we would calculate from created_at
                                    let dtStr = "N/A";
                                    let ts = item.created_at || item.createdDt;
                                    if (ts) {
                                        if (ts < 1e12) ts *= 1000;
                                        dtStr = format(new Date(ts), "dd MMM yyyy");
                                    } else {
                                        dtStr = "Recent"; // Fallback
                                    }

                                    return (
                                        <tr key={idx} className="hover:bg-[#1a1c23] transition-colors group cursor-pointer" onClick={() => setSelectedIssue(item)}>
                                            <td className="p-4 text-cyan-400">{id}</td>
                                            <td className="p-4 text-gray-300">{keyword}</td>
                                            <td className="p-4 text-gray-300">{category}</td>
                                            <td className="p-4 text-gray-300">{publisher}</td>
                                            <td className="p-4 text-gray-400 truncate max-w-xs max-w-[200px]" title={retrievedData}>
                                                {retrievedData}
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded tracking-wide text-[10px] font-sans font-bold ${isPending ? 'bg-orange-500 text-white' : 'bg-emerald-500 text-white'}`}>
                                                    {statusVal}
                                                </span>
                                            </td>
                                            <td className="p-4 text-gray-400">{dtStr}</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                <div className="p-4 bg-[#0a0a0f] border-t border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-gray-400 text-xs font-semibold">Rows Per Page</span>
                        <div className="relative">
                            <select className="appearance-none bg-[#13141c] border border-white/10 rounded px-3 py-1 text-xs text-white outline-none pr-8 cursor-pointer">
                                <option>10</option>
                                <option>25</option>
                                <option>50</option>
                            </select>
                            <ChevronDown className="absolute right-2 top-1.5 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            className="p-1 text-gray-400 hover:text-white disabled:opacity-50 transition-colors bg-[#13141c] border border-white/10 rounded"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button className="px-3 py-1 font-mono text-xs bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded">
                            {currentPage}
                        </button>
                        <button
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            className="p-1 text-gray-400 hover:text-white disabled:opacity-50 transition-colors bg-[#13141c] border border-white/10 rounded"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

            </div>

            {/* Bottom Padding */}
            <div className="h-10"></div>

            {/* Selected Incident Details Modal */}
            {selectedIssue && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 md:p-8 anim-fade-in" onClick={() => setSelectedIssue(null)}>
                    <div
                        className="card-panel w-full max-w-5xl flex flex-col max-h-full overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-white/5 flex justify-between items-start shrink-0 bg-[#0a0a0f]">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="text-cyan-400 font-mono text-sm tracking-widest">{selectedIssue.ticket_key || selectedIssue.taskKey || selectedIssue.id || "DFINC-UNKNOWN"}</div>
                                    <span className="bg-[#13141c] px-2.5 py-1 rounded text-gray-300 text-[10px] font-bold uppercase tracking-wider border border-white/5">
                                        {selectedIssue.category_name || selectedIssue.type || "Threat Incident"}
                                    </span>
                                </div>
                                <h2 className="text-xl font-semibold text-white tracking-tight leading-snug">{selectedIssue.title || selectedIssue.keyword || "Incident Details"}</h2>
                            </div>
                            <button
                                onClick={() => setSelectedIssue(null)}
                                className="text-gray-500 hover:text-white bg-[#1a1c23] hover:bg-[#34363a] p-2 rounded-full transition-colors border border-transparent hover:border-white/10"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar bg-[#13141c]">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                {/* Left Side: Primary Descriptions */}
                                <div className="md:col-span-2 space-y-8">
                                    <section>
                                        <div className="text-gray-500 text-[11px] uppercase font-bold mb-3 tracking-widest flex items-center gap-2">
                                            <CornerDownRight className="w-4 h-4 text-cyan-500/80" />
                                            Incident Description
                                        </div>
                                        <div className="text-gray-300 text-[13px] leading-relaxed whitespace-pre-wrap font-sans bg-[#0a0a0f] border border-white/5 p-5 rounded-lg shadow-inner">
                                            {renderFormattedText(selectedIssue.description || "No detailed description provided.", "text-white font-bold")}
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

                                    {(selectedIssue.recommendation || selectedIssue.remediation) && (
                                        <section>
                                            <div className="text-emerald-400/80 text-[11px] uppercase font-bold mb-3 tracking-widest">Remediation Steps</div>
                                            <div className="text-emerald-200/90 text-[13px] leading-relaxed whitespace-pre-wrap font-sans bg-emerald-950/20 border border-emerald-900/40 p-5 rounded-lg">
                                                {renderFormattedText(selectedIssue.recommendation || selectedIssue.remediation, "text-emerald-400 font-bold drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]")}
                                            </div>
                                        </section>
                                    )}
                                </div>

                                {/* Right Side: Meta Data & Verification */}
                                <div className="space-y-6">
                                    <div className="bg-[#0a0a0f] rounded-lg p-5 border border-cyan-500/20 shadow-[0_0_15px_rgba(0,240,255,0.05)] space-y-5">
                                        <h3 className="text-gray-100 text-sm font-semibold border-b border-cyan-500/20 pb-3 mb-4">Metadata</h3>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <div className="text-gray-500 text-[10px] uppercase font-bold mb-1 tracking-widest">Status</div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-2 h-2 rounded-full ${selectedIssue.status_label?.toLowerCase().includes("pending") || selectedIssue.status?.toLowerCase().includes("pending") ? "bg-orange-500" : "bg-emerald-500"}`} />
                                                    <span className="text-gray-200 text-sm font-medium">{selectedIssue.status_label || selectedIssue.status || "Open"}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-gray-500 text-[10px] uppercase font-bold mb-1 tracking-widest">Severity</div>
                                                <span className="text-white text-sm font-mono font-bold">{selectedIssue.severity || selectedIssue.severity_label || "N/A"}</span>
                                            </div>
                                        </div>

                                        {(selectedIssue.domain || selectedIssue.brand_domain) && (
                                            <div>
                                                <div className="text-gray-500 text-[10px] uppercase font-bold mb-1 tracking-widest">Domain Name</div>
                                                <span className="text-cyan-400 font-mono text-sm">{selectedIssue.domain || selectedIssue.brand_domain}</span>
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
                                                    {selectedIssue.url.trim()} <CornerDownRight className="w-3 h-3 shrink-0" />
                                                </a>
                                            </div>
                                        )}

                                        {(selectedIssue.source || selectedIssue.publisher_source) && (
                                            <div>
                                                <div className="text-gray-500 text-[10px] uppercase font-bold mb-1 tracking-widest">Source</div>
                                                <span className="text-gray-300 font-mono text-xs break-all">{selectedIssue.source || selectedIssue.publisher_source}</span>
                                            </div>
                                        )}

                                        {selectedIssue.ip_address && (
                                            <div>
                                                <div className="text-gray-500 text-[10px] uppercase font-bold mb-1 tracking-widest">IP Address</div>
                                                <span className="text-red-400 font-mono text-xs break-all">{selectedIssue.ip_address}</span>
                                            </div>
                                        )}
                                    </div>

                                    {(selectedIssue.retrieved_data || selectedIssue.raw_data) && (
                                        <div className="bg-[#0a0a0f] rounded-lg border border-cyan-500/20 shadow-[0_0_15px_rgba(0,240,255,0.05)] flex flex-col overflow-hidden">
                                            <div className="bg-[#13141c] p-3 text-cyan-400 text-[11px] font-semibold uppercase tracking-wider flex justify-between items-center border-b border-cyan-500/10">
                                                Raw Data Extracted
                                            </div>
                                            <div className="p-0">
                                                <pre className="bg-[#020204] p-4 text-gray-400 text-xs whitespace-pre-wrap font-mono break-all max-h-60 overflow-y-auto">
                                                    {selectedIssue.retrieved_data || selectedIssue.raw_data}
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
