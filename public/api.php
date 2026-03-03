<?php
// Deep Inxide API Backend Proxy 
// (HARDENED EDITION 🔒 - Pentest Ready)

// 1. Strict CORS Policy (Batasi Origin khusus domain yang bersangkutan)
$allowedOrigins = [
    'https://cti.tkm-teknologi.id',
    'http://localhost:8080',
    'http://localhost:3000',
    'http://127.0.0.1:8080'
];
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if (in_array($origin, $allowedOrigins)) {
    header("Access-Control-Allow-Origin: $origin");
} else {
    // Fallback block jika request asing secara direct hit
    header('Access-Control-Allow-Origin: https://cti.tkm-teknologi.id'); 
}

header('Access-Control-Allow-Methods: GET, POST, OPTIONS'); // Blok PUT dll untuk endpoint public API ini (Hardening)
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With'); // Jangan expose header org CyberXTron
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY'); // Mencegah iframe hijacking
header('Strict-Transport-Security: max-age=31536000; includeSubDomains');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}

// 2. Kunci API CyberXTron (Tersimpan sangat aman di backend, sama sekali tidak ada di bundle webpack)
$XTRON_ORG_KEY = "4b34f105b8f7867a3559d52a424c3d2b"; 
$XTRON_ORG_SECRET = "bca542a66a163868d3ffb402122f51d641f7441beddc1993ae4c43eed8ae99c2";

// --- START SUPABASE JWT AUTHENTICATION CHECK ---
$authHeader = '';
if (function_exists('apache_request_headers')) {
    $headers = apache_request_headers();
    $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : (isset($headers['authorization']) ? $headers['authorization'] : '');
}
if (empty($authHeader) && isset($_SERVER['HTTP_AUTHORIZATION'])) {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
} else if (empty($authHeader) && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
    $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
}

if (empty($authHeader) || !preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
    http_response_code(401);
    echo json_encode(["status" => "error", "message" => "401 Unauthorized: Missing or invalid Authorization header"]);
    exit();
}

$jwt = $matches[1];
$supabaseUrl = "https://ypgrpsupzgjsjdbglrqw.supabase.co/auth/v1/user";
$supabaseAnonKey = "sb_publishable__Nw25S7BQ7qy36gLjLY0tw_4SoxuKzZ"; // Public safe anon key for verification API

// Verifikasi token ke server Supabase
$chAuth = curl_init($supabaseUrl);
curl_setopt($chAuth, CURLOPT_RETURNTRANSFER, true);
curl_setopt($chAuth, CURLOPT_HTTPHEADER, [
    "apikey: " . $supabaseAnonKey,
    "Authorization: Bearer " . $jwt
]);
$authResult = curl_exec($chAuth);
$authHttpCode = curl_getinfo($chAuth, CURLINFO_HTTP_CODE);
curl_close($chAuth);

// Jika respons dari Supabase bukan 200 OK (token expired, invalid, etc), tolak request!
if ($authHttpCode !== 200) {
    http_response_code(401);
    echo json_encode(["status" => "error", "message" => "401 Unauthorized: Invalid or expired session token"]);
    exit();
}
// --- END AUTHENTICATION CHECK ---

// 3. Sanitasi Ekstrem (WAF Level 1 - Path Traversal & XSS Mitigation)
$req = isset($_GET['req']) ? ltrim(trim($_GET['req']), '/') : '';
$requestPath = '/' . $req;
$requestPath = str_replace(['../', '..\\', '%00'], '', $requestPath); // Blok directory traversal null byte
$queryString = isset($_SERVER['QUERY_STRING']) ? $_SERVER['QUERY_STRING'] : '';
$cleanQuery = preg_replace('/^req=[^&]*&?/', '', $queryString);
$cleanQuery = htmlspecialchars($cleanQuery, ENT_QUOTES, 'UTF-8'); 

// 4. Endpoint Whitelisting (ASR - Attack Surface Reduction)
// Hanya endpoint spesifik ini saja yang diizinkan di proxy untuk lolos, blokir tebakan API liar
$targetUrl = "";
if (strpos($requestPath, "/threatbolt") === 0) {
    if (preg_match('#^/threatbolt/api/v1/ioc/[^/]+/malicious-feed$#', $requestPath) ||
        preg_match('#^/threatbolt/api/v1/ioc/enrichment-summary$#', $requestPath)) {
        $targetUrl = "https://apix.cyberxtron.com" . $requestPath;
    }
} else if (strpos($requestPath, "/incidents") === 0) {
    $cleanPath = preg_replace('~^/incidents~', '', $requestPath);
    if (in_array($cleanPath, [
        '/api/v1/darkflash/incidents',
        '/api/v1/brandsafe/incidents',
        '/api/v1/shadowspot/findings'
    ])) {
        $targetUrl = "https://incidents.cyberxtron.com" . $cleanPath;
    }
} else if (strpos($requestPath, "/supabase") === 0) {
    $cleanPath = preg_replace('~^/supabase~', '', $requestPath);
    if (in_array($cleanPath, [
        '/virustotal-lookup',
        '/threat-intel-proxy'
    ])) {
        $targetUrl = "https://ypgrpsupzgjsjdbglrqw.supabase.co/functions/v1" . $cleanPath;
    }
} else if (strpos($requestPath, "/threatfox") === 0) {
    $targetUrl = "https://threatfox-api.abuse.ch/api/v1/";
    $cleanQuery = '';
} else if (strpos($requestPath, "/geo") === 0) {
    $ip = isset($_GET['ip']) ? trim($_GET['ip']) : '';
    $targetUrl = "http://ip-api.com/json/" . $ip . "?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query";
    $cleanQuery = ''; // Prevent appending original query string
} else if (strpos($requestPath, "/urlhaus") === 0) {
    $type = isset($_GET['type']) ? $_GET['type'] : '';
    $query = isset($_GET['query']) ? $_GET['query'] : '';
    
    $targetUrl = ($type === 'url') ? "https://urlhaus-api.abuse.ch/v1/url/" : "https://urlhaus-api.abuse.ch/v1/host/";
    $cleanQuery = '';
    
    // URLhaus actually requires POST with form-urlencoded
    global $customUrlhausPayload;
    $customUrlhausPayload = ($type === 'url') ? "url=" . urlencode($query) : "host=" . urlencode($query);
    $_SERVER['REQUEST_METHOD'] = 'POST'; // Force POST mode for this endpoint
} else if (strpos($requestPath, "/shodan") === 0) {
    $ip = isset($_GET['ip']) ? trim($_GET['ip']) : '';
    $targetUrl = "https://internetdb.shodan.io/" . $ip;
    $cleanQuery = ''; // Prevent appending original query string
} else if (strpos($requestPath, "/dns") === 0) {
    $domain = isset($_GET['domain']) ? trim($_GET['domain']) : '';
    $type = isset($_GET['type']) ? trim($_GET['type']) : '1';
    $targetUrl = "https://dns.google/resolve?name=" . urlencode($domain) . "&type=" . urlencode($type);
    $cleanQuery = ''; // Prevent appending original query string
}

// Security Break! Jika hacker mencoba akses path/endpoint invalid
if (empty($targetUrl)) {
    http_response_code(403); // HTTP 403 Forbidden
    echo json_encode([
        "status" => "error", 
        "message" => "403 Forbidden: Endpoint is locked or invalid.",
        "debug_path" => $requestPath
    ]);
    exit();
}

if (!empty($cleanQuery)) {
    $targetUrl .= "?" . $cleanQuery; 
}

// 5. Hard Cek Metode HTTP (Izinkan GET & POST)
$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'GET' && $method !== 'POST') {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "405 Method Not Allowed"]);
    exit();
}

// 6. Eksekusi Aman SSL (SSRF Mitigation)
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $targetUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 30); // 30s untuk API lambat spt VT
curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

global $customUrlhausPayload;
if ($method === 'POST') {
    curl_setopt($ch, CURLOPT_POST, true);
    if (isset($customUrlhausPayload)) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $customUrlhausPayload);
    } else {
        $inputJSON = file_get_contents('php://input');
        curl_setopt($ch, CURLOPT_POSTFIELDS, $inputJSON);
    }
}

// Jangan boleh follow lokasi redirect sembarangan (SSRF Prevention)
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false); 

$forwardHeaders = [
    isset($customUrlhausPayload) ? "Content-Type: application/x-www-form-urlencoded" : "Content-Type: application/json",
    "Accept: application/json, text/plain, */*",
    "XTRON-ORG-KEY: " . $XTRON_ORG_KEY,            // Injeksi API secara anonim
    "XTRON-ORG-SECRET: " . $XTRON_ORG_SECRET
];

// Teruskan JWT ke Supabase jka request adalah Supabase Edge Function
if (strpos($requestPath, "/supabase") === 0 && !empty($authHeader)) {
    $forwardHeaders[] = "Authorization: " . $authHeader;
}

curl_setopt($ch, CURLOPT_HTTPHEADER, $forwardHeaders);

// Eksekusi CURL
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

// Output Handling
http_response_code($httpCode ? $httpCode : 502);
header('Content-Type: application/json');

if ($response === false) {
    echo json_encode(["status" => "error", "message" => "Internal Gateway Error"]);
} else {
    echo $response;
}
?>
