import { ShieldCheck, Activity, Search, Radio, Box, ChevronRight } from "lucide-react";

interface SidebarProps {
    scanCount: number;
    isScanning: boolean;
    onNewScan: () => void;
}

const navItems = [
    { icon: Search, label: "Scanner", id: "scanner", active: true },
    { icon: Activity, label: "Activity", id: "activity" },
    { icon: Radio, label: "Threat Feed", id: "feed" },
    { icon: Box, label: "IOC Database", id: "ioc" },
];

interface SourceGroup {
    label: string;
    sources: { name: string; available: boolean }[];
}

const sourceGroups: SourceGroup[] = [
    {
        label: "Core",
        sources: [
            { name: "VirusTotal", available: true },
            { name: "Shodan", available: true },
            { name: "URLhaus", available: true },
            { name: "ThreatMiner", available: true },
        ],
    },
    {
        label: "Enrichment",
        sources: [
            { name: "MalwareBazaar", available: true },
            { name: "GreyNoise", available: true },
            { name: "ThreatFox", available: true },
            { name: "Feodo Tracker", available: true },
            { name: "CIRCL CVE", available: true },
        ],
    },
    {
        label: "Community",
        sources: [
            { name: "CISA KEV", available: true },
            { name: "EPSS", available: true },
            { name: "crt.sh", available: true },
            { name: "AbuseIPDB", available: true },
            { name: "GeoIP", available: true },
        ],
    },
];

const Sidebar = ({ scanCount, isScanning }: SidebarProps) => {
    return (
        <aside className="sidebar">
            {/* Brand */}
            <div className="px-5 py-5 border-b border-border/40">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-primary/12 flex items-center justify-center border border-primary/10">
                        <ShieldCheck className="w-4.5 h-4.5 text-primary" strokeWidth={2} />
                    </div>
                    <div>
                        <div className="text-sm font-bold text-foreground tracking-tight leading-none">
                            ThreatIntel
                        </div>
                        <div className="text-[9px] text-muted-foreground/50 mt-0.5 tracking-[0.2em] uppercase">
                            OSINT Platform
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="px-2 py-3 space-y-0.5">
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${item.active
                            ? "bg-primary/8 text-primary font-medium border border-primary/10"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                            }`}
                    >
                        <item.icon className="w-4 h-4" />
                        <span>{item.label}</span>
                        {item.active && (
                            <ChevronRight className="w-3 h-3 ml-auto opacity-40" />
                        )}
                    </button>
                ))}
            </nav>

            {/* Stats + Sources */}
            <div className="flex-1 overflow-y-auto px-4 py-3 border-t border-border/30 space-y-4">
                {/* Scan counter */}
                <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground/60">Scans today</span>
                    <span className="font-mono font-semibold text-foreground">{scanCount}</span>
                </div>

                {/* Source groups */}
                {sourceGroups.map((group) => (
                    <div key={group.label}>
                        <div className="text-[8px] uppercase tracking-[0.15em] text-muted-foreground/30 font-semibold mb-1.5">
                            {group.label}
                        </div>
                        <div className="space-y-1">
                            {group.sources.map((source) => (
                                <StatusDot key={source.name} label={source.name} status={isScanning ? "busy" : "ok"} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Version */}
            <div className="px-4 py-3 border-t border-border/30">
                <div className="text-[9px] text-muted-foreground/30 font-mono text-center">
                    v3.1.0 · Build 2026.02
                </div>
            </div>
        </aside>
    );
};

function StatusDot({ label, status }: { label: string; status: "ok" | "error" | "busy" }) {
    const colors = {
        ok: "bg-emerald-400/80",
        error: "bg-red-400",
        busy: "bg-amber-400 pulse-dot",
    };
    return (
        <div className="flex items-center justify-between py-0.5">
            <span className="text-[10px] text-muted-foreground/50">{label}</span>
            <span className={`w-1 h-1 rounded-full ${colors[status]}`} />
        </div>
    );
}

export default Sidebar;
