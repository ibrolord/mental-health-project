-- Expand accountability sharing without widening access to any private row.
--
-- Partners still receive only the JSON counts emitted by partner_snapshot().
-- Celebrations are fixed-format events derived from those counts. There is no
-- free-text field, so journal text, mood notes, goal text, assessment scores,
-- and AI chat content cannot be copied into this channel.

ALTER TABLE public.partner_invites
  ADD COLUMN share_streaks BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN allow_celebrations BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.partner_links
  ADD COLUMN share_streaks BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN allow_celebrations BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.partner_links
  ADD CONSTRAINT partner_links_id_owner_partner_key
  UNIQUE (id, owner_id, partner_id);

CREATE TABLE public.partner_celebrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  source TEXT NOT NULL,
  milestone_count INTEGER NOT NULL,
  reward_key TEXT,
  dedupe_key TEXT NOT NULL,
  seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT partner_celebrations_link_identity_fk
    FOREIGN KEY (link_id, owner_id, partner_id)
    REFERENCES public.partner_links (id, owner_id, partner_id)
    ON DELETE CASCADE,
  CONSTRAINT partner_celebrations_kind_check
    CHECK (kind IN ('cheer', 'reward')),
  CONSTRAINT partner_celebrations_source_check
    CHECK (source IN ('habit_streak', 'goal_progress', 'general')),
  CONSTRAINT partner_celebrations_milestone_check
    CHECK (milestone_count >= 0),
  CONSTRAINT partner_celebrations_reward_shape_check
    CHECK (
      (kind = 'cheer' AND reward_key IS NULL)
      OR
      (
        kind = 'reward'
        AND reward_key IN (
          'favorite_snack',
          'quiet_evening',
          'walk_together',
          'music_break',
          'celebration_call'
        )
      )
    ),
  CONSTRAINT partner_celebrations_dedupe_length
    CHECK (char_length(dedupe_key) BETWEEN 1 AND 160),
  CONSTRAINT partner_celebrations_link_dedupe_key
    UNIQUE (link_id, dedupe_key)
);

CREATE INDEX partner_celebrations_owner_created_idx
  ON public.partner_celebrations (owner_id, created_at DESC);
CREATE INDEX partner_celebrations_partner_created_idx
  ON public.partner_celebrations (partner_id, created_at DESC);

ALTER TABLE public.partner_celebrations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.partner_celebrations
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.partner_celebrations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.partner_celebrations
  TO service_role;

CREATE POLICY "Permanent owners read celebrations received"
  ON public.partner_celebrations
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = owner_id
    AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
  );

CREATE POLICY "Permanent partners read celebrations sent"
  ON public.partner_celebrations
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = partner_id
    AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
  );

-- The original UI rejected anonymous accounts, but the database policies did
-- not. Replace every partner policy so that a crafted client cannot create or
-- inspect a partnership from an anonymous Supabase Auth account.
DROP POLICY IF EXISTS "Owners manage their own invites"
  ON public.partner_invites;
DROP POLICY IF EXISTS "Owners read their own links"
  ON public.partner_links;
DROP POLICY IF EXISTS "Partners read links naming them"
  ON public.partner_links;
DROP POLICY IF EXISTS "Owners update their own links"
  ON public.partner_links;
DROP POLICY IF EXISTS "Owners delete their own links"
  ON public.partner_links;
DROP POLICY IF EXISTS "Partners may end their own partnership"
  ON public.partner_links;

CREATE POLICY "Permanent owners manage their own invites"
  ON public.partner_invites
  FOR ALL
  TO authenticated
  USING (
    (SELECT auth.uid()) = owner_id
    AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
  )
  WITH CHECK (
    (SELECT auth.uid()) = owner_id
    AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
  );

CREATE POLICY "Permanent owners read their own links"
  ON public.partner_links
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = owner_id
    AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
  );

CREATE POLICY "Permanent partners read links naming them"
  ON public.partner_links
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = partner_id
    AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
  );

CREATE POLICY "Permanent owners update their own links"
  ON public.partner_links
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) = owner_id
    AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
  )
  WITH CHECK (
    (SELECT auth.uid()) = owner_id
    AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
  );

CREATE POLICY "Permanent owners delete their own links"
  ON public.partner_links
  FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.uid()) = owner_id
    AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
  );

CREATE POLICY "Permanent partners may end their own partnership"
  ON public.partner_links
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) = partner_id
    AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
  )
  WITH CHECK (
    (SELECT auth.uid()) = partner_id
    AND COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE
  );

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

  SELECT * INTO v_invite
    FROM public.partner_invites
   WHERE token_hash = p_token_hash
     AND status = 'pending'
     AND expires_at > NOW()
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite is invalid or has expired';
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
      v_invite.share_mood_trend,
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

  v_result := jsonb_build_object(
    'owner_id', p_owner_id,
    'window_days', 7,
    'scopes', jsonb_build_object(
      'goals', v_link.share_goals,
      'habits', v_link.share_habits,
      'checkins', v_link.share_checkins,
      'mood_trend', v_link.share_mood_trend,
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

  IF v_link.share_mood_trend THEN
    v_result := v_result || jsonb_build_object('mood_trend', (
      SELECT COALESCE(jsonb_agg(entry ORDER BY entry->>'day'), '[]'::JSONB)
      FROM (
        SELECT jsonb_build_object(
          'day', local_date,
          'emoji', MODE() WITHIN GROUP (ORDER BY emoji)
        ) AS entry
        FROM public.moods
        WHERE user_id = p_owner_id
          AND local_date BETWEEN v_since AND CURRENT_DATE
        GROUP BY local_date
      ) daily
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

  -- One identical response per weekly milestone prevents accidental double
  -- sends while still allowing a rebuilt streak to be celebrated later.
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
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF COALESCE((auth.jwt() ->> 'is_anonymous')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'a permanent account is required';
  END IF;

  UPDATE public.partner_celebrations
     SET seen_at = COALESCE(seen_at, NOW())
   WHERE id = p_celebration_id
     AND owner_id = auth.uid();

  RETURN FOUND;
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

GRANT EXECUTE ON FUNCTION public.accept_partner_invite(TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.partner_snapshot(UUID)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_partner_celebration(UUID, TEXT, TEXT, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_partner_celebration_seen(UUID)
  TO authenticated;

-- Include connection metadata and fixed-format celebration events in account
-- deletion. Anonymous-session data is intentionally untouched.
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
