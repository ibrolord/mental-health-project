-- Add scheduled habit accountability and opt-in aggregate progress scopes.
-- Partners still receive numeric summaries only, never authored content.

ALTER TABLE public.habits
  ADD COLUMN accountability_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN accountability_days SMALLINT[] NOT NULL
    DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6]::SMALLINT[],
  ADD COLUMN accountability_timezone TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN accountability_share_streak BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.habits
  ADD CONSTRAINT habits_accountability_days_check
    CHECK (
      cardinality(accountability_days) BETWEEN 1 AND 7
      AND accountability_days <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::SMALLINT[]
    ),
  ADD CONSTRAINT habits_accountability_timezone_check
    CHECK (char_length(accountability_timezone) BETWEEN 1 AND 80);

CREATE OR REPLACE FUNCTION public.validate_habit_accountability()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.accountability_timezone := btrim(NEW.accountability_timezone);
  NEW.accountability_days := ARRAY(
    SELECT DISTINCT day
      FROM unnest(NEW.accountability_days) AS day
     ORDER BY day
  );

  IF NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_timezone_names
     WHERE name = NEW.accountability_timezone
  ) THEN
    RAISE EXCEPTION 'accountability timezone is invalid';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_habit_accountability_trigger
  BEFORE INSERT OR UPDATE OF accountability_days, accountability_timezone
  ON public.habits
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_habit_accountability();

ALTER TABLE public.partner_invites
  ADD COLUMN share_journal_activity BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN share_assessment_activity BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN share_planner_progress BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN share_focus_progress BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN share_library_activity BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.partner_links
  ADD COLUMN share_journal_activity BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN share_assessment_activity BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN share_planner_progress BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN share_focus_progress BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN share_library_activity BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.partner_links_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'revoked' AND NEW.status <> 'revoked' THEN
    RAISE EXCEPTION 'a revoked partnership cannot be reactivated';
  END IF;

  IF auth.uid() = OLD.partner_id AND auth.uid() <> OLD.owner_id THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.share_goals IS DISTINCT FROM OLD.share_goals
      OR NEW.share_habits IS DISTINCT FROM OLD.share_habits
      OR NEW.share_checkins IS DISTINCT FROM OLD.share_checkins
      OR NEW.share_mood_trend IS DISTINCT FROM OLD.share_mood_trend
      OR NEW.share_streaks IS DISTINCT FROM OLD.share_streaks
      OR NEW.allow_celebrations IS DISTINCT FROM OLD.allow_celebrations
      OR NEW.share_journal_activity IS DISTINCT FROM OLD.share_journal_activity
      OR NEW.share_assessment_activity IS DISTINCT FROM OLD.share_assessment_activity
      OR NEW.share_planner_progress IS DISTINCT FROM OLD.share_planner_progress
      OR NEW.share_focus_progress IS DISTINCT FROM OLD.share_focus_progress
      OR NEW.share_library_activity IS DISTINCT FROM OLD.share_library_activity
      OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
      OR NEW.partner_id IS DISTINCT FROM OLD.partner_id
      OR NEW.partner_label IS DISTINCT FROM OLD.partner_label
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.revoked_at IS DISTINCT FROM OLD.revoked_at
    THEN
      RAISE EXCEPTION 'partners may only revoke, not modify sharing scopes';
    END IF;

    IF NEW.status <> 'revoked' THEN
      RAISE EXCEPTION 'partners may only set status to revoked';
    END IF;
  END IF;

  IF auth.uid() = OLD.owner_id THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
      OR NEW.partner_id IS DISTINCT FROM OLD.partner_id
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.revoked_at IS DISTINCT FROM OLD.revoked_at
    THEN
      RAISE EXCEPTION 'partnership identity and history are immutable';
    END IF;
  END IF;

  IF NEW.status = 'revoked' AND OLD.status <> 'revoked' THEN
    NEW.revoked_at := NOW();
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_partner_invite(p_token_hash TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invite public.partner_invites%ROWTYPE;
  v_link_id UUID;
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF COALESCE((auth.jwt() ->> 'is_anonymous')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'a permanent account is required';
  END IF;
  IF p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invite is invalid or has expired';
  END IF;

  SELECT * INTO v_invite
    FROM public.partner_invites
   WHERE token_hash = pg_catalog.encode(
           extensions.digest(p_token_hash, 'sha256'),
           'hex'
         )
     AND status = 'pending'
     AND expires_at > NOW()
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite is invalid or has expired';
  END IF;
  IF NOT private.accountability_participants_are_permanent(
    v_invite.owner_id,
    v_caller
  ) THEN
    RAISE EXCEPTION 'both accountability participants must be permanent accounts';
  END IF;
  IF v_invite.owner_id = v_caller THEN
    RAISE EXCEPTION 'you cannot accept your own invite';
  END IF;

  SELECT id INTO v_link_id
    FROM public.partner_links
   WHERE owner_id = v_invite.owner_id
     AND partner_id = v_caller
     AND status = 'active';

  IF v_link_id IS NULL THEN
    INSERT INTO public.partner_links (
      owner_id,
      partner_id,
      status,
      share_goals,
      share_habits,
      share_checkins,
      share_mood_trend,
      share_streaks,
      allow_celebrations,
      share_journal_activity,
      share_assessment_activity,
      share_planner_progress,
      share_focus_progress,
      share_library_activity
    )
    VALUES (
      v_invite.owner_id,
      v_caller,
      'active',
      v_invite.share_goals,
      v_invite.share_habits,
      v_invite.share_checkins,
      FALSE,
      v_invite.share_streaks,
      v_invite.allow_celebrations,
      v_invite.share_journal_activity,
      v_invite.share_assessment_activity,
      v_invite.share_planner_progress,
      v_invite.share_focus_progress,
      v_invite.share_library_activity
    )
    ON CONFLICT (owner_id, partner_id) WHERE status = 'active'
      DO NOTHING
    RETURNING id INTO v_link_id;

    IF v_link_id IS NULL THEN
      SELECT id INTO v_link_id
        FROM public.partner_links
       WHERE owner_id = v_invite.owner_id
         AND partner_id = v_caller
         AND status = 'active';
    END IF;
  END IF;

  UPDATE public.partner_invites
     SET status = 'accepted', accepted_at = NOW()
   WHERE id = v_invite.id;

  RETURN v_link_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.partner_snapshot(p_owner_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_link public.partner_links%ROWTYPE;
  v_since DATE := CURRENT_DATE - 6;
  v_result JSONB := '{}'::JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF COALESCE((auth.jwt() ->> 'is_anonymous')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'a permanent account is required';
  END IF;

  SELECT * INTO v_link
    FROM public.partner_links
   WHERE owner_id = p_owner_id
     AND partner_id = auth.uid()
     AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not an active partner for this account';
  END IF;
  IF NOT private.accountability_participants_are_permanent(
    v_link.owner_id,
    v_link.partner_id
  ) THEN
    RAISE EXCEPTION 'both accountability participants must be permanent accounts';
  END IF;

  v_result := jsonb_build_object(
    'window_days', 7,
    'scopes', jsonb_build_object(
      'goals', v_link.share_goals,
      'habits', v_link.share_habits,
      'checkins', v_link.share_checkins,
      'streaks', v_link.share_streaks,
      'celebrations', v_link.allow_celebrations,
      'journal', v_link.share_journal_activity,
      'assessments', v_link.share_assessment_activity,
      'planner', v_link.share_planner_progress,
      'focus', v_link.share_focus_progress,
      'library', v_link.share_library_activity
    )
  );

  IF v_link.share_goals THEN
    v_result := v_result || jsonb_build_object('goals', (
      SELECT jsonb_build_object(
        'completed', COUNT(*) FILTER (WHERE status = 'completed')
      )
      FROM public.goals
      WHERE user_id = p_owner_id
        AND date BETWEEN v_since AND CURRENT_DATE
    ));
  END IF;

  IF v_link.share_habits THEN
    v_result := v_result || jsonb_build_object('habits', (
      SELECT jsonb_build_object(
        'due_today',
          COUNT(*) FILTER (
            WHERE EXTRACT(
              DOW FROM CURRENT_TIMESTAMP AT TIME ZONE h.accountability_timezone
            )::INTEGER = ANY(h.accountability_days)
          ),
        'completed_today',
          COUNT(*) FILTER (
            WHERE EXTRACT(
              DOW FROM CURRENT_TIMESTAMP AT TIME ZONE h.accountability_timezone
            )::INTEGER = ANY(h.accountability_days)
              AND EXISTS (
                SELECT 1
                  FROM public.habit_logs hl
                 WHERE hl.habit_id = h.id
                   AND hl.completed
                   AND hl.log_date = (
                     CURRENT_TIMESTAMP AT TIME ZONE h.accountability_timezone
                   )::DATE
              )
          )
      )
      FROM public.habits h
      WHERE h.user_id = p_owner_id
        AND h.is_active
        AND h.accountability_enabled
    ));
  END IF;

  IF v_link.share_streaks THEN
    v_result := v_result || jsonb_build_object('streaks', (
      SELECT jsonb_build_object(
        'best_current', COALESCE(MAX(GREATEST(streak_count, 0)), 0)
      )
      FROM public.habits
      WHERE user_id = p_owner_id
        AND is_active
        AND accountability_enabled
        AND accountability_share_streak
    ));
  END IF;

  IF v_link.share_checkins THEN
    v_result := v_result || jsonb_build_object('checkins', (
      SELECT jsonb_build_object('days', COUNT(DISTINCT local_date))
      FROM public.moods
      WHERE user_id = p_owner_id
        AND local_date BETWEEN v_since AND CURRENT_DATE
    ));
  END IF;

  IF v_link.share_journal_activity THEN
    v_result := v_result || jsonb_build_object('journal', (
      SELECT jsonb_build_object('entries', COUNT(*))
      FROM public.journal_entries
      WHERE user_id = p_owner_id
        AND created_at >= v_since::TIMESTAMPTZ
    ));
  END IF;

  IF v_link.share_assessment_activity THEN
    v_result := v_result || jsonb_build_object('assessments', (
      SELECT jsonb_build_object('completed', COUNT(*))
      FROM public.assessments
      WHERE user_id = p_owner_id
        AND created_at >= v_since::TIMESTAMPTZ
    ));
  END IF;

  IF v_link.share_planner_progress THEN
    v_result := v_result || jsonb_build_object('planner', (
      SELECT jsonb_build_object('completed', COUNT(*))
      FROM public.life_plan_items
      WHERE user_id = p_owner_id
        AND status = 'complete'
        AND updated_at >= v_since::TIMESTAMPTZ
    ));
  END IF;

  IF v_link.share_focus_progress THEN
    v_result := v_result || jsonb_build_object('focus', (
      SELECT jsonb_build_object('sessions', COUNT(*))
      FROM public.focus_sessions
      WHERE user_id = p_owner_id
        AND status = 'complete'
        AND completed_at >= v_since::TIMESTAMPTZ
    ));
  END IF;

  IF v_link.share_library_activity THEN
    v_result := v_result || jsonb_build_object('library', (
      SELECT jsonb_build_object('items', COUNT(*))
      FROM public.user_library_items
      WHERE user_id = p_owner_id
        AND updated_at >= v_since::TIMESTAMPTZ
    ));
  END IF;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_partner_celebration(
  p_owner_id UUID,
  p_source TEXT,
  p_kind TEXT DEFAULT 'cheer',
  p_reward_key TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_link public.partner_links%ROWTYPE;
  v_milestone INTEGER := 0;
  v_period TEXT;
  v_dedupe_key TEXT;
  v_id UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF COALESCE((auth.jwt() ->> 'is_anonymous')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'a permanent account is required';
  END IF;
  IF p_source NOT IN ('habit_streak', 'goal_progress', 'general') THEN
    RAISE EXCEPTION 'unsupported celebration source';
  END IF;
  IF p_kind NOT IN ('cheer', 'reward') THEN
    RAISE EXCEPTION 'unsupported celebration kind';
  END IF;
  IF p_kind = 'cheer' AND p_reward_key IS NOT NULL THEN
    RAISE EXCEPTION 'a cheer cannot include a reward';
  END IF;
  IF p_kind = 'reward' AND (
    p_reward_key IS NULL
    OR p_reward_key NOT IN (
      'favorite_snack',
      'quiet_evening',
      'walk_together',
      'music_break',
      'celebration_call'
    )
  ) THEN
    RAISE EXCEPTION 'unsupported reward';
  END IF;

  SELECT * INTO v_link
    FROM public.partner_links
   WHERE owner_id = p_owner_id
     AND partner_id = v_caller
     AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not an active partner for this account';
  END IF;
  IF NOT private.accountability_participants_are_permanent(
    v_link.owner_id,
    v_link.partner_id
  ) THEN
    RAISE EXCEPTION 'both accountability participants must be permanent accounts';
  END IF;
  IF NOT v_link.allow_celebrations THEN
    RAISE EXCEPTION 'celebrations are not enabled for this partnership';
  END IF;

  IF p_source = 'habit_streak' THEN
    IF NOT v_link.share_streaks THEN
      RAISE EXCEPTION 'streak sharing is not enabled';
    END IF;
    SELECT COALESCE(MAX(GREATEST(streak_count, 0)), 0)
      INTO v_milestone
      FROM public.habits
     WHERE user_id = p_owner_id
       AND is_active
       AND accountability_enabled
       AND accountability_share_streak;
    IF v_milestone = 0 THEN
      RAISE EXCEPTION 'there is no visible streak milestone to celebrate';
    END IF;
  ELSIF p_source = 'goal_progress' THEN
    IF NOT v_link.share_goals THEN
      RAISE EXCEPTION 'goal sharing is not enabled';
    END IF;
    SELECT COUNT(*)::INTEGER
      INTO v_milestone
      FROM public.goals
     WHERE user_id = p_owner_id
       AND status = 'completed'
       AND date BETWEEN CURRENT_DATE - 6 AND CURRENT_DATE;
    IF v_milestone = 0 THEN
      RAISE EXCEPTION 'there is no visible goal milestone to celebrate';
    END IF;
  END IF;

  v_period := (
    CURRENT_DATE - EXTRACT(ISODOW FROM CURRENT_DATE)::INTEGER + 1
  )::TEXT;
  v_dedupe_key := CONCAT(
    p_source,
    ':',
    p_kind,
    ':',
    COALESCE(p_reward_key, 'none'),
    ':',
    v_milestone,
    ':',
    v_period
  );

  INSERT INTO public.partner_celebrations (
    link_id,
    owner_id,
    partner_id,
    kind,
    source,
    milestone_count,
    reward_key,
    dedupe_key
  )
  VALUES (
    v_link.id,
    p_owner_id,
    v_caller,
    p_kind,
    p_source,
    v_milestone,
    p_reward_key,
    v_dedupe_key
  )
  ON CONFLICT (link_id, dedupe_key)
    DO UPDATE SET dedupe_key = EXCLUDED.dedupe_key
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_partner_invite(TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.partner_snapshot(UUID)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.send_partner_celebration(UUID, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.validate_habit_accountability()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.accept_partner_invite(TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.partner_snapshot(UUID)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_partner_celebration(UUID, TEXT, TEXT, TEXT)
  TO authenticated;
