import type { CISAKEVEntry, EPSSResult, CVESearchResult } from "@/lib/types";
import { ShieldAlert, AlertTriangle } from "lucide-react";

interface Props {
    cveDetails: CVESearchResult | null;
    kevMatches: CISAKEVEntry[] | null;
    epssScores: EPSSResult | null;
}

export default function AttackSurfacePanel({ cveDetails, kevMatches, epssScores }: Props) {
    if (!cveDetails?.cves.length) return null;

    const kevSet = new Set((kevMatches || []).map(k => k.cveID));
    const epssMap = new Map((epssScores?.scores || []).map(s => [s.cve, s]));

    const enrichedCVEs = cveDetails.cves.map(cve => ({
        ...cve,
        isKEV: kevSet.has(cve.id),
        kev: (kevMatches || []).find(k => k.cveID === cve.id),
        epss: epssMap.get(cve.id),
    })).sort((a, b) => {
        if (a.isKEV !== b.isKEV) return a.isKEV ? -1 : 1;
        const aEpss = a.epss?.epss ?? 0;
        const bEpss = b.epss?.epss ?? 0;
        if (aEpss !== bEpss) return bEpss - aEpss;
        return (b.cvss3 || b.cvss || 0) - (a.cvss3 || a.cvss || 0);
    });

    const kevCount = enrichedCVEs.filter(c => c.isKEV).length;

    return (
        <div className="card-panel">
            <div className="card-header">
                <div className="flex items-center gap-2">
                    <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                    <h3>Attack Surface</h3>
                </div>
                <div className="flex items-center gap-2">
                    {kevCount > 0 && <span className="badge-danger">{kevCount} KEV</span>}
                    <span className="text-[11px] font-mono" style={{ color: 'hsl(0 0% 100% / 0.35)' }}>
                        {cveDetails.cves.length} CVEs
                    </span>
                </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>CVE</th>
                            <th className="text-center">CVSS</th>
                            <th className="text-center">EPSS</th>
                            <th className="text-center">Status</th>
                            <th>Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        {enrichedCVEs.slice(0, 20).map((cve, i) => {
                            const cvss = cve.cvss3 || cve.cvss || 0;
                            const cvssColor = cvss >= 9 ? "text-red-400" : cvss >= 7 ? "text-orange-400" : cvss >= 4 ? "text-yellow-400" : "text-white/30";
                            const epssVal = cve.epss?.epss ?? null;

                            return (
                                <tr key={i} className={cve.isKEV ? "bg-red-500/[0.03]" : ""}>
                                    <td className="font-mono font-semibold text-white/90 text-[11px]">{cve.id}</td>
                                    <td className={`text-center font-mono font-bold ${cvssColor}`}>
                                        {cvss > 0 ? cvss.toFixed(1) : "—"}
                                    </td>
                                    <td className={`text-center font-mono text-[10px] ${epssVal && epssVal > 0.5 ? "text-yellow-400 font-semibold" : ""}`}
                                        style={!(epssVal && epssVal > 0.5) ? { color: 'hsl(0 0% 100% / 0.3)' } : undefined}>
                                        {epssVal !== null ? `${(epssVal * 100).toFixed(0)}%` : "—"}
                                    </td>
                                    <td className="text-center">
                                        {cve.isKEV ? (
                                            <span className="badge-danger text-[9px]">
                                                <AlertTriangle className="w-2 h-2" />EXPL
                                            </span>
                                        ) : (
                                            <span style={{ color: 'hsl(0 0% 100% / 0.2)' }}>—</span>
                                        )}
                                    </td>
                                    <td className="text-[10px] truncate max-w-[200px]" style={{ color: 'hsl(0 0% 100% / 0.45)' }}>
                                        {cve.summary?.slice(0, 100) || "—"}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
