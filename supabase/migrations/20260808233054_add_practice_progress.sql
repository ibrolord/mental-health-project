CREATE TABLE public.practice_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  practice_type TEXT NOT NULL,
  practice_id TEXT NOT NULL,
  route TEXT NOT NULL,
  step_index INTEGER NOT NULL,
  step_elapsed_seconds INTEGER NOT NULL,
  version BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, practice_type),
  CONSTRAINT practice_progress_allowlist CHECK (
    practice_type = 'meditation'
    AND route = '/meditate'
    AND practice_id IN (
      'gentle-breath-reset',
      'name-and-unhook',
      'eyes-open-orienting',
      'sleep-body-release',
      'grief-companion',
      'self-kindness-pause',
      'single-point-focus',
      'walking-anchor'
    )
  ),
  CONSTRAINT practice_progress_position CHECK (
    step_index BETWEEN 0 AND 4
    AND step_elapsed_seconds BETWEEN 0 AND 899
    AND (step_index > 0 OR step_elapsed_seconds > 0)
  ),
  CONSTRAINT practice_progress_version CHECK (version > 0)
);

COMMENT ON TABLE public.practice_progress IS
  'Owner-only paused practice coordinates. Running and completed timers are never stored.';

CREATE INDEX practice_progress_user_updated_idx
  ON public.practice_progress (user_id, updated_at DESC);

ALTER TABLE public.practice_progress ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.practice_progress
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.practice_progress TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.practice_progress TO service_role;

CREATE POLICY "Owners can read practice progress"
  ON public.practice_progress
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Owners can insert practice progress"
  ON public.practice_progress
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Owners can update practice progress"
  ON public.practice_progress
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Owners can delete practice progress"
  ON public.practice_progress
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.save_practice_progress(
  p_expected_user_id UUID,
  p_practice_type TEXT,
  p_practice_id TEXT,
  p_route TEXT,
  p_step_index INTEGER,
  p_step_elapsed_seconds INTEGER,
  p_expected_version BIGINT
)
RETURNS public.practice_progress
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := (SELECT auth.uid());
  v_progress public.practice_progress%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'practice_progress_auth_required';
  END IF;

  IF p_expected_user_id IS NULL OR p_expected_user_id <> v_user_id THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'practice_progress_owner_changed';
  END IF;

  IF p_expected_version < 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'practice_progress_invalid_version';
  END IF;

  IF p_expected_version = 0 THEN
    INSERT INTO public.practice_progress (
      user_id,
      practice_type,
      practice_id,
      route,
      step_index,
      step_elapsed_seconds,
      version
    )
    VALUES (
      v_user_id,
      p_practice_type,
      p_practice_id,
      p_route,
      p_step_index,
      p_step_elapsed_seconds,
      1
    )
    ON CONFLICT (user_id, practice_type) DO NOTHING
    RETURNING * INTO v_progress;
  ELSE
    UPDATE public.practice_progress
       SET practice_id = p_practice_id,
           route = p_route,
           step_index = p_step_index,
           step_elapsed_seconds = p_step_elapsed_seconds,
           version = version + 1,
           updated_at = statement_timestamp()
     WHERE user_id = v_user_id
       AND practice_type = p_practice_type
       AND version = p_expected_version
    RETURNING * INTO v_progress;
  END IF;

  IF v_progress.user_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'practice_progress_conflict';
  END IF;

  RETURN v_progress;
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_practice_progress(
  p_expected_user_id UUID,
  p_practice_type TEXT,
  p_practice_id TEXT,
  p_route TEXT,
  p_expected_version BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := (SELECT auth.uid());
  v_deleted INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'practice_progress_auth_required';
  END IF;

  IF p_expected_user_id IS NULL OR p_expected_user_id <> v_user_id THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'practice_progress_owner_changed';
  END IF;

  IF p_expected_version < 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'practice_progress_invalid_version';
  END IF;

  DELETE FROM public.practice_progress
   WHERE user_id = v_user_id
     AND practice_type = p_practice_type
     AND practice_id = p_practice_id
     AND route = p_route
     AND version = p_expected_version;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'practice_progress_conflict';
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.save_practice_progress(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.clear_practice_progress(UUID, TEXT, TEXT, TEXT, BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_practice_progress(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, BIGINT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_practice_progress(UUID, TEXT, TEXT, TEXT, BIGINT)
  TO authenticated;

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

    DELETE FROM public.practice_progress WHERE user_id = p_user_id;
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
