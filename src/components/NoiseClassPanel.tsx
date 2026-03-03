import type { NoiseClassification } from "@/lib/types";
import { Volume2, VolumeX, AlertTriangle, Shield, Radio } from "lucide-react";

interface Props { classification: NoiseClassification | null; }

const CATEGORY_META: Record<string, { label: string; icon: any; color: string; bg: string }> = {
    BENIGN_SCANNER: { label: "Benign Scanner", icon: Shield, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    MASS_SCANNER: { label: "Mass Scanner", icon: Radio, color: "text-blue-400", bg: "bg-blue-500/10" },
    NOISE: { label: "Background Noise", icon: VolumeX, color: "text-slate-400", bg: "bg-slate-500/10" },
    TARGETED_SCAN: { label: "Targeted Scan", icon: AlertTriangle, color: "text-yellow-400", bg: "bg-yellow-500/10" },
    ACTIVE_EXPLOITATION: { label: "Active Exploit", icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10" },
    C2_INFRASTRUCTURE: { label: "C2 Infra", icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10" },
    UNKNOWN: { label: "Unknown", icon: Volume2, color: "text-white/40", bg: "bg-white/5" },
};

const ACTION_BADGE: Record<string, { label: string; cls: string }> = {
    dismiss: { label: "Dismiss", cls: "badge-neutral" },
    low_priority: { label: "Low Priority", cls: "badge-neutral" },
    investigate: { label: "Investigate", cls: "badge-warning" },
    respond: { label: "Respond", cls: "badge-danger" },
    block: { label: "Block", cls: "badge-danger" },
};

const NoiseClassPanel = ({ classification }: Props) => {
    if (!classification) {
        return (
            <div className="card-panel card-body flex items-center justify-center py-12 h-full">
                <span className="text-sm" style={{ color: 'hsl(0 0% 100% / 0.3)' }}>Classifying noise…</span>
            </div>
        );
    }

    const meta = CATEGORY_META[classification.category] || CATEGORY_META.UNKNOWN;
    const action = ACTION_BADGE[classification.recommendedAction] || ACTION_BADGE.dismiss;
    const Icon = meta.icon;

    return (
        <div className="card-panel h-full">
            <div className="card-header">
                <h3>Noise Classification</h3>
                <span className={action.cls}>{action.label}</span>
            </div>
            <div className="card-body space-y-4">
                {/* Category */}
                <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${meta.bg}`}>
                        <Icon className={`w-4 h-4 ${meta.color}`} />
                    </div>
                    <div>
                        <div className={`text-sm font-semibold ${meta.color}`}>{meta.label}</div>
                        <div className="text-[11px] font-mono" style={{ color: 'hsl(0 0% 100% / 0.35)' }}>
                            {classification.confidence}% confidence
                        </div>
                    </div>
                </div>

                {/* Reasoning */}
                <p className="text-xs leading-relaxed" style={{ color: 'hsl(0 0% 100% / 0.45)' }}>
                    {classification.reasoning}
                </p>

                {/* Sources */}
                {classification.sources.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {classification.sources.map((s, i) => (
                            <span key={i} className="text-[10px] px-2 py-0.5 rounded font-mono"
                                style={{ background: 'hsl(0 0% 100% / 0.04)', color: 'hsl(0 0% 100% / 0.4)' }}>
                                {s}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default NoiseClassPanel;
