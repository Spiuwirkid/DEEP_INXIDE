import { useState, useMemo } from "react";
import { Search } from "lucide-react";

interface VendorResultsProps {
  results: Record<string, { category: string; result: string | null; engine_name: string }> | null;
}

type Filter = "all" | "malicious" | "suspicious" | "harmless" | "undetected";

const FILTER_CONFIG: { key: Filter; label: string; dot: string }[] = [
  { key: "all", label: "All", dot: "" },
  { key: "malicious", label: "Malicious", dot: "bg-red-400" },
  { key: "suspicious", label: "Suspicious", dot: "bg-yellow-400" },
  { key: "harmless", label: "Clean", dot: "bg-emerald-400" },
  { key: "undetected", label: "N/A", dot: "bg-white/20" },
];

const VendorResults = ({ results }: VendorResultsProps) => {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const entries = useMemo(() => {
    if (!results) return [];
    return Object.values(results)
      .filter(
        (e) =>
          (filter === "all" || e.category === filter) &&
          (!search || e.engine_name.toLowerCase().includes(search.toLowerCase()))
      )
      .sort((a, b) => {
        const order: Record<string, number> = { malicious: 0, suspicious: 1, undetected: 2, harmless: 3 };
        return (order[a.category] ?? 4) - (order[b.category] ?? 4);
      });
  }, [results, filter, search]);

  if (!results) return null;
  const all = Object.values(results);
  const counts = {
    malicious: all.filter((e) => e.category === "malicious").length,
    suspicious: all.filter((e) => e.category === "suspicious").length,
    harmless: all.filter((e) => e.category === "harmless").length,
    undetected: all.filter((e) => e.category === "undetected").length,
  };

  const getBadge = (cat: string) => {
    switch (cat) {
      case "malicious": return "badge-danger";
      case "suspicious": return "badge-warning";
      case "harmless": return "badge-safe";
      default: return "badge-neutral";
    }
  };

  return (
    <div className="card-panel">
      {/* Header */}
      <div className="card-header">
        <h3>Vendor Analysis</h3>
        <span className="text-[11px] font-mono" style={{ color: 'hsl(0 0% 100% / 0.35)' }}>
          {all.length} engines
        </span>
      </div>

      {/* Filters */}
      <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid hsl(0 0% 100% / 0.04)' }}>
        <div className="flex items-center gap-1">
          {FILTER_CONFIG.map((f) => {
            const count = f.key === "all" ? all.length : counts[f.key as keyof typeof counts] ?? 0;
            return (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className="px-2.5 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1.5"
                style={{
                  background: filter === f.key ? 'hsl(0 0% 100% / 0.06)' : 'transparent',
                  color: filter === f.key ? 'hsl(0 0% 100% / 0.9)' : 'hsl(0 0% 100% / 0.4)',
                }}>
                {f.dot && <span className={`w-1.5 h-1.5 rounded-full ${f.dot}`} />}
                {f.label}
                <span className="font-mono" style={{ opacity: 0.5 }}>{count}</span>
              </button>
            );
          })}
        </div>
        <div className="ml-auto relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color: 'hsl(0 0% 100% / 0.3)' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter…"
            className="h-7 w-36 pl-7 pr-2 rounded text-[11px] focus:outline-none"
            style={{
              background: 'hsl(0 0% 100% / 0.04)',
              border: '1px solid hsl(0 0% 100% / 0.08)',
              color: 'hsl(0 0% 100% / 0.8)',
            }} />
        </div>
      </div>

      {/* Engine list */}
      <div className="max-h-[400px] overflow-y-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Engine</th>
              <th className="text-right">Result</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.engine_name}>
                <td className="font-medium text-white/80">{entry.engine_name}</td>
                <td className="text-right">
                  <span className={getBadge(entry.category)}>
                    {entry.result || entry.category}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {entries.length === 0 && (
          <div className="px-4 py-8 text-center text-xs" style={{ color: 'hsl(0 0% 100% / 0.3)' }}>No results</div>
        )}
      </div>
    </div>
  );
};

export default VendorResults;
