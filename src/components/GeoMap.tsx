import { useEffect, useRef } from "react";
import type { GeoIPResult } from "@/lib/types";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Props {
    geo: GeoIPResult | null;
    className?: string;
}

export default function GeoMap({ geo, className = "" }: Props) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);

    useEffect(() => {
        if (!mapRef.current) return;

        if (mapInstanceRef.current) {
            mapInstanceRef.current.remove();
            mapInstanceRef.current = null;
        }

        const lat = geo?.lat ?? 20;
        const lon = geo?.lon ?? 0;
        const zoom = geo ? 5 : 2;

        const map = L.map(mapRef.current, {
            center: [lat, lon],
            zoom,
            zoomControl: false,
            attributionControl: false,
            scrollWheelZoom: false,
            dragging: true,
            doubleClickZoom: true,
        });

        // Cyber/Dark tiles
        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
            subdomains: "abcd",
            maxZoom: 19,
        }).addTo(map);

        L.control.zoom({ position: "bottomright" }).addTo(map);

        if (geo) {
            const pulseIcon = L.divIcon({
                className: "geo-pulse-marker",
                html: `<div class="geo-pulse-dot"></div><div class="geo-pulse-ring"></div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10],
            });

            const marker = L.marker([geo.lat, geo.lon], { icon: pulseIcon }).addTo(map);

            // Minimal Cyber Popup
            const popupContent = `
                <div style="font-family:'JetBrains Mono',monospace; font-size:10px; color:#00f0ff; background:rgba(0,0,0,0.8); backdrop-filter:blur(4px); padding:8px; border:1px solid rgba(0,240,255,0.2); text-transform:uppercase;">
                    <div style="font-weight:bold; margin-bottom:2px; color:#fff">${geo.query}</div>
                    <div>${geo.city}, ${geo.country}</div>
                    <div style="opacity:0.7">${geo.isp}</div>
                    <div style="border-top:1px solid rgba(255,255,255,0.1); margin-top:4px; padding-top:4px;">
                        LAT: ${geo.lat.toFixed(4)} <br/> LON: ${geo.lon.toFixed(4)}
                    </div>
                </div>
            `;

            marker.bindPopup(popupContent, {
                closeButton: false,
                className: "geo-popup-cyber",
                offset: [0, -10]
            });
        }

        mapInstanceRef.current = map;
        const timeoutId = setTimeout(() => {
            if (mapInstanceRef.current) {
                try {
                    mapInstanceRef.current.invalidateSize();
                } catch (e) {
                    console.warn("Leaflet map invalidateSize error ignored");
                }
            }
        }, 300);

        return () => {
            clearTimeout(timeoutId);
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, [geo]);

    return (
        <div className={`relative w-full h-full min-h-[300px] overflow-hidden rounded ${className}`}>
            <div ref={mapRef} className="absolute inset-0 z-0 bg-[#0a0a0a]" />

            {/* Cyber Overlay Grid */}
            <div className="absolute inset-0 z-10 pointer-events-none"
                style={{
                    background: 'linear-gradient(rgba(0,240,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.03) 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                    boxShadow: 'inset 0 0 40px rgba(0,0,0,0.8)'
                }}
            />

            {/* Status Overlay */}
            {geo && (
                <div className="absolute bottom-4 left-4 z-20 font-mono text-[10px] text-cyan-500 bg-black/80 border border-cyan-500/20 px-3 py-2 backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse shadow-[0_0_5px_#00f0ff]" />
                        <span className="tracking-widest">POSITION_LOCKED</span>
                    </div>
                    <div className="text-white opacity-80">{geo.city.toUpperCase()} // {geo.countryCode}</div>
                </div>
            )}
        </div>
    );
}
