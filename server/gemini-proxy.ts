import type { Plugin } from "vite";
import { readFileSync } from "fs";
import { resolve } from "path";

const GEMINI_MODEL = "gemini-3-flash-preview";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

function loadEnvKey(): string {
    try {
        const envPath = resolve(process.cwd(), ".env");
        const envContent = readFileSync(envPath, "utf-8");
        const match = envContent.match(/^GEMINI_AI_STUDIO=(.+)$/m);
        return match?.[1]?.trim() || "";
    } catch {
        return "";
    }
}

function loadCyberXKeys() {
    try {
        const envPath = resolve(process.cwd(), ".env");
        const envContent = readFileSync(envPath, "utf-8");
        const key = envContent.match(/^XTRON_ORG_KEY=(.+)$/m)?.[1]?.trim() || "";
        const secret = envContent.match(/^XTRON-ORG-SECRET=(.+)$/m)?.[1]?.trim() || "";
        return { key, secret };
    } catch {
        return { key: "", secret: "" };
    }
}

async function callGemini(apiKey: string, prompt: string): Promise<string> {
    const url = `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    console.log(`[Gemini] Calling model: ${GEMINI_MODEL}`);
    console.log(`[Gemini] URL: ${url.replace(apiKey, "****")}`);

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 4096,
                topP: 0.95,
            },
        }),
    });

    if (!response.ok) {
        const errBody = await response.text();
        console.error(`[Gemini] API Error ${response.status}:`, errBody);

        if (response.status === 404 || response.status === 400) {
            console.log("[Gemini] Primary model failed, trying fallback...");
            return await callGeminiFallback(apiKey, prompt);
        }

        throw new Error(`Gemini API error ${response.status}: ${errBody.substring(0, 200)}`);
    }

    const data: any = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
        console.error("[Gemini] No text in response:", JSON.stringify(data).substring(0, 500));
        throw new Error("No response text from Gemini");
    }

    console.log(`[Gemini] Success! Response length: ${text.length} chars`);
    return text;
}

async function callGeminiFallback(apiKey: string, prompt: string): Promise<string> {
    const fallbackModels = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
    ];

    for (const model of fallbackModels) {
        console.log(`[Gemini] Trying fallback model: ${model}`);
        const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`;

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 4096,
                        topP: 0.95,
                    },
                }),
            });

            if (response.ok) {
                const data: any = await response.json();
                const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                    console.log(`[Gemini] Fallback ${model} succeeded! Response: ${text.length} chars`);
                    return text;
                }
            } else {
                const errText = await response.text();
                console.log(`[Gemini] Fallback ${model} failed (${response.status}): ${errText.substring(0, 100)}`);
            }
        } catch (e: any) {
            console.log(`[Gemini] Fallback ${model} error: ${e.message}`);
        }
    }

    throw new Error("All Gemini models failed. Check your API key at https://aistudio.google.com/apikey");
}

import * as https from "https";
import * as http from "http";

async function fetchWebsiteContent(url: string): Promise<{ title: string; description: string; h1: string } | null> {
    if (!url || url.match(/^\d+\.\d+\.\d+\.\d+$/)) return null; // Skip IPs

    const targetUrl = url.startsWith("http") ? url : `https://${url}`;

    return new Promise((resolve) => {
        console.log(`[Crawler] Fetching content for: ${targetUrl}`);
        const client = targetUrl.startsWith("https") ? https : http;

        const req = client.get(targetUrl, { headers: { "User-Agent": "DeepInxide-Scanner/1.0" }, timeout: 5000 }, (res) => {
            let data = "";
            res.on("data", (chunk) => { if (data.length < 50000) data += chunk; }); // Limit to 50KB
            res.on("end", () => {
                if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    // Handle simple redirect
                    console.log(`[Crawler] Redirect to: ${res.headers.location}`);
                    resolve(fetchWebsiteContent(res.headers.location));
                    return;
                }

                // Simple Regex Extraction
                const title = data.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || "";
                const description = data.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i)?.[1]?.trim() || "";
                const h1 = data.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1]?.trim() || "";

                console.log(`[Crawler] Found: Title="${title.substring(0, 30)}...", Desc="${description.substring(0, 30)}..."`);
                resolve({ title, description, h1 });
            });
        });

        req.on("error", (e) => {
            console.error(`[Crawler] Error: ${e.message}`);
            resolve(null);
        });

        req.on("timeout", () => {
            req.destroy();
            resolve(null);
        });
    });
}

import { createProxyMiddleware, responseInterceptor } from 'http-proxy-middleware';
import { getCyberXTronSessionCookies } from './cyberxtron-auth';
import express from 'express';

export function geminiProxyPlugin(): Plugin {
    return {
        name: "gemini-proxy",
        configureServer(server) {
            // ─── List available models ───
            server.middlewares.use("/api/gemini-models", async (req, res) => {
                // ... existing debug endpoint ...
                res.setHeader("Content-Type", "application/json");
                const apiKey = loadEnvKey();
                if (!apiKey) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: "No API key" }));
                    return;
                }
                try {
                    const resp = await fetch(`${GEMINI_API_BASE}/models?key=${apiKey}`);
                    const data = await resp.json();
                    res.end(JSON.stringify(data, null, 2));
                } catch (e: any) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: e.message }));
                }
            });

            // ─── ISOLATED CyberXTron SSO Proxy Server (Port 8081) ───
            // We spin up a completely isolated proxy instance on port 8081 exclusively for CyberXTron.
            // This natively mitigates SPA relative path collisions (e.g. /assets/index.js) from leaking into Vite.
            const cyberApp = express();

            cyberApp.use(async (req: any, res: any, next: any) => {
                if (req.method !== 'OPTIONS') {
                    try {
                        const sessionPayload: any = await getCyberXTronSessionCookies();
                        const cookies = sessionPayload.cookies;
                        if (cookies && cookies.length > 0) {
                            const cookieString = cookies.map((c: any) => `${c.name}=${c.value}`).join('; ');
                            req.headers.cookie = cookieString;
                        }
                        // Stash the local storage payload in the request for the response interceptor
                        req.__spaSession = sessionPayload;
                    } catch (e) {
                        console.error("[Cyber Proxy 8081] Failed to inject session:", e);
                    }
                }
                next();
            });

            cyberApp.use('/', createProxyMiddleware({
                target: 'https://portal.cyberxtron.com',
                changeOrigin: true,
                selfHandleResponse: true, // We will manually handle response to inject our SPA script
                on: {
                    proxyReq: (proxyReq: any, req: any, res: any) => {
                        // Crucial: remove accept-encoding so target doesn't return compressed gzip/br 
                        // which breaks string replacement and responseInterceptor buffering.
                        proxyReq.removeHeader('Accept-Encoding');
                        proxyReq.removeHeader('accept-encoding');

                        // Sneak the stolen Bearer JWT into ALL api calls passing through to the proxy
                        if (req.__spaSession && req.__spaSession.bearerToken) {
                            if (!proxyReq.getHeader('authorization') && !proxyReq.getHeader('Authorization')) {
                                proxyReq.setHeader('Authorization', req.__spaSession.bearerToken);
                            }
                        }
                    },
                    proxyRes: responseInterceptor(async (responseBuffer, proxyRes, req: any, res) => {
                        try {
                            // Strip strict security headers that prevent iframe integrations
                            if (proxyRes.headers['content-security-policy']) delete proxyRes.headers['content-security-policy'];
                            if (proxyRes.headers['x-frame-options']) delete proxyRes.headers['x-frame-options'];

                            // Suppress keycloak redirects dynamically if any slip through
                            if (proxyRes.statusCode && proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
                                console.log("[Cyber Proxy 8081] Intercepted SSO redirect to:", proxyRes.headers.location);
                            }

                            const isHtml = proxyRes.headers['content-type']?.includes('text/html');
                            if (isHtml && req.__spaSession) {
                                let html = responseBuffer.toString('utf8');

                                // Inject LocalStorage seamlessly
                                const localData = req.__spaSession.localStorage;
                                const sessionData = req.__spaSession.sessionStorage;

                                const injectionScript = `
                                    <script>
                                        (function(){
                                            try {
                                                var ls = ${localData};
                                                for (var k in ls) { window.localStorage.setItem(k, ls[k]); }
                                                var ss = ${sessionData};
                                                for (var j in ss) { window.sessionStorage.setItem(j, ss[j]); }
                                                
                                                var bearerToken = "${req.__spaSession.bearerToken || ''}";

                                                // 1. Monkey-patch window.fetch
                                                var originalFetch = window.fetch;
                                                window.fetch = async function() {
                                                    var args = Array.prototype.slice.call(arguments);
                                                    var url = args[0] && typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
                                                    if (url && (url.includes('cyberxtron.com') || url.startsWith('/')) && bearerToken) {
                                                        if (!args[1]) args[1] = {};
                                                        if (!args[1].headers) args[1].headers = {};
                                                        
                                                        // Convert Headers object or plain object
                                                        if (args[1].headers instanceof Headers) {
                                                            args[1].headers.set('Authorization', bearerToken);
                                                        } else if (Array.isArray(args[1].headers)) {
                                                            args[1].headers.push(['Authorization', bearerToken]);
                                                        } else {
                                                            args[1].headers['Authorization'] = bearerToken;
                                                        }
                                                    }
                                                    return originalFetch.apply(this, args);
                                                };

                                                // 2. Monkey-patch XMLHttpRequest
                                                var originalOpen = XMLHttpRequest.prototype.open;
                                                XMLHttpRequest.prototype.open = function() {
                                                    this._url = arguments[1];
                                                    return originalOpen.apply(this, arguments);
                                                };
                                                var originalSend = XMLHttpRequest.prototype.send;
                                                XMLHttpRequest.prototype.send = function() {
                                                    if (this._url && (this._url.includes('cyberxtron.com') || this._url.startsWith('/')) && bearerToken) {
                                                        this.setRequestHeader('Authorization', bearerToken);
                                                    }
                                                    return originalSend.apply(this, arguments);
                                                };

                                                console.log("[DEEP_INXIDE] Auto-injected secure session XHR bindings.");
                                            } catch(e){ console.error("[DEEP_INXIDE] Session injection failed", e); }
                                        })();
                                    </script>
                                `;

                                html = html.replace('<head>', '<head>' + injectionScript);
                                return html;
                            }

                            return responseBuffer;
                        } catch (err) {
                            console.error("[Cyber Proxy 8081] Interceptor Error:", err);
                            return responseBuffer;
                        }
                    }),
                    error: (err, req, res) => {
                        console.error("[Cyber Proxy 8081] Error:", err);
                    }
                }
            }));

            // Boot the isolated backend
            cyberApp.listen(8081, () => {
                console.log("[Cyber Proxy] 🟢 Isolated Auth Bypass Proxy active on http://localhost:8081");
            }).on('error', (e: any) => {
                // Ignore address in use if Vite restarts middleware repeatedly during dev
                if (e.code !== 'EADDRINUSE') console.error(e);
            });

            // ─── VirusTotal Proxy Handler ───
            server.middlewares.use("/api/virustotal", async (req, res) => {
                res.setHeader("Access-Control-Allow-Origin", "*");
                res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
                res.setHeader("Access-Control-Allow-Headers", "Content-Type");

                if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return; }

                const url = new URL(req.url || "", `http://${req.headers.host}`);
                const query = url.searchParams.get("query");
                const type = url.searchParams.get("type"); // ip, domain, url

                // Load VT Key
                const envPath = resolve(process.cwd(), ".env");
                let vtKey = "";
                try {
                    const envContent = readFileSync(envPath, "utf-8");
                    vtKey = envContent.match(/^VIRUSTOTAL_API_KEY=(.+)$/m)?.[1]?.trim() || "";
                } catch { }

                if (!vtKey) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: "VIRUSTOTAL_API_KEY missing in .env" }));
                    return;
                }

                if (!query || !type) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: "Missing query or type" }));
                    return;
                }

                // Map type to VT endpoint
                let endpoint = "";
                if (type === "ip") endpoint = `ip_addresses/${query}`;
                else if (type === "domain") endpoint = `domains/${query}`;
                else if (type === "url") endpoint = `urls/${Buffer.from(query).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}`;

                console.log(`[VT Proxy] Querying: ${endpoint}`);

                try {
                    const vtRes = await fetch(`https://www.virustotal.com/api/v3/${endpoint}`, {
                        headers: { "x-apikey": vtKey }
                    });

                    if (!vtRes.ok) {
                        const err = await vtRes.text();
                        console.error(`[VT Proxy] Error ${vtRes.status}:`, err);
                        res.statusCode = vtRes.status;
                        res.end(JSON.stringify({ error: "VirusTotal API Error", details: err }));
                        return;
                    }

                    const data = await vtRes.json();
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify(data));
                } catch (e: any) {
                    console.error("[VT Proxy] Exception:", e);
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: e.message }));
                }
            });

            // ─── URLhaus Proxy ───
            server.middlewares.use("/api/urlhaus", async (req, res) => {
                if (req.method === "OPTIONS") { res.statusCode = 204; res.setHeader("Access-Control-Allow-Origin", "*"); res.end(); return; }
                const url = new URL(req.url || "", `http://${req.headers.host}`);
                const query = url.searchParams.get("query");
                const type = url.searchParams.get("type"); // url or host

                if (!query || !type) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing query/type" })); return; }

                const endpoint = type === "url" ? "https://urlhaus-api.abuse.ch/v1/url/" : "https://urlhaus-api.abuse.ch/v1/host/";
                const body = type === "url" ? `url=${encodeURIComponent(query)}` : `host=${query}`;

                try {
                    console.log(`[URLhaus Proxy] Fetching: ${endpoint} for ${query}`);
                    const apiRes = await fetch(endpoint, {
                        method: "POST",
                        headers: { "Content-Type": "application/x-www-form-urlencoded" },
                        body: body
                    });
                    const data = await apiRes.json();
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify(data));
                } catch (e: any) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: e.message }));
                }
            });

            // ─── GeoIP Proxy ───
            server.middlewares.use("/api/geo", async (req, res) => {
                if (req.method === "OPTIONS") { res.statusCode = 204; res.setHeader("Access-Control-Allow-Origin", "*"); res.end(); return; }
                const url = new URL(req.url || "", `http://${req.headers.host}`);
                const ip = url.searchParams.get("ip");
                if (!ip) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing IP" })); return; }

                try {
                    const apiRes = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`);
                    const data = await apiRes.json();
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify(data));
                } catch (e: any) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: e.message }));
                }
            });

            // ─── ThreatFox Proxy ───
            server.middlewares.use("/api/threatfox", async (req, res) => {
                if (req.method === "OPTIONS") { res.statusCode = 204; res.setHeader("Access-Control-Allow-Origin", "*"); res.end(); return; }
                const url = new URL(req.url || "", `http://${req.headers.host}`);
                const query = url.searchParams.get("query");
                // ThreatFox uses POST with JSON body
                if (!query) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing query" })); return; }

                try {
                    const apiRes = await fetch("https://threatfox-api.abuse.ch/api/v1/", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ query: "search_ioc", search_term: query })
                    });
                    const data = await apiRes.json();
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify(data));
                } catch (e: any) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: e.message }));
                }
            });

            // ─── Shodan Proxy ───
            server.middlewares.use("/api/shodan", async (req, res) => {
                if (req.method === "OPTIONS") { res.statusCode = 204; res.setHeader("Access-Control-Allow-Origin", "*"); res.end(); return; }
                const url = new URL(req.url || "", `http://${req.headers.host}`);
                const ip = url.searchParams.get("ip");
                if (!ip) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing ip" })); return; }

                try {
                    const apiRes = await fetch(`https://internetdb.shodan.io/${ip}`);
                    if (!apiRes.ok) throw new Error(`HTTP ${apiRes.status}`);
                    const data = await apiRes.json();
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify(data));
                } catch (e: any) {
                    if (e.message.includes("404")) {
                        res.statusCode = 404;
                        res.setHeader("Content-Type", "application/json");
                        res.end(JSON.stringify({ error: "Not found" }));
                        return;
                    }
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: e.message }));
                }
            });

            // ─── DNS Proxy ───
            server.middlewares.use("/api/dns", async (req, res) => {
                if (req.method === "OPTIONS") { res.statusCode = 204; res.setHeader("Access-Control-Allow-Origin", "*"); res.end(); return; }
                const url = new URL(req.url || "", `http://${req.headers.host}`);
                const domain = url.searchParams.get("domain");
                const type = url.searchParams.get("type") || "1";
                if (!domain) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing domain" })); return; }

                try {
                    const apiRes = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${type}`, {
                        headers: { Accept: "application/dns-json" }
                    });
                    const data = await apiRes.json();
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify(data));
                } catch (e: any) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: e.message }));
                }
            });

            // ─── Feodo Tracker Proxy ───
            server.middlewares.use("/api/feodo", async (req, res) => {
                if (req.method === "OPTIONS") { res.statusCode = 204; res.setHeader("Access-Control-Allow-Origin", "*"); res.end(); return; }
                const url = new URL(req.url || "", `http://${req.headers.host}`);
                const query = url.searchParams.get("query");
                if (!query) { res.statusCode = 400; res.end(JSON.stringify({ error: "Missing query" })); return; }

                try {
                    const apiRes = await fetch("https://feodotracker.abuse.ch/api/v1/", {
                        method: "POST",
                        headers: { "Content-Type": "application/x-www-form-urlencoded" },
                        body: `search=get_iocs&search_term=${query}`
                    });
                    const data = await apiRes.json();
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify(data));
                } catch (e: any) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: e.message }));
                }
            });

            // ─── CyberXTron Open API Proxy ───
            server.middlewares.use("/api/cyberx", async (req, res) => {
                res.setHeader("Access-Control-Allow-Origin", "*");
                res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
                res.setHeader("Access-Control-Allow-Headers", "Content-Type");

                if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return; }

                const { key, secret } = loadCyberXKeys();
                if (!key || !secret) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: "XTRON_ORG_KEY or SECRET missing" }));
                    return;
                }

                // req.url will be something like: /threatbolt/api/v1/ioc/ip/malicious-feed?include=all
                // or /incidents/api/v1/brandsafe/incidents?status=Open
                const pathWithQuery = req.url || "";
                let targetUrl = "";

                if (pathWithQuery.startsWith("/threatbolt")) {
                    targetUrl = `https://apix.cyberxtron.com${pathWithQuery}`;
                } else if (pathWithQuery.startsWith("/incidents")) {
                    // strip /incidents prefix to map to https://incidents.cyberxtron.com/api/v1/...
                    const cleanPath = pathWithQuery.replace("/incidents", "");
                    targetUrl = `https://incidents.cyberxtron.com${cleanPath}`;
                } else {
                    res.statusCode = 404;
                    res.end(JSON.stringify({ error: "Unknown API route. Use /api/cyberx/threatbolt or /api/cyberx/incidents" }));
                    return;
                }

                // --- START SUPABASE JWT AUTHENTICATION CHECK ---
                const authHeader = req.headers.authorization || req.headers.Authorization;
                if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
                    res.statusCode = 401;
                    res.end(JSON.stringify({ status: "error", message: "401 Unauthorized: Missing or invalid Authorization header" }));
                    return;
                }

                const jwt = authHeader.split(' ')[1];
                const supabaseUrl = "https://ypgrpsupzgjsjdbglrqw.supabase.co/auth/v1/user";
                const envPath = resolve(process.cwd(), ".env");
                const envContent = readFileSync(envPath, "utf-8");
                const supabaseAnonKeyMatch = envContent.match(/^VITE_SUPABASE_ANON_KEY=(.+)$/m);
                const supabaseAnonKey = supabaseAnonKeyMatch ? supabaseAnonKeyMatch[1].trim() : "";

                try {
                    const authRes = await fetch(supabaseUrl, {
                        headers: {
                            "apikey": supabaseAnonKey,
                            "Authorization": `Bearer ${jwt}`
                        }
                    });

                    if (!authRes.ok) {
                        res.statusCode = 401;
                        res.end(JSON.stringify({ status: "error", message: "401 Unauthorized: Invalid or expired session token" }));
                        return;
                    }
                } catch (authErr) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ status: "error", message: "Failed to verify session token" }));
                    return;
                }
                // --- END AUTHENTICATION CHECK ---

                try {
                    console.log(`[CyberX Proxy] Fetching: ${targetUrl}`);
                    const apiRes = await fetch(targetUrl, {
                        headers: {
                            "Content-Type": "application/json",
                            "XTRON-ORG-KEY": key,
                            "XTRON-ORG-SECRET": secret
                        }
                    });

                    const data = await apiRes.text();
                    res.statusCode = apiRes.status;
                    res.setHeader("Content-Type", "application/json");
                    res.end(data);
                } catch (e: any) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: e.message }));
                }
            });

            // ─── Main analysis endpoint ───
            server.middlewares.use("/api/gemini-analyze", async (req, res) => {
                res.setHeader("Access-Control-Allow-Origin", "*");
                res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
                res.setHeader("Access-Control-Allow-Headers", "Content-Type");

                if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return; }
                if (req.method !== "POST") { res.statusCode = 405; res.end(JSON.stringify({ error: "Method not allowed" })); return; }

                const apiKey = loadEnvKey();
                if (!apiKey) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: "API key missing" }));
                    return;
                }

                let body = "";
                for await (const chunk of req) { body += chunk; }

                try {
                    const { scanData } = JSON.parse(body);
                    if (!scanData) throw new Error("Missing scanData");

                    // 1. CRAWL WEBSITE CONTENT (Parallel to save time, but await before prompt)
                    let webContext = null;
                    if (scanData.query && !scanData.query.match(/^\d+\.\d+\.\d+\.\d+$/)) {
                        try {
                            webContext = await fetchWebsiteContent(scanData.query);
                        } catch (e) {
                            console.error("[Crawler] Failed:", e);
                        }
                    }

                    // 2. Build Prompt with Web Context
                    const prompt = buildPrompt(scanData, webContext);
                    console.log(`[Gemini] Prompt length: ${prompt.length} chars. Web Context: ${webContext ? "YES" : "NO"}`);

                    const analysis = await callGemini(apiKey, prompt);

                    res.statusCode = 200;
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify({ analysis, model: GEMINI_MODEL, webContextFound: !!webContext }));
                } catch (err: any) {
                    console.error("[Gemini Proxy Error]", err.message);
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: err.message }));
                }
            });
        },
    };
}

function buildPrompt(scanData: any, webContext: any): string {
    const webInfo = webContext ? `
## INFORMASI WEBSITE (HASIL CRAWLING)
Deep Inxide telah berhasil mengakses halaman depan target:
- **Judul Web**: "${webContext.title}"
- **Deskripsi**: "${webContext.description}"
- **Header Utama**: "${webContext.h1}"
Gunakan informasi di atas untuk mengidentifikasi JENIS website ini (Company Profile, Toko Online, Pemerintah, dll).
` : `
## INFORMASI WEBSITE
Deep Inxide TIDAK dapat mengakses konten halaman depan (mungkin diblokir firewall atau timeout). Lakukan identifikasi berdasarkan port, DNS, dan nama domain saja.
`;

    return `Bertindaklah sebagai "Deep Inxide AI", analis Cyber Threat Intelligence (CTI). Tugasmu adalah menganalisis target dan menjelaskan hasilnya dalam **Bahasa Indonesia** yang profesional, otoritatif, dan edukatif.

DATA PEMINDAIAN:

## TARGET
- Query: ${scanData.query}
- Type: ${scanData.type}
- Resolved IP: ${scanData.resolvedIP || "N/A"}
${webInfo}

## HASIL SCAN TEKNIS

### Composite Risk Score
${scanData.compositeScore ? `Score: ${scanData.compositeScore.total}/100 | Level: ${scanData.compositeScore.level} | Confidence: ${scanData.compositeScore.confidence}` : "Data belum tersedia"}

### VirusTotal (Reputasi)
${scanData.vt ? `Malicious: ${scanData.vt.stats.malicious} | Suspicious: ${scanData.vt.stats.suspicious} | Harmless: ${scanData.vt.stats.harmless}` : "Tidak ada data"}

### Shodan (Open Ports)
${scanData.shodan ? `Ports: [${scanData.shodan.ports?.join(", ") || "none"}] | Vulns: [${scanData.shodan.vulns?.join(", ") || "none"}] | Tags: [${scanData.shodan.tags?.join(", ") || "none"}]` : "Tidak ada data"}

### Geo Location & Network
${scanData.geo ? `Country: ${scanData.geo.country} | City: ${scanData.geo.city} | ISP: ${scanData.geo.isp} | ASN: ${scanData.geo.as} | Org: ${scanData.geo.org}` : "Tidak ada data"}

### DNS Records
${scanData.dns?.Answer ? scanData.dns.Answer.map((r: any) => `Type ${r.type}: ${r.data}`).join("\n") : "Data DNS tidak tersedia"}

### Threat Intelligence
- ThreatFox IOCs: ${scanData.threatfox?.data?.length || 0} matches
- URLhaus: ${scanData.urlhaus?.query_status || "N/A"}
- Noise Category: ${scanData.noiseClassification?.category || "Unknown"}
- MITRE Techniques: ${scanData.mitre?.techniques?.length || 0} mapped

---

INSTRUKSI ANALISIS (PENTING):

1.  **IDENTIFIKASI TARGET (CRITICAL)**:
    -   Berdasarkan section "INFORMASI WEBSITE" (Judul/Deskripsi) dan data teknis, jelaskan **secara spesifik** website apa ini.
    -   *Contoh*: "Berdasarkan meta-data, target 'tkm-teknologi.id' adalah website Company Profile untuk perusahaan IT Service TKM Teknologi yang menyediakan solusi software..." (Sesuaikan dengan data crawling).
    -   JANGAN MENEBAK SEMAUNYA jika data crawling ada. Gunakan data itu.

2.  **TERJEMAHKAN TEKNIS KE BAHASA EDUKATIF**:
    -   Jelaskan setiap temuan teknis (Port, DNS, Skor) dengan bahasa yang mendidik user.
    -   *Contoh*: "Ditemukan Port 443 terbuka. Artinya website ini menggunakan protokol HTTPS yang mengenkripsi data pengunjung..."

3.  **ANALISIS RISIKO MENDALAM**:
    -   Hubungkan profil target (misal: Company Profile) dengan temuan teknisnya. Apakah ada port database yang bocor di website company profile?

FORMAT LAPORAN (MARKDOWN):

## 🌐 Identitas Target
(Jelaskan dengan akurat: Website apa ini? Siapa pemiliknya? Bergerak di bidang apa? Gunakan data crawling).

## 📚 Analisis Teknis & Edukasi
(Jelaskan temuan satu per satu: Port, Reputasi, DNS. Berikan edukasi singkat tentang arti masing-masing).

## ⚠️ Analisis Risiko & Ancaman
(Seberapa bahaya status keamanannya? Apa potensi serangannya?)

## 🛡️ Rekomendasi Taktis
(Langkah konkret perbaikan, simpel dan ringkas tapi harus jelas).

Gunakan persona "Deep Inxide AI".`;
}
