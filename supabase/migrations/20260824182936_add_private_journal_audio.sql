-- Voice journals are intentionally local-first. This flag permits an owner to
-- save a voice-only journal entry without uploading the recording or metadata.
ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS has_voice_recording BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.journal_entries
  DROP CONSTRAINT IF EXISTS journal_content_length;

ALTER TABLE public.journal_entries
  ADD CONSTRAINT journal_content_length CHECK (
    char_length(btrim(content)) <= 12000
    AND (
      char_length(btrim(content)) >= 1
      OR has_voice_recording
    )
  );

COMMENT ON COLUMN public.journal_entries.has_voice_recording IS
  'A local voice recording exists on this device. Original audio and audio metadata are never uploaded to Supabase.';
