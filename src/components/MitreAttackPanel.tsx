import type { MitreMapping } from "@/lib/types";
import { Shield, ExternalLink } from "lucide-react";

interface Props { mapping: MitreMapping; }

const TACTIC_ORDER = [
    "Reconnaissance", "Resource Development", "Initial Access", "Execution",
    "Persistence", "Privilege Escalation", "Defense Evasion", "Credential Access",
    "Discovery", "Lateral Movement", "Collection", "Command and Control",
    "Exfiltration", "Impact",
];

/** Parse a source string and render CVE IDs as clickable red links */
const renderSource = (source: string) => {
    // Match CVE patterns like CVE-2023-44487, CVE-2025-23419
    const cveRegex = /(CVE-\d{4}-\d{4,})/g;
    const parts = source.split(cveRegex);

    if (parts.length === 1) {
        // No CVEs found, return plain text
        return <span className="text-[10px] font-mono" style={{ color: 'hsl(0 0% 100% / 0.35)' }}>{source}</span>;
    }

    return (
        <span className="text-[10px] font-mono inline-flex flex-wrap items-center gap-1">
            {parts.map((part, i) => {
                if (cveRegex.test(part)) {
                    // Reset regex lastIndex since we're using .test() in a loop
                    cveRegex.lastIndex = 0;
                }
                if (/^CVE-\d{4}-\d{4,}$/.test(part)) {
                    return (
                        <a
                            key={i}
                            href={`https://nvd.nist.gov/vuln/detail/${part}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-red-400 font-semibold transition-all duration-200 hover:text-red-300 hover:bg-red-400/10"
                            style={{ border: '1px solid hsl(0 74% 42% / 0.3)' }}
                            title={`View ${part} on NVD`}
                        >
                            {part}
                            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                        </a>
                    );
                }
                // Non-CVE text (prefix like "Shodan (", separator ", ", suffix ")")
                const trimmed = part.trim();
                if (!trimmed) return null;
                return (
                    <span key={i} style={{ color: 'hsl(0 0% 100% / 0.3)' }}>{part}</span>
                );
            })}
        </span>
    );
};

const MitreAttackPanel = ({ mapping }: Props) => {
    // Group techniques by tactic
    const byTactic = new Map<string, typeof mapping.techniques>();
    for (const t of mapping.techniques) {
        const list = byTactic.get(t.tactic) || [];
        list.push(t);
        byTactic.set(t.tactic, list);
    }

    const sortedTactics = [...byTactic.entries()].sort((a, b) => {
        const ai = TACTIC_ORDER.indexOf(a[0]);
        const bi = TACTIC_ORDER.indexOf(b[0]);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

    return (
        <div className="card-panel h-full flex flex-col">
            <div className="card-header shrink-0">
                <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5" style={{ color: 'hsl(0 0% 100% / 0.4)' }} />
                    <h3>MITRE ATT&CK</h3>
                </div>
                <span className="badge-primary">{mapping.techniques.length} techniques</span>
            </div>
            <div className="card-body space-y-5">
                {sortedTactics.map(([tactic, techs]) => (
                    <div key={tactic}>
                        <div className="text-[10px] uppercase tracking-wider font-semibold mb-2"
                            style={{ color: 'hsl(0 0% 100% / 0.3)' }}>
                            {tactic}
                        </div>
                        {techs.map((t, i) => (
                            <div key={i} className="py-2.5 px-0 space-y-1.5" style={{ borderBottom: '1px solid hsl(0 0% 100% / 0.04)' }}>
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className="badge-primary text-[10px] font-mono">{t.id}</span>
                                        <span className="text-xs font-medium" style={{ color: 'hsl(0 0% 100% / 0.7)' }}>{t.name}</span>
                                    </div>
                                </div>
                                {/* Description */}
                                <p className="text-[11px] leading-relaxed pl-0.5" style={{ color: 'hsl(0 0% 100% / 0.35)' }}>
                                    {t.description}
                                </p>
                                {/* Source with clickable CVEs */}
                                <div className="flex items-start gap-1.5 pl-0.5">
                                    <span className="text-[9px] uppercase font-semibold tracking-wider mt-0.5 shrink-0" style={{ color: 'hsl(0 0% 100% / 0.2)' }}>
                                        Source:
                                    </span>
                                    {renderSource(t.source)}
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MitreAttackPanel;
