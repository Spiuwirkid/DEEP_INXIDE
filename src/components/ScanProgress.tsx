import type { ScanEvent } from "@/lib/types";
import { Loader2 } from "lucide-react";

interface ScanProgressProps {
    events: ScanEvent[];
    isScanning: boolean;
}

const ScanProgress = ({ events, isScanning }: ScanProgressProps) => {
    const total = events.length;
    const done = events.filter((e) => e.status !== "running").length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    return (
        <div className="card-panel px-5 py-3">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    {isScanning && <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />}
                    <span className="text-[11px]" style={{ color: 'hsl(0 0% 100% / 0.45)' }}>
                        {isScanning ? "Analyzing…" : "Analysis complete"}
                    </span>
                </div>
                <span className="text-[11px] font-mono text-blue-400">
                    {done}/{total}
                </span>
            </div>
            <div className="progress-bar">
                <div className="progress-fill bg-blue-500"
                    style={{ width: `${isScanning ? pct : 100}%` }}>
                    {isScanning && (
                        <div className="h-full w-1/3 bg-white/20 rounded-full"
                            style={{ animation: "scan 1.2s ease-in-out infinite" }} />
                    )}
                </div>
            </div>
        </div>
    );
};

export default ScanProgress;
