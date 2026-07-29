-- Close the remaining accountability privacy gaps without rewriting migration
-- history that has already reached production.
--
-- The partner snapshot is deliberately aggregate-only: permission booleans and
-- numeric counts, with no dates, labels, emoji, notes, scores, or authored text.

-- Rows created before these scopes existed must not silently opt in.
UPDATE public.partner_invites
   SET share_streaks = FALSE,
       allow_celebrations = FALSE
 WHERE created_at < TIMESTAMPTZ '2026-07-28 16:15:48+00';

UPDATE public.partner_links
   SET share_streaks = FALSE,
       allow_celebrations = FALSE
 WHERE created_at < TIMESTAMPTZ '2026-07-28 16:15:48+00';

-- Mood shape included dates and emoji, so it was not a counts-only scope.
-- Keep the legacy column for client compatibility, but make FALSE invariant.
UPDATE public.partner_invites
   SET share_mood_trend = FALSE
 WHERE share_mood_trend;

UPDATE public.partner_links
   SET share_mood_trend = FALSE
 WHERE share_mood_trend;

ALTER TABLE public.partner_invites
  ADD CONSTRAINT partner_invites_mood_trend_disabled
  CHECK (share_mood_trend = FALSE);

ALTER TABLE public.partner_links
  ADD CONSTRAINT partner_links_mood_trend_disabled
  CHECK (share_mood_trend = FALSE);

-- Existing pending tokens used a single client-side hash. A previously
-- exported hash could therefore be submitted directly. There are no pending
-- production invites at rollout, but revoke any old row on other installs
-- rather than pretending an already-exposed verifier can be made secret.
UPDATE public.partner_invites
   SET status = 'revoked'
 WHERE status = 'pending'
   AND created_at < TIMESTAMPTZ '2026-07-28 16:37:54+00';

-- Legacy relationships involving anonymous Auth identities are not durable
-- accountability relationships. Revoke them before tightening policies.
UPDATE public.partner_invites i
   SET status = 'revoked'
 WHERE i.status = 'pending'
   AND EXISTS (
     SELECT 1
       FROM auth.users owner_account
      WHERE owner_account.id = i.owner_id
        AND owner_account.is_anonymous IS TRUE
   );

UPDATE public.partner_links l
   SET status = 'revoked',
       revoked_at = COALESCE(l.revoked_at, NOW())
 WHERE l.status = 'active'
   AND (
     EXISTS (
       SELECT 1
         FROM auth.users owner_account
        WHERE owner_account.id = l.owner_id
          AND owner_account.is_anonymous IS TRUE
     )
     OR EXISTS (
       SELECT 1
         FROM auth.users partner_account
        WHERE partner_account.id = l.partner_id
          AND partner_account.is_anonymous IS TRUE
     )
   );

-- A client submits SHA-256(raw token). Hash that verifier again before storage.
-- The stored value is therefore useless as an input to accept_partner_invite.
CREATE OR REPLACE FUNCTION public.partner_invites_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.token_hash !~ '^[0-9a-f]{64}$' THEN
      RAISE EXCEPTION 'invite verifier must be a SHA-256 digest';
    END IF;
    NEW.token_hash := pg_catalog.encode(
      extensions.digest(NEW.token_hash, 'sha256'),
      'hex'
    );
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
    OR NEW.token_hash IS DISTINCT FROM OLD.token_hash
    OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'invite identity and verifier are immutable';
  END IF;

  IF auth.uid() = OLD.owner_id
    AND NEW.status IS DISTINCT FROM OLD.status
    AND NOT (OLD.status = 'pending' AND NEW.status = 'revoked')
  THEN
    RAISE EXCEPTION 'invite owners may only revoke pending invites';
  END IF;

  IF OLD.status <> 'pending' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'a completed invite cannot change status';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS partner_invites_guard_trigger
  ON public.partner_invites;
CREATE TRIGGER partner_invites_guard_trigger
  BEFORE INSERT OR UPDATE ON public.partner_invites
  FOR EACH ROW EXECUTE FUNCTION public.partner_invites_guard();

REVOKE ALL ON FUNCTION public.partner_invites_guard()
  FROM PUBLIC, anon, authenticated;

-- Policies cannot safely trust only the caller's JWT: both identities attached
-- to the row must still be permanent accounts in auth.users.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.accountability_participants_are_permanent(
  p_owner_id UUID,
  p_partner_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    (auth.uid() = p_owner_id OR auth.uid() = p_partner_id)
    AND EXISTS (
      SELECT 1
        FROM auth.users owner_account
       WHERE owner_account.id = p_owner_id
         AND owner_account.is_anonymous IS FALSE
    )
    AND EXISTS (
      SELECT 1
        FROM auth.users partner_account
       WHERE partner_account.id = p_partner_id
         AND partner_account.is_anonymous IS FALSE
    );
$$;

REVOKE ALL ON FUNCTION
  private.accountability_participants_are_permanent(UUID, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  private.accountability_participants_are_permanent(UUID, UUID)
  TO authenticated;

DROP POLICY IF EXISTS "Permanent participants read celebrations"
  ON public.partner_celebrations;
CREATE POLICY "Permanent participants read celebrations"
  ON public.partner_celebrations
  FOR SELECT
  TO authenticated
  USING (
    (
      (SELECT auth.uid()) = owner_id
      OR (SELECT auth.uid()) = partner_id
    )
    AND COALESCE(
      ((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN,
      FALSE
    ) = FALSE
    AND private.accountability_participants_are_permanent(owner_id, partner_id)
  );

DROP POLICY IF EXISTS "Permanent participants read their links"
  ON public.partner_links;
CREATE POLICY "Permanent participants read their links"
  ON public.partner_links
  FOR SELECT
  TO authenticated
  USING (
    (
      (SELECT auth.uid()) = owner_id
      OR (SELECT auth.uid()) = partner_id
    )
    AND COALESCE(
      ((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN,
      FALSE
    ) = FALSE
    AND private.accountability_participants_are_permanent(owner_id, partner_id)
  );

DROP POLICY IF EXISTS "Permanent participants update their links"
  ON public.partner_links;
CREATE POLICY "Permanent participants update their links"
  ON public.partner_links
  FOR UPDATE
  TO authenticated
  USING (
    (
      (SELECT auth.uid()) = owner_id
      OR (SELECT auth.uid()) = partner_id
    )
    AND COALESCE(
      ((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN,
      FALSE
    ) = FALSE
    AND private.accountability_participants_are_permanent(owner_id, partner_id)
  )
  WITH CHECK (
    (
      (SELECT auth.uid()) = owner_id
      OR (SELECT auth.uid()) = partner_id
    )
    AND COALESCE(
      ((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN,
      FALSE
    ) = FALSE
    AND private.accountability_participants_are_permanent(owner_id, partner_id)
  );

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
      allow_celebrations
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
      v_invite.allow_celebrations
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
      'celebrations', v_link.allow_celebrations
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
        'logged_days', COUNT(DISTINCT hl.log_date)
      )
      FROM public.habit_logs hl
      JOIN public.habits h ON h.id = hl.habit_id
      WHERE h.user_id = p_owner_id
        AND hl.log_date BETWEEN v_since AND CURRENT_DATE
        AND hl.completed
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
       AND is_active;
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

CREATE OR REPLACE FUNCTION public.mark_partner_celebration_seen(
  p_celebration_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_celebration public.partner_celebrations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF COALESCE((auth.jwt() ->> 'is_anonymous')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'a permanent account is required';
  END IF;

  SELECT * INTO v_celebration
    FROM public.partner_celebrations
   WHERE id = p_celebration_id
     AND owner_id = auth.uid();

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  IF NOT private.accountability_participants_are_permanent(
    v_celebration.owner_id,
    v_celebration.partner_id
  ) THEN
    RAISE EXCEPTION 'both accountability participants must be permanent accounts';
  END IF;

  UPDATE public.partner_celebrations
     SET seen_at = COALESCE(seen_at, NOW())
   WHERE id = p_celebration_id
     AND owner_id = auth.uid();

  RETURN FOUND;
END;
$$;

-- Preserve anonymous data. This function remains unscheduled and dry-run by
-- default; the additional table check prevents library-only accounts from ever
-- being classified as empty if an operator explicitly invokes it.
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

REVOKE ALL ON FUNCTION public.accept_partner_invite(TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.partner_snapshot(UUID)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.send_partner_celebration(UUID, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_partner_celebration_seen(UUID)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reap_stale_anonymous_users(INTEGER, BOOLEAN)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.accept_partner_invite(TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.partner_snapshot(UUID)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_partner_celebration(UUID, TEXT, TEXT, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_partner_celebration_seen(UUID)
  TO authenticated;
