import { useState, useEffect } from "react";

interface StatsCardsProps {
  stats: {
    malicious: number;
    suspicious: number;
    harmless: number;
    undetected: number;
  } | null;
}

function useCount(target: number, ms = 600) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!target) { setV(0); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / ms, 1);
      setV(Math.round(p * p * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, ms]);
  return v;
}

const StatsCards = ({ stats }: StatsCardsProps) => {
  const mal = useCount(stats?.malicious ?? 0);
  const sus = useCount(stats?.suspicious ?? 0);
  const safe = useCount(stats?.harmless ?? 0);
  const unk = useCount(stats?.undetected ?? 0);

  const total =
    (stats?.malicious ?? 0) +
    (stats?.suspicious ?? 0) +
    (stats?.harmless ?? 0) +
    (stats?.undetected ?? 0);

  const items = [
    { label: "Malicious", value: mal, raw: stats?.malicious ?? 0, color: "text-red-400", bar: "bg-red-400" },
    { label: "Suspicious", value: sus, raw: stats?.suspicious ?? 0, color: "text-amber-400", bar: "bg-amber-400" },
    { label: "Clean", value: safe, raw: stats?.harmless ?? 0, color: "text-emerald-400", bar: "bg-emerald-400" },
    { label: "Unknown", value: unk, raw: stats?.undetected ?? 0, color: "text-zinc-500", bar: "bg-zinc-500" },
  ];

  // Stacked bar percentages
  const segments = items.map(item => ({
    ...item,
    pct: total > 0 ? (item.raw / total) * 100 : 25,
  }));

  return (
    <div className="panel overflow-hidden slide-up">
      <div className="flex items-stretch divide-x divide-border/30">
        {segments.map((item) => (
          <div key={item.label} className="flex-1 px-4 py-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">{item.label}</span>
              {total > 0 && (
                <span className="text-[9px] font-mono text-muted-foreground/50">{Math.round(item.pct)}%</span>
              )}
            </div>
            <div className={`text-xl font-bold font-mono tabular-nums ${item.color}`}>
              {item.value}
            </div>
          </div>
        ))}
      </div>
      {/* Stacked bar */}
      <div className="flex h-1">
        {segments.map((item) => (
          <div
            key={item.label}
            className={`${item.bar} transition-all duration-700 first:rounded-bl-xl last:rounded-br-xl`}
            style={{ width: `${item.pct}%` }}
          />
        ))}
      </div>
    </div>
  );
};

export default StatsCards;
