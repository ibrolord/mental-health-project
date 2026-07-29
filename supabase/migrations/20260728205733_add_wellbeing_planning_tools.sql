-- Coherent owner-scoped tools for habits, routines, focus, and life planning.
--
-- Anonymous Supabase users carry the `authenticated` database role and a real
-- auth.uid(), so every table below is owner-scoped by user_id. Legacy
-- session_id ownership remains only on the pre-existing habits table.

ALTER TABLE public.habits
  ADD COLUMN habit_type TEXT NOT NULL DEFAULT 'build',
  ADD COLUMN category TEXT NOT NULL DEFAULT 'wellbeing',
  ADD COLUMN icon TEXT NOT NULL DEFAULT 'sparkles',
  ADD COLUMN cue TEXT NOT NULL DEFAULT '',
  ADD COLUMN tiny_step TEXT NOT NULL DEFAULT '',
  ADD COLUMN routine_slot TEXT NOT NULL DEFAULT 'anytime',
  ADD COLUMN reward TEXT NOT NULL DEFAULT '',
  ADD COLUMN reward_target INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN best_streak INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN total_completions INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN dedupe_key TEXT;

ALTER TABLE public.habits
  ADD CONSTRAINT habits_type_check
    CHECK (habit_type IN ('build', 'reduce')),
  ADD CONSTRAINT habits_category_check
    CHECK (
      category IN (
        'wellbeing',
        'movement',
        'mindfulness',
        'nourishment',
        'sleep',
        'study',
        'home',
        'social',
        'substance',
        'custom'
      )
    ),
  ADD CONSTRAINT habits_routine_slot_check
    CHECK (routine_slot IN ('morning', 'afternoon', 'evening', 'anytime')),
  ADD CONSTRAINT habits_reward_target_check
    CHECK (reward_target BETWEEN 1 AND 365),
  ADD CONSTRAINT habits_extended_text_lengths_check
    CHECK (
      char_length(icon) BETWEEN 1 AND 40
      AND char_length(cue) <= 240
      AND char_length(tiny_step) <= 240
      AND char_length(reward) <= 240
      AND (dedupe_key IS NULL OR char_length(dedupe_key) BETWEEN 1 AND 180)
    );

-- Existing duplicates are intentionally preserved. Only new writes that carry
-- a dedupe key are protected, so this migration never deletes user data.
CREATE UNIQUE INDEX habits_user_active_dedupe_unique
  ON public.habits (user_id, dedupe_key)
  WHERE user_id IS NOT NULL
    AND dedupe_key IS NOT NULL
    AND is_active IS TRUE;

CREATE UNIQUE INDEX habits_legacy_session_active_dedupe_unique
  ON public.habits (session_id, dedupe_key)
  WHERE session_id IS NOT NULL
    AND dedupe_key IS NOT NULL
    AND is_active IS TRUE;

CREATE TABLE public.life_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  horizon TEXT NOT NULL,
  title TEXT NOT NULL,
  reflection TEXT NOT NULL DEFAULT '',
  next_step TEXT NOT NULL DEFAULT '',
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT life_plan_item_type_check
    CHECK (item_type IN ('dream', 'motivation', 'fear', 'milestone')),
  CONSTRAINT life_plan_horizon_check
    CHECK (horizon IN ('30_days', '90_days', '1_year', '3_years', 'someday')),
  CONSTRAINT life_plan_status_check
    CHECK (status IN ('active', 'complete', 'paused')),
  CONSTRAINT life_plan_text_lengths_check
    CHECK (
      char_length(btrim(title)) BETWEEN 1 AND 160
      AND char_length(reflection) <= 2000
      AND char_length(next_step) <= 500
    )
);

CREATE INDEX life_plan_items_user_status_idx
  ON public.life_plan_items (user_id, status, updated_at DESC);
CREATE UNIQUE INDEX life_plan_items_user_active_identity_unique
  ON public.life_plan_items (
    user_id,
    item_type,
    horizon,
    lower(regexp_replace(btrim(title), '\s+', ' ', 'g'))
  )
  WHERE status = 'active';

CREATE TABLE public.focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  task_label TEXT NOT NULL,
  focus_minutes INTEGER NOT NULL DEFAULT 25,
  break_minutes INTEGER NOT NULL DEFAULT 5,
  planned_cycles INTEGER NOT NULL DEFAULT 1,
  completed_cycles INTEGER NOT NULL DEFAULT 0,
  sound_mode TEXT NOT NULL DEFAULT 'none',
  status TEXT NOT NULL DEFAULT 'planned',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT focus_task_length_check
    CHECK (char_length(btrim(task_label)) BETWEEN 1 AND 200),
  CONSTRAINT focus_minutes_check
    CHECK (focus_minutes BETWEEN 5 AND 120),
  CONSTRAINT focus_break_minutes_check
    CHECK (break_minutes BETWEEN 1 AND 30),
  CONSTRAINT focus_cycles_check
    CHECK (
      planned_cycles BETWEEN 1 AND 12
      AND completed_cycles BETWEEN 0 AND planned_cycles
    ),
  CONSTRAINT focus_sound_mode_check
    CHECK (sound_mode IN ('none', 'rain', 'ocean', 'brown_noise')),
  CONSTRAINT focus_status_check
    CHECK (status IN ('planned', 'running', 'paused', 'complete', 'abandoned'))
);

CREATE INDEX focus_sessions_user_created_idx
  ON public.focus_sessions (user_id, created_at DESC);

CREATE TABLE public.wellbeing_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id UUID REFERENCES public.habits(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  route TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  timezone TEXT NOT NULL,
  days_of_week SMALLINT[] NOT NULL DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6]::SMALLINT[],
  local_time TIME,
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT wellbeing_reminder_kind_check
    CHECK (kind IN ('habit', 'routine', 'focus', 'planner')),
  CONSTRAINT wellbeing_reminder_label_length_check
    CHECK (char_length(btrim(label)) BETWEEN 1 AND 160),
  CONSTRAINT wellbeing_reminder_route_check
    CHECK (route ~ '^/[a-z0-9/_-]*$' AND char_length(route) <= 200),
  CONSTRAINT wellbeing_reminder_timezone_length_check
    CHECK (char_length(timezone) BETWEEN 1 AND 80),
  CONSTRAINT wellbeing_reminder_days_check
    CHECK (days_of_week <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::SMALLINT[]),
  CONSTRAINT wellbeing_reminder_schedule_shape_check
    CHECK (
      (local_time IS NOT NULL AND scheduled_at IS NULL)
      OR (local_time IS NULL AND scheduled_at IS NOT NULL)
    )
);

CREATE INDEX wellbeing_reminders_enabled_idx
  ON public.wellbeing_reminders (enabled, scheduled_at, local_time)
  WHERE enabled IS TRUE;
CREATE INDEX wellbeing_reminders_user_idx
  ON public.wellbeing_reminders (user_id, updated_at DESC);
CREATE UNIQUE INDEX wellbeing_reminders_user_habit_unique
  ON public.wellbeing_reminders (user_id, habit_id)
  WHERE habit_id IS NOT NULL;
CREATE UNIQUE INDEX wellbeing_reminders_user_kind_route_unique
  ON public.wellbeing_reminders (user_id, kind, route)
  WHERE habit_id IS NULL;

CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_agent TEXT NOT NULL DEFAULT '',
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT push_subscription_endpoint_unique UNIQUE (endpoint),
  CONSTRAINT push_subscription_lengths_check
    CHECK (
      char_length(endpoint) BETWEEN 20 AND 4000
      AND char_length(p256dh) BETWEEN 20 AND 500
      AND char_length(auth_key) BETWEEN 8 AND 500
      AND char_length(user_agent) <= 500
      AND failed_count BETWEEN 0 AND 20
    )
);

CREATE INDEX push_subscriptions_user_idx
  ON public.push_subscriptions (user_id, updated_at DESC);

CREATE TABLE public.reminder_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id UUID NOT NULL REFERENCES public.wellbeing_reminders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delivery_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'claimed',
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  CONSTRAINT reminder_delivery_unique UNIQUE (reminder_id, delivery_key),
  CONSTRAINT reminder_delivery_status_check
    CHECK (status IN ('claimed', 'delivered', 'failed', 'no_subscription')),
  CONSTRAINT reminder_delivery_key_length_check
    CHECK (char_length(delivery_key) BETWEEN 1 AND 80)
);

CREATE INDEX reminder_deliveries_user_created_idx
  ON public.reminder_deliveries (user_id, created_at DESC);

CREATE TABLE public.dismissed_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notice_key TEXT NOT NULL,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT dismissed_notice_user_key_unique UNIQUE (user_id, notice_key),
  CONSTRAINT dismissed_notice_key_length_check
    CHECK (char_length(notice_key) BETWEEN 1 AND 120)
);

CREATE INDEX dismissed_notices_user_idx
  ON public.dismissed_notices (user_id, dismissed_at DESC);

ALTER TABLE public.life_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellbeing_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dismissed_notices ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.life_plan_items,
  public.focus_sessions,
  public.wellbeing_reminders,
  public.push_subscriptions,
  public.reminder_deliveries,
  public.dismissed_notices
FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.life_plan_items,
  public.focus_sessions,
  public.wellbeing_reminders,
  public.push_subscriptions,
  public.dismissed_notices
TO authenticated;

GRANT SELECT ON TABLE public.reminder_deliveries TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.life_plan_items,
  public.focus_sessions,
  public.wellbeing_reminders,
  public.push_subscriptions,
  public.reminder_deliveries,
  public.dismissed_notices
TO service_role;

CREATE POLICY "Users own life plan items"
  ON public.life_plan_items
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users own focus sessions"
  ON public.focus_sessions
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users own wellbeing reminders"
  ON public.wellbeing_reminders
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users own push subscriptions"
  ON public.push_subscriptions
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can read their reminder deliveries"
  ON public.reminder_deliveries
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users own dismissed notices"
  ON public.dismissed_notices
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Recalculate all habit progress from the unique daily log source of truth.
-- This replaces the old insert/update-only trigger, which could leave stale
-- counts after deletions and never maintained a best or total count.
CREATE OR REPLACE FUNCTION public.refresh_habit_progress(p_habit_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_total INTEGER := 0;
  v_best INTEGER := 0;
  v_current INTEGER := 0;
BEGIN
  WITH completed_days AS (
    SELECT DISTINCT log_date
      FROM public.habit_logs
     WHERE habit_id = p_habit_id
       AND completed IS TRUE
  ),
  numbered AS (
    SELECT
      log_date,
      log_date - (ROW_NUMBER() OVER (ORDER BY log_date))::INTEGER AS island
    FROM completed_days
  ),
  runs AS (
    SELECT
      COUNT(*)::INTEGER AS run_length,
      MAX(log_date) AS end_date
    FROM numbered
    GROUP BY island
  )
  SELECT
    (SELECT COUNT(*)::INTEGER FROM completed_days),
    COALESCE(MAX(run_length), 0)::INTEGER,
    COALESCE(
      MAX(run_length) FILTER (WHERE end_date >= CURRENT_DATE - 1),
      0
    )::INTEGER
  INTO v_total, v_best, v_current
  FROM runs;

  UPDATE public.habits
     SET total_completions = COALESCE(v_total, 0),
         best_streak = COALESCE(v_best, 0),
         streak_count = COALESCE(v_current, 0),
         updated_at = NOW()
   WHERE id = p_habit_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_habit_streak()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_habit_progress(OLD.habit_id);
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.habit_id IS DISTINCT FROM OLD.habit_id THEN
    PERFORM public.refresh_habit_progress(OLD.habit_id);
  END IF;
  PERFORM public.refresh_habit_progress(NEW.habit_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS habit_streak_trigger ON public.habit_logs;
CREATE TRIGGER habit_streak_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.habit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_habit_streak();

DO $$
DECLARE
  v_habit RECORD;
BEGIN
  FOR v_habit IN SELECT id FROM public.habits LOOP
    PERFORM public.refresh_habit_progress(v_habit.id);
  END LOOP;
END;
$$;

-- Account/data deletion remains transactional and now covers every new table.
CREATE OR REPLACE FUNCTION public.delete_owned_data(
  p_user_id UUID,
  p_session_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (p_user_id IS NULL) = (p_session_id IS NULL) THEN
    RAISE EXCEPTION 'Exactly one owner identifier is required';
  END IF;

  IF p_user_id IS NOT NULL THEN
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
  ELSE
    DELETE FROM public.user_affirmation_history WHERE session_id = p_session_id;
    DELETE FROM public.user_book_favorites WHERE session_id = p_session_id;
    DELETE FROM public.chat_history WHERE session_id = p_session_id;
    DELETE FROM public.habits WHERE session_id = p_session_id;
    DELETE FROM public.goals WHERE session_id = p_session_id;
    DELETE FROM public.assessments WHERE session_id = p_session_id;
    DELETE FROM public.moods WHERE session_id = p_session_id;
  END IF;

  RETURN jsonb_build_object('deleted', true);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_owned_data(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_owned_data(UUID, TEXT)
  TO service_role;

-- The project intentionally does not schedule anonymous-user cleanup. Keep
-- this dry-run-only operator function aware of all new owner tables so even a
-- manual invocation can never classify a profile with saved data as empty.
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
  IF NOT p_dry_run THEN
    RAISE EXCEPTION 'Anonymous account purging is disabled for this project';
  END IF;

  v_cutoff := NOW() - make_interval(days => p_older_than_days);

  SELECT COALESCE(array_agg(u.id), '{}')
  INTO v_candidates
  FROM auth.users u
  WHERE u.is_anonymous IS TRUE
    AND u.created_at < v_cutoff
    AND NOT EXISTS (SELECT 1 FROM public.moods                    t WHERE t.user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.assessments              t WHERE t.user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.goals                    t WHERE t.user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.habits                   t WHERE t.user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.life_plan_items          t WHERE t.user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.focus_sessions           t WHERE t.user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.wellbeing_reminders      t WHERE t.user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.push_subscriptions       t WHERE t.user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.dismissed_notices        t WHERE t.user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.journal_entries          t WHERE t.user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.chat_history             t WHERE t.user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.user_affirmation_history t WHERE t.user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.user_book_favorites      t WHERE t.user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.user_library_items       t WHERE t.user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.user_data_migration      t WHERE t.user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.acquisition_attribution  t WHERE t.user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.ai_response_reports      t WHERE t.user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.user_profiles            t WHERE t.id = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.partner_invites          t WHERE t.owner_id = u.id)
    AND NOT EXISTS (
      SELECT 1 FROM public.partner_links t
       WHERE t.owner_id = u.id OR t.partner_id = u.id
    );

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

-- Legacy pre-Auth sessions follow the same no-purge policy. The function
-- remains useful for operator visibility, but an apply request fails closed.
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
