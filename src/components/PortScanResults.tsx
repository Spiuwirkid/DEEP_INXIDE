import type { ShodanResult } from "@/lib/types";
import { Server } from "lucide-react";

interface Props { shodan: ShodanResult; }

const RISK_LEVEL: Record<number, { label: string; cls: string }> = {
    21: { label: "FTP", cls: "text-yellow-400" },
    22: { label: "SSH", cls: "text-yellow-400" },
    23: { label: "TELNET", cls: "text-red-400" },
    25: { label: "SMTP", cls: "text-yellow-400" },
    53: { label: "DNS", cls: "text-emerald-400" },
    80: { label: "HTTP", cls: "text-emerald-400" },
    110: { label: "POP3", cls: "text-yellow-400" },
    143: { label: "IMAP", cls: "text-yellow-400" },
    443: { label: "HTTPS", cls: "text-emerald-400" },
    445: { label: "SMB", cls: "text-red-400" },
    993: { label: "IMAPS", cls: "text-emerald-400" },
    995: { label: "POP3S", cls: "text-emerald-400" },
    3306: { label: "MySQL", cls: "text-red-400" },
    3389: { label: "RDP", cls: "text-red-400" },
    5432: { label: "PostgreSQL", cls: "text-red-400" },
    5900: { label: "VNC", cls: "text-red-400" },
    6379: { label: "Redis", cls: "text-red-400" },
    8080: { label: "HTTP-ALT", cls: "text-yellow-400" },
    8443: { label: "HTTPS-ALT", cls: "text-emerald-400" },
    27017: { label: "MongoDB", cls: "text-red-400" },
};

const PortScanResults = ({ shodan }: Props) => {
    const sortedPorts = [...shodan.ports].sort((a, b) => a - b);

    return (
        <div className="card-panel h-full flex flex-col">
            <div className="card-header shrink-0">
                <div className="flex items-center gap-2">
                    <Server className="w-3.5 h-3.5" style={{ color: 'hsl(0 0% 100% / 0.4)' }} />
                    <h3>Port & Service Scan</h3>
                </div>
                <span className="badge-primary">{shodan.ports.length} open</span>
            </div>

            {sortedPorts.length > 0 ? (
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Port</th>
                            <th>Service</th>
                            <th>Risk</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedPorts.map((port) => {
                            const info = RISK_LEVEL[port];
                            const isHighRisk = [23, 445, 3306, 3389, 5432, 5900, 6379, 27017].includes(port);
                            return (
                                <tr key={port}>
                                    <td className="font-mono font-semibold text-white/90">{port}</td>
                                    <td className="font-mono">{info?.label || "Unknown"}</td>
                                    <td>
                                        <span className={`text-xs font-semibold ${isHighRisk ? "text-red-400" : info?.cls || "text-white/40"}`}>
                                            {isHighRisk ? "HIGH" : "LOW"}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            ) : (
                <div className="card-body text-center py-8">
                    <span className="text-sm" style={{ color: 'hsl(0 0% 100% / 0.3)' }}>No open ports detected</span>
                </div>
            )}

            {/* Hostnames */}
            {shodan.hostnames.length > 0 && (
                <div className="px-5 py-3" style={{ borderTop: '1px solid hsl(0 0% 100% / 0.04)' }}>
                    <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'hsl(0 0% 100% / 0.3)' }}>Hostnames</span>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {shodan.hostnames.map((h, i) => (
                            <span key={i} className="text-[11px] px-2 py-0.5 rounded font-mono"
                                style={{ background: 'hsl(0 0% 100% / 0.04)', color: 'hsl(0 0% 100% / 0.55)' }}>
                                {h}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PortScanResults;
