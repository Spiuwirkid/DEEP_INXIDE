// ─────────────────────────────────────────────
// AbuseIPDB — IP Abuse Reports
// Free tier: 1,000 checks/day (requires API key)
// Proxied via Supabase Edge Function
// Falls back gracefully if no key is configured
// ─────────────────────────────────────────────
import type { AbuseIPDBResult } from "../types";
import { supabase } from "@/integrations/supabase/client";

export async function lookupAbuseIPDB(ip: string): Promise<AbuseIPDBResult | null> {
    try {
        const { data, error } = await supabase.functions.invoke("abuseipdb-lookup", {
            body: { ip },
        });

        if (error || !data) return null;

        return {
            ipAddress: data.data?.ipAddress || ip,
            isPublic: data.data?.isPublic ?? true,
            abuseConfidenceScore: data.data?.abuseConfidenceScore ?? 0,
            countryCode: data.data?.countryCode || "",
            usageType: data.data?.usageType || "",
            isp: data.data?.isp || "",
            domain: data.data?.domain || "",
            totalReports: data.data?.totalReports ?? 0,
            numDistinctUsers: data.data?.numDistinctUsers ?? 0,
            lastReportedAt: data.data?.lastReportedAt || null,
            isWhitelisted: data.data?.isWhitelisted ?? false,
        };
    } catch {
        // Graceful fallback — no API key configured
        return null;
    }
}
