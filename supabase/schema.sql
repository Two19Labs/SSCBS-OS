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
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_progress (user_id)
    VALUES (new.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind the trigger to auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
