import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { resolve } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';

puppeteer.use(StealthPlugin());

const COOKIE_FILE = resolve(process.cwd(), '.cyberxtron-cookies.json');

export async function getCyberXTronSessionCookies(options = { forceRefresh: false }): Promise<any> {
    // Return cached cookies if they exist and are recent
    if (existsSync(COOKIE_FILE)) {
        try {
            const stats = readFileSync(COOKIE_FILE, 'utf-8');
            const data = JSON.parse(stats);
            if (data.timestamp && (Date.now() - data.timestamp < 1000 * 60 * 60 * 8)) { // 8 hours valid
                console.log("[CyberXTron-Auth] Using cached session payload.");
                return data;
            }
        } catch (e) {
            console.warn("[CyberXTron-Auth] Invalid cookie cache, re-authenticating...");
        }
    }

    console.log("[CyberXTron-Auth] Initiating Stealth Puppeteer for SSO bypass...");
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
    });

    try {
        const page = await browser.newPage();

        // Anti-bot evasions
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        let stolenBearerToken = '';
        page.on('response', async (response) => {
            if (response.url().includes('/protocol/openid-connect/token') && response.request().method() === 'POST') {
                try {
                    const json = await response.json();
                    if (json && json.access_token) {
                        stolenBearerToken = 'Bearer ' + json.access_token;
                        console.log('[CyberXTron-Auth] Keycloak /token intercept caught JWT!');
                    }
                } catch (e) {
                    // Ignore JSON parse errors
                }
            }
        });

        console.log("[CyberXTron-Auth] Navigating to Keycloak Login...");
        await page.goto("https://portal.cyberxtron.com/login", { waitUntil: "domcontentloaded" });

        console.log(`[CyberXTron-Auth] Waiting for Keycloak SSO redirect...`);
        // Wait until we reach the auth subdomain
        await page.waitForFunction(() => window.location.href.includes('auth.cyberxtron.com'), { timeout: 20000 });
        console.log(`[CyberXTron-Auth] Reached auth page:`, page.url());

        console.log(`[CyberXTron-Auth] Waiting for username input on URL:`, page.url());
        // Wait for username input
        try {
            await page.waitForSelector('input[name="username"], #username, input[name="email"], #email', { timeout: 15000 });
        } catch (e) {
            console.error('[CyberXTron-Auth] Dump:', await page.content());
            throw e;
        }

        console.log("[CyberXTron-Auth] Injecting credentials...");
        await page.type('input[name="username"], #username, input[name="email"], #email', 'nomad-demo@cyberxtron.com', { delay: 100 });
        await page.type('input[name="password"], #password', 'Hz98laUFdxO%', { delay: 100 });

        console.log("[CyberXTron-Auth] Executing login...");
        // Wait for navigation after clicking submit
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => console.log('nav timeout ignored')),
            page.click('input[type="submit"], button[type="submit"], #kc-login') // Adjust selector if needed based on Keycloak theme
        ]);

        console.log("[CyberXTron-Auth] Login successful. Extracting session tokens...");
        // Wait for Keycloak to redirect back to the app portal
        await page.waitForFunction(() => window.location.href.includes('portal.cyberxtron.com'), { timeout: 15000 }).catch(() => { });

        // Wait for the SPA to intercept API request and capture the bearer token
        console.log("[CyberXTron-Auth] Waiting for SPA to finalize token exchange...");
        const waitInterval = setInterval(() => { if (stolenBearerToken) console.log('[CyberXTron-Auth] API intercept caught Bearer Token!'); }, 1000);
        await page.waitForFunction(() => (window as any)['__authCaptured'] === true || Object.keys(window.localStorage).length > 0, { timeout: 15000 }).catch(e => console.log('token wait timeout ignored'));

        // Let's also enforce a brute force time wait if token isn't captured yet
        let retries = 0;
        while (!stolenBearerToken && retries < 15) {
            await new Promise(r => setTimeout(r, 1000));
            retries++;
        }
        clearInterval(waitInterval);

        // Get all storage states to fully replicate the SPA session
        const client = await page.target().createCDPSession();
        const { cookies } = await client.send('Network.getAllCookies');
        const localData = await page.evaluate(() => JSON.stringify(Object.assign({}, window.localStorage)));
        const sessionData = await page.evaluate(() => JSON.stringify(Object.assign({}, window.sessionStorage)));

        console.log(`[CyberXTron-Auth] Final URL: ${page.url()}`);
        if (!stolenBearerToken) {
            console.log(`[CyberXTron-Auth] Warning: Could not intercept Bearer token. Application might bounce.`);
            console.log(`[CyberXTron-Auth] Final Page Dump: ${await page.content()}`);
        } else {
            console.log(`[CyberXTron-Auth] Stolen Bearer JWT: ${stolenBearerToken.substring(0, 30)}...`);
        }

        console.log(`[CyberXTron-Auth] Captured SPA Session: ${cookies.length} cookies, ${localData.length}b local, ${sessionData.length}b session.`);

        const sessionPayload = {
            timestamp: Date.now(),
            cookies,
            localStorage: localData,
            sessionStorage: sessionData,
            bearerToken: stolenBearerToken
        };

        // Cache them
        writeFileSync(COOKIE_FILE, JSON.stringify(sessionPayload));

        await browser.close();
        console.log("[CyberXTron-Auth] Session acquired and cached successfully.");
        return sessionPayload;

    } catch (error) {
        console.error("[CyberXTron-Auth] Headless authentication failed:", error);
        if (browser) await browser.close();
        throw error;
    }
}
