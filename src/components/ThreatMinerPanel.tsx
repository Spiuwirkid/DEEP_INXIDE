import type { ThreatMinerData } from "@/lib/types";
import { Network, Globe, FileSearch, Calendar, ExternalLink } from "lucide-react";

interface Props {
    data: ThreatMinerData;
    onPivot?: (query: string, type: "ip" | "domain" | "hash") => void;
}

export default function ThreatMinerPanel({ data, onPivot }: Props) {
    const hasDNS = data.passiveDNS.length > 0;
    const hasSubs = data.subdomains.length > 0;
    const hasSamples = data.relatedSamples.length > 0;
    const hasURIs = data.uris.length > 0;

    if (!hasDNS && !hasSubs && !hasSamples && !hasURIs) {
        return null;
    }

    return (
        <div className="card-panel h-full flex flex-col">
            <div className="card-header shrink-0">
                <div className="flex items-center gap-2">
                    <Network className="w-3.5 h-3.5" style={{ color: 'hsl(0 0% 100% / 0.4)' }} />
                    <h3>ThreatMiner</h3>
                </div>
                <div className="flex items-center gap-2">
                    {hasDNS && <span className="badge-primary text-[10px]">{data.passiveDNS.length} pDNS</span>}
                    {hasSubs && <span className="badge-neutral text-[10px]">{data.subdomains.length} subs</span>}
                    {hasSamples && <span className="badge-danger text-[10px]">{data.relatedSamples.length} samples</span>}
                </div>
            </div>
            <div className="card-body space-y-4">
                {/* Passive DNS */}
                {hasDNS && (
                    <div>
                        <div className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: 'hsl(0 0% 100% / 0.3)' }}>
                            Passive DNS
                        </div>
                        <div className="max-h-40 overflow-y-auto space-y-0">
                            {data.passiveDNS.slice(0, 15).map((rec, i) => (
                                <div key={i} className="data-row px-0">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Globe className="w-3 h-3 shrink-0" style={{ color: 'hsl(0 0% 100% / 0.2)' }} />
                                        <button
                                            onClick={() => onPivot?.(rec.domain, "domain")}
                                            className="text-xs font-mono truncate text-blue-400 hover:text-blue-300 transition-colors text-left">
                                            {rec.domain}
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-xs font-mono" style={{ color: 'hsl(0 0% 100% / 0.4)' }}>{rec.ip}</span>
                                        {rec.first_seen && (
                                            <span className="text-[10px] font-mono" style={{ color: 'hsl(0 0% 100% / 0.2)' }}>
                                                {rec.first_seen.split(" ")[0]}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Subdomains */}
                {hasSubs && (
                    <div>
                        <div className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: 'hsl(0 0% 100% / 0.3)' }}>
                            Subdomains
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {data.subdomains.slice(0, 20).map((sub, i) => (
                                <button key={i}
                                    onClick={() => onPivot?.(sub, "domain")}
                                    className="text-[10px] font-mono px-2 py-0.5 rounded text-blue-400 hover:text-blue-300 transition-colors"
                                    style={{ background: 'hsl(217 91% 60% / 0.06)', border: '1px solid hsl(217 91% 60% / 0.12)' }}>
                                    {sub}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Related Samples */}
                {hasSamples && (
                    <div>
                        <div className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: 'hsl(0 0% 100% / 0.3)' }}>
                            Related Samples
                        </div>
                        <div className="max-h-32 overflow-y-auto space-y-0">
                            {data.relatedSamples.slice(0, 10).map((hash, i) => (
                                <div key={i} className="data-row px-0">
                                    <button
                                        onClick={() => onPivot?.(hash, "hash")}
                                        className="text-xs font-mono truncate text-blue-400 hover:text-blue-300 transition-colors text-left flex items-center gap-1.5">
                                        <FileSearch className="w-3 h-3 shrink-0" style={{ color: 'hsl(0 0% 100% / 0.2)' }} />
                                        {hash}
                                    </button>
                                    <ExternalLink className="w-3 h-3 shrink-0" style={{ color: 'hsl(0 0% 100% / 0.15)' }} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* URIs */}
                {hasURIs && (
                    <div>
                        <div className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: 'hsl(0 0% 100% / 0.3)' }}>
                            Associated URIs
                        </div>
                        <div className="max-h-32 overflow-y-auto space-y-0">
                            {data.uris.slice(0, 10).map((uri, i) => (
                                <div key={i} className="data-row px-0">
                                    <span className="text-xs font-mono truncate" style={{ color: 'hsl(0 0% 100% / 0.5)' }}>{uri}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
