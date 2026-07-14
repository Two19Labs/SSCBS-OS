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
    INSERT INTO public.user_progress (user_id)
    VALUES (new.id);
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

-- Only aditya.25015 can write (insert, update, delete)
CREATE POLICY "Enable write access for aditya.25015" 
    ON public.system_configs 
    FOR ALL 
    TO authenticated 
    USING (auth.jwt() ->> 'email' = 'aditya.25015@sscbs.du.ac.in')
    WITH CHECK (auth.jwt() ->> 'email' = 'aditya.25015@sscbs.du.ac.in');

