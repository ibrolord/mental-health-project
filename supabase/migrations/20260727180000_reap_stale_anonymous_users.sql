-- Reap stale anonymous accounts.
--
-- Every anonymous visitor creates a permanent row in auth.users. Supabase has
-- no automatic cleanup for these (unlike Firebase Auth, which deletes
-- anonymous accounts after 30 days), so they accumulate forever, inflate the
-- monthly-active-user count that the free tier is billed on, and make the
-- legacy anonymous_sessions registry grow without bound.
--
-- Measured 2026-07-27: 634 anonymous_sessions rows against 56 mood entries.
-- Roughly 90% of anonymous visitors produce nothing at all.
--
-- SAFETY: this deletes accounts, so it is deliberately conservative.
--   * Only rows where is_anonymous is true. Permanent accounts are never
--     touched, and the predicate is repeated in the DELETE rather than
--     trusting the selection step.
--   * Only accounts with NO row in ANY table referencing them, including
--     acquisition_attribution. An attribution row on its own is a real growth
--     signal ("visited, never activated"), so its presence protects the user
--     from deletion even though it is not user content.
--   * Dry run is the DEFAULT. Callers must pass FALSE explicitly to delete.
--
-- Run a dry run before scheduling anything:
--   SELECT public.reap_stale_anonymous_users(30, TRUE);

CREATE OR REPLACE FUNCTION public.reap_stale_anonymous_users(
  p_older_than_days INTEGER DEFAULT 30,
  p_dry_run BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cutoff TIMESTAMPTZ;
  v_candidates UUID[];
  v_deleted INTEGER := 0;
BEGIN
  IF p_older_than_days < 1 THEN
    RAISE EXCEPTION 'Refusing to reap accounts younger than one day';
  END IF;

  v_cutoff := NOW() - make_interval(days => p_older_than_days);

  SELECT COALESCE(array_agg(u.id), '{}')
  INTO v_candidates
  FROM auth.users u
  WHERE u.is_anonymous IS TRUE
    AND u.created_at < v_cutoff
    AND NOT EXISTS (SELECT 1 FROM public.moods                    t WHERE t.user_id  = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.assessments              t WHERE t.user_id  = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.goals                    t WHERE t.user_id  = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.habits                   t WHERE t.user_id  = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.journal_entries          t WHERE t.user_id  = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.chat_history             t WHERE t.user_id  = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.user_affirmation_history t WHERE t.user_id  = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.user_book_favorites      t WHERE t.user_id  = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.user_data_migration      t WHERE t.user_id  = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.acquisition_attribution  t WHERE t.user_id  = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.ai_response_reports      t WHERE t.user_id  = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.user_profiles            t WHERE t.id       = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.partner_invites          t WHERE t.owner_id = u.id)
    AND NOT EXISTS (
      SELECT 1 FROM public.partner_links t
       WHERE t.owner_id = u.id OR t.partner_id = u.id
    );

  IF NOT p_dry_run THEN
    DELETE FROM auth.users u
     WHERE u.id = ANY(v_candidates)
       AND u.is_anonymous IS TRUE;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'dry_run', p_dry_run,
    'older_than_days', p_older_than_days,
    'cutoff', v_cutoff,
    'eligible', COALESCE(array_length(v_candidates, 1), 0),
    'deleted', v_deleted,
    'anonymous_total', (SELECT COUNT(*) FROM auth.users WHERE is_anonymous IS TRUE)
  );
END;
$$;

-- The legacy pre-JWT registry. Rows here are keyed by session_id, not by a
-- user, and the modern client no longer writes to it. Same conservative rule:
-- only remove sessions that never produced anything.
CREATE OR REPLACE FUNCTION public.reap_stale_anonymous_sessions(
  p_older_than_days INTEGER DEFAULT 30,
  p_dry_run BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cutoff TIMESTAMPTZ;
  v_eligible INTEGER;
  v_deleted INTEGER := 0;
BEGIN
  IF p_older_than_days < 1 THEN
    RAISE EXCEPTION 'Refusing to reap sessions younger than one day';
  END IF;

  v_cutoff := NOW() - make_interval(days => p_older_than_days);

  CREATE TEMP TABLE _reap_sessions ON COMMIT DROP AS
  SELECT s.session_id
    FROM public.anonymous_sessions s
   WHERE s.last_active_at < v_cutoff
     AND NOT EXISTS (SELECT 1 FROM public.moods        t WHERE t.session_id = s.session_id)
     AND NOT EXISTS (SELECT 1 FROM public.assessments  t WHERE t.session_id = s.session_id)
     AND NOT EXISTS (SELECT 1 FROM public.goals        t WHERE t.session_id = s.session_id)
     AND NOT EXISTS (SELECT 1 FROM public.habits       t WHERE t.session_id = s.session_id)
     AND NOT EXISTS (SELECT 1 FROM public.chat_history t WHERE t.session_id = s.session_id);

  SELECT COUNT(*) INTO v_eligible FROM _reap_sessions;

  IF NOT p_dry_run THEN
    DELETE FROM public.anonymous_sessions s
     WHERE s.session_id IN (SELECT session_id FROM _reap_sessions);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'dry_run', p_dry_run,
    'older_than_days', p_older_than_days,
    'cutoff', v_cutoff,
    'eligible', v_eligible,
    'deleted', v_deleted,
    'sessions_total', (SELECT COUNT(*) FROM public.anonymous_sessions)
  );
END;
$$;

-- These touch auth.users and must never be callable from the client.
REVOKE ALL ON FUNCTION public.reap_stale_anonymous_users(INTEGER, BOOLEAN)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reap_stale_anonymous_sessions(INTEGER, BOOLEAN)
  FROM PUBLIC, anon, authenticated;

-- Scheduling is intentionally NOT done here. Run the dry runs first, confirm
-- the counts look right, then enable with:
--
--   SELECT cron.schedule('reap-anonymous-users', '23 3 * * *',
--     $$SELECT public.reap_stale_anonymous_users(30, FALSE)$$);
--   SELECT cron.schedule('reap-anonymous-sessions', '31 3 * * *',
--     $$SELECT public.reap_stale_anonymous_sessions(30, FALSE)$$);
--
-- (pg_cron is already installed on this project; see the
-- purge-expired-ai-response-reports job.)
