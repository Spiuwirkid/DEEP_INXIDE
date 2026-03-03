import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center"
                style={{ background: 'hsl(240 6% 4%)' }}>
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                    <span className="text-xs font-mono" style={{ color: 'hsl(0 0% 100% / 0.3)' }}>
                        Verifying session...
                    </span>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
};

export default ProtectedRoute;
