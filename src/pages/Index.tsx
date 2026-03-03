import { useState, useCallback, useRef, useEffect } from "react";
import type { ScanState, ScanEvent, ScanStep } from "@/lib/types";
import {
  lookupVirusTotal, lookupShodanInternetDB, lookupGeoIP, lookupURLhaus,
  resolveHostToIP, resolveDNS, lookupThreatMiner, lookupMalwareBazaar,
  lookupCVEBatch, lookupFeodoTracker, detectInputType, saveScanResult,
  getScanHistory, getScanById, addToWatchlist, getWatchlist, removeFromWatchlist
} from "@/lib/api";
import { lookupGreyNoise } from "@/lib/api/greynoise";
import { lookupThreatFox } from "@/lib/api/threatfox";
import { lookupAbuseIPDB } from "@/lib/api/abuseipdb";
import { lookupCrtSh } from "@/lib/api/crtsh";
import { lookupCISAKEV } from "@/lib/api/cisakev";
import { lookupEPSS } from "@/lib/api/epss";
import { calculateCompositeScore } from "@/lib/scoring";
import { generateMitreMapping } from "@/lib/mitre";
import { classifyNoise } from "@/lib/engines/noise-classifier";
import { assessConfidence } from "@/lib/engines/confidence-model";
import { analyzeInfraCluster } from "@/lib/engines/infra-cluster";
import { buildThreatContext, buildTimeline } from "@/lib/engines/threat-context";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { generatePDFReport } from "@/lib/report-generator";

// ─── ALL COMPONENT IMPORTS (RESTORED) ───
import GeoMap from "@/components/GeoMap";
import CompositeScorePanel from "@/components/CompositeScorePanel";
import NoiseClassPanel from "@/components/NoiseClassPanel";
import ConfidencePanel from "@/components/ConfidencePanel";
import PortScanResults from "@/components/PortScanResults";
import VendorResults from "@/components/VendorResults";
import MitreAttackPanel from "@/components/MitreAttackPanel";
import TimelinePanel from "@/components/TimelinePanel";
import ThreatContextPanel from "@/components/ThreatContextPanel";
import InfraClusterPanel from "@/components/InfraClusterPanel";
import AttackSurfacePanel from "@/components/AttackSurfacePanel";
import ThreatFoxPanel from "@/components/ThreatFoxPanel";
import ThreatMinerPanel from "@/components/ThreatMinerPanel";
import MalwareIntelPanel from "@/components/MalwareIntelPanel";
import VulnIntelPanel from "@/components/VulnIntelPanel";
import ScanProgress from "@/components/ScanProgress";
import GeminiAnalysisPanel from "@/components/GeminiAnalysisPanel";
import ThreatGraphPanel from "@/components/ThreatGraphPanel";
import GlobalIntelFeed from "@/components/GlobalIntelFeed";
import MultiServicePortal from "@/components/CyberXTronPortal";
import ApiPortal from "@/components/ApiPortal";
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarTrigger } from "@/components/ui/menubar";

import {
  Shield, Globe, Activity, Server, Terminal,
  Wifi, Database, ChevronRight, Network, Lock,
  History, Calendar, ArrowUpRight, FileText, Eye, Trash2, Plus, MonitorDot,
  HandHeart,
  CurlyBracesIcon,
  CodeXml,
  ScanFace,
  ScanLine,
  LayoutGrid,
  KanbanSquareIcon,
  KanbanIcon,
  KanbanSquareDashedIcon,
  ScanSearchIcon,
  SatelliteDishIcon,
  SquareDashedKanban,
  SearchX
} from "lucide-react";

/* ─── UTILS ─── */
function gid(): string { return Math.random().toString(36).slice(2, 9); }

const Index = () => {
  const { user, signOut } = useAuth();
  const [scanState, setScanState] = useState<ScanState | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [currentScanId, setCurrentScanId] = useState<string | null>(null);
  const eventsRef = useRef<ScanEvent[]>([]);
  const [query, setQuery] = useState("");
  const [activeView, setActiveView] = useState<'scanner' | 'history' | 'watchlist' | 'global' | 'portal' | 'api_portal'>('scanner');
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadedAnalysis, setLoadedAnalysis] = useState<any>(null);

  /* New Features State */
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [showGraph, setShowGraph] = useState(false);

  // ─── EFFECTS ───
  useEffect(() => {
    if (activeView === 'history') {
      setLoadingHistory(true);
      getScanHistory()
        .then(setHistoryList)
        .catch(console.error)
        .finally(() => setLoadingHistory(false));
    } else if (activeView === 'watchlist') {
      setLoadingHistory(true); // Reuse loading state
      getWatchlist()
        .then(setWatchlist)
        .catch(console.error)
        .finally(() => setLoadingHistory(false));
    }
  }, [activeView]);

  // ─── AUTO-SAVE SCAN HISTORY ───
  useEffect(() => {
    if (isScanning) return; // Wait until scanning is finished
    if (scanState?.currentStep === "complete" && !currentScanId) {
      // Prevent double-save by checking if we already have an ID for this session
      // Wait a tick to ensure all state updates are flushed
      const timer = setTimeout(async () => {
        try {
          const newId = await saveScanResult(scanState);
          if (newId) {
            console.log("Scan saved with ID:", newId);
            setCurrentScanId(newId);
            toast.success("Scan history saved");
          }
        } catch (e) {
          console.error("Failed to save scan:", e);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [scanState, isScanning, currentScanId]);

  // ─── CORE SCAN LOGIC ───
  const addEvent = useCallback((step: ScanStep, label: string, status: ScanEvent["status"], detail?: string) => {
    const event: ScanEvent = { id: gid(), step, label, status, detail, timestamp: Date.now() };
    eventsRef.current = [...eventsRef.current, event];
    setScanState(p => p ? { ...p, events: eventsRef.current, currentStep: step } : p);
    return event.id;
  }, []);

  const updateEvent = useCallback((id: string, status: ScanEvent["status"], detail?: string) => {
    eventsRef.current = eventsRef.current.map(e => e.id === id ? { ...e, status, detail: detail ?? e.detail } : e);
    setScanState(p => p ? { ...p, events: eventsRef.current } : p);
  }, []);

  const handleSearch = async (q: string) => {
    if (!q.trim()) return;
    const type = detectInputType(q);
    setIsScanning(true);
    setCurrentScanId(null);
    setLoadedAnalysis(null);
    setShowGraph(false);
    eventsRef.current = [];
    setScanState({ query: q, type, currentStep: "resolving", events: [], results: {}, resolvedIP: undefined });

    try {
      let targetIP = q;
      // 1. DNS Resolution
      if (type === "domain" || type === "url") {
        const id = addEvent("resolving", "DNS_RESOLVE", "running", "Querying nameservers...");
        try {
          const dns = await resolveDNS(q);
          const ip = await resolveHostToIP(type === "url" ? new URL(q).hostname : q);
          if (ip) {
            targetIP = ip;
            updateEvent(id, "success", `Resolved: ${ip}`);
            setScanState(p => p ? { ...p, resolvedIP: ip, results: { ...p.results, dns } } : p);
          } else { updateEvent(id, "warning", "No IP resolution"); }
        } catch (e: any) { updateEvent(id, "error", e.message); }
      }

      // 2. Parallel Intelligence Engines
      const promises: Promise<void>[] = [];

      // VirusTotal
      promises.push((async () => {
        const id = addEvent("virustotal", "VIRUSTOTAL", "running", "Analyzing hash signatures...");
        try {
          const vt = await lookupVirusTotal(type, q);
          if (vt) {
            updateEvent(id, vt.stats.malicious > 0 ? "warning" : "success",
              `Detections: ${vt.stats.malicious}/${vt.stats.harmless + vt.stats.malicious + vt.stats.suspicious + vt.stats.undetected}`);
            setScanState(p => p ? { ...p, results: { ...p.results, vt } } : p);
          } else { updateEvent(id, "error", "No VT data returned"); }
        } catch (e: any) { updateEvent(id, "error", e.message); }
      })());

      // Shodan + CVE + KEV + EPSS
      if (type !== 'hash') {
        promises.push((async () => {
          const id = addEvent("portscan", "SHODAN_INTERNET_DB", "running", "Scanning ports & vulnerabilities...");
          try {
            if (type !== 'ip') await new Promise(r => setTimeout(r, 500));
            const shodan = await lookupShodanInternetDB(targetIP);
            updateEvent(id, "success", `Ports: ${shodan.ports.length} | Vulns: ${shodan.vulns.length}`);
            setScanState(p => p ? { ...p, results: { ...p.results, shodan } } : p);
            if (shodan.vulns.length) {
              const cveId = addEvent("cve", "CVE_ENRICHMENT", "running", "Cross-referencing CISA KEV & EPSS...");
              try {
                const [cves, kev, epss] = await Promise.all([
                  lookupCVEBatch(shodan.vulns), lookupCISAKEV(shodan.vulns), lookupEPSS(shodan.vulns)
                ]);
                setScanState(p => p ? { ...p, results: { ...p.results, cveDetails: cves, cisakev: kev, epss } } : p);
                updateEvent(cveId, "success", `${cves.cves.length} CVEs analyzed`);
              } catch (e: any) { updateEvent(cveId, "error", e.message); }
            }
          } catch (e: any) { updateEvent(id, "error", e.message); }
        })());
      }

      // GeoIP
      if (type !== 'hash') {
        promises.push((async () => {
          const id = addEvent("geolookup", "GEO_LOCATION", "running", "Triangulating coordinates...");
          try {
            const geo = await lookupGeoIP(targetIP);
            setScanState(p => p ? { ...p, results: { ...p.results, geo } } : p);
            updateEvent(id, "success", `${geo.country} - ${geo.isp}`);
          } catch (e: any) { updateEvent(id, "error", e.message); }
        })());
      }

      // URLhaus
      if (type === "url" || type === "domain") {
        promises.push((async () => {
          const id = addEvent("urlhaus", "URLHAUS_SCAN", "running", "Checking abuse.ch URLhaus...");
          try {
            const uh = await lookupURLhaus(q, type === "url" ? "url" : "host");
            setScanState(p => p ? { ...p, results: { ...p.results, urlhaus: uh } } : p);
            updateEvent(id, "success", `Status: ${uh.query_status}`);
          } catch (e: any) { updateEvent(id, "error", e.message); }
        })());
      }

      // CRT.sh (SSL Certificates)
      if (type === "domain" || type === "url") {
        promises.push((async () => {
          const id = addEvent("crtsh", "CERT_TRANSPARENCY", "running", "Querying crt.sh...");
          try {
            const certs = await lookupCrtSh(q);
            setScanState(p => p ? { ...p, results: { ...p.results, crtsh: certs } } : p);
            updateEvent(id, "success", `${certs.length} certificates found`);
          } catch (e: any) { updateEvent(id, "error", e.message); }
        })());
      }

      // ThreatFox
      promises.push((async () => {
        const id = addEvent("threatfox", "THREATFOX_IOC", "running", "Checking ThreatFox IOC database...");
        try {
          const tf = await lookupThreatFox(q, type as any);
          setScanState(p => p ? { ...p, results: { ...p.results, threatfox: tf } } : p);
          updateEvent(id, "success", `${tf.data?.length || 0} IOCs matched`);
        } catch (e: any) { updateEvent(id, "error", e.message); }
      })());

      // ThreatMiner
      if (type === "domain" || type === "ip") {
        promises.push((async () => {
          const id = addEvent("threatminer", "THREATMINER", "running", "Querying ThreatMiner...");
          try {
            const tm = await lookupThreatMiner(q, type as any);
            setScanState(p => p ? { ...p, results: { ...p.results, threatMiner: tm } } : p);
            updateEvent(id, "success", `pDNS: ${tm.passiveDNS.length} | Subs: ${tm.subdomains.length}`);
          } catch (e: any) { updateEvent(id, "error", e.message); }
        })());
      }

      // MalwareBazaar
      if (type === "hash") {
        promises.push((async () => {
          const id = addEvent("malwarebazaar", "MALWARE_BAZAAR", "running", "Querying MalwareBazaar...");
          try {
            const mb = await lookupMalwareBazaar(q, "hash");
            setScanState(p => p ? { ...p, results: { ...p.results, malwareBazaar: mb } } : p);
            updateEvent(id, "success", `${mb.data?.length || 0} samples found`);
          } catch (e: any) { updateEvent(id, "error", e.message); }
        })());
      }

      // GreyNoise
      if (type === "ip") {
        promises.push((async () => {
          const id = addEvent("greynoise", "GREYNOISE", "running", "Checking GreyNoise...");
          try {
            const gn = await lookupGreyNoise(q);
            setScanState(p => p ? { ...p, results: { ...p.results, greynoise: gn } } : p);
            updateEvent(id, "success", `Classification: ${gn.classification || "unknown"}`);
          } catch (e: any) { updateEvent(id, "error", e.message); }
        })());
      }

      // AbuseIPDB
      if (type === "ip") {
        promises.push((async () => {
          const id = addEvent("abuseipdb", "ABUSEIPDB", "running", "Checking AbuseIPDB...");
          try {
            const abuse = await lookupAbuseIPDB(q);
            setScanState(p => p ? { ...p, results: { ...p.results, abuseipdb: abuse } } : p);
            updateEvent(id, "success", `Abuse confidence: ${abuse.abuseConfidenceScore}%`);
          } catch (e: any) { updateEvent(id, "error", e.message); }
        })());
      }

      // Feodo Tracker
      if (type === "ip") {
        promises.push((async () => {
          const id = addEvent("feodo", "FEODO_TRACKER", "running", "Checking Feodo Tracker...");
          try {
            const feodo = await lookupFeodoTracker(q);
            setScanState(p => p ? { ...p, results: { ...p.results, feodo } } : p);
            updateEvent(id, "success", `${feodo.entries?.length || 0} entries`);
          } catch (e: any) { updateEvent(id, "error", e.message); }
        })());
      }

      // Wait for all engines
      await Promise.allSettled(promises);

      // 3. Scoring & Analysis Phase
      const sid = addEvent("scoring", "COMPOSITE_SCORING", "running", "Calculating risk vectors...");
      setScanState(prev => {
        if (!prev) return null;
        const noise = classifyNoise(prev);
        const prevWithNoise = { ...prev, results: { ...prev.results, noiseClassification: noise } };
        const score = calculateCompositeScore(prevWithNoise);
        updateEvent(sid, "success", `Risk Level: ${score.level.toUpperCase()}`);
        return {
          ...prev,
          results: {
            ...prev.results,
            noiseClassification: noise,
            compositeScore: score,
            mitre: generateMitreMapping(prev),
            confidence: assessConfidence(prev),
            infraCluster: analyzeInfraCluster(prev),
            threatContext: buildThreatContext(prev),
            timeline: buildTimeline(prev)
          },
          currentStep: "complete"
        };
      });
      addEvent("complete", "OPERATION_COMPLETE", "success", "All engines finished.");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsScanning(false);
    }
  };

  // ─── PIVOT HANDLER (for ThreatMiner) ───
  const handlePivot = (newQuery: string, _type: "ip" | "domain" | "hash") => {
    setQuery(newQuery);
    handleSearch(newQuery);
  };

  const handleAddToWatchlist = async () => {
    if (!scanState) return;
    try {
      await addToWatchlist({ target: scanState.query, type: scanState.type });
      toast.success("Added to active monitoring");
    } catch (e) {
      toast.error("Failed to add to watchlist");
    }
  };

  // ─── HISTORY LOADER ───
  const loadScanRecord = async (id: string) => {
    try {
      setLoadingHistory(true);
      const record = await getScanById(id);
      if (record) {
        eventsRef.current = [];
        setScanState({
          query: record.target,
          type: record.scan_type,
          currentStep: "complete",
          events: [],
          results: record.scan_data,
          resolvedIP: record.scan_data?.dns?.Answer?.[0]?.data || undefined
        });
        setCurrentScanId(record.id);
        const analysis = record.ai_analysis;
        setLoadedAnalysis(analysis || null);

        setActiveView('scanner');
        toast.success(`Loaded scan: ${record.target}`);
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to load record");
    } finally {
      setLoadingHistory(false);
    }
  };

  // ─── VIEWS ───
  const HistoryView = () => (
    <div className="w-full max-w-5xl mx-auto px-6 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-32">
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-white/10">
        <History className="w-6 h-6 text-cyan-400" />
        <h2 className="text-2xl font-bold text-white tracking-tight">Scan Search History</h2>
        <span className="ml-auto text-xs font-mono text-gray-500">{historyList.length} records</span>
      </div>

      {loadingHistory ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-cyan-500/50 border-t-cyan-500 rounded-full animate-spin" />
        </div>
      ) : historyList.length === 0 ? (
        <div className="text-center py-12 text-gray-500 font-mono">No scan history found.</div>
      ) : (
        <div className="grid gap-3">
          {historyList.map(h => (
            <div key={h.id}
              onClick={() => loadScanRecord(h.id)}
              className="group relative flex items-center gap-4 p-4 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-cyan-500/30 transition-all cursor-pointer overflow-hidden">
              <div className={`w-1 h-8 rounded-full transition-all group-hover:h-full group-hover:rounded-none group-hover:absolute group-hover:left-0 group-hover:top-0 group-hover:w-[2px] ${h.risk_level === 'safe' ? 'bg-emerald-500' :
                h.risk_level === 'low' ? 'bg-blue-500' :
                  h.risk_level === 'medium' ? 'bg-yellow-500' :
                    h.risk_level === 'high' ? 'bg-orange-500' : 'bg-red-500'
                }`} />
              <div className="flex-1 min-w-0 pl-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg font-bold text-white truncate">{h.target}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/10 uppercase text-gray-400">{h.scan_type}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500 font-mono">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(h.created_at).toLocaleString()}</span>
                  <span className={getScoreColor(h.risk_level)}>{(h.risk_score || 0).toFixed(0)} RISK SCORE</span>
                </div>
              </div>
              <ArrowUpRight className="w-5 h-5 text-gray-600 group-hover:text-cyan-400 transition-colors opacity-0 group-hover:opacity-100" />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const WatchlistView = () => (
    <div className="w-full max-w-5xl mx-auto px-6 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-32">
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-white/10">
        <Eye className="w-6 h-6 text-cyan-400" />
        <h2 className="text-2xl font-bold text-white tracking-tight">Proactive Monitoring</h2>
        <span className="ml-auto text-xs font-mono text-gray-500">{watchlist.length} targets</span>
      </div>

      <div className="border border-cyan-500/20 bg-cyan-900/5 rounded-lg p-4 mb-8">
        <h3 className="text-sm font-bold text-cyan-400 mb-2 flex items-center gap-2">
          <Activity className="w-4 h-4" /> Continuous Monitoring Active
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed max-w-2xl">
          Targets in this list are automatically scanned every 24 hours. You will receive alerts if new IOCs, CVEs, or significant risk score changes are detected.
        </p>
      </div>

      {loadingHistory ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-cyan-500/50 border-t-cyan-500 rounded-full animate-spin" />
        </div>
      ) : watchlist.length === 0 ? (
        <div className="text-center py-12 text-gray-500 font-mono">No active monitors. Use the scanner to add targets.</div>
      ) : (
        <div className="grid gap-3">
          {watchlist.map(w => (
            <div key={w.id} className="flex items-center gap-4 p-4 rounded-lg bg-white/[0.02] border border-white/5 hover:border-cyan-500/30 transition-all">
              <div className="w-1 h-8 rounded-full bg-cyan-500 shadow-[0_0_8px_#06b6d4]" />
              <div className="flex-1 min-w-0 pl-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg font-bold text-white truncate">{w.target}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/10 uppercase text-gray-400">{w.type}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-400 uppercase border border-green-500/30">Active</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500 font-mono">
                  <span className="flex items-center gap-1">Added: {new Date(w.created_at).toLocaleDateString()}</span>
                  <span>Last check: {w.last_scanned_at ? new Date(w.last_scanned_at).toLocaleString() : 'Pending...'}</span>
                </div>
              </div>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  if (confirm('Stop monitoring this target?')) {
                    await removeFromWatchlist(w.id);
                    setWatchlist(prev => prev.filter(p => p.id !== w.id));
                    toast.success('Removed from watchlist');
                  }
                }}
                className="p-2 hover:bg-red-500/20 text-gray-600 hover:text-red-400 rounded transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const OpsView = () => (
    <div className="flex flex-col items-center justify-center min-h-[80vh] w-full max-w-4xl mx-auto px-4 relative">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-cyan-500/5 rounded-full animate-[spin_60s_linear_infinite]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-purple-500/5 rounded-full animate-[spin_45s_linear_infinite_reverse]" />
      </div>
      <div className="z-10 w-full text-center">
        <h1 className="text-6xl font-black tracking-tighter text-white mb-4 glitch-text" data-text="DEEP_INXIDE">DEEP_INXIDE</h1>
        <p className="text-sm text-gray-500 font-mono mb-12">Cyber Threat Intelligence Platform</p>

        <div className="relative group max-w-2xl mx-auto">
          <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 opacity-20 group-hover:opacity-40 blur transition duration-500"></div>
          <div className="relative bg-black border border-white/10 flex items-center p-2">
            <div className="p-3"><Terminal className="w-5 h-5 text-cyan-500" /></div>
            <input type="text" value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch(query)}
              className="flex-1 bg-transparent border-none outline-none text-white font-mono placeholder:text-gray-700 h-10 uppercase tracking-wider"
              placeholder="ENTER_TARGET: IP / DOMAIN / URL / HASH..." autoFocus />
            <button onClick={() => handleSearch(query)} disabled={isScanning}
              className="px-6 py-2 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500 hover:text-black transition-all font-mono text-xs font-bold uppercase tracking-widest disabled:opacity-50">
              {isScanning ? "SCANNING..." : "INITIALIZE"}
            </button>
          </div>
        </div>

        {/* Quick Targets */}
        <div className="flex flex-wrap gap-2 justify-center mt-8">
          {["8.8.8.8", "1.1.1.1", "google.com", "cloudflare.com"].map(t => (
            <button key={t} onClick={() => { setQuery(t); handleSearch(t); }}
              className="px-3 py-1 text-[10px] font-mono text-gray-500 bg-white/5 border border-white/10 rounded hover:border-cyan-500/30 hover:text-cyan-400 transition-all uppercase tracking-wider">
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const DashboardView = () => {
    if (!scanState) return null;
    const r = scanState.results;
    const score = r.compositeScore;

    return (
      <div className="w-full max-w-[1400px] mx-auto px-6 py-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-32">

        {/* ─── HEADER BAR ─── */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
          <div className="flex items-center gap-4">
            <button onClick={() => { setScanState(null); setIsScanning(false); }}
              className="flex items-center gap-2 text-xs font-mono text-gray-500 hover:text-cyan-400 transition-colors uppercase tracking-wider">
              <ChevronRight className="w-3 h-3 rotate-180" /> Back to Terminal
            </button>
            <div className="h-4 w-px bg-white/10" />
            <span className="text-2xl font-black tracking-tight text-white">{scanState.query}</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/5 border border-white/10 text-gray-400 uppercase">{scanState.type}</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <button
                onClick={handleAddToWatchlist}
                className="flex items-center gap-2 px-3 py-1.5 bg-cyan-900/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 rounded text-[10px] font-bold uppercase tracking-wider transition-all"
                title="Add to Watchlist"
              >
                <Eye className="w-3 h-3" /> Monitor
              </button>
              <button
                onClick={() => setShowGraph(!showGraph)}
                className={`flex items-center gap-2 px-3 py-1.5 border rounded text-[10px] font-bold uppercase tracking-wider transition-all ${showGraph
                  ? 'bg-purple-900/20 border-purple-500/30 text-purple-400'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                  }`}
              >
                <Network className="w-3 h-3" /> Graph
              </button>
              <button
                onClick={() => generatePDFReport(scanState, currentScanId)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/20 rounded text-[10px] font-bold uppercase tracking-wider transition-all"
              >
                <FileText className="w-3 h-3" /> Export PDF
              </button>
            </div>

            <div className="h-8 w-px bg-white/10" />

            <div className="text-right">
              <div className="text-[10px] uppercase text-gray-500 font-mono tracking-widest">Composite Risk</div>
              <div className={`text-xl font-bold font-mono ${getScoreColor(score?.level)}`}>{score ? score.level.toUpperCase() : "..."}</div>
            </div>
            <div className={`w-14 h-14 flex items-center justify-center border-2 rounded-lg font-mono text-xl font-bold bg-black shadow-lg ${getScoreBorderColor(score?.level)} ${getScoreColor(score?.level)}`}>
              {score ? score.total : "--"}
            </div>
          </div>
        </div>

        {/* ─── GRAPH VIEW OVERLAY ─── */}
        {showGraph && (
          <div className="mb-6 h-[600px] animate-in fade-in slide-in-from-top-4 duration-500">
            <ThreatGraphPanel scanState={scanState} />
          </div>
        )}

        {/* ─── SCAN PROGRESS ─── */}
        <ScanProgress events={scanState.events} isScanning={isScanning} />

        {/* ─── OPS LOG (Collapsible Events) ─── */}
        <div className="mt-6 mb-6">
          <div className="cyber-panel p-4 bg-black/40 rounded-lg">
            <div className="flex items-center gap-2 mb-3 border-b border-white/5 pb-2">
              <Activity className="w-4 h-4 text-cyan-500" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-cyan-100">Ops Log</h3>
              <span className="ml-auto text-[10px] text-gray-500 font-mono">{scanState.events.length} events</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 font-mono text-xs">
              {scanState.events.map(e => (
                <div key={e.id} className="flex gap-2 items-start p-2 rounded bg-white/[0.02]">
                  <div className={`w-1.5 h-1.5 mt-1.5 rounded-full flex-shrink-0 ${e.status === 'running' ? 'bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]' :
                    e.status === 'warning' ? 'bg-orange-500' :
                      e.status === 'error' ? 'bg-red-500' : 'bg-emerald-500'
                    }`} />
                  <div className="min-w-0">
                    <div className="text-gray-300 font-bold truncate">{e.label}</div>
                    {e.detail && <div className="text-[10px] text-gray-600 mt-0.5 truncate">{e.detail}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* ─── ROW 1: Score + Noise + Confidence (3 cols) ─── */}
        {/* ═══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <CompositeScorePanel score={r.compositeScore ?? null} />
          <NoiseClassPanel classification={r.noiseClassification ?? null} />
          <ConfidencePanel assessment={r.confidence ?? null} />
        </div>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* ─── ROW 2: GeoMap + Port Scan (2 cols) ─── */}
        {/* ═══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="h-[380px]">
            <GeoMap geo={r.geo ?? null} className="h-full" />
          </div>
          {r.shodan && <PortScanResults shodan={r.shodan} />}
        </div>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* ─── ROW 3: VirusTotal Vendor Results (full width) ─── */}
        {/* ═══════════════════════════════════════════════════════ */}
        {r.vt && (
          <div className="mb-6">
            <VendorResults results={r.vt.vendorResults} />
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/* ─── ROW 4: MITRE ATT&CK + Threat Context (2 cols) ─── */}
        {/* ═══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {r.mitre && <MitreAttackPanel mapping={r.mitre} />}
          <ThreatContextPanel context={r.threatContext ?? null} />
        </div>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* ─── ROW 5: Infrastructure Cluster + Timeline (2 cols) ─── */}
        {/* ═══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <InfraClusterPanel cluster={r.infraCluster ?? null} />
          <TimelinePanel events={r.timeline ?? null} />
        </div>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* ─── ROW 6: Attack Surface (full width) ─── */}
        {/* ═══════════════════════════════════════════════════════ */}
        <div className="mb-6">
          <AttackSurfacePanel
            cveDetails={r.cveDetails ?? null}
            kevMatches={r.cisakev ?? null}
            epssScores={r.epss ?? null}
          />
        </div>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* ─── ROW 7: ThreatFox + ThreatMiner (2 cols) ─── */}
        {/* ═══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <ThreatFoxPanel data={r.threatfox ?? null} />
          {r.threatMiner && <ThreatMinerPanel data={r.threatMiner} onPivot={handlePivot} />}
        </div>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* ─── ROW 8: Malware Intel + Vuln Intel (2 cols) ─── */}
        {/* ═══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {r.malwareBazaar && <MalwareIntelPanel data={r.malwareBazaar} />}
          {r.cveDetails && <VulnIntelPanel data={r.cveDetails} />}
        </div>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* ─── ROW 9: DNS Records + SSL/TLS Certs ─── */}
        {/* ═══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* DNS Records */}
          {r.dns?.Answer && r.dns.Answer.length > 0 && (
            <div className="card-panel">
              <div className="card-header">
                <div className="flex items-center gap-2">
                  <Network className="w-3.5 h-3.5" style={{ color: 'hsl(0 0% 100% / 0.4)' }} />
                  <h3>DNS Records</h3>
                </div>
                <span className="text-[11px] font-mono" style={{ color: 'hsl(0 0% 100% / 0.35)' }}>{r.dns.Answer.length} records</span>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                <table className="data-table">
                  <thead>
                    <tr><th>Type</th><th>Name</th><th>Data</th><th>TTL</th></tr>
                  </thead>
                  <tbody>
                    {r.dns.Answer.map((rec, i) => (
                      <tr key={i}>
                        <td className="font-mono font-bold text-cyan-400">{getTypeName(rec.type)}</td>
                        <td className="font-mono text-white/60 truncate max-w-[120px]">{rec.name}</td>
                        <td className="font-mono text-white/80 truncate max-w-[200px]">{rec.data}</td>
                        <td className="font-mono text-white/30">{rec.TTL}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SSL/TLS Certificate Transparency */}
          {r.crtsh && r.crtsh.length > 0 && (
            <div className="card-panel">
              <div className="card-header">
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5" style={{ color: 'hsl(0 0% 100% / 0.4)' }} />
                  <h3>Certificate Transparency</h3>
                </div>
                <span className="text-[11px] font-mono" style={{ color: 'hsl(0 0% 100% / 0.35)' }}>{r.crtsh.length} certs</span>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                <table className="data-table">
                  <thead>
                    <tr><th>Common Name</th><th>Issuer</th><th>Logged</th></tr>
                  </thead>
                  <tbody>
                    {r.crtsh.slice(0, 20).map((c: any, i: number) => (
                      <tr key={i}>
                        <td className="font-mono text-white/80 truncate max-w-[200px]">{c.common_name}</td>
                        <td className="font-mono text-white/40 truncate max-w-[150px]">{c.issuer_name?.split(',')[0] || "—"}</td>
                        <td className="font-mono text-white/30 whitespace-nowrap">{c.entry_timestamp?.split('T')[0] || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* ─── ROW 10: Gemini AI Analysis ─── */}
        {/* ═══════════════════════════════════════════════════════ */}
        {!isScanning && scanState.currentStep === "complete" && (
          <div className="mb-6">
            <GeminiAnalysisPanel scanState={scanState} scanId={currentScanId} initialAnalysis={loadedAnalysis} />
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/* ─── ROW 11: Pivot Actions ─── */}
        {/* ═══════════════════════════════════════════════════════ */}
        <div className="card-panel">
          <div className="card-header">
            <h3>Pivot Actions</h3>
          </div>
          <div className="card-body flex flex-wrap gap-3">
            <button onClick={() => { const json = JSON.stringify(scanState, null, 2); navigator.clipboard.writeText(json); toast.success("Copied JSON to clipboard"); }}
              className="px-4 py-2 bg-white/5 border border-white/10 text-xs font-mono text-gray-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all rounded uppercase tracking-wider">
              Export JSON
            </button>
            <button onClick={() => { const newQ = scanState.resolvedIP || scanState.query; setQuery(newQ); handleSearch(newQ); }}
              className="px-4 py-2 bg-white/5 border border-white/10 text-xs font-mono text-gray-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all rounded uppercase tracking-wider">
              Re-Scan Target
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen transition-all bg-grid-cyber font-sans relative md:pl-[60px]">
      {/* Sidebar - always visible */}
      <aside className="fixed left-0 top-0 bottom-0 w-[60px] border-r border-white/10 flex flex-col items-center py-6 z-50 bg-black/80 backdrop-blur-md">
        <div className="mb-6 flex flex-col items-center justify-center gap-1.5">
          <img src="/deep_inxide_logo.png" alt="Deep Inxide" className="w-12 h-12 object-contain drop-shadow-[0_0_8px_rgba(0,240,255,0.6)]" />
          <div className="text-[9px] font-bold text-center leading-none text-cyan-400 tracking-wide font-mono hover:text-cyan-300 transition-colors cursor-default">
            DEEP<br />INXIDE
          </div>
        </div>
        <nav className="flex-1 space-y-6 w-full flex flex-col items-center">
          <SidebarIcon icon={LayoutGrid} active={['scanner', 'history', 'watchlist', 'global'].includes(activeView)} onClick={() => { if (!['scanner', 'history', 'watchlist', 'global'].includes(activeView)) setActiveView('scanner'); }} title="Deep Inxide" />
          <SidebarIcon icon={SearchX} active={activeView === 'portal'} onClick={() => setActiveView('portal')} title="Deep Inxide Portal (iFrame)" />
          <SidebarIcon icon={KanbanSquareDashedIcon} active={activeView === 'api_portal'} onClick={() => setActiveView('api_portal')} title="API Portal (Native)" />
        </nav>
        <button onClick={signOut} className="p-3 text-red-500/40 hover:text-red-400 transition-colors mt-auto" title="Sign Out">
          <PowerIcon />
        </button>
      </aside>

      {/* Mobile Logout */}
      <button onClick={signOut} className="md:hidden fixed top-4 right-4 z-50 p-2 bg-black/50 border border-white/10 rounded-full text-red-400/50 hover:text-red-400 backdrop-blur-md transition-all">
        <PowerIcon />
      </button>

      {activeView === 'api_portal' ? (
        <ApiPortal />
      ) : activeView === 'portal' ? (
        <MultiServicePortal />
      ) : (
        <div className="flex flex-col w-full h-screen overflow-hidden">
          {/* Top Menu Bar for Deep Inxide */}
          <div className="w-full border-b border-white/10 bg-black/80 backdrop-blur-md px-6 py-2.5 flex items-center shadow-[0_4px_30px_rgba(0,0,0,0.5)] z-10 flex-shrink-0 relative">
            <div className="flex items-center gap-3 mr-8 cursor-default group">
              <Shield className="w-5 h-5 text-cyan-500 group-hover:drop-shadow-[0_0_8px_rgba(0,240,255,0.8)] transition-all" />
              <div className="flex flex-col">
                <span className="text-white font-black tracking-widest text-sm font-mono leading-none group-hover:text-cyan-400 transition-colors">DEEP_INXIDE</span>
                <span className="text-[9px] text-gray-400 font-mono tracking-[0.2em] relative top-[2px]">THREAT INTELLIGENCE PLATFORM</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => setActiveView('scanner')} className={`cursor-pointer outline-none font-mono text-xs uppercase tracking-wider px-4 py-2 flex items-center gap-2 rounded transition-colors ${activeView === 'scanner' ? 'bg-cyan-900/40 text-cyan-400 border border-cyan-500/30 shadow-[0_0_10px_rgba(0,240,255,0.15)]' : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'}`}>
                <Activity className="w-3.5 h-3.5" /> OSINT Scanner
              </button>
              <button onClick={() => setActiveView('history')} className={`cursor-pointer outline-none font-mono text-xs uppercase tracking-wider px-4 py-2 flex items-center gap-2 rounded transition-colors ${activeView === 'history' ? 'bg-cyan-900/40 text-cyan-400 border border-cyan-500/30 shadow-[0_0_10px_rgba(0,240,255,0.15)]' : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'}`}>
                <History className="w-3.5 h-3.5" /> Scan History
              </button>
              <button onClick={() => setActiveView('watchlist')} className={`cursor-pointer outline-none font-mono text-xs uppercase tracking-wider px-4 py-2 flex items-center gap-2 rounded transition-colors ${activeView === 'watchlist' ? 'bg-cyan-900/40 text-cyan-400 border border-cyan-500/30 shadow-[0_0_10px_rgba(0,240,255,0.15)]' : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'}`}>
                <Eye className="w-3.5 h-3.5" /> Watchlist
              </button>
              <button onClick={() => setActiveView('global')} className={`cursor-pointer outline-none font-mono text-xs uppercase tracking-wider px-4 py-2 flex items-center gap-2 rounded transition-colors ${activeView === 'global' ? 'bg-cyan-900/40 text-cyan-400 border border-cyan-500/30 shadow-[0_0_10px_rgba(0,240,255,0.15)]' : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'}`}>
                <Globe className="w-3.5 h-3.5" /> Live Threat Stream
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto relative">
            {activeView === 'history' ? (
              <HistoryView />
            ) : activeView === 'watchlist' ? (
              <WatchlistView />
            ) : activeView === 'global' ? (
              <GlobalIntelFeed />
            ) : (
              !scanState ? <OpsView /> : <DashboardView />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── HELPER COMPONENTS ─── */

const SidebarIcon = ({ icon: Icon, active, onClick, title }: { icon: any; active?: boolean; onClick?: () => void; title?: string }) => (
  <button onClick={onClick} title={title} className={`p-3 rounded-md transition-all duration-300 relative group ${active ? 'text-cyan-400' : 'text-gray-600 hover:text-gray-300'}`}>
    <Icon className="w-5 h-5" />
    {active && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[2px] h-6 bg-cyan-400 shadow-[0_0_10px_#00f0ff]" />}
  </button>
);

const PowerIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
    <path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" />
  </svg>
);

const getTypeName = (type: number) => {
  const m: Record<number, string> = { 1: "A", 2: "NS", 5: "CNAME", 6: "SOA", 15: "MX", 16: "TXT", 28: "AAAA" };
  return m[type] || `TYPE${type}`;
};

const getScoreColor = (level?: string) => {
  if (level === 'critical') return 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]';
  if (level === 'high') return 'text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]';
  if (level === 'moderate') return 'text-yellow-400';
  if (level === 'low') return 'text-green-400';
  return 'text-gray-400';
};

const getScoreBorderColor = (level?: string) => {
  if (level === 'critical') return 'border-red-500 bg-red-900/10';
  if (level === 'high') return 'border-orange-500 bg-orange-900/10';
  if (level === 'moderate') return 'border-yellow-500 bg-yellow-900/10';
  if (level === 'low') return 'border-green-500 bg-green-900/10';
  return 'border-gray-700';
};

export default Index;
