import type { ConfidenceAssessment } from "@/lib/types";
import { CheckCircle2, AlertCircle, HelpCircle, MinusCircle } from "lucide-react";

interface Props { assessment: ConfidenceAssessment | null; }

const VERDICT_DOT: Record<string, string> = {
    malicious: "bg-red-400",
    suspicious: "bg-yellow-400",
    clean: "bg-emerald-400",
    unknown: "bg-white/20",
};

const LEVEL_META: Record<string, { icon: any; color: string }> = {
    confirmed: { icon: CheckCircle2, color: "text-emerald-400" },
    high: { icon: CheckCircle2, color: "text-blue-400" },
    moderate: { icon: AlertCircle, color: "text-yellow-400" },
    low: { icon: MinusCircle, color: "text-orange-400" },
    unverified: { icon: HelpCircle, color: "text-white/40" },
};

const ConfidencePanel = ({ assessment }: Props) => {
    if (!assessment) {
        return (
            <div className="card-panel card-body flex items-center justify-center py-12 h-full">
                <span className="text-sm" style={{ color: 'hsl(0 0% 100% / 0.3)' }}>Assessing confidence…</span>
            </div>
        );
    }

    const meta = LEVEL_META[assessment.level] || LEVEL_META.unverified;
    const LevelIcon = meta.icon;

    return (
        <div className="card-panel h-full">
            <div className="card-header">
                <h3>Confidence</h3>
                <div className="flex items-center gap-1.5">
                    <LevelIcon className={`w-3.5 h-3.5 ${meta.color}`} />
                    <span className={`text-xs font-semibold capitalize ${meta.color}`}>{assessment.level}</span>
                </div>
            </div>
            <div className="card-body space-y-4">
                {/* Score bar */}
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-2xl font-bold font-mono tabular-nums ${meta.color}`}>
                            {assessment.score}
                        </span>
                        <span className="text-[11px]" style={{ color: 'hsl(0 0% 100% / 0.3)' }}>
                            {assessment.agreeing}/{assessment.sourceCount} sources agree
                        </span>
                    </div>
                    <div className="progress-bar">
                        <div className={`progress-fill ${assessment.level === "confirmed" ? "bg-emerald-500" :
                                assessment.level === "high" ? "bg-blue-500" :
                                    assessment.level === "moderate" ? "bg-yellow-500" : "bg-orange-500"
                            }`} style={{ width: `${assessment.score}%` }} />
                    </div>
                </div>

                {/* Source evidence list */}
                <div className="space-y-0">
                    {assessment.evidence.slice(0, 6).map((e, i) => (
                        <div key={i} className="data-row px-0 py-2">
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${VERDICT_DOT[e.verdict]}`} />
                                <span className="text-xs" style={{ color: 'hsl(0 0% 100% / 0.6)' }}>{e.source}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono" style={{ color: 'hsl(0 0% 100% / 0.3)' }}>T{e.tier}</span>
                                <span className={`text-[10px] font-medium ${e.verdict === "clean" ? "text-emerald-400" :
                                        e.verdict === "malicious" ? "text-red-400" :
                                            e.verdict === "suspicious" ? "text-yellow-400" : "text-white/30"
                                    }`}>{e.verdict}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ConfidencePanel;
