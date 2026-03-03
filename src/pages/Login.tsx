import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isLockedOut, recordFailedAttempt, clearAttempts, formatLockoutTime } from '@/lib/rate-limiter';
import { Eye, EyeOff, Lock, User, AlertCircle, Loader2 } from 'lucide-react';

/** Sanitize input — strip potential XSS vectors */
const sanitize = (input: string): string =>
    input.replace(/[<>"'&]/g, '').trim();

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [lockoutRemaining, setLockoutRemaining] = useState(0);
    const { signIn } = useAuth();
    const navigate = useNavigate();

    // Check lockout status on mount and countdown
    useEffect(() => {
        if (!email) return;
        const { locked, remainingMs } = isLockedOut(email);
        if (locked) {
            setLockoutRemaining(remainingMs);
            setError(`Too many failed attempts. Try again in ${formatLockoutTime(remainingMs)}.`);
        }
    }, [email]);

    // Countdown timer for lockout
    useEffect(() => {
        if (lockoutRemaining <= 0) return;
        const timer = setInterval(() => {
            setLockoutRemaining(prev => {
                const next = prev - 1000;
                if (next <= 0) {
                    setError('');
                    return 0;
                }
                setError(`Too many failed attempts. Try again in ${formatLockoutTime(next)}.`);
                return next;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [lockoutRemaining > 0]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');

        const cleanEmail = sanitize(email);
        const cleanPassword = password.trim();

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(cleanEmail)) {
            setError('Please enter a valid email address.');
            return;
        }

        const { locked, remainingMs } = isLockedOut(cleanEmail);
        if (locked) {
            setLockoutRemaining(remainingMs);
            setError(`Account locked. Try again in ${formatLockoutTime(remainingMs)}.`);
            return;
        }

        setLoading(true);

        try {
            const { error } = await signIn(cleanEmail, cleanPassword);

            if (error) {
                const nowLocked = recordFailedAttempt(cleanEmail);
                if (nowLocked) {
                    const { remainingMs } = isLockedOut(cleanEmail);
                    setLockoutRemaining(remainingMs);
                    setError(`Security limit exceeded. Account locked for ${formatLockoutTime(remainingMs)}.`);
                } else {
                    setError('Invalid credentials.');
                }
                setLoading(false);
            } else {
                clearAttempts(cleanEmail);
                navigate('/');
            }
        } catch {
            setError('System unreachable. Please try again later.');
            setLoading(false);
        }
    };

    const isLocked = lockoutRemaining > 0;

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0a0f] text-gray-200 font-sans selection:bg-cyan-500/30 relative overflow-hidden">

            {/* Ambient Glow overlay */}
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/20 via-[#0a0a0f] to-[#0a0a0f] z-0" />

            <div className="w-full max-w-[420px] p-6 sm:p-8 relative z-10">

                {/* Header Logo */}
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 rounded-xl bg-[#0a0a0f] shadow-[0_0_20px_rgba(0,240,255,0.1)] border border-cyan-500/30 flex items-center justify-center mb-5 transition-transform hover:scale-105 duration-300 relative overflow-hidden">
                        {/* Decorative scanline inside logo */}
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-cyan-400/50 animate-[pulse_2s_ease-in-out_infinite]" />
                        <img
                            src="/deep_inxide_logo.png"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            alt="Deep Inxide"
                            className="w-10 h-10 object-contain drop-shadow-[0_0_10px_rgba(0,240,255,0.6)]"
                        />
                    </div>
                    <h1 className="text-2xl font-bold tracking-[0.2em] text-white font-mono drop-shadow-[0_0_8px_rgba(0,240,255,0.2)]">
                        DEEP INXIDE
                    </h1>
                </div>

                {/* Main Card */}
                <div className="card-panel bg-[#13141c] shadow-[0_0_30px_rgba(0,240,255,0.05)] border border-cyan-500/20 rounded-xl p-6 sm:p-8 relative overflow-hidden">

                    <form onSubmit={handleSubmit} className="space-y-6 relative z-10">

                        {/* Error Alert */}
                        {error && (
                            <div className="flex items-start gap-3 p-3.5 bg-red-950/40 border border-red-500/30 rounded-lg text-sm text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                                <div className="leading-tight text-xs mt-0.5 font-medium">
                                    {error}
                                </div>
                            </div>
                        )}

                        {/* Email Input */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-cyan-500/80 uppercase tracking-widest ml-1 flex items-center gap-2">
                                <span className="w-1 h-1 bg-cyan-400 rounded-full" /> Email Address
                            </label>
                            <div className="relative group/input">
                                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within/input:text-cyan-400 transition-colors">
                                    <User className="w-4 h-4" />
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg py-3 pl-10 pr-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all font-mono shadow-inner"
                                    placeholder="Enter your email"
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-cyan-500/80 uppercase tracking-widest ml-1 flex items-center gap-2">
                                <span className="w-1 h-1 bg-cyan-400 rounded-full" /> Password
                            </label>
                            <div className="relative group/input">
                                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within/input:text-cyan-400 transition-colors">
                                    <Lock className="w-4 h-4" />
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg py-3 pl-10 pr-10 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all font-mono shadow-inner"
                                    placeholder="Enter your password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-cyan-400 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading || isLocked}
                            className="w-full mt-4 relative overflow-hidden bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 hover:border-cyan-400 text-cyan-400 rounded-lg py-3 font-semibold text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,240,255,0.05)] hover:shadow-[0_0_25px_rgba(0,240,255,0.15)] uppercase tracking-wider"
                        >
                            {loading && <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />}
                            {loading ? 'Authenticating...' : 'Login'}
                        </button>
                    </form>
                </div>

                {/* Footer */}
                <p className="text-center text-xs text-gray-600 mt-8 font-mono">
                    &copy; {new Date().getFullYear()} Deep Inxide. All rights reserved.
                </p>

            </div>
        </div>
    );
};

export default Login;
