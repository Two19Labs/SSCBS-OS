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

-- 4. Verify columns created properly
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'squad_posts'
  AND column_name IN ('accepted_emails', 'initial_open_spots');
