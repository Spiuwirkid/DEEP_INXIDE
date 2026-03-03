import type { ThreatFoxResult } from "@/lib/types";
import { Bug } from "lucide-react";

interface Props { data: ThreatFoxResult | null; }

const ThreatFoxPanel = ({ data }: Props) => {
    if (!data || data.query_status !== "ok" || !data.data?.length) return null;

    return (
        <div className="card-panel h-full flex flex-col">
            <div className="card-header shrink-0">
                <div className="flex items-center gap-2">
                    <Bug className="w-3.5 h-3.5" style={{ color: 'hsl(0 0% 100% / 0.4)' }} />
                    <h3>ThreatFox IOCs</h3>
                </div>
                <span className="badge-danger">{data.data.length} match{data.data.length !== 1 ? 'es' : ''}</span>
            </div>
            <div>
                {data.data.slice(0, 8).map((ioc, i) => (
                    <div key={i} className="data-row">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="badge-danger text-[9px]">{ioc.threat_type.replace('_', ' ')}</span>
                            <span className="text-xs font-mono truncate" style={{ color: 'hsl(0 0% 100% / 0.7)' }}>
                                {ioc.malware_printable}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[10px] font-mono" style={{ color: 'hsl(0 0% 100% / 0.3)' }}>
                                {ioc.confidence_level}%
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ThreatFoxPanel;
