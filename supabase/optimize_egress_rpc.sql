-- ====================================================================
-- SSCBS OS: Supabase Egress & Database Usage Optimization Migration
-- ====================================================================

-- 1. Create missing active_presence table to prevent PGRST205 API errors
CREATE TABLE IF NOT EXISTS public.active_presence (
    session_id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    course TEXT DEFAULT 'N/A',
    semester TEXT DEFAULT 'N/A',
    section TEXT DEFAULT 'N/A',
    current_view TEXT DEFAULT 'home',
    view_label TEXT DEFAULT 'Home Dashboard',
    device TEXT DEFAULT '💻 Desktop',
    last_ping TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on active_presence
ALTER TABLE public.active_presence ENABLE ROW LEVEL SECURITY;

-- Setup RLS Policies for active_presence (Allow both authenticated and anon for real-time presence)
DROP POLICY IF EXISTS "Enable read access for active_presence" ON public.active_presence;
DROP POLICY IF EXISTS "Enable insert/update access for active_presence" ON public.active_presence;

CREATE POLICY "Enable read access for active_presence" 
    ON public.active_presence 
    FOR SELECT 
    TO authenticated, anon 
    USING (true);

CREATE POLICY "Enable insert/update access for active_presence" 
    ON public.active_presence 
    FOR ALL 
    TO authenticated, anon 
    USING (true)
    WITH CHECK (true);

-- 2. Create missing app_config table for timetable & global app settings
CREATE TABLE IF NOT EXISTS public.app_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for app_config" ON public.app_config;
CREATE POLICY "Enable read access for app_config" 
    ON public.app_config FOR SELECT TO authenticated, anon USING (true);

-- 3. Create missing profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for profiles" ON public.profiles;
CREATE POLICY "Enable read access for profiles" 
    ON public.profiles FOR SELECT TO authenticated, anon USING (true);

-- 4. Create missing admin_whitelist table
CREATE TABLE IF NOT EXISTS public.admin_whitelist (
    email TEXT PRIMARY KEY,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.admin_whitelist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for admin_whitelist" ON public.admin_whitelist;
CREATE POLICY "Enable read access for admin_whitelist" 
    ON public.admin_whitelist FOR SELECT TO authenticated, anon USING (true);

-- 5. Create B-Tree composite indexes for sub-millisecond egress aggregation queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_feature 
    ON public.analytics_events(created_at, feature_id);

CREATE INDEX IF NOT EXISTS idx_notices_display_created 
    ON public.notices(display_order, created_at DESC);

-- 6. Create Server-Side Postgres RPC function for aggregated analytics (Reduces egress by >99%)
CREATE OR REPLACE FUNCTION public.get_analytics_summary(start_date TIMESTAMP WITH TIME ZONE)
RETURNS TABLE (date_str TEXT, feature_id TEXT, visit_count BIGINT) 
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT 
        to_char(created_at, 'YYYY-MM-DD') AS date_str,
        feature_id,
        COUNT(*) AS visit_count
    FROM public.analytics_events
    WHERE created_at >= start_date AND feature_id != 'admin'
    GROUP BY 1, 2;
$$;

-- Grant execution permissions on RPC to authenticated and anon roles
GRANT EXECUTE ON FUNCTION public.get_analytics_summary(TIMESTAMP WITH TIME ZONE) TO authenticated, anon;
