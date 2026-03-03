import type { CVESearchResult } from "@/lib/types";
import { ShieldAlert, ExternalLink } from "lucide-react";

interface Props {
    data: CVESearchResult;
}

function cvssColor(score: number): string {
    if (score >= 9) return "text-destructive";
    if (score >= 7) return "text-orange-400";
    if (score >= 4) return "text-yellow-400";
    return "text-accent";
}

function cvssLabel(score: number): string {
    if (score >= 9) return "CRITICAL";
    if (score >= 7) return "HIGH";
    if (score >= 4) return "MEDIUM";
    return "LOW";
}

export default function VulnIntelPanel({ data }: Props) {
    if (data.cves.length === 0) return null;

    // Sort by CVSS score descending
    const sorted = [...data.cves].sort((a, b) => {
        const sa = a.cvss3 || a.cvss || 0;
        const sb = b.cvss3 || b.cvss || 0;
        return sb - sa;
    });

    return (
        <div className="panel overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-orange-400" />
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                        Vulnerability Intelligence
                    </span>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">
                    {data.cves.length}/{data.totalCount} CVEs enriched · CIRCL
                </span>
            </div>

            {/* CVE list */}
            <div className="max-h-80 overflow-y-auto">
                {sorted.map((cve) => {
                    const score = cve.cvss3 || cve.cvss || 0;
                    return (
                        <div key={cve.id} className="px-4 py-3 border-b border-border last:border-0 hover:bg-secondary/20">
                            <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                    <a
                                        href={`https://nvd.nist.gov/vuln/detail/${cve.id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs font-mono text-primary font-bold hover:underline flex items-center gap-1"
                                    >
                                        {cve.id}
                                        <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                </div>
                                <div className="flex items-center gap-2">
                                    {score > 0 && (
                                        <>
                                            <span className={`text-sm font-mono font-black ${cvssColor(score)}`}>
                                                {score.toFixed(1)}
                                            </span>
                                            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${score >= 9 ? "bg-destructive/10 border-destructive/30 text-destructive" :
                                                    score >= 7 ? "bg-orange-500/10 border-orange-500/30 text-orange-400" :
                                                        score >= 4 ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400" :
                                                            "bg-accent/10 border-accent/30 text-accent"
                                                }`}>
                                                {cvssLabel(score)}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                                {cve.summary || "No description available"}
                            </p>
                            {cve.Published && (
                                <div className="mt-1.5 text-[10px] text-muted-foreground/60 font-mono">
                                    Published: {cve.Published.split("T")[0]}
                                    {cve.impact && (
                                        <span className="ml-3">
                                            C:{cve.impact.confidentiality?.charAt(0) || "?"} / I:{cve.impact.integrity?.charAt(0) || "?"} / A:{cve.impact.availability?.charAt(0) || "?"}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
