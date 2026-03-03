import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const THREATMINER_BASE = 'https://api.threatminer.org/v2';

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { source, entityType, query, rt } = await req.json();

        if (source === 'threatminer') {
            // ThreatMiner API proxy
            // entityType: "domain", "ip", "sample"
            // rt: report type number (varies by entity)
            const url = `${THREATMINER_BASE}/${entityType}.php?q=${encodeURIComponent(query)}&rt=${rt}`;

            const response = await fetch(url, {
                headers: { 'User-Agent': 'ThreatIntelHub/2.0' },
            });

            if (!response.ok) {
                return new Response(JSON.stringify({
                    status_code: String(response.status),
                    status_message: 'API error',
                    results: [],
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }

            const data = await response.json();
            return new Response(JSON.stringify(data), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({ error: 'Unknown source' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        return new Response(JSON.stringify({ error: msg }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
