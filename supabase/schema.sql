-- =======================================================
-- SSCBS OS: Database Schema & Authentication Integration
-- =======================================================

-- 1. Create a table to store user profile / progress data
CREATE TABLE IF NOT EXISTS public.user_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    completed_modules TEXT[] DEFAULT '{}'::TEXT[],
    saved_simulations JSONB DEFAULT '[]'::JSONB,
    settings JSONB DEFAULT '{"theme": "dark", "sound": true}'::JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_user_progress UNIQUE (user_id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

-- 2. Setup Security Policies (users can only access their own data)
CREATE POLICY "Users can view their own progress" 
    ON public.user_progress 
    FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own progress" 
    ON public.user_progress 
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress" 
    ON public.user_progress 
    FOR UPDATE 
    USING (auth.uid() = user_id);

-- 3. Automatic Profile Creation Trigger on Sign Up
-- Whenever a user registers in auth.users, this function automatically creates their user_progress profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.user_progress (user_id, settings)
    VALUES (
        new.id,
        jsonb_build_object('email', new.email, 'theme', 'dark', 'sound', true)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Revoke default public execution privileges to secure the SECURITY DEFINER function
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

-- Bind the trigger to auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Enforce domain restriction on Sign Up (Only allow @sscbs.du.ac.in)
CREATE OR REPLACE FUNCTION public.check_sscbs_email()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    IF NEW.email NOT LIKE '%@sscbs.du.ac.in' THEN
        RAISE EXCEPTION 'Access Denied: Only @sscbs.du.ac.in emails are allowed.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Bind the email validation trigger BEFORE insertion to block immediately
CREATE OR REPLACE TRIGGER enforce_sscbs_email
    BEFORE INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.check_sscbs_email();

-- Revoke default public execution privileges to secure the SECURITY DEFINER function
REVOKE EXECUTE ON FUNCTION public.check_sscbs_email() FROM public;
REVOKE EXECUTE ON FUNCTION public.check_sscbs_email() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.check_sscbs_email() FROM anon;

-- 5. Create a table to store system configurations (e.g. timetables)
CREATE TABLE IF NOT EXISTS public.system_configs (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.system_configs ENABLE ROW LEVEL SECURITY;

-- Setup Security Policies
-- Anyone authenticated can read
CREATE POLICY "Enable read access for all authenticated users" 
    ON public.system_configs 
    FOR SELECT 
    TO authenticated 
    USING (true);

-- Only admins can write (insert, update, delete)
CREATE POLICY "Enable write access for admins" 
    ON public.system_configs 
    FOR ALL 
    TO authenticated 
    USING (auth.jwt() ->> 'email' IN ('aditya.25015@sscbs.du.ac.in', 'manthan.25138@sscbs.du.ac.in'))
    WITH CHECK (auth.jwt() ->> 'email' IN ('aditya.25015@sscbs.du.ac.in', 'manthan.25138@sscbs.du.ac.in'));

-- 6. Create a table to store campus notices / events
CREATE TABLE IF NOT EXISTS public.notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL,     -- 'Society', 'Session', 'Event', 'Academic'
    society TEXT,               -- e.g. 'Kronos', 'Macula' (Optional)
    venue TEXT,                 -- e.g. 'Auditorium', 'Room 408' (Optional)
    link_url TEXT,              -- Registration link (Optional)
    event_date TIMESTAMP WITH TIME ZONE,  -- Event/Session date and time (Optional)
    active_from TIMESTAMP WITH TIME ZONE, -- Display notice start date (Optional)
    active_to TIMESTAMP WITH TIME ZONE,   -- Display notice end date (Optional)
    display_order INT DEFAULT 0,          -- Custom ordering index
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'published',      -- 'published', 'pending', 'rejected'
    created_by_email TEXT,
    created_by_name TEXT
);

-- Migration statements if table already exists:
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS venue TEXT;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published';
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS created_by_email TEXT;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS created_by_name TEXT;

-- Enable Row Level Security (RLS)
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

-- Setup Security Policies
DROP POLICY IF EXISTS "Enable read access for all authenticated users on notices" ON public.notices;
DROP POLICY IF EXISTS "Enable write access for admins on notices" ON public.notices;
DROP POLICY IF EXISTS "Enable insert access for pending notice drafts" ON public.notices;
DROP POLICY IF EXISTS "Enable full access for admins on notices" ON public.notices;

-- Anyone authenticated can read notices
CREATE POLICY "Enable read access for all authenticated users on notices" 
    ON public.notices 
    FOR SELECT 
    TO authenticated 
    USING (true);

-- Anyone authenticated can submit pending notice drafts
CREATE POLICY "Enable insert access for pending notice drafts"
    ON public.notices
    FOR INSERT
    TO authenticated
    WITH CHECK (status = 'pending' OR auth.jwt() ->> 'email' IN ('aditya.25015@sscbs.du.ac.in', 'manthan.25138@sscbs.du.ac.in'));

-- Admins have full control (update, delete, publish)
CREATE POLICY "Enable full access for admins on notices"
    ON public.notices
    FOR ALL
    TO authenticated
    USING (auth.jwt() ->> 'email' IN ('aditya.25015@sscbs.du.ac.in', 'manthan.25138@sscbs.du.ac.in'))
    WITH CHECK (auth.jwt() ->> 'email' IN ('aditya.25015@sscbs.du.ac.in', 'manthan.25138@sscbs.du.ac.in'));

-- 6b. Create a table to store notice drafter requests from students / society reps
CREATE TABLE IF NOT EXISTS public.notice_drafter_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    full_name TEXT,
    society_note TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.notice_drafter_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for notice drafter requests" ON public.notice_drafter_requests;
DROP POLICY IF EXISTS "Enable all access for notice drafter requests" ON public.notice_drafter_requests;
DROP POLICY IF EXISTS "Enable write access for notice drafter requests" ON public.notice_drafter_requests;
DROP POLICY IF EXISTS "Enable insert access for notice drafter requests" ON public.notice_drafter_requests;
DROP POLICY IF EXISTS "Enable update/delete access for notice drafter requests" ON public.notice_drafter_requests;

CREATE POLICY "Enable read access for notice drafter requests" 
    ON public.notice_drafter_requests 
    FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Enable insert access for notice drafter requests" 
    ON public.notice_drafter_requests 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (user_id = auth.uid() OR auth.jwt() ->> 'email' IN ('aditya.25015@sscbs.du.ac.in', 'manthan.25138@sscbs.du.ac.in'));

CREATE POLICY "Enable update/delete access for notice drafter requests" 
    ON public.notice_drafter_requests 
    FOR ALL 
    TO authenticated 
    USING (user_id = auth.uid() OR auth.jwt() ->> 'email' IN ('aditya.25015@sscbs.du.ac.in', 'manthan.25138@sscbs.du.ac.in'))
    WITH CHECK (user_id = auth.uid() OR auth.jwt() ->> 'email' IN ('aditya.25015@sscbs.du.ac.in', 'manthan.25138@sscbs.du.ac.in'));

-- Only admins can view all student progress for demographics/analytics
CREATE POLICY "Enable read access for admin on user progress" 
    ON public.user_progress 
    FOR SELECT 
    TO authenticated 
    USING (auth.jwt() ->> 'email' IN ('aditya.25015@sscbs.du.ac.in', 'manthan.25138@sscbs.du.ac.in'));

-- 7. Create a table to store feature usage analytics events
CREATE TABLE IF NOT EXISTS public.analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_id TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type TEXT DEFAULT 'visit',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to log usage events
CREATE POLICY "Enable insert access for authenticated users on analytics_events" 
    ON public.analytics_events 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

-- Allow all authenticated users to read analytics events for dashboards
CREATE POLICY "Enable read access for authenticated users on analytics_events" 
    ON public.analytics_events 
    FOR SELECT 
    TO authenticated 
    USING (true);

-- 8. Create a table to track real-time active student presence
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

-- Enable Row Level Security (RLS)
ALTER TABLE public.active_presence ENABLE ROW LEVEL SECURITY;

-- Security Policies for active_presence
-- All authenticated users can read online presence
CREATE POLICY "Enable read access for authenticated users on active_presence" 
    ON public.active_presence 
    FOR SELECT 
    TO authenticated 
    USING (true);

-- Authenticated users can insert or update their own presence ping
CREATE POLICY "Enable insert/update access for authenticated users on active_presence" 
    ON public.active_presence 
    FOR ALL 
    TO authenticated 
    USING (auth.jwt() ->> 'email' = email OR user_id = auth.uid()::text)
    WITH CHECK (auth.jwt() ->> 'email' = email OR user_id = auth.uid()::text);

-- 9. Create a table to store holidays/fests and custom messages
CREATE TABLE IF NOT EXISTS public.holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE,
    title TEXT NOT NULL,
    message TEXT,
    type TEXT DEFAULT 'Holiday', -- 'Holiday', 'Fest', etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- Setup Security Policies
-- Anyone authenticated can read holidays
CREATE POLICY "Enable read access for all authenticated users on holidays" 
    ON public.holidays 
    FOR SELECT 
    TO authenticated 
    USING (true);

-- Only admins can write (insert, update, delete) holidays
CREATE POLICY "Enable write access for admins on holidays" 
    ON public.holidays 
    FOR ALL 
    TO authenticated 
    USING (auth.jwt() ->> 'email' IN ('aditya.25015@sscbs.du.ac.in', 'manthan.25138@sscbs.du.ac.in'))
    WITH CHECK (auth.jwt() ->> 'email' IN ('aditya.25015@sscbs.du.ac.in', 'manthan.25138@sscbs.du.ac.in'));

-- 10. Create a table for Team Finder / Squad Posts (Admin Beta & Campus Rollout)
CREATE TABLE IF NOT EXISTS public.squad_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    competition_name TEXT NOT NULL,
    organizer TEXT,
    competition_link TEXT,
    phone_number TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    skills_have TEXT[] DEFAULT '{}'::TEXT[],
    skills_looking_for TEXT[] DEFAULT '{}'::TEXT[],
    total_members INT DEFAULT 4,
    spots_left INT DEFAULT 1,
    course TEXT DEFAULT 'BMS',
    year TEXT DEFAULT '2nd Year',
    is_open BOOLEAN DEFAULT true,
    created_by_email TEXT,
    created_by_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Migration statements if table already exists:
ALTER TABLE public.squad_posts ADD COLUMN IF NOT EXISTS created_by_email TEXT;
ALTER TABLE public.squad_posts ADD COLUMN IF NOT EXISTS created_by_name TEXT;
ALTER TABLE public.squad_posts ADD COLUMN IF NOT EXISTS total_members INT DEFAULT 4;

-- Enable RLS
ALTER TABLE public.squad_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users on squad_posts" ON public.squad_posts;
DROP POLICY IF EXISTS "Enable insert access for authenticated users on squad_posts" ON public.squad_posts;
DROP POLICY IF EXISTS "Enable update/delete access for creator or admin on squad_posts" ON public.squad_posts;

-- Allow authenticated users to read squad posts
CREATE POLICY "Enable read access for authenticated users on squad_posts" 
    ON public.squad_posts 
    FOR SELECT 
    TO authenticated 
    USING (true);

-- Allow authenticated users to create and update squad posts
CREATE POLICY "Enable insert access for authenticated users on squad_posts" 
    ON public.squad_posts 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (user_id = auth.uid() OR user_id IS NULL OR auth.jwt() ->> 'email' IN ('aditya.25015@sscbs.du.ac.in', 'manthan.25138@sscbs.du.ac.in'));

CREATE POLICY "Enable update/delete access for creator or admin on squad_posts" 
    ON public.squad_posts 
    FOR ALL 
    TO authenticated 
    USING (user_id = auth.uid() OR auth.jwt() ->> 'email' IN ('aditya.25015@sscbs.du.ac.in', 'manthan.25138@sscbs.du.ac.in'))
    WITH CHECK (user_id = auth.uid() OR auth.jwt() ->> 'email' IN ('aditya.25015@sscbs.du.ac.in', 'manthan.25138@sscbs.du.ac.in'));


-- 11. Create a table for Squad Join Applications & Host Approvals
CREATE TABLE IF NOT EXISTS public.squad_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.squad_posts(id) ON DELETE CASCADE,
    applicant_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    applicant_name TEXT NOT NULL,
    applicant_email TEXT NOT NULL,
    applicant_phone TEXT,
    applicant_course TEXT DEFAULT 'BMS',
    applicant_year TEXT DEFAULT '2nd Year',
    pitch_note TEXT NOT NULL,
    highlighted_skills TEXT[] DEFAULT '{}'::TEXT[],
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.squad_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access on squad_applications" ON public.squad_applications;
DROP POLICY IF EXISTS "Enable insert access on squad_applications" ON public.squad_applications;
DROP POLICY IF EXISTS "Enable update/delete access on squad_applications" ON public.squad_applications;

-- Allow authenticated users to view applications for posts they created or applied to
CREATE POLICY "Enable read access on squad_applications"
    ON public.squad_applications FOR SELECT TO authenticated
    USING (true);

-- Allow authenticated users to create join requests
CREATE POLICY "Enable insert access on squad_applications"
    ON public.squad_applications FOR INSERT TO authenticated
    WITH CHECK (applicant_id = auth.uid() OR applicant_id IS NULL OR auth.jwt() ->> 'email' IN ('aditya.25015@sscbs.du.ac.in', 'manthan.25138@sscbs.du.ac.in'));

-- Allow post creator or applicant or admin to update status / delete
CREATE POLICY "Enable update/delete access on squad_applications"
    ON public.squad_applications FOR ALL TO authenticated
    USING (
        applicant_id = auth.uid() 
        OR post_id IN (SELECT id FROM public.squad_posts WHERE user_id = auth.uid())
        OR auth.jwt() ->> 'email' IN ('aditya.25015@sscbs.du.ac.in', 'manthan.25138@sscbs.du.ac.in')
    );


