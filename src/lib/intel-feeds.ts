
interface CisaVulnerability {
    cveID: string;
    vendorProject: string;
    product: string;
    vulnerabilityName: string;
    dateAdded: string;
    shortDescription: string;
    requiredAction: string;
}

export interface RealIntelEvent {
    id: string;
    timestamp: string;
    source: string;
    target: string;
    sourceCoords: [number, number];
    targetCoords: [number, number];
    type: string;
    details: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
}

const NATION_COORDS: Record<string, [number, number]> = {
    'USA': [37.0902, -95.7129],
    'CHN': [35.8617, 104.1954],
    'RUS': [61.5240, 105.3188],
    'DEU': [51.1657, 10.4515],
    'BRA': [-14.2350, -51.9253],
    'IND': [20.5937, 78.9629],
    'IRN': [32.4279, 53.6880],
    'PRK': [40.3399, 127.5101],
    'GBR': [55.3781, -3.4360],
    'FRA': [46.2276, 2.2137],
    'IDN': [-0.7893, 113.9213],
    'VNM': [14.0583, 108.2772],
    'ISR': [31.0461, 34.8516],
    'UKR': [48.3794, 31.1656],
    'JPN': [36.2048, 138.2529]
};

const THREAT_ACTORS = ['APT28', 'Lazarus Group', 'Equation Group', 'Turla', 'OilRig', 'Sandworm', 'Double Dragon'];

// Fallback data in case API fails
const FALLBACK_VULNS = [
    { cveID: 'CVE-2024-21413', vendorProject: 'Microsoft', vulnerabilityName: 'Outlook RCE', shortDescription: 'Critical remote code execution in Outlook.' },
    { cveID: 'CVE-2024-1709', vendorProject: 'ConnectWise', vulnerabilityName: 'ScreenConnect Auth Bypass', shortDescription: 'Authentication bypass allowing critical access.' },
    { cveID: 'CVE-2023-46805', vendorProject: 'Ivanti', vulnerabilityName: 'Auth Bypass', shortDescription: 'Zero-day vulnerability in Ivanti VPN.' }
];

export async function fetchCisaFeed(): Promise<CisaVulnerability[]> {
    try {
        const response = await fetch('https://raw.githubusercontent.com/cisagov/known_exploited_vulnerabilities/master/known_exploited_vulnerabilities.json');
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        return data.vulnerabilities.slice(0, 50); // Get top 50 recent
    } catch (error) {
        console.error("Failed to fetch CISA feed, using fallback", error);
        return FALLBACK_VULNS.map(v => ({
            ...v,
            product: 'Software',
            dateAdded: new Date().toISOString(),
            requiredAction: 'Patch immediately'
        })) as CisaVulnerability[];
    }
}

// Feodo Tracker: Active C2 servers (The "Real" Source)
export async function fetchActiveMaliciousIPs(): Promise<string[]> {
    try {
        const response = await fetch('https://feodotracker.abuse.ch/downloads/ipblocklist_recommended.txt');
        const text = await response.text();
        const ips = text.split('\n')
            .filter(line => line && !line.startsWith('#'))
            .map(line => line.trim())
            .filter(line => line.length > 0);
        return ips.slice(0, 100);
    } catch (e) {
        console.error("Failed to fetch Feodo blocklist", e);
        return ['103.203.57.18', '45.142.213.149', '193.109.69.130'];
    }
}

export function generateRealTimeEvent(vulnPool: CisaVulnerability[], ipPool: string[]): RealIntelEvent {
    const vuln = vulnPool[Math.floor(Math.random() * vulnPool.length)] || FALLBACK_VULNS[0];
    const srcIP = ipPool[Math.floor(Math.random() * ipPool.length)] || '185.244.25.187';

    const targetPool = [
        { name: 'Financial Cluster', ip: '10.20.14.28' },
        { name: 'Gov Network', ip: '172.16.8.102' },
        { name: 'Infrastructure', ip: '192.168.50.4' },
        { name: 'Cloud Infrastructure', ip: '52.14.20.101' }
    ];
    const target = targetPool[Math.floor(Math.random() * targetPool.length)];

    const nations = Object.keys(NATION_COORDS);
    const srcCode = nations[Math.floor(Math.random() * nations.length)];
    let tgtCode = nations[Math.floor(Math.random() * nations.length)];
    while (srcCode === tgtCode) tgtCode = nations[Math.floor(Math.random() * nations.length)];

    return {
        id: Math.random().toString(36).substring(7),
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
        source: `${srcCode} - ${srcIP}`,
        target: `${tgtCode} - ${target.name}`,
        sourceCoords: NATION_COORDS[srcCode],
        targetCoords: NATION_COORDS[tgtCode],
        type: vuln.cveID,
        details: `${vuln.vendorProject} ${vuln.vulnerabilityName}`,
        severity: Math.random() > 0.8 ? 'critical' : 'high'
    };
}
