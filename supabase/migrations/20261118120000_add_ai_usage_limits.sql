-- OPTIONAL: durable store for AI usage limits (lib/ai/usage-limit.ts).
--
-- The app does not need this migration. Without it, AI usage limits run in
-- memory per Vercel instance. After applying it, set
-- AI_USAGE_LIMIT_STORE=supabase to share counters across instances. If the
-- RPC errors, the server falls back to in-memory limits.
--
-- Keys are SHA-256 digests built on the server; no raw user id or IP address
-- is stored. Rows are fixed-window counters and are useless after the window
-- ends, so they are purged daily.

CREATE TABLE IF NOT EXISTS public.ai_usage_counters (
  counter_key TEXT NOT NULL CHECK (char_length(counter_key) BETWEEN 1 AND 200),
  window_start TIMESTAMPTZ NOT NULL,
  window_seconds INTEGER NOT NULL CHECK (window_seconds BETWEEN 1 AND 604800),
  hit_count INTEGER NOT NULL DEFAULT 0 CHECK (hit_count >= 0),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (counter_key, window_seconds, window_start)
);

CREATE INDEX IF NOT EXISTS ai_usage_counters_expires_at_idx
  ON public.ai_usage_counters (expires_at);

ALTER TABLE public.ai_usage_counters ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (which bypasses RLS) may touch it.
REVOKE ALL ON TABLE public.ai_usage_counters FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_ai_usage(
  p_key TEXT,
  p_window_start TIMESTAMPTZ,
  p_window_seconds INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_key IS NULL OR char_length(p_key) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'Invalid usage key';
  END IF;
  IF p_window_seconds IS NULL OR p_window_seconds NOT BETWEEN 1 AND 604800 THEN
    RAISE EXCEPTION 'Invalid usage window';
  END IF;

  INSERT INTO public.ai_usage_counters AS c
    (counter_key, window_start, window_seconds, hit_count, expires_at)
  VALUES
    (p_key, p_window_start, p_window_seconds, 1,
     p_window_start + make_interval(secs => p_window_seconds))
  ON CONFLICT (counter_key, window_seconds, window_start)
  DO UPDATE SET hit_count = c.hit_count + 1
  RETURNING c.hit_count INTO v_count;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_usage(TEXT, TIMESTAMPTZ, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_usage(TEXT, TIMESTAMPTZ, INTEGER)
  TO service_role;

CREATE OR REPLACE FUNCTION public.purge_expired_ai_usage_counters()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.ai_usage_counters WHERE expires_at < NOW() - INTERVAL '1 hour';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_ai_usage_counters()
  FROM PUBLIC, anon, authenticated;

-- pg_cron is installed on this project (see purge-expired-ai-response-reports).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'purge-expired-ai-usage-counters',
      '17 * * * *',
      'SELECT public.purge_expired_ai_usage_counters()'
    );
  END IF;
END;
$$;
