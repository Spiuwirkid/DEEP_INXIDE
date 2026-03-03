interface ThreatGaugeProps {
  score: number;
  label: string;
}

const ThreatGauge = ({ score, label }: ThreatGaugeProps) => {
  const getColor = () => {
    if (score <= 15) return { text: "text-accent", bg: "bg-accent", hex: "hsl(152 69% 46%)" };
    if (score <= 40) return { text: "text-warning", bg: "bg-warning", hex: "hsl(38 92% 50%)" };
    if (score <= 70) return { text: "text-primary", bg: "bg-primary", hex: "hsl(258 90% 66%)" };
    return { text: "text-destructive", bg: "bg-destructive", hex: "hsl(0 63% 54%)" };
  };

  const getRiskLabel = () => {
    if (score <= 15) return "LOW";
    if (score <= 40) return "MEDIUM";
    if (score <= 70) return "HIGH";
    return "CRITICAL";
  };

  const getBadgeClass = () => {
    if (score <= 15) return "badge-safe";
    if (score <= 40) return "badge-warning";
    if (score <= 70) return "badge-primary";
    return "badge-danger";
  };

  const c = getColor();

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</span>
        <span className={getBadgeClass()}>{getRiskLabel()}</span>
      </div>

      {/* Large score */}
      <div className="flex items-baseline gap-1.5 mb-3">
        <span className={`text-4xl font-bold font-mono tabular-nums ${c.text}`}>
          {score}
        </span>
        <span className="text-sm text-muted-foreground font-mono">/100</span>
      </div>

      {/* Horizontal bar */}
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${c.bg} transition-all duration-1000 ease-out`}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* Scale labels */}
      <div className="flex justify-between mt-1.5 text-[9px] font-mono text-muted-foreground">
        <span>SAFE</span>
        <span>CRITICAL</span>
      </div>
    </div>
  );
};

export default ThreatGauge;
