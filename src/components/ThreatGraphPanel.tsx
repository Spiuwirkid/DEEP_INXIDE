
import { useRef, useEffect, useState, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { ScanState } from '@/lib/types';
import { Network } from 'lucide-react';

const ThreatGraphPanel = ({ scanState }: { scanState: ScanState }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ w: 800, h: 600 });

    useEffect(() => {
        if (containerRef.current) {
            setDimensions({
                w: containerRef.current.clientWidth,
                h: containerRef.current.clientHeight
            });
        }
    }, []);

    // -- Construct Graph Data --
    const data = useMemo(() => {
        const nodes: any[] = [];
        const links: any[] = [];
        const seen = new Set<string>();

        const addNode = (id: string, label: string, type: string, color: string, val: number) => {
            if (!id || seen.has(id)) return;
            seen.add(id);
            nodes.push({ id, label, type, color, val });
        };

        const addLink = (source: string, target: string, label?: string) => {
            if (!source || !target || !seen.has(source) || !seen.has(target)) return;
            links.push({ source, target, label });
        };

        // Root Node
        const rootColor = '#bd00ff';
        const subColor = '#00f0ff';
        const maliciousColor = '#ff0055';
        const neutralColor = '#ffffff';

        if (scanState.query) {
            addNode(scanState.query, scanState.query, scanState.type, rootColor, 15);
        }

        // Resolved IP
        if (scanState.resolvedIP && scanState.resolvedIP !== scanState.query) {
            addNode(scanState.resolvedIP, scanState.resolvedIP, 'ip', subColor, 10);
            addLink(scanState.query, scanState.resolvedIP, 'resolves_to');
        }

        // DNS Records
        scanState.results.dns?.Answer?.forEach(rec => {
            if (rec.type === 1 || rec.type === 5) { // A or CNAME
                const target = rec.data;
                addNode(target, target, rec.type === 1 ? 'ip' : 'domain', subColor, 8);
                addLink(scanState.query, target, 'dns_record');
            }
        });

        // Subdomains / Passive DNS
        scanState.results.threatMiner?.subdomains?.slice(0, 10).forEach(sub => {
            addNode(sub, sub, 'subdomain', neutralColor, 5);
            addLink(scanState.query, sub, 'subdomain');
        });

        // Communicating Samples (Malware)
        scanState.results.malwareBazaar?.data?.slice(0, 5).forEach(sample => {
            if (sample.sha256_hash) {
                addNode(sample.sha256_hash, sample.sha256_hash.substring(0, 8) + '...', 'malware', maliciousColor, 8);
                addLink(scanState.query, sample.sha256_hash, 'associated_malware');
            }
        });

        // URLs (URLhaus)
        if (scanState.results.urlhaus?.urls) {
            scanState.results.urlhaus.urls.slice(0, 5).forEach(u => {
                addNode(u.url, u.url.substring(0, 30) + '...', 'url', maliciousColor, 6);
                addLink(scanState.query, u.url, 'hosting_malware');
            });
        }

        // CVEs
        scanState.results.shodan?.vulns?.slice(0, 5).forEach(cve => {
            addNode(cve, cve, 'vulnerability', '#ff9900', 7);
            addLink(scanState.resolvedIP || scanState.query, cve, 'vulnerable_to');
        });

        return { nodes, links };
    }, [scanState]); // Rehub when scanState changes

    return (
        <div className="card-panel h-full min-h-[500px] flex flex-col border border-cyan-500/20 shadow-[0_0_20px_rgba(0,240,255,0.05)] bg-[#050608]">
            <div className="card-header border-b border-white/5 p-3 flex justify-between items-center bg-black/60 backdrop-blur-md z-10">
                <div className="flex items-center gap-2">
                    <Network className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-bold text-gray-200 tracking-wider">THREAT GRAPH VISUALIZATION</h3>
                </div>
                <div className="flex gap-4 text-[10px] uppercase font-mono text-gray-400">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#bd00ff] shadow-[0_0_8px_#bd00ff]"></span> Target</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#ff0055] shadow-[0_0_8px_#ff0055]"></span> Malicious</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]"></span> Infra</span>
                </div>
            </div>

            <div className="flex-1 relative overflow-hidden" ref={containerRef}>
                <div className="absolute inset-0 bg-[linear-gradient(rgba(0,240,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,240,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

                <ForceGraph2D
                    width={dimensions.w}
                    height={dimensions.h}
                    graphData={data}
                    nodeLabel={node => `${node.label} (${node.type})`}
                    nodeColor="color"
                    backgroundColor="rgba(0,0,0,0)"

                    // Link Styling
                    linkColor={() => 'rgba(0, 240, 255, 0.15)'}
                    linkWidth={1.5}
                    linkDirectionalParticles={3}
                    linkDirectionalParticleSpeed={0.005}
                    linkDirectionalParticleWidth={2}
                    linkDirectionalParticleColor={() => '#00f0ff'}

                    // Custom Node Rendering
                    nodeCanvasObject={(node: any, ctx, globalScale) => {
                        const r = node.val;
                        const isRoot = node.id === scanState.query;

                        // Glow
                        ctx.shadowColor = node.color;
                        ctx.shadowBlur = 15;
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
                        ctx.fillStyle = node.color;
                        ctx.fill();

                        // Inner Ring for Root
                        if (isRoot) {
                            ctx.beginPath();
                            ctx.arc(node.x, node.y, r + 4, 0, 2 * Math.PI, false);
                            ctx.strokeStyle = node.color;
                            ctx.lineWidth = 1;
                            ctx.stroke();
                        }

                        // Reset shadow for text
                        ctx.shadowBlur = 0;

                        // Label (only concise or on hover logic could be here, but standard label is handled by interaction)
                        const label = node.label.length > 20 ? node.label.substring(0, 17) + '...' : node.label;
                        const fontSize = 10 / globalScale; // Scale font

                        ctx.font = `${fontSize}px "JetBrains Mono", monospace`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillStyle = 'rgba(255,255,255,0.8)';

                        // Draw label below node
                        ctx.fillText(label, node.x, node.y + r + 6);
                    }}
                    nodeCanvasObjectMode={() => 'replace'} // We replace the default circle completely

                    // Physics
                    d3VelocityDecay={0.3} // Higher damping to stop jitter
                    d3AlphaDecay={0.02}    // Slower cooling
                    cooldownTicks={100}

                    onNodeClick={node => {
                        console.log('Clicked node', node);
                    }}
                />

                {/* Vignette Overlay */}
                <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,#000_100%)] opacity-60" />
            </div>
        </div>
    );
};

export default ThreatGraphPanel;
