/**
 * Client-side rate limiter for login attempts.
 * 
 * Prevents brute force by tracking failed attempts per email.
 * After MAX_ATTEMPTS failures within WINDOW_MS, the account is
 * locked for LOCKOUT_MS. Uses localStorage for persistence across
 * page refreshes.
 * 
 * NOTE: This is a client-side measure. For production, always
 * combine with Supabase's built-in rate limiting and server-side
 * controls.
 */

const MAX_ATTEMPTS = 5;          // Max failed attempts before lockout
const WINDOW_MS = 15 * 60_000;  // 15 minute window
const LOCKOUT_MS = 15 * 60_000; // 15 minute lockout

interface AttemptRecord {
    attempts: number;
    firstAttempt: number;
    lockedUntil: number | null;
}

const STORAGE_KEY = 'auth_rate_limit';

function getRecords(): Record<string, AttemptRecord> {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function saveRecords(records: Record<string, AttemptRecord>) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch {
        // Storage full or private mode — fail silently
    }
}

/** Check if an email is currently locked out */
export function isLockedOut(email: string): { locked: boolean; remainingMs: number } {
    const records = getRecords();
    const record = records[email.toLowerCase()];

    if (!record?.lockedUntil) return { locked: false, remainingMs: 0 };

    const remaining = record.lockedUntil - Date.now();
    if (remaining <= 0) {
        // Lockout expired — clear
        delete records[email.toLowerCase()];
        saveRecords(records);
        return { locked: false, remainingMs: 0 };
    }

    return { locked: true, remainingMs: remaining };
}

/** Record a failed login attempt. Returns whether now locked out. */
export function recordFailedAttempt(email: string): boolean {
    const records = getRecords();
    const key = email.toLowerCase();
    const now = Date.now();

    let record = records[key];

    if (!record || (now - record.firstAttempt > WINDOW_MS)) {
        // Start new window
        record = { attempts: 1, firstAttempt: now, lockedUntil: null };
    } else {
        record.attempts++;
    }

    if (record.attempts >= MAX_ATTEMPTS) {
        record.lockedUntil = now + LOCKOUT_MS;
    }

    records[key] = record;
    saveRecords(records);

    return record.lockedUntil !== null;
}

/** Clear attempts on successful login */
export function clearAttempts(email: string) {
    const records = getRecords();
    delete records[email.toLowerCase()];
    saveRecords(records);
}

/** Format remaining lockout time for display */
export function formatLockoutTime(ms: number): string {
    const minutes = Math.ceil(ms / 60_000);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
}
