-- Accountability partners.
--
-- Design constraint that drives everything below: every other table in this
-- schema is owner-only (auth.uid() = user_id), and the data involved includes
-- PHQ-9 item-9 self-harm responses and private journal entries. So a partner
-- NEVER gets a SELECT policy on moods, assessments, goals, habits, chat_history
-- or journal_entries.
--
-- Instead, partners read a single SECURITY DEFINER function that returns
-- derived counts only. If a partner has no read path to the raw rows, a
-- subtly wrong policy predicate cannot leak them.
--
-- Deliberately NOT shareable, under any scope combination:
--   - journal entries (any field)
--   - AI chat history
--   - assessment scores or responses (PHQ-9 / GAD-7 / CBI)
--   - the free-text `note` on a mood entry
-- Mood sharing is limited to the emoji trend. Do not widen this without a
-- matching update to the in-app consent copy.

CREATE TYPE partner_link_status AS ENUM ('active', 'revoked');
CREATE TYPE partner_invite_status AS ENUM ('pending', 'accepted', 'revoked');

-- ---------------------------------------------------------------------------
-- Invites
-- ---------------------------------------------------------------------------

CREATE TABLE public.partner_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- SHA-256 of the raw invite token. The raw token is shown to the owner once
  -- and never persisted, so a database read cannot be replayed into access.
  token_hash TEXT NOT NULL UNIQUE,
  -- Optional label so the owner remembers who a pending link was meant for.
  invitee_label TEXT,
  status partner_invite_status NOT NULL DEFAULT 'pending',
  share_goals BOOLEAN NOT NULL DEFAULT TRUE,
  share_habits BOOLEAN NOT NULL DEFAULT TRUE,
  share_checkins BOOLEAN NOT NULL DEFAULT TRUE,
  share_mood_trend BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  CONSTRAINT invite_label_length CHECK (
    invitee_label IS NULL OR char_length(invitee_label) <= 60
  )
);

CREATE INDEX partner_invites_owner_idx ON public.partner_invites (owner_id);

-- ---------------------------------------------------------------------------
-- Accepted partnerships
-- ---------------------------------------------------------------------------

CREATE TABLE public.partner_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_label TEXT,
  status partner_link_status NOT NULL DEFAULT 'active',
  share_goals BOOLEAN NOT NULL DEFAULT TRUE,
  share_habits BOOLEAN NOT NULL DEFAULT TRUE,
  share_checkins BOOLEAN NOT NULL DEFAULT TRUE,
  share_mood_trend BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  CONSTRAINT partner_is_not_owner CHECK (owner_id <> partner_id)
);

CREATE INDEX partner_links_owner_idx ON public.partner_links (owner_id);
CREATE INDEX partner_links_partner_idx ON public.partner_links (partner_id);
CREATE UNIQUE INDEX partner_links_one_active_pair_idx
  ON public.partner_links (owner_id, partner_id)
  WHERE status = 'active';

ALTER TABLE public.partner_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_links ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- RLS: owners control everything. Partners get read-only visibility of the
-- link row itself so they know whose progress they can see, and the ability to
-- end the partnership from their side.
-- ---------------------------------------------------------------------------

CREATE POLICY "Owners manage their own invites"
  ON public.partner_invites FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = owner_id)
  WITH CHECK ((SELECT auth.uid()) = owner_id);

CREATE POLICY "Owners read their own links"
  ON public.partner_links FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = owner_id);

CREATE POLICY "Partners read links naming them"
  ON public.partner_links FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = partner_id);

CREATE POLICY "Owners update their own links"
  ON public.partner_links FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = owner_id)
  WITH CHECK ((SELECT auth.uid()) = owner_id);

CREATE POLICY "Owners delete their own links"
  ON public.partner_links FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = owner_id);

-- Partners may revoke from their side, but must not be able to widen scopes.
-- The trigger below enforces that; the policy only opens the row.
CREATE POLICY "Partners may end their own partnership"
  ON public.partner_links FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = partner_id)
  WITH CHECK ((SELECT auth.uid()) = partner_id);

CREATE OR REPLACE FUNCTION public.partner_links_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Revocation is final for this link. Reconnecting requires accepting a new
  -- invite, which creates a new active row and preserves the audit history.
  IF OLD.status = 'revoked' AND NEW.status <> 'revoked' THEN
    RAISE EXCEPTION 'a revoked partnership cannot be reactivated';
  END IF;

  -- A partner acting on their own row may only set status to 'revoked'.
  -- Every other column must be untouched, so scopes cannot be widened by the
  -- person receiving the data.
  IF auth.uid() = OLD.partner_id AND auth.uid() <> OLD.owner_id THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.share_goals IS DISTINCT FROM OLD.share_goals
      OR NEW.share_habits IS DISTINCT FROM OLD.share_habits
      OR NEW.share_checkins IS DISTINCT FROM OLD.share_checkins
      OR NEW.share_mood_trend IS DISTINCT FROM OLD.share_mood_trend
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

  -- Owners may change scopes, labels, or revoke, but cannot rewrite who a
  -- historical partnership belonged to.
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

CREATE TRIGGER partner_links_guard_trigger
  BEFORE UPDATE ON public.partner_links
  FOR EACH ROW EXECUTE FUNCTION public.partner_links_guard();

-- ---------------------------------------------------------------------------
-- Accepting an invite.
--
-- SECURITY DEFINER because the invitee cannot (and must not) SELECT the
-- owner's invite rows. The raw token is hashed by the caller; this function
-- only ever sees the hash.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.accept_partner_invite(p_token_hash TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invite public.partner_invites%ROWTYPE;
  v_link_id UUID;
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required';
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

  -- Keep a currently active connection as-is. If the previous connection was
  -- revoked, the partial unique index allows a fresh row for the new consent.
  SELECT id INTO v_link_id
    FROM public.partner_links
   WHERE owner_id = v_invite.owner_id
     AND partner_id = v_caller
     AND status = 'active';

  IF v_link_id IS NULL THEN
    INSERT INTO public.partner_links (
    owner_id, partner_id, status,
    share_goals, share_habits, share_checkins, share_mood_trend
    )
    VALUES (
      v_invite.owner_id, v_caller, 'active',
      v_invite.share_goals, v_invite.share_habits,
      v_invite.share_checkins, v_invite.share_mood_trend
    )
    ON CONFLICT (owner_id, partner_id) WHERE status = 'active'
      DO NOTHING
    RETURNING id INTO v_link_id;

    -- Another acceptance may have won the race.
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

-- ---------------------------------------------------------------------------
-- The only read path a partner has.
--
-- Returns derived counts, never rows. Each field is gated on its own scope
-- flag, so a partner who was granted goals-only genuinely cannot observe
-- habits or mood. Nothing here touches assessments, chat_history, or
-- journal_entries.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.partner_snapshot(p_owner_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_link public.partner_links%ROWTYPE;
  v_since DATE := CURRENT_DATE - 6;
  v_result JSONB := '{}'::JSONB;
BEGIN
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
      'mood_trend', v_link.share_mood_trend
    )
  );

  -- Semantics: goals *dated* within the window, and how many of those are
  -- done. A goal dated before the window is out of scope even if completed
  -- recently, which matches the "this week" framing of the partner card.
  IF v_link.share_goals THEN
    v_result := v_result || jsonb_build_object('goals', (
      SELECT jsonb_build_object(
        'completed', COUNT(*) FILTER (WHERE status = 'completed'),
        'total', COUNT(*)
      )
      FROM public.goals
      WHERE user_id = p_owner_id
        AND date BETWEEN v_since AND CURRENT_DATE
    ));
  END IF;

  -- NB: habit_logs stores the day in `log_date`, not `date`, and carries a
  -- `completed` flag. Only completed logs count toward the streak.
  IF v_link.share_habits THEN
    v_result := v_result || jsonb_build_object('habits', (
      SELECT jsonb_build_object(
        'logged_days', COUNT(DISTINCT hl.log_date),
        'tracked', (SELECT COUNT(*) FROM public.habits WHERE user_id = p_owner_id)
      )
      FROM public.habit_logs hl
      JOIN public.habits h ON h.id = hl.habit_id
      WHERE h.user_id = p_owner_id
        AND hl.log_date BETWEEN v_since AND CURRENT_DATE
        AND hl.completed
    ));
  END IF;

  IF v_link.share_checkins THEN
    v_result := v_result || jsonb_build_object('checkins', (
      SELECT jsonb_build_object(
        'days', COUNT(DISTINCT local_date)
      )
      FROM public.moods
      WHERE user_id = p_owner_id
        AND local_date BETWEEN v_since AND CURRENT_DATE
    ));
  END IF;

  -- Emoji trend only. The free-text `note` column is never selected here.
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

REVOKE ALL ON FUNCTION public.accept_partner_invite(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.partner_snapshot(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_partner_invite(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.partner_snapshot(UUID) TO authenticated;

REVOKE ALL ON public.partner_invites FROM anon;
REVOKE ALL ON public.partner_links FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_invites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_links TO authenticated;
