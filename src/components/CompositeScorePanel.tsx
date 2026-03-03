import type { CompositeScore } from "@/lib/types";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Props { score: CompositeScore | null; }

const WEIGHT_COLOR: Record<string, string> = {
    critical: "text-red-400",
    high: "text-orange-400",
    medium: "text-yellow-400",
    low: "text-emerald-400",
};

const WEIGHT_BG: Record<string, string> = {
    critical: "bg-red-500",
    high: "bg-orange-500",
    medium: "bg-yellow-500",
    low: "bg-emerald-500",
};

const CompositeScorePanel = ({ score }: Props) => {
    if (!score) {
        return (
            <div className="card-panel card-body flex items-center justify-center py-12">
                <span className="text-sm" style={{ color: 'hsl(0 0% 100% / 0.3)' }}>Calculating score…</span>
            </div>
        );
    }

    const levelColor = score.level === "critical" ? "text-red-400"
        : score.level === "high" ? "text-orange-400"
            : score.level === "moderate" ? "text-yellow-400" : "text-emerald-400";

    const barBg = score.level === "critical" ? "bg-red-500"
        : score.level === "high" ? "bg-orange-500"
            : score.level === "moderate" ? "bg-yellow-500" : "bg-emerald-500";

    return (
        <div className="card-panel h-full">
            <div className="card-header">
                <h3>Threat Score</h3>
                <span className="text-[11px] font-mono" style={{ color: 'hsl(0 0% 100% / 0.35)' }}>
                    {score.sourceCount} src · {score.sourcesAgreeing} agree
                </span>
            </div>
            <div className="card-body space-y-5">
                {/* Score + Level */}
                <div className="flex items-end gap-3">
                    <span className={`text-4xl font-extrabold font-mono tabular-nums leading-none ${levelColor}`}>
                        {score.total}
                    </span>
                    <span className="text-xs font-medium uppercase tracking-wider pb-1" style={{ color: 'hsl(0 0% 100% / 0.4)' }}>
                        / 100
                    </span>
                    <span className={`badge ml-auto ${score.level === "critical" ? "badge-danger" :
                            score.level === "high" ? "badge-warning" :
                                score.level === "moderate" ? "badge-warning" : "badge-safe"
                        }`}>
                        {score.confidence === "confirmed" ? <TrendingUp className="w-3 h-3" /> :
                            score.confidence === "possible" ? <Minus className="w-3 h-3" /> :
                                <TrendingDown className="w-3 h-3" />}
                        {score.level}
                    </span>
                </div>

                {/* Bar */}
                <div className="progress-bar">
                    <div className={`progress-fill ${barBg}`} style={{ width: `${Math.min(score.total, 100)}%` }} />
                </div>

                {/* Scoring Factors */}
                <div className="space-y-0">
                    <div className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: 'hsl(0 0% 100% / 0.3)' }}>
                        Scoring Factors
                    </div>
                    {score.factors.map((f, i) => (
                        <div key={i} className="data-row px-0">
                            <div className="flex items-center gap-2">
                                <span className={`w-1.5 h-1.5 rounded-full ${WEIGHT_BG[f.weight]}`} />
                                <span className="text-xs" style={{ color: 'hsl(0 0% 100% / 0.65)' }}>{f.name}</span>
                                <span className={`text-[10px] uppercase font-semibold ${WEIGHT_COLOR[f.weight]}`}>{f.weight}</span>
                            </div>
                            <span className="text-xs font-mono tabular-nums" style={{ color: 'hsl(0 0% 100% / 0.5)' }}>
                                {f.score > 0 ? '+' : ''}{f.score}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CompositeScorePanel;
