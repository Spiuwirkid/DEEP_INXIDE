import { useState, useEffect, useRef } from "react";
import { Search, CornerDownLeft, Scan } from "lucide-react";
import { detectInputType } from "@/lib/api";

type SearchType = "ip" | "domain" | "url" | "hash";

interface SearchPanelProps {
  onSearch: (type: SearchType, query: string) => void;
  isLoading: boolean;
}

const TYPE_META: Record<SearchType, { label: string; color: string }> = {
  ip: { label: "IP", color: "hsl(217 91% 60%)" },
  domain: { label: "DOMAIN", color: "hsl(160 84% 50%)" },
  url: { label: "URL", color: "hsl(280 67% 55%)" },
  hash: { label: "HASH", color: "hsl(30 100% 55%)" },
};

const SearchPanel = ({ onSearch, isLoading }: SearchPanelProps) => {
  const [query, setQuery] = useState("");
  const [detectedType, setDetectedType] = useState<SearchType>("domain");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (query.trim()) setDetectedType(detectInputType(query));
  }, [query]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sanitized = query.trim().replace(/<[^>]*>/g, '').replace(/[<>"']/g, '').slice(0, 2048);
    if (sanitized && !isLoading) onSearch(detectedType, sanitized);
  };

  const meta = TYPE_META[detectedType];

  return (
    <form onSubmit={handleSubmit} className="search-cmd">
      <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200 z-10
        ${focused ? 'text-blue-400' : 'text-white/20'}`} />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Analyze IP, domain, URL, or hash…"
        className="search-cmd-input"
        maxLength={2048}
        spellCheck={false}
        autoComplete="off"
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
        {query.trim() && (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider"
            style={{
              background: `${meta.color}15`,
              color: meta.color,
              border: `1px solid ${meta.color}25`,
            }}>
            {meta.label}
          </span>
        )}
        {isLoading ? (
          <div className="w-5 h-5 rounded-lg flex items-center justify-center" style={{ background: 'hsl(217 91% 60% / 0.1)' }}>
            <Scan className="w-3 h-3 text-blue-400 animate-spin" />
          </div>
        ) : (
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono"
            style={{ background: 'hsl(0 0% 100% / 0.04)', color: 'hsl(0 0% 100% / 0.25)', border: '1px solid hsl(0 0% 100% / 0.06)' }}>
            <CornerDownLeft className="w-2.5 h-2.5" />
          </kbd>
        )}
      </div>
    </form>
  );
};

export default SearchPanel;
