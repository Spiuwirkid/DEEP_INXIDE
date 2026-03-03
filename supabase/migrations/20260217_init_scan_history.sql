-- Create scan_history table to store all threat intelligence scans
CREATE TABLE IF NOT EXISTS public.scan_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    target TEXT NOT NULL,
    scan_type TEXT NOT NULL, -- e.g., 'ip', 'domain', 'url'
    scan_data JSONB NOT NULL DEFAULT '{}'::jsonb, -- Stores raw technical scan results (VT, Shodan, etc.)
    ai_analysis JSONB, -- Stores the Deep Inxide AI analysis result (Markdown + Metadata)
    risk_score INTEGER, -- extracted composite score for easy querying
    risk_level TEXT -- e.g., 'critical', 'high', 'medium', 'low', 'safe'
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.scan_history ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to view all history (or just their own if we had users table linked)
-- For now, allowing public read for demo purposes, or authenticated only.
-- Assuming anon key is used for public access in this demo:
CREATE POLICY "Allow public read access" ON public.scan_history FOR SELECT USING (true);

-- Policy: Allow anon to insert scan results (since the scanner runs on client side)
CREATE POLICY "Allow public insert access" ON public.scan_history FOR INSERT WITH CHECK (true);

-- Policy: Allow extensive updates (for AI analysis injection after scan)
CREATE POLICY "Allow public update access" ON public.scan_history FOR UPDATE USING (true);
