
import { useState, useEffect, useRef, useMemo } from 'react';
import { Shield, Globe, Radio, Share2, Activity, AlertTriangle, Zap, Map as MapIcon, Info } from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

import { fetchCisaFeed, fetchActiveMaliciousIPs, generateRealTimeEvent, RealIntelEvent } from '../lib/intel-feeds';

// Unified threat event structure using real intelligence data
export type ThreatEvent = RealIntelEvent;
const LOCATIONS = [
    { code: 'USA', coords: [37.0902, -95.7129] },
    { code: 'CHN', coords: [35.8617, 104.1954] },
    { code: 'RUS', coords: [61.5240, 105.3188] },
    { code: 'DEU', coords: [51.1657, 10.4515] },
    { code: 'BRA', coords: [-14.2350, -51.9253] },
    { code: 'IND', coords: [20.5937, 78.9629] },
    { code: 'IRN', coords: [32.4279, 53.6880] },
    { code: 'PRK', coords: [40.3399, 127.5101] },
    { code: 'GBR', coords: [55.3781, -3.4360] },
    { code: 'FRA', coords: [46.2276, 2.2137] },
    { code: 'IDN', coords: [-0.7893, 113.9213] },
    { code: 'VNM', coords: [14.0583, 108.2772] }
];


// -- Animation Utilities --

// Easing function for professional "arriving" feel (EaseOutQuart)
const easeOutQuart = (x: number): number => {
    return 1 - Math.pow(1 - x, 4);
};

// Hook for high-performance animation
const useAnimation = (duration: number = 1000) => {
    const [progress, setProgress] = useState(0);
    const requestRef = useRef<number>();
    const startTimeRef = useRef<number>();

    const animate = (time: number) => {
        if (startTimeRef.current === undefined) {
            startTimeRef.current = time;
        }
        const timeFraction = (time - startTimeRef.current) / duration;

        // Cap at 1
        const p = Math.min(timeFraction, 1);

        // Apply easing
        const easedProgress = easeOutQuart(p);

        setProgress(easedProgress);

        if (timeFraction < 1) {
            requestRef.current = requestAnimationFrame(animate);
        }
    };

    useEffect(() => {
        requestRef.current = requestAnimationFrame(animate);
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [duration]);

    return progress;
};

// Helper: Generate very smooth quadratic bezier
const getCurvedPath = (start: [number, number], end: [number, number]): [number, number][] => {
    const lat1 = start[0];
    const lng1 = start[1];
    const lat2 = end[0];
    const lng2 = end[1];

    const midLat = (lat1 + lat2) / 2;
    const midLng = (lng1 + lng2) / 2;

    // Distance-based curvature
    const dLat = lat2 - lat1;
    const dLng = lng2 - lng1;
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);

    // Slight arc, not too exaggerated
    const curvature = 0.2 + (dist * 0.0005);

    const controlLat = midLat - (dLng * curvature);
    const controlLng = midLng + (dLat * curvature);

    const path: [number, number][] = [];
    const steps = 120; // High resolution for 60fps

    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        // P(t) = (1-t)^2 P0 + 2(1-t)t P1 + t^2 P2
        const lt = 1 - t;
        const lat = lt * lt * lat1 + 2 * lt * t * controlLat + t * t * lat2;
        const lng = lt * lt * lng1 + 2 * lt * t * controlLng + t * t * lng2;
        path.push([lat, lng]);
    }
    return path;
};

// Component: The Moving Projectile
const AttackProjectile = ({ start, end, color }: { start: [number, number], end: [number, number], color: string }) => {
    // Slightly longer duration for "weighty" feel, but easing makes it feel fast at start
    const progress = useAnimation(1200);

    const path = useMemo(() => getCurvedPath(start, end), [start, end]);

    const totalPoints = path.length;
    const drawIndex = Math.min(Math.floor(progress * (totalPoints - 1)), totalPoints - 1);
    const currentPos = path[drawIndex];

    // Dynamic trail that grows from start
    const trailPositions = path.slice(0, drawIndex + 1);

    return (
        <>
            {/* The Connected Line (Glows) */}
            <Polyline
                positions={trailPositions}
                pathOptions={{
                    color: color,
                    weight: 1.5, // Thinner, more precise "laser" look
                    opacity: 0.9,
                    className: 'glow-line',
                    lineCap: 'round',
                    lineJoin: 'round'
                }}
            />
            {/* The Leading Projectile */}
            <CircleMarker
                center={currentPos}
                radius={2.5} // Precise dot
                pathOptions={{
                    fillColor: '#fff',
                    fillOpacity: 1,
                    color: color,
                    weight: 0, // No border, pure light
                    className: 'glow-effect'
                }}
            />
            {/* Impact Ripple at 100% */}
            {progress >= 0.95 && (
                <CircleMarker
                    center={end}
                    radius={8}
                    pathOptions={{
                        color: color,
                        fillColor: color,
                        fillOpacity: 0,
                        weight: 1,
                        className: 'animate-ping' // Tailwind ping for impact
                    }}
                />
            )}
        </>
    );
};



const GlobalIntelFeed = () => {
    const [events, setEvents] = useState<ThreatEvent[]>([]);
    const [stats, setStats] = useState({ critical: 0, high: 0, active: 0 });
    const [activeEvent, setActiveEvent] = useState<ThreatEvent | null>(null);
    const feedRef = useRef<HTMLDivElement>(null);
    const poolsRef = useRef<{ vulns: any[], ips: string[] }>({ vulns: [], ips: [] });

    // -- Fetch Real Intelligence Feed --
    useEffect(() => {
        const loadIntel = async () => {
            const [vulns, ips] = await Promise.all([
                fetchCisaFeed(),
                fetchActiveMaliciousIPs()
            ]);

            poolsRef.current = { vulns, ips };

            const interval = setInterval(() => {
                if (poolsRef.current.vulns.length === 0 || poolsRef.current.ips.length === 0) return;

                const newEvent = generateRealTimeEvent(poolsRef.current.vulns, poolsRef.current.ips);

                setEvents(prev => [newEvent, ...prev].slice(0, 50));
                setActiveEvent(newEvent);
                setStats(prev => ({
                    critical: prev.critical + (newEvent.severity === 'critical' ? 1 : 0),
                    high: prev.high + (newEvent.severity === 'high' ? 1 : 0),
                    active: prev.active + 1
                }));

            }, 1200);

            return () => clearInterval(interval);
        };

        loadIntel();
    }, []);

    return (
        <div className="w-full max-w-[1600px] mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-32">

            {/* Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <Globe className="w-6 h-6 text-cyan-400" />
                    <div>
                        <h2 className="text-2xl font-bold text-white tracking-tight text-glow">GLOBAL OPERATIONS CENTER</h2>
                        <p className="text-xs text-cyan-500/70 font-mono uppercase tracking-wider flex items-center gap-2">
                            Active Cyber Intelligence Stream
                            <span className="px-1.5 py-0.5 bg-cyan-900/30 rounded text-[9px] text-cyan-400 border border-cyan-500/20 flex items-center gap-1 animate-pulse">
                                <Activity className="w-2.5 h-2.5" /> SECURE DATA CONNECTION: ESTABLISHED
                            </span>
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono">
                    <div className="flex items-center gap-2 px-3 py-1 bg-red-900/20 border border-red-500/30 rounded text-red-400">
                        <AlertTriangle className="w-3 h-3" />
                        <span>CRITICAL: {stats.critical}</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-emerald-900/20 border border-emerald-500/30 rounded text-emerald-400">
                        <Activity className="w-3 h-3" />
                        <span>LIVE STREAMING</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 h-[750px]">

                {/* LEFT: Live Map (Takes up more space) */}
                <div className="xl:col-span-3 flex flex-col gap-4 h-full">
                    <div className="card-panel bg-[#050608] border border-cyan-500/20 rounded-lg h-full flex flex-col relative overflow-hidden shadow-2xl">

                        {/* Map Container */}
                        <div className="flex-1 bg-black relative z-0">
                            <MapContainer
                                center={[20, 0]}
                                zoom={2}
                                scrollWheelZoom={false}
                                style={{ height: '100%', width: '100%', backgroundColor: '#050608' }}
                                attributionControl={false}
                            >
                                {/* Dark Matter Tiles */}
                                <TileLayer
                                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                                />

                                {activeEvent && (
                                    <>
                                        {/* Source Marker */}
                                        <CircleMarker
                                            center={activeEvent.sourceCoords}
                                            pathOptions={{ color: '#00f0ff', fillColor: '#00f0ff', fillOpacity: 0.8 }}
                                            radius={4}
                                        >
                                            <Popup>Source: {activeEvent.source}</Popup>
                                        </CircleMarker>

                                        {/* Target Marker */}
                                        <CircleMarker
                                            center={activeEvent.targetCoords}
                                            pathOptions={{ color: '#ff0055', fillColor: '#ff0055', fillOpacity: 0.8 }}
                                            radius={6}
                                        >
                                            <Popup>Target: {activeEvent.target} <br /> {activeEvent.type}</Popup>
                                        </CircleMarker>

                                        {/* Animated Projectile */}
                                        <AttackProjectile
                                            key={activeEvent.id} // Essential for resetting animation
                                            start={activeEvent.sourceCoords}
                                            end={activeEvent.targetCoords}
                                            color={activeEvent.severity === 'critical' ? '#ef4444' : '#00f0ff'}
                                        />
                                    </>
                                )}

                                {/* Persistent Markers for Locations */}
                                {LOCATIONS.map(loc => (
                                    <CircleMarker
                                        key={loc.code}
                                        center={loc.coords as [number, number]}
                                        pathOptions={{ color: '#ffffff', fillOpacity: 0.1, weight: 1 }}
                                        radius={2}
                                    />
                                ))}

                            </MapContainer>

                            {/* Overlay Vignette */}
                            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,#050608_100%)] opacity-50 z-[1000]" />
                        </div>

                        {/* Recent Activity Ticker Overlay */}
                        <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-md border-t border-white/10 p-2 z-[1001]">
                            <div className="flex items-center gap-4 text-[10px] font-mono text-cyan-400 overflow-hidden whitespace-nowrap">
                                <span className="font-bold text-white px-2">LATEST INTERCEPT:</span>
                                {activeEvent ? (
                                    <span className="animate-in fade-in slide-in-from-right duration-300">
                                        {activeEvent.timestamp} | {activeEvent.source} &rarr; {activeEvent.target} | {activeEvent.type} | {activeEvent.severity.toUpperCase()}
                                    </span>
                                ) : (
                                    <span>Waiting for signal...</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT: Feed & Intel */}
                <div className="flex flex-col gap-4 h-full overflow-hidden">

                    {/* Live Feed List */}
                    <div className="card-panel bg-[#050608] border border-white/10 p-0 rounded-lg flex-1 flex flex-col overflow-hidden">
                        <div className="p-3 border-b border-white/10 bg-white/5 flex justify-between items-center">
                            <h3 className="text-xs font-bold text-gray-200 flex items-center gap-2">
                                <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
                                SIGNAL STREAM
                            </h3>
                            <span className="text-[9px] text-gray-500 font-mono">LIVE</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar" ref={feedRef}>
                            {events.map((e) => (
                                <div key={e.id} className="text-[10px] font-mono p-2 mb-2 rounded bg-white/5 border border-white/5 hover:border-cyan-400/30 transition-all group">
                                    <div className="flex justify-between items-center mb-1.5 border-b border-white/5 pb-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-gray-500 text-[9px]">{e.timestamp}</span>
                                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                                        </div>
                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider ${e.severity === 'critical' ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'
                                            }`}>
                                            {e.type}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between gap-1">
                                        <div className="flex-1 min-w-0">
                                            <div className="text-cyan-300 font-bold truncate">
                                                {e.source.split(' - ')[0]}
                                            </div>
                                            <div className="text-[8px] text-gray-500 truncate group-hover:text-gray-400">
                                                {e.source.split(' - ')[1]}
                                            </div>
                                        </div>

                                        <div className="flex-shrink-0 px-1 text-gray-700">&rarr;</div>

                                        <div className="flex-1 min-w-0 text-right">
                                            <div className="text-purple-300 font-bold truncate">
                                                {e.target.split(' - ')[0]}
                                            </div>
                                            <div className="text-[8px] text-gray-500 truncate group-hover:text-gray-400">
                                                {e.target.split(' - ')[1]}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-1.5 pt-1 border-t border-white/5 text-[8px] text-gray-600 truncate italic">
                                        {e.details}
                                    </div>
                                </div>
                            ))}

                        </div>
                    </div>


                    {/* Live Threat Landscape (Replaces Campaigns & Submit) */}
                    <div className="card-panel bg-[#050608] border border-white/10 p-4 rounded-lg flex-col gap-4 flex-1">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xs font-bold text-gray-200 uppercase flex items-center gap-2">
                                <Zap className="w-3 h-3 text-cyan-400" /> THREAT LANDSCAPE
                            </h3>
                            <div className="text-[9px] font-mono text-red-500 animate-pulse">ELEVATED</div>
                        </div>

                        {/* Attack Vector Stats */}
                        <div className="flex-1 space-y-3">
                            {Object.entries(events.reduce((acc, e) => {
                                acc[e.type] = (acc[e.type] || 0) + 1;
                                return acc;
                            }, {} as Record<string, number>))
                                .sort(([, a], [, b]) => b - a)
                                .slice(0, 5)
                                .map(([type, count], i) => (
                                    <div key={type} className="group">
                                        <div className="flex justify-between text-[9px] mb-1 font-mono text-gray-400 group-hover:text-cyan-300 transition-colors">
                                            <span>{type.toUpperCase()}</span>
                                            <span>{Math.round((count / (events.length || 1)) * 100)}%</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-cyan-600 to-blue-500 rounded-full transition-all duration-500"
                                                style={{ width: `${(count / (events.length || 1)) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                        </div>

                        {/* Mini System Status */}
                        <div className="mt-auto pt-3 border-t border-white/5 grid grid-cols-2 gap-2">
                            <div className="bg-red-900/10 border border-red-500/20 p-2 rounded text-center">
                                <div className="text-[9px] text-red-400 font-mono mb-1">DEFCON</div>
                                <div className="text-xl font-bold text-red-500 leading-none">3</div>
                            </div>
                            <div className="bg-emerald-900/10 border border-emerald-500/20 p-2 rounded text-center">
                                <div className="text-[9px] text-emerald-400 font-mono mb-1">NODES</div>
                                <div className="text-xl font-bold text-emerald-500 leading-none">ACTIVE</div>
                            </div>
                        </div>
                    </div>


                </div>
            </div>
        </div>
    );
};

export default GlobalIntelFeed;
