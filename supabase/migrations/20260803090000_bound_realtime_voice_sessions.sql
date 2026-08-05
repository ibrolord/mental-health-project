-- Bound Realtime transcription spend without retaining audio, transcripts, or raw IDs.
CREATE TABLE IF NOT EXISTS public.realtime_voice_session_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_hash TEXT NOT NULL CHECK (length(subject_hash) = 64),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'ended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 minutes'),
  provider_call_id TEXT UNIQUE CHECK (
    provider_call_id IS NULL OR provider_call_id ~ '^rtc_[A-Za-z0-9_-]{1,120}$'
  ),
  session_expires_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  end_reason TEXT CHECK (
    end_reason IS NULL OR end_reason IN (
      'server_hangup_requested',
      'provider_already_ended',
      'server_hangup_failed'
    )
  )
);

ALTER TABLE public.realtime_voice_session_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.realtime_voice_session_grants FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.realtime_voice_session_grants TO service_role;

CREATE INDEX IF NOT EXISTS realtime_voice_session_grants_subject_created_idx
  ON public.realtime_voice_session_grants (subject_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS realtime_voice_session_grants_expires_idx
  ON public.realtime_voice_session_grants (expires_at);

CREATE OR REPLACE FUNCTION public.claim_realtime_voice_session(
  p_subject_hash TEXT,
  p_hourly_limit INTEGER,
  p_daily_limit INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_grant_id UUID;
  v_hourly_count INTEGER;
  v_daily_count INTEGER;
BEGIN
  IF p_subject_hash IS NULL
    OR length(p_subject_hash) <> 64
    OR p_hourly_limit < 1
    OR p_daily_limit < p_hourly_limit
    OR p_daily_limit > 24
  THEN
    RAISE EXCEPTION 'Invalid Realtime voice limit input';
  END IF;

  -- Prevent simultaneous requests for one subject from bypassing the quota.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_subject_hash, 0));

  DELETE FROM public.realtime_voice_session_grants
  WHERE subject_hash = p_subject_hash
    AND expires_at <= NOW();

  SELECT COUNT(*) INTO v_hourly_count
  FROM public.realtime_voice_session_grants
  WHERE subject_hash = p_subject_hash
    AND created_at >= NOW() - INTERVAL '1 hour';

  IF v_hourly_count >= p_hourly_limit THEN
    RETURN jsonb_build_object('status', 'hourly_limit');
  END IF;

  SELECT COUNT(*) INTO v_daily_count
  FROM public.realtime_voice_session_grants
  WHERE subject_hash = p_subject_hash
    AND created_at >= NOW() - INTERVAL '24 hours';

  IF v_daily_count >= p_daily_limit THEN
    RETURN jsonb_build_object('status', 'daily_limit');
  END IF;

  INSERT INTO public.realtime_voice_session_grants (subject_hash)
  VALUES (p_subject_hash)
  RETURNING id INTO v_grant_id;

  RETURN jsonb_build_object('status', 'allowed', 'grant_id', v_grant_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.register_realtime_voice_session(
  p_grant_id UUID,
  p_subject_hash TEXT,
  p_provider_call_id TEXT,
  p_session_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_session_seconds < 1
    OR p_session_seconds > 600
    OR p_provider_call_id !~ '^rtc_[A-Za-z0-9_-]{1,120}$'
  THEN
    RAISE EXCEPTION 'Invalid Realtime voice session duration';
  END IF;

  UPDATE public.realtime_voice_session_grants
  SET provider_call_id = p_provider_call_id,
      session_expires_at = NOW() + make_interval(secs => p_session_seconds),
      expires_at = NOW() + INTERVAL '2 minutes'
  WHERE id = p_grant_id
    AND subject_hash = p_subject_hash
    AND status = 'pending'
    AND provider_call_id IS NULL
    AND expires_at > NOW();
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_realtime_voice_session(
  p_grant_id UUID,
  p_subject_hash TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.realtime_voice_session_grants
  SET status = 'active',
      -- Quota windows start only after the client confirms a usable data channel.
      created_at = NOW(),
      expires_at = NOW() + INTERVAL '24 hours'
  WHERE id = p_grant_id
    AND subject_hash = p_subject_hash
    AND status = 'pending'
    AND provider_call_id IS NOT NULL
    AND expires_at > NOW();
  IF FOUND THEN
    RETURN 'confirmed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.realtime_voice_session_grants
    WHERE id = p_grant_id
      AND subject_hash = p_subject_hash
      AND status = 'active'
  ) THEN
    RETURN 'already_active';
  END IF;
  RETURN 'not_found';
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_realtime_voice_session(
  p_grant_id UUID,
  p_subject_hash TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_provider_call_id TEXT;
BEGIN
  DELETE FROM public.realtime_voice_session_grants
  WHERE id = p_grant_id
    AND subject_hash = p_subject_hash
    AND status = 'pending'
    AND provider_call_id IS NOT NULL
  RETURNING provider_call_id INTO v_provider_call_id;
  RETURN v_provider_call_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_realtime_voice_session(
  p_grant_id UUID,
  p_subject_hash TEXT,
  p_end_reason TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_end_reason NOT IN (
    'server_hangup_requested',
    'provider_already_ended',
    'server_hangup_failed'
  ) THEN
    RAISE EXCEPTION 'Invalid Realtime voice end reason';
  END IF;

  UPDATE public.realtime_voice_session_grants
  SET status = 'ended',
      ended_at = NOW(),
      end_reason = p_end_reason
  WHERE id = p_grant_id
    AND subject_hash = p_subject_hash
    AND status = 'active';
  IF FOUND THEN
    RETURN 'active_ended';
  END IF;

  DELETE FROM public.realtime_voice_session_grants
  WHERE id = p_grant_id
    AND subject_hash = p_subject_hash
    AND status = 'pending';
  IF FOUND THEN
    RETURN 'pending_released';
  END IF;
  RETURN 'not_found';
END;
$$;

CREATE OR REPLACE FUNCTION public.release_realtime_voice_session(
  p_grant_id UUID,
  p_subject_hash TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.realtime_voice_session_grants
  WHERE id = p_grant_id
    AND subject_hash = p_subject_hash
    AND status = 'pending';
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_realtime_voice_session(TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.register_realtime_voice_session(UUID, TEXT, TEXT, INTEGER)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_realtime_voice_session(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_realtime_voice_session(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_realtime_voice_session(UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_realtime_voice_session(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_realtime_voice_session(TEXT, INTEGER, INTEGER)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.register_realtime_voice_session(UUID, TEXT, TEXT, INTEGER)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_realtime_voice_session(UUID, TEXT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_realtime_voice_session(UUID, TEXT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_realtime_voice_session(UUID, TEXT, TEXT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.release_realtime_voice_session(UUID, TEXT)
  TO service_role;
