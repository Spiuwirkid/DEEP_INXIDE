import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VT_BASE = 'https://www.virustotal.com/api/v3';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get('VIRUSTOTAL_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'VIRUSTOTAL_API_KEY not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { type, query } = await req.json();
    
    let endpoint = '';
    switch (type) {
      case 'ip':
        endpoint = `/ip_addresses/${query}`;
        break;
      case 'domain':
        endpoint = `/domains/${query}`;
        break;
      case 'url':
        // For URLs we need to get the URL ID first (base64url encoded)
        const urlId = btoa(query).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        endpoint = `/urls/${urlId}`;
        break;
      case 'hash':
        endpoint = `/files/${query}`;
        break;
      default:
        return new Response(JSON.stringify({ error: 'Invalid type. Use: ip, domain, url, hash' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const vtResponse = await fetch(`${VT_BASE}${endpoint}`, {
      headers: { 'x-apikey': apiKey },
    });

    const data = await vtResponse.json();

    if (!vtResponse.ok) {
      return new Response(JSON.stringify({ error: data.error?.message || 'VirusTotal API error', code: vtResponse.status }), {
        status: vtResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
