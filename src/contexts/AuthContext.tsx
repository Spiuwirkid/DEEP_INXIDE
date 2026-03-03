import { createContext, useContext, useEffect, useState, useRef, useCallback, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// ── Security Configuration ──
const SESSION_TIMEOUT_MS = 30 * 60_000; // 30 minutes of inactivity → auto-logout
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;

interface AuthState {
    user: User | null;
    session: Session | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

    const signOut = useCallback(async () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
        // Clear any sensitive data from storage
        try {
            sessionStorage.clear();
        } catch { /* ignore */ }
    }, []);

    // ── Session Timeout (auto-logout on inactivity) ──
    const resetInactivityTimer = useCallback(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (!user) return;

        timeoutRef.current = setTimeout(() => {
            console.warn('[Security] Session expired due to inactivity');
            signOut();
        }, SESSION_TIMEOUT_MS);
    }, [user, signOut]);

    useEffect(() => {
        if (!user) return;

        // Start timer
        resetInactivityTimer();

        // Reset on user activity
        const handlers = ACTIVITY_EVENTS.map(event => {
            const handler = () => resetInactivityTimer();
            window.addEventListener(event, handler, { passive: true });
            return { event, handler };
        });

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            handlers.forEach(({ event, handler }) =>
                window.removeEventListener(event, handler)
            );
        };
    }, [user, resetInactivityTimer]);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                setSession(session);
                setUser(session?.user ?? null);
                setLoading(false);

                // Security: Log auth events
                if (event === 'SIGNED_IN') {
                    console.log('[Auth] User signed in:', session?.user?.email);
                } else if (event === 'SIGNED_OUT') {
                    console.log('[Auth] User signed out');
                } else if (event === 'TOKEN_REFRESHED') {
                    console.log('[Auth] Token refreshed');
                }
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error ? new Error(error.message) : null };
    };

    return (
        <AuthContext.Provider value={{ user, session, loading, signIn, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};
