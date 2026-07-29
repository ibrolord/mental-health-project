-- Legacy session validation now runs only through backend service-role routes.
-- Remove the unused Data API grants in addition to the table's fail-closed RLS.
REVOKE ALL ON TABLE public.anonymous_sessions FROM anon, authenticated;

-- Cover remaining foreign keys used by account deletion and parent-row cleanup.
CREATE INDEX IF NOT EXISTS ai_response_reports_user_id_idx
  ON public.ai_response_reports(user_id);

CREATE INDEX IF NOT EXISTS user_affirmation_history_affirmation_id_idx
  ON public.user_affirmation_history(affirmation_id);

CREATE INDEX IF NOT EXISTS user_affirmation_history_session_id_idx
  ON public.user_affirmation_history(session_id);

CREATE INDEX IF NOT EXISTS user_affirmation_history_user_id_idx
  ON public.user_affirmation_history(user_id);

CREATE INDEX IF NOT EXISTS user_book_favorites_book_id_idx
  ON public.user_book_favorites(book_id);

CREATE INDEX IF NOT EXISTS user_data_migration_user_id_idx
  ON public.user_data_migration(user_id);
