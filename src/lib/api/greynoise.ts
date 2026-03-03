// ─────────────────────────────────────────────
// GreyNoise Community API — free, no key
// Classifies IPs as noise/scanner/malicious
// ─────────────────────────────────────────────
import type { GreyNoiseResult } from "../types";

export async function lookupGreyNoise(ip: string): Promise<GreyNoiseResult | null> {
    try {
        const res = await fetch(`https://api.greynoise.io/v3/community/${encodeURIComponent(ip)}`, {
            headers: { Accept: "application/json" },
        });

        if (res.status === 404) {
            // IP not found in GreyNoise — not seen scanning
            return {
                ip,
                noise: false,
                riot: false,
                classification: "unknown",
                name: "Not observed",
                link: "",
                last_seen: "",
                message: "IP not found in GreyNoise dataset",
            };
        }

        if (!res.ok) return null;

        const data = await res.json();
        return {
            ip: data.ip || ip,
            noise: data.noise ?? false,
            riot: data.riot ?? false,
            classification: data.classification || "unknown",
            name: data.name || "",
            link: data.link || "",
            last_seen: data.last_seen || "",
            message: data.message,
        };
    } catch {
        return null;
    }
}
