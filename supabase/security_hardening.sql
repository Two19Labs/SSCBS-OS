-- ====================================================================
-- SSCBS OS — Security Hardening Migration
-- ====================================================================
-- Run this ONCE in the Supabase SQL Editor (Dashboard > SQL Editor > New query).
-- It is idempotent: safe to re-run.
--
-- Fixes:
--   1. squad_applications — applicant PII readable by every student
--   2. squad_applications — applicants could self-approve their own request
--   3. Ownership binding was optional on posts/applications (forged rows)
--   4. notices        — author email could be forged
--   5. analytics_events — world-readable + forgeable
--   6. active_presence  — user enumeration
--   7. notice_drafter_requests — readable by all
--   8. get_analytics_summary RPC — SECURITY DEFINER, granted to anon,
--                                  no search_path pinning
-- ====================================================================


-- --------------------------------------------------------------------
-- 0. Central admin check (single source of truth for the admin list)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_sscbs_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(auth.jwt() ->> 'email', '') IN (
    'aditya.25015@sscbs.du.ac.in',
    'manthan.25138@sscbs.du.ac.in'
  );
$$;

-- To add or remove an admin later, edit ONLY this function and re-run it.


-- --------------------------------------------------------------------
-- 1 + 2 + 3. squad_applications
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Enable read access on squad_applications"          ON public.squad_applications;
DROP POLICY IF EXISTS "Enable insert access on squad_applications"        ON public.squad_applications;
DROP POLICY IF EXISTS "Enable update/delete access on squad_applications" ON public.squad_applications;
DROP POLICY IF EXISTS "applications_select"        ON public.squad_applications;
DROP POLICY IF EXISTS "applications_insert"        ON public.squad_applications;
DROP POLICY IF EXISTS "applications_update_own"    ON public.squad_applications;
DROP POLICY IF EXISTS "applications_update_host"   ON public.squad_applications;
DROP POLICY IF EXISTS "applications_delete"        ON public.squad_applications;

-- SELECT: only your own applications, applications to posts you host, or admin.
-- This is what the original comment always claimed; USING (true) did not enforce it.
CREATE POLICY "applications_select"
    ON public.squad_applications FOR SELECT TO authenticated
    USING (
        applicant_id = auth.uid()
        OR post_id IN (SELECT id FROM public.squad_posts WHERE user_id = auth.uid())
        OR public.is_sscbs_admin()
    );

-- INSERT: you may only file an application as yourself, and only as 'pending'.
-- (The old policy allowed applicant_id IS NULL, i.e. unattributable rows.)
CREATE POLICY "applications_insert"
    ON public.squad_applications FOR INSERT TO authenticated
    WITH CHECK (
        (applicant_id = auth.uid() AND status = 'pending')
        OR public.is_sscbs_admin()
    );

-- UPDATE (applicant): re-applying is allowed, but the row may only ever land
-- back in 'pending'. This is what blocks self-approval: an applicant setting
-- status='accepted' passes USING but fails WITH CHECK.
CREATE POLICY "applications_update_own"
    ON public.squad_applications FOR UPDATE TO authenticated
    USING (applicant_id = auth.uid())
    WITH CHECK (applicant_id = auth.uid() AND status = 'pending');

-- UPDATE (host/admin): the host of the post decides accepted/declined/removed.
CREATE POLICY "applications_update_host"
    ON public.squad_applications FOR UPDATE TO authenticated
    USING (
        post_id IN (SELECT id FROM public.squad_posts WHERE user_id = auth.uid())
        OR public.is_sscbs_admin()
    )
    WITH CHECK (
        post_id IN (SELECT id FROM public.squad_posts WHERE user_id = auth.uid())
        OR public.is_sscbs_admin()
    );

-- DELETE: withdraw your own application; hosts/admins can clear their own posts'.
CREATE POLICY "applications_delete"
    ON public.squad_applications FOR DELETE TO authenticated
    USING (
        applicant_id = auth.uid()
        OR post_id IN (SELECT id FROM public.squad_posts WHERE user_id = auth.uid())
        OR public.is_sscbs_admin()
    );


-- --------------------------------------------------------------------
-- 3b. squad_posts — require real ownership on insert
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Enable insert access for authenticated users on squad_posts" ON public.squad_posts;
DROP POLICY IF EXISTS "posts_insert" ON public.squad_posts;

-- Removed the `user_id IS NULL` escape hatch, which allowed posts that belonged
-- to nobody and could never be edited or deleted by their creator.
CREATE POLICY "posts_insert"
    ON public.squad_posts FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid() OR public.is_sscbs_admin());

-- NOTE: squad_posts SELECT stays USING (true) on purpose. The poster's
-- phone_number is published deliberately so students can WhatsApp the host.


-- --------------------------------------------------------------------
-- 4. notices — bind the author, keep drafts pending
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Enable insert access for pending notice drafts" ON public.notices;
DROP POLICY IF EXISTS "notices_insert" ON public.notices;

-- A student may submit a draft only under their own email and only as 'pending'.
-- Admins may insert anything (including directly published notices).
CREATE POLICY "notices_insert"
    ON public.notices FOR INSERT TO authenticated
    WITH CHECK (
        (status = 'pending' AND created_by_email = auth.jwt() ->> 'email')
        OR public.is_sscbs_admin()
    );


-- --------------------------------------------------------------------
-- 5. analytics_events — admin-only reads, non-forgeable writes
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Enable insert access for authenticated users on analytics_events" ON public.analytics_events;
DROP POLICY IF EXISTS "Enable read access for authenticated users on analytics_events"   ON public.analytics_events;
DROP POLICY IF EXISTS "analytics_insert" ON public.analytics_events;
DROP POLICY IF EXISTS "analytics_select" ON public.analytics_events;

-- You may only log events attributed to yourself (was: WITH CHECK (true)).
CREATE POLICY "analytics_insert"
    ON public.analytics_events FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Only the Admin Console reads this table (was: readable by every student).
CREATE POLICY "analytics_select"
    ON public.analytics_events FOR SELECT TO authenticated
    USING (public.is_sscbs_admin());


-- --------------------------------------------------------------------
-- 6. active_presence — stop user enumeration
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Enable read access for authenticated users on active_presence"          ON public.active_presence;
DROP POLICY IF EXISTS "Enable insert/update access for authenticated users on active_presence" ON public.active_presence;
DROP POLICY IF EXISTS "presence_select" ON public.active_presence;
DROP POLICY IF EXISTS "presence_write"  ON public.active_presence;

-- Was USING (true): any student could list every user's email and online status.
CREATE POLICY "presence_select"
    ON public.active_presence FOR SELECT TO authenticated
    USING (
        auth.jwt() ->> 'email' = email
        OR public.is_sscbs_admin()
    );

CREATE POLICY "presence_write"
    ON public.active_presence FOR ALL TO authenticated
    USING (auth.jwt() ->> 'email' = email OR user_id = auth.uid()::text)
    WITH CHECK (auth.jwt() ->> 'email' = email OR user_id = auth.uid()::text);


-- --------------------------------------------------------------------
-- 7. notice_drafter_requests — own request or admin
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Enable read access for notice drafter requests"          ON public.notice_drafter_requests;
DROP POLICY IF EXISTS "Enable insert access for notice drafter requests"        ON public.notice_drafter_requests;
DROP POLICY IF EXISTS "Enable update/delete access for notice drafter requests" ON public.notice_drafter_requests;
DROP POLICY IF EXISTS "drafter_select" ON public.notice_drafter_requests;
DROP POLICY IF EXISTS "drafter_insert" ON public.notice_drafter_requests;
DROP POLICY IF EXISTS "drafter_write"  ON public.notice_drafter_requests;

-- The app queries this filtered by user_email, so match on either identifier.
CREATE POLICY "drafter_select"
    ON public.notice_drafter_requests FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
        OR user_email = auth.jwt() ->> 'email'
        OR public.is_sscbs_admin()
    );

CREATE POLICY "drafter_insert"
    ON public.notice_drafter_requests FOR INSERT TO authenticated
    WITH CHECK (
        (user_id = auth.uid() AND user_email = auth.jwt() ->> 'email')
        OR public.is_sscbs_admin()
    );

-- Only an admin may flip a request to 'approved'.
CREATE POLICY "drafter_write"
    ON public.notice_drafter_requests FOR UPDATE TO authenticated
    USING (
        user_id = auth.uid()
        OR user_email = auth.jwt() ->> 'email'
        OR public.is_sscbs_admin()
    )
    WITH CHECK (
        (user_email = auth.jwt() ->> 'email' AND status = 'pending')
        OR public.is_sscbs_admin()
    );


-- --------------------------------------------------------------------
-- 8. Harden the analytics RPC
-- --------------------------------------------------------------------
-- Was: SECURITY DEFINER (bypasses RLS), granted to anon, no search_path.
-- That let ANY visitor read aggregated analytics regardless of the policies above.
REVOKE EXECUTE ON FUNCTION public.get_analytics_summary(TIMESTAMP WITH TIME ZONE) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_analytics_summary(TIMESTAMP WITH TIME ZONE) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.get_analytics_summary(start_date TIMESTAMP WITH TIME ZONE)
RETURNS TABLE (date_str TEXT, feature_id TEXT, visit_count BIGINT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_sscbs_admin() THEN
        RAISE EXCEPTION 'Access denied: admin only.';
    END IF;

    RETURN QUERY
    SELECT
        to_char(a.created_at, 'YYYY-MM-DD') AS date_str,
        a.feature_id,
        COUNT(*) AS visit_count
    FROM public.analytics_events a
    WHERE a.created_at >= start_date AND a.feature_id != 'admin'
    GROUP BY 1, 2;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_analytics_summary(TIMESTAMP WITH TIME ZONE) TO authenticated;


-- ====================================================================
-- VERIFICATION — run these after the migration
-- ====================================================================

-- A. No table should still be wide open. Expect ZERO rows here.
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
      'squad_applications', 'analytics_events',
      'active_presence', 'notice_drafter_requests'
  )
  AND cmd = 'SELECT'
  AND qual = 'true';

-- B. Every policy now in force, for review.
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;

-- C. RLS must be enabled on every table.  rowsecurity should be true for all.
SELECT relname AS table_name, relrowsecurity AS rls_enabled
FROM pg_class
WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
ORDER BY relname;

-- D. anon must have no EXECUTE on the analytics RPC. Expect ZERO rows.
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_name = 'get_analytics_summary' AND grantee = 'anon';
