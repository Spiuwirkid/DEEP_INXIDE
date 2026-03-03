import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Suspense, lazy } from 'react';
import Index from "./pages/Index";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const PentestGuide = lazy(() => import('./pages/PentestGuide'));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Index />
              </ProtectedRoute>
            } />
            {/* DEV-ONLY ROUTES */}
            {import.meta.env.DEV && (
              <Route path="/pentest-guide" element={
                <Suspense fallback={<div className="min-h-screen bg-[#0a0a0f] text-cyan-500 font-mono p-10 flex items-center justify-center">INITIALIZING SECURITY HUD...</div>}>
                  <PentestGuide />
                </Suspense>
              } />
            )}
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
