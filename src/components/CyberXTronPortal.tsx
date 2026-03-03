import React, { useState } from "react";
import {
    LayoutGrid,
    ShieldAlert,
    Hexagon,
    Crosshair
} from "lucide-react";
import {
    Menubar,
    MenubarContent,
    MenubarItem,
    MenubarMenu,
    MenubarTrigger,
} from "@/components/ui/menubar";

export const MultiServicePortal = () => {
    const [iframeUrl, setIframeUrl] = useState("https://portal.cyberxtron.com/");
    const [activeItem, setActiveItem] = useState("Dashboard");
    const [iframeKey, setIframeKey] = useState(0);

    const iframeRef = React.useRef<HTMLIFrameElement>(null);

    // Use a new storage key to force reset the state for testing
    const [needsSessionCache, setNeedsSessionCache] = useState(() => {
        return localStorage.getItem('cyberxtron_auth_state_v2') !== 'true';
    });

    // Intelligent cross-origin detection for SPA login success
    React.useEffect(() => {
        if (!needsSessionCache) return;

        const checkInterval = setInterval(() => {
            try {
                const frame = iframeRef.current;
                // Cross-origin safe way to detect if Keycloak (0 iframes) redirected 
                // to CyberXTron SPA Dashboard (1 hidden session iframe)
                if (frame && frame.contentWindow && frame.contentWindow.length > 0) {
                    console.log("[DEEP_INXIDE Portal] Detected authenticated SPA load.");
                    localStorage.setItem('cyberxtron_auth_state_v2', 'true');
                    setNeedsSessionCache(false);
                    setIframeKey(k => k + 1); // Refresh our main wrapper iframe to home
                    clearInterval(checkInterval);
                }
            } catch (err) {
                // Ignore DOM errors if any strict cross-origin checks block length
            }
        }, 1000);

        return () => clearInterval(checkInterval);
    }, [needsSessionCache]);

    const handleNavigate = (path: string, itemName: string) => {
        if (path.startsWith("http")) {
            setIframeUrl(path);
        } else {
            const p = path.startsWith("/") ? path : `/${path}`;
            setIframeUrl(`https://portal.cyberxtron.com${p}`);
        }
        setActiveItem(itemName);
        setIframeKey(k => k + 1); // increment key to force iframe reload
    };

    return (
        <div className="w-full h-screen flex flex-col bg-[#13131A] overflow-hidden font-sans">
            {/* --- TOP MENU BAR --- */}
            <div className="w-full border-b border-white/10 bg-black/80 backdrop-blur-md px-6 py-2.5 flex items-center shadow-[0_4px_30px_rgba(0,0,0,0.5)] z-10 flex-shrink-0 relative">
                <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />



                <Menubar className="border-none bg-transparent gap-2">
                    <MenubarMenu>
                        <MenubarTrigger onClick={() => handleNavigate("/", "Dashboard")} className="cursor-pointer font-mono text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-cyan-400 data-[state=open]:text-cyan-400 hover:bg-white/5 data-[state=open]:bg-transparent transition-all outline-none rounded py-2 px-3 focus:bg-transparent">
                            <LayoutGrid className="w-3.5 h-3.5 mr-2" />
                            Dashboard
                        </MenubarTrigger>
                    </MenubarMenu>

                    <MenubarMenu>
                        <MenubarTrigger className="cursor-pointer font-mono text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-cyan-400 data-[state=open]:text-cyan-400 data-[state=open]:bg-cyan-900/20 hover:bg-white/20 transition-all outline-none rounded py-2 px-3 focus:bg-transparent">
                            <ShieldAlert className="w-3.5 h-3.5 mr-2" />
                            Digital Risk Protection
                        </MenubarTrigger>
                        <MenubarContent className="bg-[#050608]/95 backdrop-blur-xl border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.8)] rounded-md font-mono text-[10px] uppercase font-bold min-w-[200px] p-1">
                            <MenubarItem onClick={() => handleNavigate("/shadowspot/asset", "Assets")} className="cursor-pointer py-2.5 px-3 text-gray-400 outline-none hover:bg-white/5 focus:bg-white/5 hover:text-cyan-300 focus:text-cyan-300 rounded transition-colors tracking-widest">
                                Assets
                            </MenubarItem>
                            <MenubarItem onClick={() => handleNavigate("/shadowspot/findings", "E-ASM")} className="cursor-pointer py-2.5 px-3 text-gray-400 outline-none hover:bg-white/5 focus:bg-white/5 hover:text-cyan-300 focus:text-cyan-300 rounded transition-colors tracking-widest">
                                E-ASM Findings
                            </MenubarItem>
                            <MenubarItem onClick={() => handleNavigate("/darkflash-incident", "Incidents")} className="cursor-pointer py-2.5 px-3 text-gray-400 outline-none hover:bg-white/5 focus:bg-white/5 hover:text-cyan-300 focus:text-cyan-300 rounded transition-colors tracking-widest">
                                Incident Monitoring
                            </MenubarItem>
                            <MenubarItem onClick={() => handleNavigate("/brandsafe", "Brand Protection")} className="cursor-pointer py-2.5 px-3 text-gray-400 outline-none hover:bg-white/5 focus:bg-white/5 hover:text-cyan-300 focus:text-cyan-300 rounded transition-colors tracking-widest">
                                Brand Protection
                            </MenubarItem>
                        </MenubarContent>
                    </MenubarMenu>

                    <MenubarMenu>
                        <MenubarTrigger className="cursor-pointer font-mono text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-cyan-400 data-[state=open]:text-cyan-400 data-[state=open]:bg-cyan-900/20 hover:bg-white/5 transition-all outline-none rounded py-2 px-3 focus:bg-transparent">
                            <Hexagon className="w-3.5 h-3.5 mr-2" />
                            Global CTI Tracker
                        </MenubarTrigger>
                        <MenubarContent className="bg-[#050608]/95 backdrop-blur-xl border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.8)] rounded-md font-mono text-[10px] uppercase font-bold min-w-[200px] p-1">
                            <MenubarItem onClick={() => handleNavigate("/advisory", "Advisory")} className="cursor-pointer py-2.5 px-3 text-gray-400 outline-none hover:bg-white/5 focus:bg-white/5 hover:text-cyan-300 focus:text-cyan-300 rounded transition-colors tracking-widest">
                                Advisory
                            </MenubarItem>
                            <MenubarItem onClick={() => handleNavigate("https://threatmap.cyberxtron.com/", "Threat Map")} className="cursor-pointer py-2.5 px-3 text-gray-400 outline-none hover:bg-white/5 focus:bg-white/5 hover:text-cyan-300 focus:text-cyan-300 rounded transition-colors tracking-widest">
                                Threat Map
                            </MenubarItem>
                            <MenubarItem onClick={() => handleNavigate("/wild-exploits", "Exploited CVEs")} className="cursor-pointer py-2.5 px-3 text-gray-400 outline-none hover:bg-white/5 focus:bg-white/5 hover:text-cyan-300 focus:text-cyan-300 rounded transition-colors tracking-widest">
                                Exploited CVEs
                            </MenubarItem>
                            <MenubarItem onClick={() => handleNavigate("/otcve", "OT CVE")} className="cursor-pointer py-2.5 px-3 text-gray-400 outline-none hover:bg-white/5 focus:bg-white/5 hover:text-cyan-300 focus:text-cyan-300 rounded transition-colors tracking-widest">
                                OT CVE
                            </MenubarItem>
                        </MenubarContent>
                    </MenubarMenu>

                    <MenubarMenu>
                        <MenubarTrigger className="cursor-pointer font-mono text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-cyan-400 data-[state=open]:text-cyan-400 data-[state=open]:bg-cyan-900/20 hover:bg-white/5 transition-all outline-none rounded py-2 px-3 focus:bg-transparent">
                            <Crosshair className="w-3.5 h-3.5 mr-2" />
                            Hunting
                        </MenubarTrigger>
                        <MenubarContent className="bg-[#050608]/95 backdrop-blur-xl border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.8)] rounded-md font-mono text-[10px] uppercase font-bold min-w-[200px] p-1">
                            <MenubarItem onClick={() => handleNavigate("/ioc-lookup", "IOC Lookup")} className="cursor-pointer py-2.5 px-3 text-gray-400 outline-none hover:bg-white/5 focus:bg-white/5 hover:text-cyan-300 focus:text-cyan-300 rounded transition-colors tracking-widest">
                                IOC Lookup
                            </MenubarItem>
                            <MenubarItem onClick={() => handleNavigate("/threat-library", "Threat Library")} className="cursor-pointer py-2.5 px-3 text-gray-400 outline-none hover:bg-white/5 focus:bg-white/5 hover:text-cyan-300 focus:text-cyan-300 rounded transition-colors tracking-widest">
                                Threat Library
                            </MenubarItem>
                        </MenubarContent>
                    </MenubarMenu>
                </Menubar>

                <div className="ml-auto flex items-center gap-3 border-l border-white/10 pl-4 py-1">
                    <span className="text-[9px] font-mono text-gray-500 tracking-widest">ACTIVE MODULE</span>
                    <div className="px-2 py-0.5 rounded bg-cyan-900/30 border border-cyan-500/30 text-[10px] font-mono font-bold text-cyan-400 shadow-[0_0_10px_rgba(0,240,255,0.15)] flex items-center gap-1.5 uppercase">
                        {activeItem}
                    </div>
                    {/* Dev/Reset Tool */}
                    <button
                        onClick={() => {
                            localStorage.removeItem('cyberxtron_auth_state_v2');
                            setNeedsSessionCache(true);
                        }}
                        className="ml-4 px-2 py-1 bg-red-500/10 hover:bg-red-500/30 text-red-500 text-[9px] font-mono rounded transition-colors uppercase border border-red-500/30"
                    >
                        Reset Auth
                    </button>
                </div>
            </div>

            {/* --- MASKED IFRAME CONTENT --- */}
            <div className="flex-1 relative overflow-hidden bg-[#13131A] flex items-center justify-center">
                {needsSessionCache ? (
                    <div className="flex flex-col items-center justify-center animate-in fade-in duration-500 z-20 w-full h-full relative">
                        {/* Cropped Iframe Container acting as a Modal Window */}
                        <div className="relative overflow-hidden rounded-xl border border-white/10 shadow-[0_0_50px_rgba(0,240,255,0.05)] bg-[#1e1e1e] flex-shrink-0" style={{ width: '480px', height: '514px' }}>
                            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-cyan-500/20 via-cyan-400 to-cyan-500/20 z-10" />
                            <iframe
                                ref={iframeRef}
                                src="https://auth.cyberxtron.com/realms/XTronUsers/protocol/openid-connect/auth?client_id=xtronportal&redirect_uri=https%3A%2F%2Fportal.cyberxtron.com%2Flogin&state=15e80d1c-020b-481d-806d-b955864d61bb&response_mode=fragment&response_type=code&scope=openid&nonce=95a52b30-38cc-4e04-baee-cf9399c4fdb7&code_challenge=h_JOnDJr506tg3tpeWGd47bgmGu_WN1dNsFzjBTPJ7g&code_challenge_method=S256"
                                title="CyberXTron authentication"
                                className="absolute"
                                style={{
                                    width: '1200px',
                                    height: '900px',
                                    top: '-180px',  // Crop out Keycloak Header (CyberXTron logo)
                                    left: '-360px', // Center the 480px container inside the 1200px iframe page ( (1200-480)/2 = 360 )
                                    border: 'none',
                                    backgroundColor: 'transparent'
                                }}
                                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
                            />
                        </div>

                        {/* Fallback override button just in case SPA detection fails */}
                        <button
                            onClick={() => {
                                localStorage.setItem('cyberxtron_auth_state_v2', 'true');
                                setNeedsSessionCache(false);
                                setIframeKey(k => k + 1);
                            }}
                            className="mt-6 text-[10px] uppercase font-mono text-gray-500 hover:text-cyan-400 underline decoration-gray-500/30 underline-offset-4 transition-colors z-20"
                        >
                            Skip / I'm already logged in
                        </button>
                    </div>
                ) : (
                    <iframe
                        key={iframeKey}
                        src={iframeUrl}
                        title="DEEP_INXIDE Portal Content"
                        className="absolute border-0 bg-transparent transition-opacity duration-300"
                        style={
                            iframeUrl.includes("threatmap")
                                ? {
                                    top: '0',
                                    left: '0',
                                    width: '100%',
                                    height: '100%'
                                }
                                : {
                                    top: '-85px', // Hides the external top header
                                    left: '-280px', // Hides the external left sidebar
                                    width: 'calc(100% + 280px)', // Expands width 
                                    height: 'calc(100vh + 85px)' // Expands height
                                }
                        }
                        sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-popups-to-escape-sandbox"
                    />
                )}
            </div>
        </div>
    );
};

export default MultiServicePortal;
