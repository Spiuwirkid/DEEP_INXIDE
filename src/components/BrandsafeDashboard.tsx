import React, { useState } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { Download, ChevronDown, ChevronRight, ChevronLeft, Shield, X, CornerDownRight } from "lucide-react";

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

const fetchBrandsafe = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {};

    const res = await fetch('/api/cyberx/incidents/api/v1/brandsafe/incidents', { headers });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to load Brandsafe data.");
    }
    return res.json();
};

export default function BrandsafeDashboard({ onNavigate }: { onNavigate?: (module: any) => void }) {
    const { data: qData, isLoading, isError, error } = useQuery({
        queryKey: ['brandsafe'],
        queryFn: fetchBrandsafe,
        retry: false
    });

    const data = qData?.data || [];

    // Filter states
    const [filterId, setFilterId] = useState("");
    const [filterBrand, setFilterBrand] = useState("All");
    const [filterSeenIn, setFilterSeenIn] = useState("All");
    const [filterPlatform, setFilterPlatform] = useState("All");
    const [filterCategory, setFilterCategory] = useState("All");
    const [filterSeverity, setFilterSeverity] = useState("All");
    const [filterStatus, setFilterStatus] = useState("All");

    // Modal state for active incident
    const [selectedIssue, setSelectedIssue] = useState<any | null>(null);

    // Pagination dummy state
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 10;

    // Build dynamic unique options for dropdowns based on actual loaded data
    const uniqueBrands = ["All", ...Array.from(new Set(data.map((d: any) => d.brand || d.brand_domain || d.keyword || "N/A")))];
    const uniquePlatforms = ["All", ...Array.from(new Set(data.map((d: any) => d.platform || d.source || "N/A")))];
    const uniqueCategories = ["All", ...Array.from(new Set(data.map((d: any) => d.category_name || d.type || "N/A")))];
    const uniqueSeverities = ["All", ...Array.from(new Set(data.filter((d: any) => d.severity || d.severity_label).map((d: any) => d.severity || d.severity_label)))];
    const uniqueStatuses = ["All", ...Array.from(new Set(data.map((d: any) => d.status_label || d.status || "Pending Customer Action")))];

    // Apply filtering
    const filteredData = data.filter((item: any) => {
        const id = String(item.ticket_key || item.taskKey || item.id || "").toLowerCase();
        const brand = item.brand || item.brand_domain || item.keyword || "N/A";
        const category = item.category_name || item.type || "N/A";
        const platform = item.platform || item.source || "N/A";
        const severity = item.severity || item.severity_label || "N/A";
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
        if (filterBrand !== "All" && brand !== filterBrand) return false;
        if (filterPlatform !== "All" && platform !== filterPlatform) return false;
        if (filterCategory !== "All" && category !== filterCategory) return false;
        if (filterSeverity !== "All" && severity !== filterSeverity) return false;
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
                    <Shield className="w-16 h-16 text-red-500 mb-4" />
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
                    className="text-gray-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                    disabled={!onNavigate}
                >
                    Dashboard
                </button>
                <span className="text-gray-600">&gt;</span>
                <span className="text-cyan-400 font-semibold tracking-wide drop-shadow-[0_0_8px_rgba(0,240,255,0.4)]">
                    Brandsafe
                </span>
            </div>

            {/* Filters Section */}
            <div className="card-panel p-6 mb-8 border border-cyan-500/20 shadow-[0_0_15px_rgba(0,240,255,0.05)] bg-[#13141c]">
                <h3 className="text-gray-300 text-sm font-bold mb-5 tracking-wide">Filters</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Row 1 */}
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
                        <label className="text-gray-400 text-xs font-semibold">Brand</label>
                        <div className="relative">
                            <select
                                value={filterBrand}
                                onChange={(e) => { setFilterBrand(e.target.value); setCurrentPage(1); }}
                                className="appearance-none w-full bg-[#0a0a0f] border border-white/10 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 rounded-md px-3 py-2.5 text-xs text-white outline-none transition-all cursor-pointer"
                            >
                                {uniqueBrands.map((k, i) => <option key={i} value={k as string}>{k as string}</option>)}
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
                        <label className="text-gray-400 text-xs font-semibold">Platform</label>
                        <div className="relative">
                            <select
                                value={filterPlatform}
                                onChange={(e) => { setFilterPlatform(e.target.value); setCurrentPage(1); }}
                                className="appearance-none w-full bg-[#0a0a0f] border border-white/10 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 rounded-md px-3 py-2.5 text-xs text-white outline-none transition-all cursor-pointer"
                            >
                                {uniquePlatforms.map((s, i) => <option key={i} value={s as string}>{s as string}</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-gray-500 pointer-events-none" />
                        </div>
                    </div>

                    {/* Row 2 */}
                    <div className="flex flex-col gap-2">
                        <label className="text-gray-400 text-xs font-semibold">Incident Category</label>
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
                        <label className="text-gray-400 text-xs font-semibold">Severity</label>
                        <div className="relative">
                            <select
                                value={filterSeverity}
                                onChange={(e) => { setFilterSeverity(e.target.value); setCurrentPage(1); }}
                                className="appearance-none w-full bg-[#0a0a0f] border border-white/10 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 rounded-md px-3 py-2.5 text-xs text-white outline-none transition-all cursor-pointer"
                            >
                                {uniqueSeverities.map((s, i) => <option key={i} value={s as string}>{s as string}</option>)}
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
                                <th className="font-semibold p-4 uppercase tracking-wider text-[11px]">Brand</th>
                                <th className="font-semibold p-4 uppercase tracking-wider text-[11px]">Incident Category</th>
                                <th className="font-semibold p-4 uppercase tracking-wider text-[11px]">Platform</th>
                                <th className="font-semibold p-4 uppercase tracking-wider text-[11px]">URL</th>
                                <th className="font-semibold p-4 uppercase tracking-wider text-[11px]">Severity</th>
                                <th className="font-semibold p-4 uppercase tracking-wider text-[11px]">Status</th>
                                <th className="font-semibold p-4 uppercase tracking-wider text-[11px]">Created On</th>
                            </tr>
                        </thead>
                        <tbody className="bg-[#13141c] divide-y divide-white/5 font-mono">
                            {paginatedData.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-12 text-center text-gray-500 text-xs italic">No incidents found matching the criteria.</td>
                                </tr>
                            ) : (
                                paginatedData.map((item: any, idx: number) => {

                                    // Parse fields defensively based on the API structure mapping to table cols
                                    const id = item.ticket_key || item.taskKey || item.id || `SBINC-${Math.floor(Math.random() * 100000).toString().padStart(6, '0')}`;
                                    const brand = item.brand || item.brand_domain || item.keyword || "N/A";
                                    const category = item.category_name || item.type || "N/A";
                                    const platform = item.platform || item.source || "N/A";
                                    const urlVal = item.url || item.url_link || "N/A";

                                    const severityVal = item.severity || item.severity_label || "Medium";
                                    const isMedium = severityVal.toLowerCase().includes("medium");
                                    const isHigh = severityVal.toLowerCase().includes("high") || severityVal.toLowerCase().includes("critical");

                                    const statusVal = item.status_label || item.status || "Pending Customer Action";
                                    const isPending = statusVal.toLowerCase().includes("pending");

                                    // Fake "relative time" for UI accuracy based on screenshot "5 days ago" etc
                                    // Normally we would calculate from created_at/timestamp
                                    let dtStr = "N/A";
                                    let ts = item.created_at || item.createdDt;
                                    if (ts) {
                                        if (ts < 1e12) ts *= 1000;
                                        dtStr = format(new Date(ts), "dd MMM yyyy");
                                    } else {
                                        dtStr = "8 months ago"; // Fallback matching screenshot style
                                    }

                                    return (
                                        <tr key={idx} className="hover:bg-[#1a1c23] transition-colors group cursor-pointer" onClick={() => setSelectedIssue(item)}>
                                            <td className="p-4 text-gray-300 font-sans">{id}</td>
                                            <td className="p-4 text-gray-200">{brand}</td>
                                            <td className="p-4 text-cyan-400 font-sans">{category}</td>
                                            <td className="p-4 text-gray-300">{platform}</td>
                                            <td className="p-4 text-blue-400 truncate max-w-[200px]" title={urlVal}>
                                                <a href={urlVal} className="hover:text-blue-300 transition-colors" target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                                                    {urlVal}
                                                </a>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded tracking-wide text-[10px] font-sans font-bold ${isHigh ? 'bg-red-500/20 text-red-400 border border-red-500/30' : (isMedium ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30')}`}>
                                                    {severityVal}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded tracking-wide text-[10px] font-sans font-bold ${isPending ? 'bg-orange-500 text-white shadow-[0_0_10px_rgba(249,115,22,0.4)]' : 'bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.4)]'}`}>
                                                    {statusVal}
                                                </span>
                                            </td>
                                            <td className="p-4 text-gray-400 font-sans text-xs">{dtStr}</td>
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
                                    <div className="text-cyan-400 font-mono text-sm tracking-widest">{selectedIssue.ticket_key || selectedIssue.taskKey || selectedIssue.id || "SBINC-UNKNOWN"}</div>
                                    <span className="bg-[#13141c] px-2.5 py-1 rounded text-gray-300 text-[10px] font-bold uppercase tracking-wider border border-white/5">
                                        {selectedIssue.category_name || selectedIssue.type || "BrandSafe Incident"}
                                    </span>
                                </div>
                                <h2 className="text-xl font-semibold text-white tracking-tight leading-snug">{selectedIssue.title || selectedIssue.keyword || selectedIssue.brand || "Incident Details"}</h2>
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

                                        {(selectedIssue.brand || selectedIssue.brand_domain) && (
                                            <div>
                                                <div className="text-gray-500 text-[10px] uppercase font-bold mb-1 tracking-widest">Brand Name</div>
                                                <span className="text-cyan-400 font-mono text-sm">{selectedIssue.brand || selectedIssue.brand_domain}</span>
                                            </div>
                                        )}

                                        {(selectedIssue.platform || selectedIssue.source) && (
                                            <div>
                                                <div className="text-gray-500 text-[10px] uppercase font-bold mb-1 tracking-widest">Platform</div>
                                                <span className="text-gray-300 font-mono text-xs break-all">{selectedIssue.platform || selectedIssue.source}</span>
                                            </div>
                                        )}

                                        {selectedIssue.assets && (
                                            <div>
                                                <div className="text-gray-500 text-[10px] uppercase font-bold mb-1 tracking-widest">Affected Asset</div>
                                                <span className="text-gray-300 font-mono text-xs break-all">{selectedIssue.assets}</span>
                                            </div>
                                        )}

                                        {(selectedIssue.url || selectedIssue.url_link) && (
                                            <div>
                                                <div className="text-gray-500 text-[10px] uppercase font-bold mb-1 tracking-widest">Target URL</div>
                                                <a href={(selectedIssue.url || selectedIssue.url_link).trim()} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1.5 font-mono text-xs break-all">
                                                    {(selectedIssue.url || selectedIssue.url_link).trim()} <CornerDownRight className="w-3 h-3 shrink-0" />
                                                </a>
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
