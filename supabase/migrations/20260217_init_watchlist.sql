
-- Watchlist table for active monitoring
CREATE TABLE IF NOT EXISTS public.watchlist (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    target TEXT NOT NULL,
    type TEXT NOT NULL, -- 'ip', 'domain', 'hash'
    notes TEXT,
    tags TEXT[],
    status TEXT DEFAULT 'active', -- 'active', 'archived'
    last_scanned_at TIMESTAMP WITH TIME ZONE,
    risk_level TEXT
);

-- RLS
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read watchlist" ON public.watchlist FOR SELECT USING (true);
CREATE POLICY "Allow public insert watchlist" ON public.watchlist FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update watchlist" ON public.watchlist FOR UPDATE USING (true);
CREATE POLICY "Allow public delete watchlist" ON public.watchlist FOR DELETE USING (true);
