import { useState } from "react";
import type { ScanEvent } from "@/lib/types";
import { Terminal, ChevronDown, ChevronRight } from "lucide-react";

interface ActivityFeedProps {
  events: ScanEvent[];
}

const ActivityFeed = ({ events }: ActivityFeedProps) => {
  const [expanded, setExpanded] = useState(false);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const statusColor = (s: ScanEvent["status"]) => {
    switch (s) {
      case "success": return "text-emerald-400";
      case "error": return "text-red-400";
      case "running": return "text-blue-400";
      default: return "text-white/30";
    }
  };

  const statusIcon = (s: ScanEvent["status"]) => {
    switch (s) {
      case "success": return "✓";
      case "error": return "✗";
      case "running": return "▸";
      default: return "·";
    }
  };

  return (
    <div className="card-panel overflow-hidden">
      <button onClick={() => setExpanded(!expanded)}
        className="w-full card-header cursor-pointer transition-colors"
        style={{ background: expanded ? 'hsl(0 0% 100% / 0.02)' : 'transparent' }}>
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="w-3 h-3" style={{ color: 'hsl(0 0% 100% / 0.35)' }} /> : <ChevronRight className="w-3 h-3" style={{ color: 'hsl(0 0% 100% / 0.35)' }} />}
          <Terminal className="w-3 h-3" style={{ color: 'hsl(0 0% 100% / 0.35)' }} />
          <h3>Scan Log</h3>
        </div>
        <span className="text-[10px] font-mono" style={{ color: 'hsl(0 0% 100% / 0.25)' }}>{events.length} events</span>
      </button>
      {expanded && (
        <div className="p-4 space-y-1 max-h-56 overflow-y-auto font-mono text-xs">
          {events.length === 0 && (
            <div style={{ color: 'hsl(0 0% 100% / 0.2)' }}>waiting for scan…</div>
          )}
          {events.map((ev) => (
            <div key={ev.id} className="flex items-start gap-2 leading-tight fade-in">
              <span className="shrink-0 w-16" style={{ color: 'hsl(0 0% 100% / 0.2)' }}>
                {formatTime(ev.timestamp)}
              </span>
              <span className={`shrink-0 w-3 ${statusColor(ev.status)}`}>
                {statusIcon(ev.status)}
              </span>
              <span style={{ color: 'hsl(0 0% 100% / 0.7)' }}>{ev.label}</span>
              {ev.detail && (
                <span className="truncate" style={{ color: 'hsl(0 0% 100% / 0.3)' }}>— {ev.detail}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ActivityFeed;
