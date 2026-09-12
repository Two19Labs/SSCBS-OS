-- ====================================================================
-- SSCBS OS — Team Finder Fixes Migration
-- ====================================================================
-- Run this query once in Supabase Dashboard > SQL Editor > New query.
-- Idempotent & safe to re-run.
-- ====================================================================

-- 1. Add accepted_emails array column to public.squad_posts
ALTER TABLE public.squad_posts 
ADD COLUMN IF NOT EXISTS accepted_emails TEXT[] DEFAULT '{}'::TEXT[];

-- 2. Add initial_open_spots integer column to public.squad_posts
ALTER TABLE public.squad_posts 
ADD COLUMN IF NOT EXISTS initial_open_spots INT DEFAULT 1;

-- 3. Backfill initial_open_spots from total_members or spots_left for existing rows
UPDATE public.squad_posts
SET initial_open_spots = COALESCE(spots_left, 1)
WHERE initial_open_spots IS NULL;

-- 4. Update squad_applications status check constraint to include 'removed'
ALTER TABLE public.squad_applications 
DROP CONSTRAINT IF EXISTS squad_applications_status_check;

ALTER TABLE public.squad_applications 
ADD CONSTRAINT squad_applications_status_check 
CHECK (status IN ('pending', 'accepted', 'declined', 'removed'));

-- 5. Enable Realtime Replication for Team Finder tables
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.squad_posts;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.squad_applications;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
END $$;

-- 6. Verify columns and constraint created properly
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'squad_posts'
  AND column_name IN ('accepted_emails', 'initial_open_spots');
