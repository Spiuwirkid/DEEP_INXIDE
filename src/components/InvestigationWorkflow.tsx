import { Check, Circle, ArrowRight, Workflow } from "lucide-react";

interface Step {
    label: string;
    done: boolean;
    active: boolean;
}

interface Props { steps: Step[]; }

export default function InvestigationWorkflow({ steps }: Props) {
    if (steps.length === 0) return null;

    const completed = steps.filter(s => s.done).length;
    const progress = Math.round((completed / steps.length) * 100);

    return (
        <div className="panel overflow-hidden">
            <div className="panel-header">
                <div className="panel-header-title">
                    <Workflow className="w-4 h-4 text-violet-400" />
                    <span>Workflow</span>
                </div>
                <span className="text-[10px] text-muted-foreground/50 font-mono">{completed}/{steps.length}</span>
            </div>

            <div className="panel-body">
                {/* Progress bar */}
                <div className="progress-bar mb-4">
                    <div className="progress-fill bg-violet-500" style={{ width: `${progress}%` }} />
                </div>

                {/* Steps — horizontal pipeline on wide, vertical on narrow */}
                <div className="hidden lg:flex items-center gap-1">
                    {steps.map((step, i) => (
                        <div key={i} className="flex items-center gap-1 flex-1 min-w-0">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${step.done ? "bg-emerald-500/15 border-emerald-500/25" :
                                    step.active ? "bg-violet-500/15 border-violet-500/25" :
                                        "bg-secondary border-border/30"
                                }`}>
                                {step.done ? (
                                    <Check className="w-2.5 h-2.5 text-emerald-400" />
                                ) : step.active ? (
                                    <ArrowRight className="w-2.5 h-2.5 text-violet-400 animate-pulse" />
                                ) : (
                                    <Circle className="w-2 h-2 text-zinc-600" />
                                )}
                            </div>
                            <span className={`text-[9px] truncate ${step.done ? "text-muted-foreground/40" :
                                    step.active ? "text-violet-300" : "text-muted-foreground/30"
                                }`}>{step.label}</span>
                            {i < steps.length - 1 && (
                                <div className={`h-px flex-1 min-w-2 ${step.done ? "bg-emerald-500/20" : "bg-border/20"}`} />
                            )}
                        </div>
                    ))}
                </div>

                {/* Vertical fallback */}
                <div className="lg:hidden space-y-1.5">
                    {steps.map((step, i) => (
                        <div key={i} className="flex items-center gap-2 text-[11px]">
                            {step.done ? (
                                <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                            ) : step.active ? (
                                <ArrowRight className="w-3 h-3 text-violet-400 shrink-0 animate-pulse" />
                            ) : (
                                <Circle className="w-3 h-3 text-zinc-600 shrink-0" />
                            )}
                            <span className={step.done ? "text-muted-foreground/40 line-through" : step.active ? "text-violet-300" : "text-muted-foreground/30"}>
                                {step.label}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
