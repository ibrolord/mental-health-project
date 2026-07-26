CREATE TABLE public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  prompt TEXT,
  entry_kind TEXT NOT NULL DEFAULT 'freeform',
  linked_book_id TEXT,
  linked_book_title TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT journal_title_length CHECK (
    char_length(btrim(title)) BETWEEN 1 AND 160
  ),
  CONSTRAINT journal_content_length CHECK (
    char_length(btrim(content)) BETWEEN 1 AND 12000
  ),
  CONSTRAINT journal_prompt_length CHECK (
    prompt IS NULL OR char_length(prompt) <= 500
  ),
  CONSTRAINT journal_entry_kind_check CHECK (
    entry_kind IN ('freeform', 'guided', 'book_note')
  ),
  CONSTRAINT journal_linked_book_id_length CHECK (
    linked_book_id IS NULL OR char_length(linked_book_id) <= 120
  ),
  CONSTRAINT journal_linked_book_title_length CHECK (
    linked_book_title IS NULL OR char_length(linked_book_title) <= 200
  ),
  CONSTRAINT journal_tag_count CHECK (cardinality(tags) <= 12)
);

CREATE INDEX journal_entries_user_created_idx
  ON public.journal_entries (user_id, created_at DESC);

CREATE INDEX journal_entries_tags_idx
  ON public.journal_entries USING GIN (tags);

COMMENT ON TABLE public.journal_entries IS
  'Private user-authored journal entries. Content is never shared across users.';

REVOKE ALL ON TABLE public.journal_entries
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.journal_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.journal_entries TO service_role;

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their journal entries"
  ON public.journal_entries
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create their journal entries"
  ON public.journal_entries
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their journal entries"
  ON public.journal_entries
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their journal entries"
  ON public.journal_entries
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

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
    DELETE FROM public.acquisition_attribution WHERE user_id = p_user_id;
    DELETE FROM public.ai_response_reports WHERE user_id = p_user_id;
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

REVOKE ALL ON FUNCTION public.delete_owned_data(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_owned_data(uuid, text) TO service_role;
