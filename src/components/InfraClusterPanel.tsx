import type { InfraCluster } from "@/lib/types";
import { Network, Server, Globe, Lock, Fingerprint } from "lucide-react";

interface Props { cluster: InfraCluster | null; }

const SIGNAL_ICONS: Record<string, any> = {
    shared_subnet: Network,
    shared_nameserver: Server,
    shared_cert: Lock,
    port_fingerprint: Fingerprint,
    naming_pattern: Globe,
    asn_density: Globe,
};

const STRENGTH_COLORS: Record<string, string> = {
    strong: "text-red-400",
    moderate: "text-yellow-400",
    weak: "text-white/35",
};

const InfraClusterPanel = ({ cluster }: Props) => {
    if (!cluster) return null;

    const SCALE_LABELS: Record<string, string> = {
        individual: "Individual",
        small_group: "Small Group",
        campaign: "Campaign",
        large_operation: "Large Operation",
    };

    return (
        <div className="card-panel h-full flex flex-col">
            <div className="card-header">
                <div className="flex items-center gap-2">
                    <Network className="w-3.5 h-3.5" style={{ color: 'hsl(0 0% 100% / 0.4)' }} />
                    <h3>Infrastructure Cluster</h3>
                </div>
                <span className="badge-neutral">{SCALE_LABELS[cluster.footprintScale] || cluster.footprintScale}</span>
            </div>
            <div className="card-body space-y-4">
                {/* Stats row */}
                <div className="flex items-center gap-4">
                    <div className="stat-pill">
                        <span className="font-mono font-bold text-blue-400">{cluster.relatedIPs.length}</span>
                        <span style={{ color: 'hsl(0 0% 100% / 0.4)' }}>IPs</span>
                    </div>
                    <div className="stat-pill">
                        <span className="font-mono font-bold text-blue-400">{cluster.relatedDomains.length}</span>
                        <span style={{ color: 'hsl(0 0% 100% / 0.4)' }}>Domains</span>
                    </div>
                    <div className="stat-pill">
                        <span className="font-mono font-bold text-blue-400">{cluster.signals.length}</span>
                        <span style={{ color: 'hsl(0 0% 100% / 0.4)' }}>Signals</span>
                    </div>
                </div>

                {/* Signals */}
                {cluster.signals.map((s, i) => {
                    const Icon = SIGNAL_ICONS[s.type] || Globe;
                    return (
                        <div key={i} className="data-row px-0">
                            <div className="flex items-center gap-2">
                                <Icon className="w-3.5 h-3.5" style={{ color: 'hsl(0 0% 100% / 0.3)' }} />
                                <span className="text-xs" style={{ color: 'hsl(0 0% 100% / 0.6)' }}>{s.detail}</span>
                            </div>
                            <span className={`text-[10px] font-semibold uppercase ${STRENGTH_COLORS[s.strength]}`}>{s.strength}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default InfraClusterPanel;
