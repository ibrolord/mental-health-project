-- Private state for the unified books-and-videos library.
-- The filename matches the migration version recorded by Supabase production.
--
-- The catalog itself remains versioned application data. This table stores
-- only user-owned interaction state keyed by a stable content id. Library
-- notes are private and are never included in accountability-partner views.

CREATE TABLE public.user_library_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL,
  media_type TEXT NOT NULL,
  is_saved BOOLEAN NOT NULL DEFAULT FALSE,
  priority TEXT NOT NULL DEFAULT 'none',
  custom_notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_library_content_id_length CHECK (
    char_length(btrim(content_id)) BETWEEN 1 AND 120
  ),
  CONSTRAINT user_library_media_type_check CHECK (
    media_type IN ('book', 'video')
  ),
  CONSTRAINT user_library_priority_check CHECK (
    priority IN ('none', 'next')
  ),
  CONSTRAINT user_library_custom_notes_length CHECK (
    char_length(custom_notes) <= 4000
  ),
  CONSTRAINT user_library_user_content_unique UNIQUE (user_id, content_id)
);

CREATE INDEX user_library_items_user_updated_idx
  ON public.user_library_items (user_id, updated_at DESC);

COMMENT ON TABLE public.user_library_items IS
  'Private saved state, priority, and notes for static library content.';

ALTER TABLE public.user_library_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_library_items
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_library_items
  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_library_items
  TO service_role;

CREATE POLICY "Users can read their library state"
  ON public.user_library_items
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create their library state"
  ON public.user_library_items
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their library state"
  ON public.user_library_items
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their library state"
  ON public.user_library_items
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Keep existing book-note writes compatible with the released mobile app while
-- allowing the web journal to identify video notes explicitly.
ALTER TABLE public.journal_entries
  ADD COLUMN linked_media_type TEXT;

ALTER TABLE public.journal_entries
  ADD CONSTRAINT journal_linked_media_type_check CHECK (
    linked_media_type IS NULL OR linked_media_type IN ('book', 'video')
  );

UPDATE public.journal_entries
SET linked_media_type = 'book'
WHERE entry_kind = 'book_note'
  AND linked_media_type IS NULL;

ALTER TABLE public.journal_entries
  DROP CONSTRAINT journal_entry_kind_check;

ALTER TABLE public.journal_entries
  ADD CONSTRAINT journal_entry_kind_check CHECK (
    entry_kind IN ('freeform', 'guided', 'book_note', 'video_note')
  );

-- Account deletion is transactional and must include the new private state.
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

REVOKE ALL ON FUNCTION public.delete_owned_data(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_owned_data(uuid, text) TO service_role;
