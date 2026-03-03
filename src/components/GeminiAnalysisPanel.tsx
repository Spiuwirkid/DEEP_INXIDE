import { useState, useEffect, useRef } from "react";
import { Cpu, Copy, Check, RefreshCw, Zap, Shield, Crosshair } from "lucide-react";
import type { ScanState } from "@/lib/types";
import { analyzeWithGemini, type GeminiAnalysis } from "@/lib/api/gemini";
import { updateScanWithAI } from "@/lib/api";
import { toast } from "sonner";

interface Props {
    scanState: ScanState;
    scanId?: string | null;
    initialAnalysis?: GeminiAnalysis | null;
}

/* ─── Typing Animation Hook ─── */
function useTypingEffect(text: string, speed = 8) {
    const [displayed, setDisplayed] = useState("");
    const [isDone, setIsDone] = useState(false);

    useEffect(() => {
        if (!text) return;
        setDisplayed("");
        setIsDone(false);
        let i = 0;
        const timer = setInterval(() => {
            i++;
            setDisplayed(text.slice(0, i));
            if (i >= text.length) {
                clearInterval(timer);
                setIsDone(true);
            }
        }, speed);
        return () => clearInterval(timer);
    }, [text, speed]);

    return { displayed, isDone };
}

/* ─── Scan Lines Animation ─── */
function ScanLinesEffect() {
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg">
            {/* Moving scan line */}
            <div className="absolute inset-x-0 h-[2px] animate-[deepScan_2.5s_ease-in-out_infinite]"
                style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(0,240,255,0.6) 50%, transparent 100%)' }} />
            {/* Corner brackets */}
            <div className="absolute top-2 left-2 w-4 h-4 border-l-2 border-t-2 border-cyan-500/40" />
            <div className="absolute top-2 right-2 w-4 h-4 border-r-2 border-t-2 border-cyan-500/40" />
            <div className="absolute bottom-2 left-2 w-4 h-4 border-l-2 border-b-2 border-cyan-500/40" />
            <div className="absolute bottom-2 right-2 w-4 h-4 border-r-2 border-b-2 border-cyan-500/40" />
        </div>
    );
}

/* ─── Neural Network Animation ─── */
function NeuralAnimation() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = 280;
        canvas.height = 120;

        const nodes: { x: number; y: number; vx: number; vy: number; r: number }[] = [];
        for (let i = 0; i < 20; i++) {
            nodes.push({
                x: Math.random() * 280,
                y: Math.random() * 120,
                vx: (Math.random() - 0.5) * 0.6,
                vy: (Math.random() - 0.5) * 0.6,
                r: Math.random() * 2 + 1,
            });
        }

        let animId: number;
        const draw = () => {
            ctx.clearRect(0, 0, 280, 120);

            // Draw connections
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const dx = nodes[i].x - nodes[j].x;
                    const dy = nodes[i].y - nodes[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 80) {
                        ctx.beginPath();
                        ctx.moveTo(nodes[i].x, nodes[i].y);
                        ctx.lineTo(nodes[j].x, nodes[j].y);
                        ctx.strokeStyle = `rgba(0, 220, 255, ${0.15 * (1 - dist / 80)})`;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }
            }

            // Draw nodes
            for (const n of nodes) {
                n.x += n.vx;
                n.y += n.vy;
                if (n.x < 0 || n.x > 280) n.vx *= -1;
                if (n.y < 0 || n.y > 120) n.vy *= -1;

                ctx.beginPath();
                ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
                ctx.fillStyle = "rgba(0, 220, 255, 0.5)";
                ctx.fill();

                // Glow
                ctx.beginPath();
                ctx.arc(n.x, n.y, n.r + 2, 0, Math.PI * 2);
                ctx.fillStyle = "rgba(0, 220, 255, 0.08)";
                ctx.fill();
            }

            animId = requestAnimationFrame(draw);
        };

        draw();
        return () => cancelAnimationFrame(animId);
    }, []);

    return <canvas ref={canvasRef} className="w-full h-[120px] opacity-60" />;
}

/* ─── Loading Phase Labels ─── */
function LoadingPhases() {
    const phases = [
        "Initializing neural engine...",
        "Parsing threat vectors...",
        "Cross-referencing IOC databases...",
        "Mapping attack surfaces...",
        "Correlating signals...",
        "Building risk assessment...",
        "Generating tactical report...",
    ];
    const [phaseIdx, setPhaseIdx] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setPhaseIdx(p => (p + 1) % phases.length);
        }, 2200);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="flex items-center gap-2 mt-3">
            <div className="flex gap-1">
                <span className="w-1 h-1 rounded-full bg-cyan-400 animate-[pulse_0.8s_ease-in-out_infinite]" />
                <span className="w-1 h-1 rounded-full bg-cyan-400 animate-[pulse_0.8s_ease-in-out_0.2s_infinite]" />
                <span className="w-1 h-1 rounded-full bg-cyan-400 animate-[pulse_0.8s_ease-in-out_0.4s_infinite]" />
            </div>
            <span className="text-[11px] font-mono text-cyan-400/70 transition-all duration-300">
                {phases[phaseIdx]}
            </span>
        </div>
    );
}

/* ─── Component ─── */
export default function GeminiAnalysisPanel({ scanState, scanId, initialAnalysis }: Props) {
    const [analysis, setAnalysis] = useState<GeminiAnalysis | null>(initialAnalysis || null);

    useEffect(() => {
        if (initialAnalysis) setAnalysis(initialAnalysis);
    }, [initialAnalysis]);

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const { displayed, isDone } = useTypingEffect(analysis?.analysis || "", 4);

    const handleAnalyze = async () => {
        setIsLoading(true);
        setError(null);
        setAnalysis(null);
        try {
            const result = await analyzeWithGemini(scanState);
            setAnalysis(result);
            toast.success("Deep analysis complete");

            // Save to history if scanId is present
            if (scanId) {
                updateScanWithAI(scanId, result);
            }
        } catch (err: any) {
            setError(err.message);
            toast.error("Analysis failed: " + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = async () => {
        if (!analysis) return;
        await navigator.clipboard.writeText(analysis.analysis);
        setCopied(true);
        toast.success("Copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
    };

    const renderMarkdown = (text: string) => {
        const lines = text.split("\n");
        const elements: JSX.Element[] = [];
        let key = 0;

        for (const line of lines) {
            key++;
            const trimmed = line.trim();

            if (trimmed.startsWith("## ")) {
                elements.push(
                    <div key={key} className="flex items-center gap-2 mt-6 mb-2 pb-1.5"
                        style={{ borderBottom: '1px solid rgba(0,200,255,0.1)' }}>
                        <Crosshair className="w-3.5 h-3.5 text-cyan-500/70 shrink-0" />
                        <h3 className="text-sm font-bold tracking-wide" style={{ color: 'rgba(200,235,255,0.95)' }}>
                            {trimmed.replace(/^## /, "").replace(/[🔍⚠️🎯🛡️📊]/g, "").trim()}
                        </h3>
                    </div>
                );
            } else if (trimmed.startsWith("### ")) {
                elements.push(
                    <h4 key={key} className="text-xs font-bold mt-3 mb-1 uppercase tracking-wider text-cyan-400/60">
                        {trimmed.replace(/^### /, "")}
                    </h4>
                );
            } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
                elements.push(
                    <div key={key} className="flex gap-2.5 py-1 ml-1 group">
                        <span className="w-1 h-1 rounded-full bg-cyan-500/50 mt-2 shrink-0 group-hover:bg-cyan-400 transition-colors" />
                        <span className="text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
                            {formatInline(trimmed.replace(/^[-*] /, ""))}
                        </span>
                    </div>
                );
            } else if (/^\d+\.\s/.test(trimmed)) {
                const num = trimmed.match(/^(\d+)\./)?.[1];
                elements.push(
                    <div key={key} className="flex gap-3 py-1.5 ml-0.5 group">
                        <span className="w-5 h-5 flex items-center justify-center rounded-sm text-[10px] font-bold shrink-0 mt-0.5 font-mono transition-colors"
                            style={{
                                background: 'rgba(0,200,255,0.08)',
                                border: '1px solid rgba(0,200,255,0.15)',
                                color: 'rgba(0,220,255,0.8)',
                            }}>
                            {num}
                        </span>
                        <span className="text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
                            {formatInline(trimmed.replace(/^\d+\.\s*/, ""))}
                        </span>
                    </div>
                );
            } else if (trimmed === "---" || trimmed === "***") {
                elements.push(
                    <div key={key} className="my-4 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,200,255,0.12), transparent)' }} />
                );
            } else if (trimmed.length > 0) {
                elements.push(
                    <p key={key} className="text-[12px] leading-relaxed py-0.5" style={{ color: 'rgba(255,255,255,0.62)' }}>
                        {formatInline(trimmed)}
                    </p>
                );
            }
        }
        return elements;
    };

    const formatInline = (text: string) => {
        const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
        return parts.map((part, i) => {
            if (part.startsWith("**") && part.endsWith("**")) {
                return <strong key={i} className="font-semibold" style={{ color: 'rgba(255,255,255,0.92)' }}>{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith("`") && part.endsWith("`")) {
                return (
                    <code key={i} className="px-1.5 py-0.5 rounded text-[10px] font-mono mx-0.5"
                        style={{ background: 'rgba(0,200,255,0.06)', border: '1px solid rgba(0,200,255,0.1)', color: '#5eead4' }}>
                        {part.slice(1, -1)}
                    </code>
                );
            }
            return part;
        });
    };

    return (
        <div className="relative rounded-lg overflow-hidden"
            style={{
                background: 'linear-gradient(145deg, rgba(10, 18, 30, 0.98) 0%, rgba(6, 12, 22, 0.96) 100%)',
                border: '1px solid rgba(0, 180, 255, 0.15)',
                boxShadow: `0 0 1px rgba(0,200,255,0.2), 0 4px 24px rgba(0,0,0,0.3), 0 12px 48px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.03)`,
            }}>

            {/* Top accent line */}
            <div className="absolute top-0 left-0 right-0 h-[2px]"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(0,200,255,0.4), rgba(0,200,255,0.6), rgba(0,200,255,0.4), transparent)' }} />

            {/* Left accent */}
            <div className="absolute top-0 left-0 bottom-0 w-[2px]"
                style={{ background: 'linear-gradient(180deg, rgba(0,200,255,0.5), rgba(0,200,255,0.05))' }} />

            {isLoading && <ScanLinesEffect />}

            {/* ─── HEADER ─── */}
            <div className="relative flex items-center justify-between px-5 py-4"
                style={{ borderBottom: '1px solid rgba(0,180,255,0.08)', background: 'rgba(0,180,255,0.02)' }}>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="w-9 h-9 rounded-md flex items-center justify-center"
                            style={{
                                background: 'linear-gradient(135deg, rgba(0,200,255,0.12), rgba(0,150,255,0.06))',
                                border: '1px solid rgba(0,200,255,0.25)',
                                boxShadow: '0 0 12px rgba(0,200,255,0.1)',
                            }}>
                            <Cpu className="w-4 h-4 text-cyan-400" />
                        </div>
                        {isLoading && (
                            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                        )}
                    </div>
                    <div>
                        <h3 className="text-sm font-bold tracking-wide" style={{ color: 'rgba(220,240,255,0.95)' }}>
                            Deep Inxide AI
                        </h3>
                        <span className="text-[10px] font-mono tracking-wider" style={{ color: 'rgba(0,200,255,0.35)' }}>
                            THREAT INTELLIGENCE ENGINE
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    {analysis && (
                        <>
                            <button onClick={handleCopy}
                                className="p-2 rounded-md transition-all hover:bg-cyan-500/10"
                                style={{ color: 'rgba(0,200,255,0.4)' }} title="Copy report">
                                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={handleAnalyze} disabled={isLoading}
                                className="p-2 rounded-md transition-all hover:bg-cyan-500/10"
                                style={{ color: 'rgba(0,200,255,0.4)' }} title="Re-analyze">
                                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </>
                    )}
                    {/* Status indicator */}
                    <div className="ml-2 flex items-center gap-1.5 px-2 py-1 rounded"
                        style={{ background: 'rgba(0,200,255,0.05)', border: '1px solid rgba(0,200,255,0.1)' }}>
                        <div className={`w-1.5 h-1.5 rounded-full ${isLoading ? 'bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]' : analysis ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-gray-600'}`} />
                        <span className="text-[9px] font-mono uppercase tracking-widest"
                            style={{ color: isLoading ? 'rgba(0,220,255,0.7)' : analysis ? 'rgba(52,211,153,0.7)' : 'rgba(255,255,255,0.25)' }}>
                            {isLoading ? "PROCESSING" : analysis ? "COMPLETE" : "STANDBY"}
                        </span>
                    </div>
                </div>
            </div>

            {/* ─── BODY ─── */}
            <div className="px-5 py-5">

                {/* ──── IDLE STATE ──── */}
                {!analysis && !isLoading && !error && (
                    <div className="text-center py-6">
                        <NeuralAnimation />
                        <p className="text-xs mt-4 mb-5 max-w-md mx-auto leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
                            Activate the Deep Inxide engine to perform advanced threat correlation, risk assessment, and generate tactical recommendations.
                        </p>
                        <button onClick={handleAnalyze}
                            className="group relative inline-flex items-center gap-2.5 px-7 py-3 rounded-md text-xs font-bold font-mono uppercase tracking-widest overflow-hidden transition-all duration-300"
                            style={{
                                background: 'linear-gradient(135deg, rgba(0,180,255,0.1), rgba(0,120,255,0.06))',
                                border: '1px solid rgba(0,200,255,0.25)',
                                color: 'rgba(0,220,255,0.9)',
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.borderColor = 'rgba(0,220,255,0.5)';
                                e.currentTarget.style.boxShadow = '0 0 30px rgba(0,200,255,0.15), inset 0 0 30px rgba(0,200,255,0.05)';
                                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0,180,255,0.18), rgba(0,120,255,0.1))';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.borderColor = 'rgba(0,200,255,0.25)';
                                e.currentTarget.style.boxShadow = 'none';
                                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0,180,255,0.1), rgba(0,120,255,0.06))';
                            }}>
                            {/* Shimmer effect */}
                            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"
                                style={{ background: 'linear-gradient(90deg, transparent, rgba(0,200,255,0.08), transparent)' }} />
                            <Zap className="w-4 h-4 relative" />
                            <span className="relative">Run Deep Analysis</span>
                        </button>
                    </div>
                )}

                {/* ──── LOADING STATE ──── */}
                {isLoading && (
                    <div className="py-6">
                        {/* Neural animation */}
                        <NeuralAnimation />

                        {/* Progress bars */}
                        <div className="mt-4 space-y-2 max-w-sm mx-auto">
                            <div className="flex items-center justify-between text-[10px] font-mono">
                                <span style={{ color: 'rgba(0,200,255,0.5)' }}>ANALYSIS DEPTH</span>
                                <span style={{ color: 'rgba(0,200,255,0.3)' }}>MULTI-VECTOR</span>
                            </div>
                            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(0,200,255,0.06)' }}>
                                <div className="h-full rounded-full animate-[indeterminate_2s_ease-in-out_infinite]"
                                    style={{ background: 'linear-gradient(90deg, rgba(0,200,255,0.1), rgba(0,220,255,0.6), rgba(0,200,255,0.1))', width: '40%' }} />
                            </div>
                        </div>

                        <div className="flex justify-center">
                            <LoadingPhases />
                        </div>
                    </div>
                )}

                {/* ──── ERROR STATE ──── */}
                {error && !isLoading && (
                    <div className="text-center py-6">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-3 rounded"
                            style={{ background: 'rgba(255,50,80,0.08)', border: '1px solid rgba(255,50,80,0.15)' }}>
                            <Shield className="w-3 h-3 text-red-400/60" />
                            <span className="text-[11px] font-mono text-red-400/80">{error}</span>
                        </div>
                        <div>
                            <button onClick={handleAnalyze}
                                className="px-5 py-2 rounded text-[11px] font-mono font-bold uppercase tracking-wider transition-all"
                                style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.2)', color: 'rgba(0,220,255,0.7)' }}>
                                Retry Analysis
                            </button>
                        </div>
                    </div>
                )}

                {/* ──── RESULT STATE (with typing effect) ──── */}
                {analysis && !isLoading && (
                    <div className="space-y-0.5">
                        {renderMarkdown(isDone ? analysis.analysis : displayed)}
                        {!isDone && (
                            <span className="inline-block w-2 h-4 ml-0.5 bg-cyan-400/60 animate-[blink_0.8s_step-end_infinite]" />
                        )}
                        {isDone && (
                            <div className="mt-5 pt-3 flex items-center justify-between text-[10px] font-mono"
                                style={{ borderTop: '1px solid rgba(0,200,255,0.08)', color: 'rgba(255,255,255,0.2)' }}>
                                <span className="flex items-center gap-1.5">
                                    <Cpu className="w-3 h-3" />
                                    Deep Inxide Engine v2.5
                                </span>
                                <span>{new Date(analysis.timestamp).toLocaleTimeString()}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
