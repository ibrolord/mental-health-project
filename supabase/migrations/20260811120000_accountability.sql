-- Accountability Together: explicit, revocable sharing for permanent users.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE SCHEMA IF NOT EXISTS accountability_private;

CREATE TABLE IF NOT EXISTS public.accountability_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  partner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invitee_email_hash BYTEA NOT NULL,
  invite_token_hash BYTEA UNIQUE,
  status TEXT NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited', 'active', 'revoked', 'blocked')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  ended_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (partner_id IS NULL OR partner_id <> owner_id),
  CHECK (expires_at > created_at),
  CHECK ((status = 'invited' AND owner_id IS NOT NULL AND partner_id IS NULL AND used_at IS NULL
      AND invite_token_hash IS NOT NULL)
    OR (status <> 'invited' AND used_at IS NOT NULL
      AND invite_token_hash IS NULL))
);

-- A primary key on user_id makes one active partner per user non-racy.
CREATE TABLE IF NOT EXISTS public.accountability_memberships (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.accountability_connections(id) ON DELETE CASCADE,
  counterpart_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'partner')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (connection_id, role),
  CHECK (user_id <> counterpart_id)
);

CREATE TABLE IF NOT EXISTS public.accountability_scope_controls (
  connection_id UUID NOT NULL REFERENCES public.accountability_connections(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shares_progress BOOLEAN NOT NULL DEFAULT true,
  shares_commitment_titles BOOLEAN NOT NULL DEFAULT true,
  shares_notes BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (connection_id, owner_id)
);

-- Explicitly created accountability commitments never expose goals or reflections.
CREATE TABLE IF NOT EXISTS public.accountability_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.accountability_connections(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 240),
  cadence TEXT NOT NULL CHECK (cadence IN ('daily', 'weekly', 'custom')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  priority TEXT CHECK (priority IS NULL OR priority IN ('high', 'medium', 'low')),
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.accountability_check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commitment_id UUID NOT NULL REFERENCES public.accountability_commitments(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shown_up_on DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (commitment_id, shown_up_on)
);

-- Commitment notes live separately so RLS can hide their content while still
-- allowing the commitment title and progress to be shared.
CREATE TABLE IF NOT EXISTS public.accountability_commitment_notes (
  commitment_id UUID PRIMARY KEY REFERENCES public.accountability_commitments(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  shared_with_partner BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.accountability_check_in_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_in_id UUID NOT NULL REFERENCES public.accountability_check_ins(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  shared_with_partner BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (check_in_id)
);

CREATE TABLE IF NOT EXISTS public.accountability_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commitment_id UUID NOT NULL REFERENCES public.accountability_commitments(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.accountability_nudges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.accountability_connections(id) ON DELETE CASCADE,
  commitment_id UUID REFERENCES public.accountability_commitments(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('encouragement', 'gentle_reminder', 'celebrate_progress')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (sender_id <> recipient_id)
);

CREATE TABLE IF NOT EXISTS public.accountability_priority_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commitment_id UUID NOT NULL REFERENCES public.accountability_commitments(id) ON DELETE CASCADE,
  suggested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  suggested_priority TEXT NOT NULL CHECK (suggested_priority IN ('high', 'medium', 'low')),
  note TEXT CHECK (note IS NULL OR char_length(btrim(note)) BETWEEN 1 AND 500),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.accountability_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commitment_id UUID NOT NULL REFERENCES public.accountability_commitments(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 1 AND 500),
  earned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (commitment_id)
);

CREATE TABLE IF NOT EXISTS public.accountability_blocks (
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS accountability_connections_owner_status_idx
  ON public.accountability_connections(owner_id, status);
CREATE INDEX IF NOT EXISTS accountability_connections_partner_status_idx
  ON public.accountability_connections(partner_id, status) WHERE partner_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS accountability_connections_pending_owner_idx
  ON public.accountability_connections(owner_id) WHERE status = 'invited';
CREATE INDEX IF NOT EXISTS accountability_memberships_connection_idx
  ON public.accountability_memberships(connection_id);
CREATE INDEX IF NOT EXISTS accountability_commitments_owner_idx
  ON public.accountability_commitments(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS accountability_commitments_connection_idx
  ON public.accountability_commitments(connection_id);
CREATE INDEX IF NOT EXISTS accountability_check_ins_owner_date_idx
  ON public.accountability_check_ins(owner_id, shown_up_on DESC);
CREATE INDEX IF NOT EXISTS accountability_check_ins_commitment_idx
  ON public.accountability_check_ins(commitment_id);
CREATE INDEX IF NOT EXISTS accountability_commitment_notes_owner_idx
  ON public.accountability_commitment_notes(owner_id);
CREATE INDEX IF NOT EXISTS accountability_check_in_notes_owner_idx
  ON public.accountability_check_in_notes(owner_id);
CREATE INDEX IF NOT EXISTS accountability_comments_commitment_idx
  ON public.accountability_comments(commitment_id, author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS accountability_nudges_rate_idx
  ON public.accountability_nudges(connection_id, sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS accountability_priority_suggestions_commitment_idx
  ON public.accountability_priority_suggestions(commitment_id, status);
CREATE INDEX IF NOT EXISTS accountability_rewards_owner_idx
  ON public.accountability_rewards(owner_id);
CREATE INDEX IF NOT EXISTS accountability_blocks_blocked_idx
  ON public.accountability_blocks(blocked_id);

ALTER TABLE public.accountability_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accountability_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accountability_scope_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accountability_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accountability_check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accountability_commitment_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accountability_check_in_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accountability_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accountability_nudges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accountability_priority_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accountability_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accountability_blocks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION accountability_private.is_permanent_user()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL
    AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, true) IS false;
$$;

CREATE OR REPLACE FUNCTION accountability_private.can_view_connection(p_connection_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT accountability_private.is_permanent_user()
    AND EXISTS (
      SELECT 1 FROM public.accountability_memberships m
      WHERE m.connection_id = p_connection_id AND m.user_id = (SELECT auth.uid())
    );
$$;

CREATE OR REPLACE FUNCTION accountability_private.can_view_commitment(p_commitment_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.accountability_commitments c
    WHERE c.id = p_commitment_id
      AND (c.status <> 'archived' OR c.owner_id = (SELECT auth.uid()))
      AND (c.owner_id = (SELECT auth.uid())
        OR (accountability_private.can_view_connection(c.connection_id)
          AND EXISTS (
            SELECT 1 FROM public.accountability_scope_controls s
            WHERE s.connection_id = c.connection_id
              AND s.owner_id = c.owner_id
              AND s.shares_commitment_titles
          )))
  );
$$;

CREATE OR REPLACE FUNCTION accountability_private.can_view_progress(p_commitment_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.accountability_commitments c
    JOIN public.accountability_scope_controls s
      ON s.connection_id = c.connection_id AND s.owner_id = c.owner_id
    WHERE c.id = p_commitment_id
      AND (c.status <> 'archived' OR c.owner_id = (SELECT auth.uid()))
      AND (c.owner_id = (SELECT auth.uid())
        OR (s.shares_progress
          AND accountability_private.can_view_connection(c.connection_id)))
  );
$$;

REVOKE ALL ON SCHEMA accountability_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA accountability_private TO authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA accountability_private FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA accountability_private TO authenticated;

CREATE POLICY "connection participants select"
  ON public.accountability_connections FOR SELECT TO authenticated
  USING (accountability_private.is_permanent_user() AND
    (owner_id = (SELECT auth.uid()) OR accountability_private.can_view_connection(id)));
CREATE POLICY "membership owner selects"
  ON public.accountability_memberships FOR SELECT TO authenticated
  USING (accountability_private.is_permanent_user() AND user_id = (SELECT auth.uid()));
CREATE POLICY "scope participants select"
  ON public.accountability_scope_controls FOR SELECT TO authenticated
  USING (accountability_private.can_view_connection(connection_id));
CREATE POLICY "scope owner updates"
  ON public.accountability_scope_controls FOR UPDATE TO authenticated
  USING (accountability_private.is_permanent_user() AND owner_id = (SELECT auth.uid()))
  WITH CHECK (accountability_private.is_permanent_user()
    AND owner_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.accountability_memberships m
      WHERE m.connection_id = accountability_scope_controls.connection_id
        AND m.user_id = (SELECT auth.uid())));

CREATE POLICY "commitment participants select"
  ON public.accountability_commitments FOR SELECT TO authenticated
  USING (accountability_private.is_permanent_user()
    AND accountability_private.can_view_commitment(id));
CREATE POLICY "commitment owner inserts"
  ON public.accountability_commitments FOR INSERT TO authenticated
  WITH CHECK (accountability_private.is_permanent_user()
    AND owner_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.accountability_memberships m
      WHERE m.connection_id = accountability_commitments.connection_id
        AND m.user_id = (SELECT auth.uid())));
CREATE POLICY "commitment owner updates"
  ON public.accountability_commitments FOR UPDATE TO authenticated
  USING (accountability_private.is_permanent_user() AND owner_id = (SELECT auth.uid()))
  WITH CHECK (accountability_private.is_permanent_user()
    AND owner_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.accountability_memberships m
      WHERE m.connection_id = accountability_commitments.connection_id
        AND m.user_id = (SELECT auth.uid())));
CREATE POLICY "commitment owner deletes"
  ON public.accountability_commitments FOR DELETE TO authenticated
  USING (accountability_private.is_permanent_user() AND owner_id = (SELECT auth.uid()));

CREATE POLICY "check in participants select"
  ON public.accountability_check_ins FOR SELECT TO authenticated
  USING (accountability_private.is_permanent_user()
    AND accountability_private.can_view_progress(commitment_id));
CREATE POLICY "check in owner inserts"
  ON public.accountability_check_ins FOR INSERT TO authenticated
  WITH CHECK (accountability_private.is_permanent_user() AND owner_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.accountability_commitments c
      WHERE c.id = commitment_id AND c.owner_id = (SELECT auth.uid())));
CREATE POLICY "check in owner deletes"
  ON public.accountability_check_ins FOR DELETE TO authenticated
  USING (accountability_private.is_permanent_user() AND owner_id = (SELECT auth.uid()));

CREATE POLICY "commitment note owner or explicitly shared partner selects"
  ON public.accountability_commitment_notes FOR SELECT TO authenticated
  USING (accountability_private.is_permanent_user() AND (
    owner_id = (SELECT auth.uid()) OR (
      shared_with_partner
      AND EXISTS (
        SELECT 1
        FROM public.accountability_commitments c
        JOIN public.accountability_scope_controls s
          ON s.connection_id = c.connection_id AND s.owner_id = c.owner_id
        WHERE c.id = commitment_id AND s.shares_notes
          AND accountability_private.can_view_connection(c.connection_id)
      )
    )));
CREATE POLICY "commitment note owner inserts"
  ON public.accountability_commitment_notes FOR INSERT TO authenticated
  WITH CHECK (accountability_private.is_permanent_user() AND owner_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.accountability_commitments c
      WHERE c.id = commitment_id AND c.owner_id = (SELECT auth.uid())));
CREATE POLICY "commitment note owner updates"
  ON public.accountability_commitment_notes FOR UPDATE TO authenticated
  USING (accountability_private.is_permanent_user() AND owner_id = (SELECT auth.uid()))
  WITH CHECK (accountability_private.is_permanent_user() AND owner_id = (SELECT auth.uid()));
CREATE POLICY "commitment note owner deletes"
  ON public.accountability_commitment_notes FOR DELETE TO authenticated
  USING (accountability_private.is_permanent_user() AND owner_id = (SELECT auth.uid()));

CREATE POLICY "note owner or explicitly shared partner selects"
  ON public.accountability_check_in_notes FOR SELECT TO authenticated
  USING (accountability_private.is_permanent_user() AND (
    owner_id = (SELECT auth.uid()) OR (
      shared_with_partner
      AND EXISTS (
        SELECT 1
        FROM public.accountability_check_ins ci
        JOIN public.accountability_commitments c ON c.id = ci.commitment_id
        JOIN public.accountability_scope_controls s ON s.connection_id = c.connection_id
        WHERE ci.id = check_in_id AND s.owner_id = c.owner_id AND s.shares_notes
          AND accountability_private.can_view_connection(c.connection_id)
      )
    )));
CREATE POLICY "note owner inserts"
  ON public.accountability_check_in_notes FOR INSERT TO authenticated
  WITH CHECK (accountability_private.is_permanent_user() AND owner_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.accountability_check_ins ci
      WHERE ci.id = check_in_id AND ci.owner_id = (SELECT auth.uid())));
CREATE POLICY "note owner updates"
  ON public.accountability_check_in_notes FOR UPDATE TO authenticated
  USING (accountability_private.is_permanent_user() AND owner_id = (SELECT auth.uid()))
  WITH CHECK (accountability_private.is_permanent_user()
    AND owner_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.accountability_check_ins ci
      WHERE ci.id = accountability_check_in_notes.check_in_id
        AND ci.owner_id = (SELECT auth.uid())));
CREATE POLICY "note owner deletes"
  ON public.accountability_check_in_notes FOR DELETE TO authenticated
  USING (accountability_private.is_permanent_user() AND owner_id = (SELECT auth.uid()));

CREATE POLICY "comment participants select"
  ON public.accountability_comments FOR SELECT TO authenticated
  USING (accountability_private.is_permanent_user() AND accountability_private.can_view_commitment(commitment_id));

CREATE POLICY "nudge participants select"
  ON public.accountability_nudges FOR SELECT TO authenticated
  USING (accountability_private.can_view_connection(connection_id));
CREATE POLICY "suggestion participants select"
  ON public.accountability_priority_suggestions FOR SELECT TO authenticated
  USING (accountability_private.is_permanent_user() AND accountability_private.can_view_commitment(commitment_id));
CREATE POLICY "reward participants select"
  ON public.accountability_rewards FOR SELECT TO authenticated
  USING (accountability_private.is_permanent_user() AND
    (owner_id = (SELECT auth.uid()) OR accountability_private.can_view_commitment(commitment_id)));
CREATE POLICY "reward owner inserts"
  ON public.accountability_rewards FOR INSERT TO authenticated
  WITH CHECK (accountability_private.is_permanent_user() AND owner_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.accountability_commitments c
      WHERE c.id = commitment_id AND c.owner_id = (SELECT auth.uid())));
CREATE POLICY "reward owner updates"
  ON public.accountability_rewards FOR UPDATE TO authenticated
  USING (accountability_private.is_permanent_user() AND owner_id = (SELECT auth.uid()))
  WITH CHECK (accountability_private.is_permanent_user() AND owner_id = (SELECT auth.uid()));
CREATE POLICY "reward owner deletes"
  ON public.accountability_rewards FOR DELETE TO authenticated
  USING (accountability_private.is_permanent_user() AND owner_id = (SELECT auth.uid()));
CREATE POLICY "blocker selects own blocks"
  ON public.accountability_blocks FOR SELECT TO authenticated
  USING (accountability_private.is_permanent_user() AND blocker_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.require_permanent_accountability_user()
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user_id UUID := (SELECT auth.uid());
BEGIN
  IF v_user_id IS NULL OR COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::boolean, true) THEN
    RAISE EXCEPTION 'A permanent authenticated account is required' USING ERRCODE = '42501';
  END IF;
  RETURN v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_accountability_invite(p_partner_email TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_owner UUID := public.require_permanent_accountability_user();
  v_owner_email TEXT;
  v_email TEXT := lower(trim(p_partner_email));
  v_partner UUID;
  v_token TEXT := encode(extensions.gen_random_bytes(32), 'hex');
  v_id UUID;
  v_expires TIMESTAMPTZ := NOW() + INTERVAL '7 days';
BEGIN
  IF v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR char_length(v_email) > 320 THEN
    RAISE EXCEPTION 'Invalid partner email' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_owner::text, 0));
  SELECT lower(email) INTO v_owner_email FROM auth.users
    WHERE id = v_owner AND is_anonymous IS false AND email_confirmed_at IS NOT NULL;
  IF v_owner_email IS NULL THEN RAISE EXCEPTION 'A confirmed email is required' USING ERRCODE = '42501'; END IF;
  SELECT id INTO v_partner FROM auth.users
    WHERE lower(email) = v_email AND is_anonymous IS false LIMIT 1;
  IF v_partner = v_owner THEN RAISE EXCEPTION 'Cannot invite yourself' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.accountability_memberships WHERE user_id = v_owner) THEN
    RAISE EXCEPTION 'An active accountability partner already exists' USING ERRCODE = '23505';
  END IF;
  IF v_partner IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.accountability_blocks
    WHERE (blocker_id = v_owner AND blocked_id = v_partner)
       OR (blocker_id = v_partner AND blocked_id = v_owner)
  ) THEN RAISE EXCEPTION 'This partnership is unavailable' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.accountability_connections
    WHERE status = 'invited' AND (
      owner_id = v_owner OR (
        v_partner IS NOT NULL
        AND owner_id = v_partner
        AND invitee_email_hash = extensions.digest(convert_to(v_owner_email, 'UTF8'), 'sha256')
      )
    );
  INSERT INTO public.accountability_connections(
    owner_id, invitee_email_hash, invite_token_hash, expires_at
  ) VALUES (
    v_owner,
    extensions.digest(convert_to(v_email, 'UTF8'), 'sha256'),
    extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'),
    v_expires
  ) RETURNING id INTO v_id;
  RETURN jsonb_build_object('connectionId', v_id, 'inviteToken', v_token, 'expiresAt', v_expires);
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_accountability_invite(p_invite_token pg_catalog.TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_partner UUID := public.require_permanent_accountability_user();
  v_email TEXT;
  v_owner_email TEXT;
  v_connection public.accountability_connections%ROWTYPE;
BEGIN
  IF p_invite_token IS NULL OR char_length(p_invite_token) <> 64 THEN
    RAISE EXCEPTION 'Invalid invite token' USING ERRCODE = '22023';
  END IF;
  SELECT lower(email) INTO v_email FROM auth.users
    WHERE id = v_partner AND is_anonymous IS false AND email_confirmed_at IS NOT NULL;
  IF v_email IS NULL THEN RAISE EXCEPTION 'A confirmed email is required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_connection FROM public.accountability_connections
    WHERE invite_token_hash = extensions.digest(convert_to(p_invite_token, 'UTF8'), 'sha256')
      AND status = 'invited';
  IF NOT FOUND THEN RAISE EXCEPTION 'Invite is invalid or expired' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(least(v_connection.owner_id::text, v_partner::text), 0));
  PERFORM pg_advisory_xact_lock(hashtextextended(greatest(v_connection.owner_id::text, v_partner::text), 0));
  SELECT * INTO v_connection FROM public.accountability_connections
    WHERE id = v_connection.id
      AND invite_token_hash = extensions.digest(convert_to(p_invite_token, 'UTF8'), 'sha256')
      AND status = 'invited' FOR UPDATE;
  IF NOT FOUND OR v_connection.expires_at <= NOW() THEN
    RAISE EXCEPTION 'Invite is invalid or expired' USING ERRCODE = '22023';
  END IF;
  IF v_connection.invitee_email_hash <> extensions.digest(convert_to(v_email, 'UTF8'), 'sha256') THEN
    RAISE EXCEPTION 'Invite is not for this account' USING ERRCODE = '42501';
  END IF;
  IF v_connection.owner_id = v_partner THEN RAISE EXCEPTION 'Cannot partner with yourself' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.accountability_memberships
    WHERE user_id IN (v_connection.owner_id, v_partner)) THEN
    RAISE EXCEPTION 'One of these users already has an active partner' USING ERRCODE = '23505';
  END IF;
  IF EXISTS (SELECT 1 FROM public.accountability_blocks
    WHERE (blocker_id = v_connection.owner_id AND blocked_id = v_partner)
       OR (blocker_id = v_partner AND blocked_id = v_connection.owner_id)) THEN
    RAISE EXCEPTION 'This partnership is unavailable' USING ERRCODE = '42501';
  END IF;
  SELECT lower(email) INTO v_owner_email FROM auth.users
    WHERE id = v_connection.owner_id AND is_anonymous IS false AND email_confirmed_at IS NOT NULL;
  DELETE FROM public.accountability_connections
    WHERE id <> v_connection.id AND status = 'invited' AND (
      (owner_id = v_connection.owner_id
        AND invitee_email_hash = extensions.digest(convert_to(v_email, 'UTF8'), 'sha256'))
      OR (owner_id = v_partner
        AND invitee_email_hash = extensions.digest(convert_to(v_owner_email, 'UTF8'), 'sha256'))
    );
  UPDATE public.accountability_connections SET
    partner_id = v_partner, status = 'active', used_at = NOW(), accepted_at = NOW(),
    invite_token_hash = NULL
    WHERE id = v_connection.id;
  INSERT INTO public.accountability_memberships(user_id, connection_id, counterpart_id, role)
  VALUES
    (v_connection.owner_id, v_connection.id, v_partner, 'owner'),
    (v_partner, v_connection.id, v_connection.owner_id, 'partner');
  INSERT INTO public.accountability_scope_controls(connection_id, owner_id)
    VALUES (v_connection.id, v_connection.owner_id), (v_connection.id, v_partner);
  RETURN v_connection.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.preview_accountability_invite(p_invite_token TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user UUID := public.require_permanent_accountability_user();
  v_email TEXT;
  v_connection public.accountability_connections%ROWTYPE;
BEGIN
  IF p_invite_token IS NULL OR char_length(p_invite_token) <> 64 THEN
    RETURN jsonb_build_object('status', 'revoked');
  END IF;
  SELECT lower(email) INTO v_email FROM auth.users
    WHERE id = v_user AND is_anonymous IS false AND email_confirmed_at IS NOT NULL;
  SELECT * INTO v_connection FROM public.accountability_connections
    WHERE invite_token_hash = extensions.digest(convert_to(p_invite_token, 'UTF8'), 'sha256')
    LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'revoked'); END IF;
  IF v_connection.invitee_email_hash <> extensions.digest(convert_to(v_email, 'UTF8'), 'sha256') THEN
    RAISE EXCEPTION 'Invite is not for this account' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'status', CASE
      WHEN v_connection.status <> 'invited' THEN 'used'
      WHEN v_connection.expires_at <= NOW() THEN 'expired'
      ELSE 'available'
    END,
    'expiresAt', v_connection.expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_accountability_invite(p_connection_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_owner UUID := public.require_permanent_accountability_user();
BEGIN
  DELETE FROM public.accountability_connections
    WHERE id = p_connection_id AND owner_id = v_owner AND status = 'invited';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending invite not found' USING ERRCODE = 'P0002';
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_accountability_commitment(
  p_connection_id UUID,
  p_title TEXT,
  p_cadence TEXT,
  p_note TEXT DEFAULT NULL,
  p_share_note BOOLEAN DEFAULT false
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_owner UUID := public.require_permanent_accountability_user();
  v_id UUID;
  v_title TEXT := btrim(p_title);
  v_note TEXT := NULLIF(btrim(p_note), '');
BEGIN
  IF char_length(v_title) NOT BETWEEN 1 AND 240 THEN
    RAISE EXCEPTION 'Invalid commitment title' USING ERRCODE = '22023';
  END IF;
  IF p_cadence NOT IN ('daily', 'weekly', 'custom') THEN
    RAISE EXCEPTION 'Invalid commitment cadence' USING ERRCODE = '22023';
  END IF;
  IF v_note IS NOT NULL AND char_length(v_note) > 2000 THEN
    RAISE EXCEPTION 'Commitment note is too long' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_connection_id::text, 0));
  IF NOT EXISTS (SELECT 1 FROM public.accountability_memberships
    WHERE connection_id = p_connection_id AND user_id = v_owner) THEN
    RAISE EXCEPTION 'Active connection not found' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.accountability_commitments(connection_id, owner_id, title, cadence)
  VALUES (p_connection_id, v_owner, v_title, p_cadence) RETURNING id INTO v_id;
  IF v_note IS NOT NULL THEN
    INSERT INTO public.accountability_commitment_notes(commitment_id, owner_id, body, shared_with_partner)
    VALUES (v_id, v_owner, v_note, p_share_note);
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_accountability_check_in(
  p_commitment_id UUID,
  p_shown_up_on DATE,
  p_note TEXT DEFAULT NULL,
  p_share_note BOOLEAN DEFAULT false
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_owner UUID := public.require_permanent_accountability_user();
  v_id UUID;
  v_connection UUID;
  v_note TEXT := NULLIF(btrim(p_note), '');
BEGIN
  IF p_shown_up_on IS NULL OR p_shown_up_on > CURRENT_DATE THEN
    RAISE EXCEPTION 'Invalid check-in date' USING ERRCODE = '22023';
  END IF;
  IF v_note IS NOT NULL AND char_length(v_note) > 2000 THEN
    RAISE EXCEPTION 'Check-in note is too long' USING ERRCODE = '22023';
  END IF;
  SELECT connection_id INTO v_connection FROM public.accountability_commitments
    WHERE id = p_commitment_id AND owner_id = v_owner AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active commitment not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_connection::text, 0));
  IF NOT EXISTS (SELECT 1 FROM public.accountability_memberships
    WHERE connection_id = v_connection AND user_id = v_owner) THEN
    RAISE EXCEPTION 'Active connection not found' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.accountability_check_ins(commitment_id, owner_id, shown_up_on)
  VALUES (p_commitment_id, v_owner, p_shown_up_on)
  ON CONFLICT (commitment_id, shown_up_on) DO UPDATE SET shown_up_on = EXCLUDED.shown_up_on
  RETURNING id INTO v_id;
  IF v_note IS NOT NULL THEN
    INSERT INTO public.accountability_check_in_notes(check_in_id, owner_id, body, shared_with_partner)
    VALUES (v_id, v_owner, v_note, p_share_note)
    ON CONFLICT (check_in_id) DO UPDATE SET
      body = EXCLUDED.body,
      shared_with_partner = EXCLUDED.shared_with_partner,
      updated_at = NOW();
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_accountability_commitment(p_commitment_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_owner UUID := public.require_permanent_accountability_user();
  v_connection UUID;
BEGIN
  SELECT connection_id INTO v_connection
  FROM public.accountability_commitments
  WHERE id = p_commitment_id AND owner_id = v_owner AND status <> 'archived';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commitment not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_connection::text, 0));
  UPDATE public.accountability_commitments
  SET status = 'archived', updated_at = NOW()
  WHERE id = p_commitment_id AND owner_id = v_owner;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_accountability_commitment_note_sharing(
  p_commitment_id UUID, p_shared BOOLEAN
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_owner UUID := public.require_permanent_accountability_user();
BEGIN
  UPDATE public.accountability_commitment_notes
  SET shared_with_partner = p_shared, updated_at = NOW()
  WHERE commitment_id = p_commitment_id AND owner_id = v_owner;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commitment note not found' USING ERRCODE = 'P0002'; END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_accountability_check_in_note_sharing(
  p_check_in_id UUID, p_shared BOOLEAN
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_owner UUID := public.require_permanent_accountability_user();
BEGIN
  UPDATE public.accountability_check_in_notes
  SET shared_with_partner = p_shared, updated_at = NOW()
  WHERE check_in_id = p_check_in_id AND owner_id = v_owner;
  IF NOT FOUND THEN RAISE EXCEPTION 'Check-in note not found' USING ERRCODE = 'P0002'; END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.end_accountability_connection(p_connection_id UUID, p_action TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user UUID := public.require_permanent_accountability_user();
  v_connection public.accountability_connections%ROWTYPE;
  v_owner_email TEXT;
  v_partner_email TEXT;
BEGIN
  IF p_action NOT IN ('revoke', 'block') THEN RAISE EXCEPTION 'Invalid action' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_connection_id::text, 0));
  SELECT * INTO v_connection FROM public.accountability_connections
    WHERE id = p_connection_id AND status = 'active'
      AND v_user IN (owner_id, partner_id) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active connection not found' USING ERRCODE = 'P0002'; END IF;
  UPDATE public.accountability_connections SET status = CASE WHEN p_action = 'block' THEN 'blocked' ELSE 'revoked' END,
    ended_at = NOW(), ended_by = v_user, invite_token_hash = NULL WHERE id = p_connection_id;
  DELETE FROM public.accountability_memberships WHERE connection_id = p_connection_id;
  SELECT lower(email) INTO v_owner_email FROM auth.users WHERE id = v_connection.owner_id;
  SELECT lower(email) INTO v_partner_email FROM auth.users WHERE id = v_connection.partner_id;
  DELETE FROM public.accountability_connections
    WHERE id <> p_connection_id AND status = 'invited' AND (
      (owner_id = v_connection.owner_id
        AND invitee_email_hash = extensions.digest(convert_to(v_partner_email, 'UTF8'), 'sha256'))
      OR (owner_id = v_connection.partner_id
        AND invitee_email_hash = extensions.digest(convert_to(v_owner_email, 'UTF8'), 'sha256'))
    );
  IF p_action = 'block' THEN
    INSERT INTO public.accountability_blocks(blocker_id, blocked_id)
    VALUES (v_user, CASE WHEN v_user = v_connection.owner_id THEN v_connection.partner_id ELSE v_connection.owner_id END)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_accountability_nudge(
  p_connection_id UUID, p_commitment_id UUID, p_kind TEXT
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_sender UUID := public.require_permanent_accountability_user();
  v_recipient UUID;
  v_id UUID;
BEGIN
  IF p_kind NOT IN ('encouragement', 'gentle_reminder', 'celebrate_progress') THEN
    RAISE EXCEPTION 'Invalid nudge template' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_connection_id::text, 0));
  SELECT counterpart_id INTO v_recipient FROM public.accountability_memberships
    WHERE user_id = v_sender AND connection_id = p_connection_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active connection not found' USING ERRCODE = '42501'; END IF;
  IF p_commitment_id IS NOT NULL AND (NOT accountability_private.can_view_commitment(p_commitment_id) OR NOT EXISTS (
    SELECT 1 FROM public.accountability_commitments
    WHERE id = p_commitment_id AND connection_id = p_connection_id AND owner_id = v_recipient
  )) THEN RAISE EXCEPTION 'Commitment not found' USING ERRCODE = 'P0002'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_connection_id::text || v_sender::text, 0));
  IF (SELECT count(*) FROM public.accountability_nudges
      WHERE connection_id = p_connection_id AND sender_id = v_sender
        AND created_at >= NOW() - INTERVAL '1 hour') >= 1
    OR (SELECT count(*) FROM public.accountability_nudges
      WHERE connection_id = p_connection_id AND sender_id = v_sender
        AND created_at >= NOW() - INTERVAL '24 hours') >= 3 THEN
    RAISE EXCEPTION 'Nudge rate limit exceeded' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.accountability_nudges(connection_id, commitment_id, sender_id, recipient_id, kind)
  VALUES (p_connection_id, p_commitment_id, v_sender, v_recipient, p_kind) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_accountability_comment(
  p_commitment_id UUID, p_body TEXT
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_author UUID := public.require_permanent_accountability_user();
  v_id UUID;
  v_connection UUID;
BEGIN
  IF char_length(btrim(p_body)) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'Invalid comment' USING ERRCODE = '22023';
  END IF;
  SELECT connection_id INTO v_connection FROM public.accountability_commitments
    WHERE id = p_commitment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shared commitment not found' USING ERRCODE = 'P0002'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_connection::text, 0));
  IF NOT accountability_private.can_view_commitment(p_commitment_id) THEN
    RAISE EXCEPTION 'Shared commitment not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_commitment_id::text || v_author::text, 0));
  IF (SELECT count(*) FROM public.accountability_comments
      WHERE commitment_id = p_commitment_id AND author_id = v_author
        AND created_at >= NOW() - INTERVAL '1 hour') >= 20 THEN
    RAISE EXCEPTION 'Comment rate limit exceeded' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.accountability_comments(commitment_id, author_id, body)
  VALUES (p_commitment_id, v_author, btrim(p_body)) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.propose_accountability_priority(
  p_commitment_id UUID, p_priority TEXT, p_note TEXT DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user UUID := public.require_permanent_accountability_user(); v_id UUID; v_connection UUID;
BEGIN
  IF p_priority NOT IN ('high', 'medium', 'low') THEN RAISE EXCEPTION 'Invalid priority' USING ERRCODE = '22023'; END IF;
  IF p_note IS NOT NULL AND char_length(btrim(p_note)) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'Invalid suggestion note' USING ERRCODE = '22023';
  END IF;
  SELECT connection_id INTO v_connection FROM public.accountability_commitments
    WHERE id = p_commitment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shared commitment not found' USING ERRCODE = 'P0002'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_connection::text, 0));
  IF NOT accountability_private.can_view_commitment(p_commitment_id) OR NOT EXISTS (
    SELECT 1 FROM public.accountability_commitments c
    JOIN public.accountability_memberships m ON m.connection_id = c.connection_id
    WHERE c.id = p_commitment_id AND m.user_id = v_user AND c.owner_id <> v_user
  ) THEN RAISE EXCEPTION 'Only the active partner can suggest priority' USING ERRCODE = '42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_commitment_id::text || v_user::text, 0));
  IF (SELECT count(*) FROM public.accountability_priority_suggestions
      WHERE commitment_id = p_commitment_id AND suggested_by = v_user
        AND status = 'pending') >= 5 THEN
    RAISE EXCEPTION 'Too many pending suggestions' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.accountability_priority_suggestions(commitment_id, suggested_by, suggested_priority, note)
  VALUES (p_commitment_id, v_user, p_priority, btrim(p_note)) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_accountability_priority(p_suggestion_id UUID, p_approved BOOLEAN)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_owner UUID := public.require_permanent_accountability_user(); v_suggestion public.accountability_priority_suggestions%ROWTYPE; v_connection UUID;
BEGIN
  SELECT s.* INTO v_suggestion FROM public.accountability_priority_suggestions s
  JOIN public.accountability_commitments c ON c.id = s.commitment_id
  WHERE s.id = p_suggestion_id AND s.status = 'pending' AND c.owner_id = v_owner FOR UPDATE OF s;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pending suggestion not found' USING ERRCODE = 'P0002'; END IF;
  SELECT connection_id INTO v_connection FROM public.accountability_commitments
    WHERE id = v_suggestion.commitment_id;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_connection::text, 0));
  IF NOT EXISTS (SELECT 1 FROM public.accountability_memberships
    WHERE connection_id = v_connection AND user_id = v_owner) THEN
    RAISE EXCEPTION 'Active connection not found' USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.accountability_priority_suggestions
    SET status = CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END, responded_at = NOW()
    WHERE id = p_suggestion_id;
  IF p_approved THEN
    UPDATE public.accountability_commitments SET priority = v_suggestion.suggested_priority, updated_at = NOW()
      WHERE id = v_suggestion.commitment_id AND owner_id = v_owner;
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_accountability_reward(
  p_commitment_id UUID, p_description TEXT
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_owner UUID := public.require_permanent_accountability_user(); v_connection UUID; v_id UUID;
BEGIN
  IF char_length(btrim(p_description)) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'Invalid reward' USING ERRCODE = '22023';
  END IF;
  SELECT connection_id INTO v_connection FROM public.accountability_commitments
    WHERE id = p_commitment_id AND owner_id = v_owner;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commitment not found' USING ERRCODE = 'P0002'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_connection::text, 0));
  IF NOT EXISTS (SELECT 1 FROM public.accountability_memberships
    WHERE connection_id = v_connection AND user_id = v_owner) THEN
    RAISE EXCEPTION 'Active connection not found' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.accountability_rewards(commitment_id, owner_id, description)
  VALUES (p_commitment_id, v_owner, btrim(p_description))
  ON CONFLICT (commitment_id) DO UPDATE SET
    description = EXCLUDED.description, updated_at = NOW()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_accountability_scope(
  p_connection_id UUID, p_shares_progress BOOLEAN,
  p_shares_commitment_titles BOOLEAN, p_shares_notes BOOLEAN
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_owner UUID := public.require_permanent_accountability_user();
BEGIN
  IF p_shares_progress IS NULL OR p_shares_commitment_titles IS NULL OR p_shares_notes IS NULL THEN
    RAISE EXCEPTION 'Invalid scope control' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_connection_id::text, 0));
  UPDATE public.accountability_scope_controls SET
    shares_progress = p_shares_progress,
    shares_commitment_titles = p_shares_commitment_titles,
    shares_notes = p_shares_notes,
    updated_at = NOW()
  WHERE connection_id = p_connection_id AND owner_id = v_owner
    AND EXISTS (SELECT 1 FROM public.accountability_memberships
      WHERE connection_id = p_connection_id AND user_id = v_owner);
  IF NOT FOUND THEN RAISE EXCEPTION 'Active connection not found' USING ERRCODE = 'P0002'; END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_accountability_check_in_dates(
  p_connection_id UUID, p_window_start DATE, p_window_end DATE
)
RETURNS TABLE(shown_up_on DATE)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user UUID := public.require_permanent_accountability_user();
BEGIN
  IF p_window_start IS NULL OR p_window_end IS NULL
    OR p_window_end < p_window_start OR p_window_end - p_window_start > 13 THEN
    RAISE EXCEPTION 'Invalid progress window' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.accountability_memberships
    WHERE connection_id = p_connection_id AND user_id = v_user
  ) THEN
    RAISE EXCEPTION 'Active connection not found' USING ERRCODE = 'P0002';
  END IF;
  RETURN QUERY
    SELECT DISTINCT ci.shown_up_on
    FROM public.accountability_check_ins ci
    JOIN public.accountability_commitments c ON c.id = ci.commitment_id
    JOIN public.accountability_scope_controls s
      ON s.connection_id = c.connection_id AND s.owner_id = c.owner_id
    WHERE c.connection_id = p_connection_id
      AND ci.shown_up_on BETWEEN p_window_start AND p_window_end
      AND (c.owner_id = v_user OR s.shares_progress);
END;
$$;

-- Include accountability rows in the existing transactional deletion contract.
CREATE OR REPLACE FUNCTION public.delete_owned_data(p_user_id UUID, p_session_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (p_user_id IS NULL) = (p_session_id IS NULL) THEN RAISE EXCEPTION 'Exactly one owner identifier is required'; END IF;
  IF p_user_id IS NOT NULL THEN
    -- A pending invite has no counterpart data. Active or ended partnerships are
    -- retained so deleting one account never erases the other person's history.
    DELETE FROM public.accountability_connections
      WHERE owner_id = p_user_id AND status = 'invited';
    UPDATE public.accountability_connections
      SET status = 'revoked', ended_at = COALESCE(ended_at, NOW()),
        ended_by = p_user_id, invite_token_hash = NULL
      WHERE owner_id = p_user_id OR partner_id = p_user_id;
    DELETE FROM public.accountability_memberships
      WHERE connection_id IN (
        SELECT id FROM public.accountability_connections
        WHERE owner_id = p_user_id OR partner_id = p_user_id
      );
    DELETE FROM public.accountability_comments WHERE author_id = p_user_id;
    DELETE FROM public.accountability_nudges
      WHERE sender_id = p_user_id OR recipient_id = p_user_id;
    DELETE FROM public.accountability_priority_suggestions WHERE suggested_by = p_user_id;
    DELETE FROM public.accountability_commitments WHERE owner_id = p_user_id;
    DELETE FROM public.accountability_scope_controls WHERE owner_id = p_user_id;
    DELETE FROM public.accountability_blocks WHERE blocker_id = p_user_id OR blocked_id = p_user_id;
    UPDATE public.accountability_connections SET
      owner_id = CASE WHEN owner_id = p_user_id THEN NULL ELSE owner_id END,
      partner_id = CASE WHEN partner_id = p_user_id THEN NULL ELSE partner_id END,
      ended_by = CASE WHEN ended_by = p_user_id THEN NULL ELSE ended_by END
      WHERE owner_id = p_user_id OR partner_id = p_user_id OR ended_by = p_user_id;
    DELETE FROM public.ai_response_reports WHERE user_id = p_user_id;
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

REVOKE ALL ON public.accountability_connections, public.accountability_memberships,
  public.accountability_scope_controls, public.accountability_commitments,
  public.accountability_check_ins, public.accountability_commitment_notes,
  public.accountability_check_in_notes,
  public.accountability_comments, public.accountability_nudges,
  public.accountability_priority_suggestions, public.accountability_rewards,
  public.accountability_blocks FROM anon, authenticated;
GRANT SELECT ON public.accountability_connections, public.accountability_memberships,
  public.accountability_scope_controls, public.accountability_commitments,
  public.accountability_check_ins, public.accountability_commitment_notes,
  public.accountability_check_in_notes,
  public.accountability_comments, public.accountability_nudges,
  public.accountability_priority_suggestions, public.accountability_rewards,
  public.accountability_blocks TO authenticated;
GRANT DELETE ON public.accountability_check_ins TO authenticated;

REVOKE ALL ON FUNCTION public.require_permanent_accountability_user() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_accountability_invite(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_accountability_invite(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.preview_accountability_invite(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_accountability_invite(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_accountability_commitment(UUID, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_accountability_check_in(UUID, DATE, TEXT, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.archive_accountability_commitment(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_accountability_commitment_note_sharing(UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_accountability_check_in_note_sharing(UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.end_accountability_connection(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.send_accountability_nudge(UUID, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_accountability_comment(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.propose_accountability_priority(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_accountability_priority(UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_accountability_check_in_dates(UUID, DATE, DATE) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_accountability_reward(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_accountability_scope(UUID, BOOLEAN, BOOLEAN, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_accountability_invite(TEXT),
  public.accept_accountability_invite(TEXT), public.preview_accountability_invite(TEXT),
  public.cancel_accountability_invite(UUID),
  public.create_accountability_commitment(UUID, TEXT, TEXT, TEXT, BOOLEAN),
  public.create_accountability_check_in(UUID, DATE, TEXT, BOOLEAN),
  public.archive_accountability_commitment(UUID),
  public.set_accountability_commitment_note_sharing(UUID, BOOLEAN),
  public.set_accountability_check_in_note_sharing(UUID, BOOLEAN),
  public.end_accountability_connection(UUID, TEXT),
  public.send_accountability_nudge(UUID, UUID, TEXT),
  public.create_accountability_comment(UUID, TEXT),
  public.propose_accountability_priority(UUID, TEXT, TEXT),
  public.respond_accountability_priority(UUID, BOOLEAN),
  public.get_accountability_check_in_dates(UUID, DATE, DATE),
  public.set_accountability_reward(UUID, TEXT),
  public.update_accountability_scope(UUID, BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated;
REVOKE ALL ON FUNCTION public.delete_owned_data(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_owned_data(UUID, TEXT) TO service_role;
