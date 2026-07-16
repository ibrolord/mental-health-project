-- Supabase anonymous users receive a normal JWT with role "authenticated".
-- New clients therefore store every user's data under auth.uid()/user_id.

-- Remove the original policies before replacing them with explicit role-scoped
-- owner policies.
DROP POLICY IF EXISTS "Users can read their own anonymous session" ON public.anonymous_sessions;
DROP POLICY IF EXISTS "Users can create anonymous sessions" ON public.anonymous_sessions;
DROP POLICY IF EXISTS "Users can update their own session" ON public.anonymous_sessions;

DROP POLICY IF EXISTS "Users can read their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;

DROP POLICY IF EXISTS "Users can read their own moods" ON public.moods;
DROP POLICY IF EXISTS "Users can insert their own moods" ON public.moods;
DROP POLICY IF EXISTS "Users can update their own moods" ON public.moods;
DROP POLICY IF EXISTS "Users can delete their own moods" ON public.moods;

DROP POLICY IF EXISTS "Users can read their own assessments" ON public.assessments;
DROP POLICY IF EXISTS "Users can insert their own assessments" ON public.assessments;
DROP POLICY IF EXISTS "Users can delete their own assessments" ON public.assessments;

DROP POLICY IF EXISTS "Users can read their own goals" ON public.goals;
DROP POLICY IF EXISTS "Users can insert their own goals" ON public.goals;
DROP POLICY IF EXISTS "Users can update their own goals" ON public.goals;
DROP POLICY IF EXISTS "Users can delete their own goals" ON public.goals;

DROP POLICY IF EXISTS "Users can read their own habits" ON public.habits;
DROP POLICY IF EXISTS "Users can insert their own habits" ON public.habits;
DROP POLICY IF EXISTS "Users can update their own habits" ON public.habits;
DROP POLICY IF EXISTS "Users can delete their own habits" ON public.habits;

DROP POLICY IF EXISTS "Users can read their own habit logs" ON public.habit_logs;
DROP POLICY IF EXISTS "Users can insert their own habit logs" ON public.habit_logs;
DROP POLICY IF EXISTS "Users can update their own habit logs" ON public.habit_logs;

DROP POLICY IF EXISTS "Users can read their own chat history" ON public.chat_history;
DROP POLICY IF EXISTS "Users can insert their own chat history" ON public.chat_history;
DROP POLICY IF EXISTS "Users can update their own chat history" ON public.chat_history;
DROP POLICY IF EXISTS "Users can delete their own chat history" ON public.chat_history;

DROP POLICY IF EXISTS "Anyone can read affirmations" ON public.affirmations;

DROP POLICY IF EXISTS "Users can read their own affirmation history" ON public.user_affirmation_history;
DROP POLICY IF EXISTS "Users can insert their own affirmation history" ON public.user_affirmation_history;

DROP POLICY IF EXISTS "Anyone can read books" ON public.books;

DROP POLICY IF EXISTS "Users can read their own book favorites" ON public.user_book_favorites;
DROP POLICY IF EXISTS "Users can insert their own book favorites" ON public.user_book_favorites;
DROP POLICY IF EXISTS "Users can delete their own book favorites" ON public.user_book_favorites;

DROP POLICY IF EXISTS "Users can read their own migration records" ON public.user_data_migration;
DROP POLICY IF EXISTS "Users can insert their own migration records" ON public.user_data_migration;

-- Permanent accounts and Supabase anonymous accounts both use these owner-only
-- policies. A JWT is required because these policies apply only to authenticated.
CREATE POLICY "Authenticated users can select their profile"
  ON public.user_profiles FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id);
CREATE POLICY "Authenticated users can insert their profile"
  ON public.user_profiles FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);
CREATE POLICY "Authenticated users can update their profile"
  ON public.user_profiles FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);
CREATE POLICY "Authenticated users can delete their profile"
  ON public.user_profiles FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "Authenticated users own moods"
  ON public.moods FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id AND session_id IS NULL);

CREATE POLICY "Authenticated users own assessments"
  ON public.assessments FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id AND session_id IS NULL);

CREATE POLICY "Authenticated users own goals"
  ON public.goals FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id AND session_id IS NULL);

CREATE POLICY "Authenticated users own habits"
  ON public.habits FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id AND session_id IS NULL);

CREATE POLICY "Authenticated users own habit logs"
  ON public.habit_logs FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.habits
      WHERE habits.id = habit_logs.habit_id
        AND habits.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.habits
      WHERE habits.id = habit_logs.habit_id
        AND habits.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Authenticated users own chat history"
  ON public.chat_history FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id AND session_id IS NULL);

CREATE POLICY "Authenticated users own affirmation history"
  ON public.user_affirmation_history FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id AND session_id IS NULL);

CREATE POLICY "Authenticated users own book favorites"
  ON public.user_book_favorites FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id AND session_id IS NULL);

CREATE POLICY "Authenticated users can select their migration records"
  ON public.user_data_migration FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Authenticated users can insert their migration records"
  ON public.user_data_migration FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Public can read affirmations"
  ON public.affirmations FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY "Public can read books"
  ON public.books FOR SELECT TO anon, authenticated
  USING (true);

-- No anon policies are recreated for user-owned data. This intentionally
-- retires direct database access from legacy iOS build 25 rather than retaining
-- globally readable mental-health rows. The replacement client can still claim
-- its locally held UUID through the service-role-only migration function below.

-- Atomically claim data created by a legacy local session. The API verifies the
-- caller's JWT and supplies that user's ID; clients cannot execute this function.
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

  IF EXISTS (SELECT 1 FROM public.moods WHERE session_id = p_legacy_session_id)
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

-- AI response reports are written only by the backend service role. Clients
-- receive a signed token from /api/chat and never receive direct table access.
CREATE TABLE public.ai_response_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_hash TEXT NOT NULL,
  response_hash TEXT NOT NULL,
  reported_response TEXT NOT NULL CHECK (char_length(reported_response) BETWEEN 1 AND 8000),
  model TEXT NOT NULL CHECK (model IN ('gemini', 'claude', 'safety')),
  reason TEXT NOT NULL CHECK (reason IN ('harmful', 'dangerous', 'incorrect', 'offensive', 'other')),
  details TEXT CHECK (details IS NULL OR char_length(details) <= 1000),
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  app_version TEXT NOT NULL CHECK (char_length(app_version) BETWEEN 1 AND 50),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- The daily purge may run almost 24 hours after expiry. Expiring at 89 days
  -- keeps actual retention below the published 90-day maximum.
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '89 days'),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT
);

ALTER TABLE public.ai_response_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_response_reports FROM anon, authenticated;

CREATE INDEX idx_ai_response_reports_subject_created
  ON public.ai_response_reports(subject_hash, created_at DESC);
CREATE INDEX idx_ai_response_reports_status_created
  ON public.ai_response_reports(status, created_at ASC);
CREATE INDEX idx_ai_response_reports_expires_at
  ON public.ai_response_reports(expires_at);

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
SELECT cron.schedule(
  'purge-expired-ai-response-reports',
  '17 3 * * *',
  $cron$DELETE FROM public.ai_response_reports WHERE expires_at <= NOW()$cron$
);

CREATE OR REPLACE FUNCTION public.submit_ai_response_report(
  p_max_reports_per_hour INTEGER,
  p_response_id UUID,
  p_user_id UUID,
  p_subject_hash TEXT,
  p_response_hash TEXT,
  p_reported_response TEXT,
  p_model TEXT,
  p_reason TEXT,
  p_details TEXT,
  p_platform TEXT,
  p_app_version TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_recent_count INTEGER;
  v_existing_user_id UUID;
  v_existing_subject_hash TEXT;
  v_existing_response_hash TEXT;
BEGIN
  IF p_max_reports_per_hour < 1 OR p_max_reports_per_hour > 100 THEN
    RAISE EXCEPTION 'Invalid report limit';
  END IF;

  -- Serialize requests for one subject so concurrent requests cannot bypass
  -- the hourly database-backed limit.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_subject_hash, 0));

  SELECT user_id, subject_hash, response_hash
  INTO v_existing_user_id, v_existing_subject_hash, v_existing_response_hash
  FROM public.ai_response_reports
  WHERE response_id = p_response_id;

  IF FOUND THEN
    IF v_existing_user_id = p_user_id
      AND v_existing_subject_hash = p_subject_hash
      AND v_existing_response_hash = p_response_hash
    THEN
      RETURN 'already_inserted';
    END IF;
    RAISE EXCEPTION 'Response report ID is already bound to different content';
  END IF;

  SELECT COUNT(*)
  INTO v_recent_count
  FROM public.ai_response_reports
  WHERE subject_hash = p_subject_hash
    AND created_at >= NOW() - INTERVAL '1 hour';

  IF v_recent_count >= p_max_reports_per_hour THEN
    RETURN 'rate_limited';
  END IF;

  INSERT INTO public.ai_response_reports (
    response_id,
    user_id,
    subject_hash,
    response_hash,
    reported_response,
    model,
    reason,
    details,
    platform,
    app_version
  ) VALUES (
    p_response_id,
    p_user_id,
    p_subject_hash,
    p_response_hash,
    p_reported_response,
    p_model,
    p_reason,
    p_details,
    p_platform,
    p_app_version
  );

  RETURN 'inserted';
END;
$$;

REVOKE ALL ON FUNCTION public.submit_ai_response_report(
  integer, uuid, uuid, text, text, text, text, text, text, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_ai_response_report(
  integer, uuid, uuid, text, text, text, text, text, text, text, text
) TO service_role;

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

REVOKE ALL ON FUNCTION public.delete_owned_data(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_owned_data(uuid, text) TO service_role;
