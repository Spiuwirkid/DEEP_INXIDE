// ─────────────────────────────────────────────
// crt.sh — Certificate Transparency logs
// Free, no key, returns JSON
// ─────────────────────────────────────────────
import type { CrtShEntry } from "../types";

export async function lookupCrtSh(domain: string): Promise<CrtShEntry[]> {
    try {
        const res = await fetch(
            `https://crt.sh/?q=%25.${encodeURIComponent(domain)}&output=json`,
            { headers: { Accept: "application/json" } }
        );

        if (!res.ok) return [];

        const data: any[] = await res.json();

        // Deduplicate by common_name and limit to 100 most recent
        const seen = new Set<string>();
        const entries: CrtShEntry[] = [];

        for (const row of data) {
            const cn = row.common_name || row.name_value || "";
            if (seen.has(cn)) continue;
            seen.add(cn);

            entries.push({
                id: row.id,
                issuer_ca_id: row.issuer_ca_id,
                issuer_name: row.issuer_name || "",
                common_name: cn,
                name_value: row.name_value || "",
                not_before: row.not_before || "",
                not_after: row.not_after || "",
                serial_number: row.serial_number || "",
                result_count: row.result_count || 1,
            });

            if (entries.length >= 100) break;
        }

        return entries;
    } catch {
        return [];
    }
}
