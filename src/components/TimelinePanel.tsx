import type { TimelineEvent } from "@/lib/types";
import { Clock } from "lucide-react";

interface Props { events: TimelineEvent[] | null; }

const TYPE_DOT: Record<string, string> = {
    first_seen: "bg-emerald-400",
    last_seen: "bg-blue-400",
    feed_appearance: "bg-red-400",
    service_change: "bg-yellow-400",
    campaign: "bg-orange-400",
    report: "bg-purple-400",
};

const TimelinePanel = ({ events }: Props) => {
    if (!events || events.length === 0) return null;

    const sorted = [...events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <div className="card-panel">
            <div className="card-header">
                <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" style={{ color: 'hsl(0 0% 100% / 0.4)' }} />
                    <h3>Timeline</h3>
                </div>
                <span className="text-[11px] font-mono" style={{ color: 'hsl(0 0% 100% / 0.35)' }}>{events.length} events</span>
            </div>
            <div className="card-body">
                <div className="space-y-0">
                    {sorted.map((e, i) => (
                        <div key={i} className="flex items-start gap-3 py-2.5"
                            style={{ borderBottom: i < sorted.length - 1 ? '1px solid hsl(0 0% 100% / 0.04)' : 'none' }}>
                            <div className="flex flex-col items-center pt-1.5">
                                <span className={`w-2 h-2 rounded-full ${TYPE_DOT[e.type] || "bg-white/20"}`} />
                                {i < sorted.length - 1 && (
                                    <div className="w-px flex-1 mt-1" style={{ background: 'hsl(0 0% 100% / 0.06)', minHeight: '16px' }} />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-xs" style={{ color: 'hsl(0 0% 100% / 0.7)' }}>{e.event}</div>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] font-mono" style={{ color: 'hsl(0 0% 100% / 0.25)' }}>
                                        {new Date(e.date).toLocaleDateString()}
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0 rounded font-mono"
                                        style={{ background: 'hsl(0 0% 100% / 0.04)', color: 'hsl(0 0% 100% / 0.3)' }}>
                                        {e.source}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TimelinePanel;
