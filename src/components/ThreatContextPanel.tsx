import type { ThreatContext } from "@/lib/types";
import { Users, Target } from "lucide-react";

interface Props { context: ThreatContext | null; }

const ThreatContextPanel = ({ context }: Props) => {
    if (!context) return null;

    return (
        <div className="card-panel h-full flex flex-col">
            <div className="card-header shrink-0">
                <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5" style={{ color: 'hsl(0 0% 100% / 0.4)' }} />
                    <h3>Threat Context</h3>
                </div>
                {context.killChainStage && (
                    <span className="badge-warning text-[10px]">{context.killChainStage}</span>
                )}
            </div>
            <div className="card-body space-y-4">
                {/* Risk Narrative */}
                {context.riskNarrative && (
                    <p className="text-xs leading-relaxed" style={{ color: 'hsl(0 0% 100% / 0.5)' }}>
                        {context.riskNarrative}
                    </p>
                )}

                {/* Actors */}
                {context.actors.map((actor, i) => (
                    <div key={i} className="rounded-lg p-4" style={{ background: 'hsl(0 0% 100% / 0.025)', border: '1px solid hsl(0 0% 100% / 0.04)' }}>
                        <div className="flex items-center gap-2 mb-2">
                            <Target className="w-3 h-3 text-red-400" />
                            <span className="text-sm font-semibold text-white">{actor.name}</span>
                        </div>
                        <div className="space-y-0">
                            {actor.motivation && (
                                <div className="data-row px-0 py-1.5">
                                    <span className="text-[10px] uppercase tracking-wider" style={{ color: 'hsl(0 0% 100% / 0.3)' }}>Motivation</span>
                                    <span className="text-xs" style={{ color: 'hsl(0 0% 100% / 0.6)' }}>{actor.motivation}</span>
                                </div>
                            )}
                            {actor.targetedIndustries.length > 0 && (
                                <div className="data-row px-0 py-1.5">
                                    <span className="text-[10px] uppercase tracking-wider" style={{ color: 'hsl(0 0% 100% / 0.3)' }}>Targets</span>
                                    <span className="text-xs" style={{ color: 'hsl(0 0% 100% / 0.6)' }}>{actor.targetedIndustries.join(", ")}</span>
                                </div>
                            )}
                            {actor.knownMalware.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {actor.knownMalware.map((m, j) => (
                                        <span key={j} className="badge-danger text-[10px]">{m}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {/* Campaigns */}
                {context.campaigns.map((c, i) => (
                    <div key={i} className="data-row px-0">
                        <div>
                            <span className="text-xs font-semibold text-white">{c.name}</span>
                            <span className="text-[11px] ml-2" style={{ color: 'hsl(0 0% 100% / 0.35)' }}>{c.actor}</span>
                        </div>
                        <span className="badge-warning text-[10px]">{c.malwareFamily}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ThreatContextPanel;
