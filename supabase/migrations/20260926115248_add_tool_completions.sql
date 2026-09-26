-- Minimal completion coordinates. Typed notes, reflection answers and goal content
-- stay in their existing private domains and are never copied into this ledger.
CREATE TABLE public.tool_completions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES public.anonymous_sessions(session_id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('grounding', 'meditation', 'yoga', 'game', 'journal', 'reflection', 'focus')),
  item_id TEXT NOT NULL CHECK (char_length(item_id) BETWEEN 1 AND 180),
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  partial BOOLEAN NOT NULL DEFAULT FALSE,
  source_step_id TEXT CHECK (source_step_id IS NULL OR char_length(source_step_id) BETWEEN 1 AND 256),
  CONSTRAINT tool_completions_exactly_one_owner CHECK ((user_id IS NULL) <> (session_id IS NULL)),
  CONSTRAINT tool_completions_time_order CHECK (
    isfinite(started_at) AND isfinite(completed_at) AND completed_at >= started_at
  )
);

COMMENT ON TABLE public.tool_completions IS
  'Owner-only append-only completion metadata; no journal text, answers or other typed wellbeing content.';
COMMENT ON COLUMN public.tool_completions.id IS
  'Client-generated UUID retained across retries. Use ON CONFLICT (id) DO NOTHING; never overwrite a completion.';

CREATE INDEX tool_completions_user_completed_idx
  ON public.tool_completions (user_id, completed_at DESC, id) WHERE user_id IS NOT NULL;
CREATE INDEX tool_completions_session_completed_idx
  ON public.tool_completions (session_id, completed_at DESC, id) WHERE session_id IS NOT NULL;

ALTER TABLE public.tool_completions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tool_completions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, DELETE ON TABLE public.tool_completions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tool_completions TO service_role;

-- Supabase anonymous Auth users also have the authenticated database role and
-- own rows through auth.uid(). A bare legacy session identifier is not proof of
-- ownership. Legacy rows are accessible only through existing verified backend
-- lifecycle paths; direct anon table access remains retired.
CREATE POLICY "Owners can read tool completions"
  ON public.tool_completions FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id AND session_id IS NULL);
CREATE POLICY "Owners can append tool completions"
  ON public.tool_completions FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id AND session_id IS NULL);
CREATE POLICY "Owners can delete tool completions"
  ON public.tool_completions FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id AND session_id IS NULL);

-- merge_anonymous_user_data already discovers all public user_id tables. It
-- therefore transfers this ledger transactionally without a new merge path.

-- Preserve existing deletion coverage and add the completion domain.
CREATE OR REPLACE FUNCTION public.delete_owned_data(
  p_user_id UUID,
  p_session_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_migrated_session_ids TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF (p_user_id IS NULL) = (p_session_id IS NULL) THEN
    RAISE EXCEPTION 'Exactly one owner identifier is required';
  END IF;

  IF p_user_id IS NOT NULL THEN
    SELECT COALESCE(array_agg(session_id), ARRAY[]::TEXT[])
      INTO v_migrated_session_ids
      FROM public.user_data_migration
      WHERE user_id = p_user_id;

    -- Keep the surviving person's relationship history while removing every
    -- membership and private contribution that belongs to the deleted user.
    DELETE FROM public.accountability_connections
      WHERE owner_id = p_user_id AND status = 'invited';
    UPDATE public.accountability_connections
      SET status = 'revoked',
          ended_at = COALESCE(ended_at, NOW()),
          ended_by = p_user_id,
          invite_token_hash = NULL
      WHERE owner_id = p_user_id OR partner_id = p_user_id;
    DELETE FROM public.accountability_memberships
      WHERE connection_id IN (
        SELECT id
        FROM public.accountability_connections
        WHERE owner_id = p_user_id OR partner_id = p_user_id
      );
    DELETE FROM public.accountability_comments WHERE author_id = p_user_id;
    DELETE FROM public.accountability_nudges
      WHERE sender_id = p_user_id OR recipient_id = p_user_id;
    DELETE FROM public.accountability_priority_suggestions
      WHERE suggested_by = p_user_id;
    DELETE FROM public.accountability_commitments WHERE owner_id = p_user_id;
    DELETE FROM public.accountability_scope_controls WHERE owner_id = p_user_id;
    DELETE FROM public.accountability_blocks
      WHERE blocker_id = p_user_id OR blocked_id = p_user_id;
    UPDATE public.accountability_connections
      SET owner_id = CASE WHEN owner_id = p_user_id THEN NULL ELSE owner_id END,
          partner_id = CASE WHEN partner_id = p_user_id THEN NULL ELSE partner_id END,
          ended_by = CASE WHEN ended_by = p_user_id THEN NULL ELSE ended_by END
      WHERE owner_id = p_user_id OR partner_id = p_user_id OR ended_by = p_user_id;

    DELETE FROM public.operational_events WHERE user_id = p_user_id;
    DELETE FROM public.practice_progress WHERE user_id = p_user_id;
    DELETE FROM public.tool_completions WHERE user_id = p_user_id;
    DELETE FROM public.privacy_events WHERE user_id = p_user_id;
    DELETE FROM public.partner_support_preferences WHERE user_id = p_user_id;
    DELETE FROM public.sleep_diary_entries WHERE user_id = p_user_id;
    DELETE FROM public.safety_plan_items WHERE user_id = p_user_id;
    DELETE FROM public.safety_plans WHERE user_id = p_user_id;
    DELETE FROM public.staying_well_plan_items WHERE user_id = p_user_id;
    DELETE FROM public.staying_well_plans WHERE user_id = p_user_id;
    DELETE FROM public.activity_plan_steps WHERE user_id = p_user_id;
    DELETE FROM public.activity_plans WHERE user_id = p_user_id;
    DELETE FROM public.partner_celebrations
      WHERE owner_id = p_user_id OR partner_id = p_user_id;
    DELETE FROM public.partner_links
      WHERE owner_id = p_user_id OR partner_id = p_user_id;
    DELETE FROM public.partner_invites WHERE owner_id = p_user_id;
    DELETE FROM public.reminder_deliveries WHERE user_id = p_user_id;
    DELETE FROM public.wellbeing_reminders WHERE user_id = p_user_id;
    DELETE FROM public.push_subscriptions WHERE user_id = p_user_id;
    DELETE FROM public.dismissed_notices WHERE user_id = p_user_id;
    DELETE FROM public.focus_sessions WHERE user_id = p_user_id;
    DELETE FROM public.life_plan_items WHERE user_id = p_user_id;
    DELETE FROM public.acquisition_attribution WHERE user_id = p_user_id;
    DELETE FROM public.ai_response_reports WHERE user_id = p_user_id;
    DELETE FROM public.user_library_items WHERE user_id = p_user_id;
    DELETE FROM public.journal_entries WHERE user_id = p_user_id;
    DELETE FROM public.user_affirmation_history WHERE user_id = p_user_id;
    DELETE FROM public.user_book_favorites WHERE user_id = p_user_id;
    DELETE FROM public.chat_history WHERE user_id = p_user_id;
    DELETE FROM public.habits WHERE user_id = p_user_id;
    DELETE FROM public.goal_attachments WHERE user_id = p_user_id;
    DELETE FROM public.goal_milestones WHERE user_id = p_user_id;
    DELETE FROM public.goals WHERE user_id = p_user_id;
    DELETE FROM public.assessments WHERE user_id = p_user_id;
    DELETE FROM public.moods WHERE user_id = p_user_id;
    DELETE FROM public.user_data_migration WHERE user_id = p_user_id;
    DELETE FROM public.anonymous_sessions AS session
      WHERE session.session_id = ANY(v_migrated_session_ids)
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_data_migration AS migration
        WHERE migration.session_id = session.session_id
      );
  ELSE
    DELETE FROM public.tool_completions WHERE session_id = p_session_id;
    DELETE FROM public.user_affirmation_history WHERE session_id = p_session_id;
    DELETE FROM public.user_book_favorites WHERE session_id = p_session_id;
    DELETE FROM public.chat_history WHERE session_id = p_session_id;
    DELETE FROM public.habits WHERE session_id = p_session_id;
    DELETE FROM public.goals WHERE session_id = p_session_id;
    DELETE FROM public.assessments WHERE session_id = p_session_id;
    DELETE FROM public.moods WHERE session_id = p_session_id;
    DELETE FROM public.user_data_migration WHERE session_id = p_session_id;
    DELETE FROM public.anonymous_sessions WHERE session_id = p_session_id;
  END IF;

  RETURN jsonb_build_object('deleted', true);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_owned_data(UUID, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_owned_data(UUID, TEXT)
  TO service_role;

-- Preserve legacy history before deleting its session registry entry.
CREATE OR REPLACE FUNCTION public.migrate_legacy_anonymous_data(
  p_legacy_session_id text,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
  v_total integer := 0;
BEGIN
  IF p_legacy_session_id IS NULL OR length(p_legacy_session_id) > 128 THEN
    RAISE EXCEPTION 'Invalid legacy session ID';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Target auth user does not exist';
  END IF;

  -- Serialize claims and prevent a concurrent legacy write from racing deletion.
  PERFORM 1
  FROM public.anonymous_sessions
  WHERE session_id = p_legacy_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('migrated', false, 'reason', 'not_found');
  END IF;

  UPDATE public.tool_completions
  SET user_id = p_user_id, session_id = NULL
  WHERE session_id = p_legacy_session_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;

  UPDATE public.moods
  SET user_id = p_user_id, session_id = NULL
  WHERE session_id = p_legacy_session_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;

  UPDATE public.assessments
  SET user_id = p_user_id, session_id = NULL
  WHERE session_id = p_legacy_session_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;

  UPDATE public.goals
  SET user_id = p_user_id, session_id = NULL
  WHERE session_id = p_legacy_session_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;

  UPDATE public.habits
  SET user_id = p_user_id, session_id = NULL
  WHERE session_id = p_legacy_session_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;

  UPDATE public.chat_history
  SET user_id = p_user_id, session_id = NULL
  WHERE session_id = p_legacy_session_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;

  UPDATE public.user_affirmation_history
  SET user_id = p_user_id, session_id = NULL
  WHERE session_id = p_legacy_session_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;

  -- Avoid violating the per-user/book uniqueness constraint when both identities
  -- already favorited the same book.
  DELETE FROM public.user_book_favorites AS legacy
  WHERE legacy.session_id = p_legacy_session_id
    AND EXISTS (
      SELECT 1
      FROM public.user_book_favorites AS current_favorite
      WHERE current_favorite.user_id = p_user_id
        AND current_favorite.book_id = legacy.book_id
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;

  UPDATE public.user_book_favorites
  SET user_id = p_user_id, session_id = NULL
  WHERE session_id = p_legacy_session_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;

  IF EXISTS (SELECT 1 FROM public.tool_completions WHERE session_id = p_legacy_session_id)
    OR EXISTS (SELECT 1 FROM public.moods WHERE session_id = p_legacy_session_id)
    OR EXISTS (SELECT 1 FROM public.assessments WHERE session_id = p_legacy_session_id)
    OR EXISTS (SELECT 1 FROM public.goals WHERE session_id = p_legacy_session_id)
    OR EXISTS (SELECT 1 FROM public.habits WHERE session_id = p_legacy_session_id)
    OR EXISTS (SELECT 1 FROM public.chat_history WHERE session_id = p_legacy_session_id)
    OR EXISTS (SELECT 1 FROM public.user_affirmation_history WHERE session_id = p_legacy_session_id)
    OR EXISTS (SELECT 1 FROM public.user_book_favorites WHERE session_id = p_legacy_session_id)
  THEN
    RAISE EXCEPTION 'Legacy data migration verification failed';
  END IF;

  DELETE FROM public.anonymous_sessions
  WHERE session_id = p_legacy_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Legacy session deletion verification failed';
  END IF;

  RETURN jsonb_build_object('migrated', true, 'rowsMigrated', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.migrate_legacy_anonymous_data(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.migrate_legacy_anonymous_data(text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.migrate_legacy_anonymous_data(text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.migrate_legacy_anonymous_data(text, uuid) TO service_role;


-- A completion is user data, so it protects otherwise empty anonymous owners.
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
    AND NOT EXISTS (SELECT 1 FROM public.tool_completions t WHERE t.user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.practice_progress        t WHERE t.user_id  = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.moods                    t WHERE t.user_id  = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.assessments              t WHERE t.user_id  = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.goals                    t WHERE t.user_id  = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.habits                   t WHERE t.user_id  = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.journal_entries          t WHERE t.user_id  = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.chat_history             t WHERE t.user_id  = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.user_affirmation_history t WHERE t.user_id  = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.user_book_favorites      t WHERE t.user_id  = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.user_library_items       t WHERE t.user_id  = u.id)
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

REVOKE ALL ON FUNCTION public.reap_stale_anonymous_users(INTEGER, BOOLEAN)
  FROM PUBLIC, anon, authenticated;

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
  v_eligible INTEGER := 0;
BEGIN
  IF p_older_than_days < 1 THEN
    RAISE EXCEPTION 'Refusing to reap sessions younger than one day';
  END IF;
  IF NOT p_dry_run THEN
    RAISE EXCEPTION 'Anonymous session purging is disabled for this project';
  END IF;

  v_cutoff := NOW() - make_interval(days => p_older_than_days);

  SELECT COUNT(*)::INTEGER
    INTO v_eligible
    FROM public.anonymous_sessions s
   WHERE s.last_active_at < v_cutoff
     AND NOT EXISTS (SELECT 1 FROM public.tool_completions t WHERE t.session_id = s.session_id)
     AND NOT EXISTS (SELECT 1 FROM public.moods                    t WHERE t.session_id = s.session_id)
     AND NOT EXISTS (SELECT 1 FROM public.assessments              t WHERE t.session_id = s.session_id)
     AND NOT EXISTS (SELECT 1 FROM public.goals                    t WHERE t.session_id = s.session_id)
     AND NOT EXISTS (SELECT 1 FROM public.habits                   t WHERE t.session_id = s.session_id)
     AND NOT EXISTS (SELECT 1 FROM public.chat_history             t WHERE t.session_id = s.session_id)
     AND NOT EXISTS (SELECT 1 FROM public.user_affirmation_history t WHERE t.session_id = s.session_id)
     AND NOT EXISTS (SELECT 1 FROM public.user_book_favorites      t WHERE t.session_id = s.session_id);

  RETURN jsonb_build_object(
    'dry_run', TRUE,
    'older_than_days', p_older_than_days,
    'cutoff', v_cutoff,
    'eligible', v_eligible,
    'deleted', 0,
    'sessions_total', (SELECT COUNT(*) FROM public.anonymous_sessions)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reap_stale_anonymous_sessions(INTEGER, BOOLEAN)
  FROM PUBLIC, anon, authenticated;
