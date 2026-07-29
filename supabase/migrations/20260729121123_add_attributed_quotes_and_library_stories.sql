-- Add sourced quotations to the affirmation feed and lived-experience stories
-- to the existing private library workflow.

ALTER TABLE public.affirmations
  ADD COLUMN kind TEXT NOT NULL DEFAULT 'affirmation',
  ADD COLUMN attribution_name TEXT,
  ADD COLUMN source_title TEXT,
  ADD COLUMN source_url TEXT;

ALTER TABLE public.affirmations
  ADD CONSTRAINT affirmation_kind_check CHECK (
    kind IN ('affirmation', 'quote')
  ),
  ADD CONSTRAINT affirmation_quote_provenance_check CHECK (
    kind = 'affirmation'
    OR (
      attribution_name IS NOT NULL
      AND char_length(btrim(attribution_name)) BETWEEN 1 AND 160
      AND source_title IS NOT NULL
      AND char_length(btrim(source_title)) BETWEEN 1 AND 240
      AND source_url IS NOT NULL
      AND char_length(btrim(source_url)) BETWEEN 9 AND 2048
      AND btrim(source_url) ~ '^https://[^[:space:]]+$'
    )
  );

INSERT INTO public.affirmations (
  id,
  content,
  mood_tags,
  category,
  kind,
  attribution_name,
  source_title,
  source_url
) VALUES
  (
    'a11f0000-0000-4000-8000-000000000001',
    'I learned that courage was not the absence of fear, but the triumph over it.',
    ARRAY['😐'::mood_emoji, '😞'::mood_emoji],
    'capability',
    'quote',
    'Nelson Mandela',
    'Nelson Mandela Foundation statement',
    'https://www.nelsonmandela.org/news/entry/media-statement-foundation-supports-national-lockdown'
  ),
  (
    'a11f0000-0000-4000-8000-000000000002',
    'A time when we have to shed our fear and give hope to each other.',
    ARRAY['😐'::mood_emoji, '😞'::mood_emoji],
    'growth',
    'quote',
    'Wangari Maathai',
    'Nobel Lecture',
    'https://www.nobelprize.org/prizes/peace/2004/maathai/lecture/'
  ),
  (
    'a11f0000-0000-4000-8000-000000000003',
    'One child, one teacher, one pen and one book can change the world.',
    ARRAY['🙂'::mood_emoji, '😐'::mood_emoji],
    'capability',
    'quote',
    'Malala Yousafzai',
    'Malala Fund: UN speech',
    'https://malala.org/news-and-voices/malala-un-speech'
  ),
  (
    'a11f0000-0000-4000-8000-000000000004',
    'Being honest about how we feel doesn''t make us weak - it makes us human.',
    ARRAY['😞'::mood_emoji, '😢'::mood_emoji],
    'self-compassion',
    'quote',
    'Sangu Delle',
    'TED: There is no shame in taking care of your mental health',
    'https://www.ted.com/talks/sangu_delle_there_s_no_shame_in_taking_care_of_your_mental_health'
  ),
  (
    'a11f0000-0000-4000-8000-000000000005',
    'The opposite of depression is not happiness, but vitality.',
    ARRAY['😞'::mood_emoji, '😢'::mood_emoji],
    'self-compassion',
    'quote',
    'Andrew Solomon',
    'TED: Depression, the secret we share',
    'https://www.ted.com/talks/andrew_solomon_depression_the_secret_we_share'
  ),
  (
    'a11f0000-0000-4000-8000-000000000006',
    'They''re going to move forward. But that doesn''t mean that they''ve moved on.',
    ARRAY['😞'::mood_emoji, '😢'::mood_emoji],
    'rest',
    'quote',
    'Nora McInerny',
    'TED: We do not move on from grief. We move forward with it',
    'https://www.ted.com/talks/nora_mcinerny_we_don_t_move_on_from_grief_we_move_forward_with_it'
  ),
  (
    'a11f0000-0000-4000-8000-000000000007',
    'Narrative is radical, creating us at the very moment it is being created.',
    ARRAY['🙂'::mood_emoji, '😐'::mood_emoji],
    'growth',
    'quote',
    'Toni Morrison',
    'Nobel Lecture',
    'https://www.nobelprize.org/prizes/literature/1993/morrison/lecture/'
  ),
  (
    'a11f0000-0000-4000-8000-000000000008',
    'Stories have been used to dispossess and to malign, but stories can also be used to empower and to humanize.',
    ARRAY['🙂'::mood_emoji, '😐'::mood_emoji],
    'growth',
    'quote',
    'Chimamanda Ngozi Adichie',
    'TED: The danger of a single story',
    'https://www.ted.com/talks/chimamanda_ngozi_adichie_the_danger_of_a_single_story'
  ),
  (
    'a11f0000-0000-4000-8000-000000000009',
    'I believe that unarmed truth and unconditional love will have the final word in reality.',
    ARRAY['😐'::mood_emoji, '😞'::mood_emoji],
    'capability',
    'quote',
    'Martin Luther King Jr.',
    'Nobel Peace Prize acceptance speech',
    'https://www.nobelprize.org/prizes/peace/1964/king/acceptance-speech/'
  ),
  (
    'a11f0000-0000-4000-8000-000000000010',
    'What you do makes a difference, and you have to decide what kind of difference you want to make.',
    ARRAY['🙂'::mood_emoji, '😐'::mood_emoji],
    'growth',
    'quote',
    'Jane Goodall',
    'Jane Goodall Institute',
    'https://janegoodall.org/news/eatmeatless-for-people-other-animals-and-the-environment/'
  ),
  (
    'a11f0000-0000-4000-8000-000000000011',
    'With self-compassion, we give ourselves the same kindness and support we''d give to a good friend.',
    ARRAY['😞'::mood_emoji, '😢'::mood_emoji],
    'self-compassion',
    'quote',
    'Kristin Neff',
    'Self-Compassion',
    'https://self-compassion.org/'
  ),
  (
    'a11f0000-0000-4000-8000-000000000012',
    'When people show you - or tell you - who they are, believe them the first time.',
    ARRAY['😐'::mood_emoji, '😞'::mood_emoji],
    'boundaries',
    'quote',
    'Maya Angelou',
    'Oprah on lessons from Maya Angelou',
    'https://www.oprahdaily.com/life/a38746686/maya-angelou-lessons-oprah-self-acceptance/'
  )
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.user_library_items
  DROP CONSTRAINT user_library_media_type_check,
  ADD CONSTRAINT user_library_media_type_check CHECK (
    media_type IN ('book', 'video', 'story')
  );

ALTER TABLE public.journal_entries
  DROP CONSTRAINT journal_linked_media_type_check,
  ADD CONSTRAINT journal_linked_media_type_check CHECK (
    linked_media_type IS NULL OR linked_media_type IN ('book', 'video', 'story')
  ),
  DROP CONSTRAINT journal_entry_kind_check,
  ADD CONSTRAINT journal_entry_kind_check CHECK (
    entry_kind IN ('freeform', 'guided', 'book_note', 'video_note', 'story_note')
  );

-- Repair legacy rows before enforcing the relationship between journal kind
-- and library media. Stable synthetic IDs preserve old notes without claiming
-- that they map to a current catalog item.
UPDATE public.journal_entries
SET linked_media_type = CASE entry_kind
  WHEN 'book_note' THEN 'book'
  WHEN 'video_note' THEN 'video'
  WHEN 'story_note' THEN 'story'
  ELSE NULL
END;

UPDATE public.journal_entries
SET
  linked_book_id = NULL,
  linked_book_title = NULL
WHERE entry_kind IN ('freeform', 'guided');

UPDATE public.journal_entries
SET linked_book_id = 'legacy-journal-' || id::text
WHERE entry_kind IN ('book_note', 'video_note', 'story_note')
  AND (linked_book_id IS NULL OR btrim(linked_book_id) = '');

-- Released clients may omit linked_media_type. Normalize it from entry_kind
-- before validation so old writers stay compatible without accepting null or
-- mismatched media on library notes.
CREATE OR REPLACE FUNCTION public.normalize_journal_library_note_media_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.linked_media_type IS NULL THEN
    NEW.linked_media_type := CASE NEW.entry_kind
      WHEN 'book_note' THEN 'book'
      WHEN 'video_note' THEN 'video'
      WHEN 'story_note' THEN 'story'
      ELSE NULL
    END;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER normalize_journal_library_note_media_type_before_write
BEFORE INSERT OR UPDATE OF entry_kind, linked_media_type
ON public.journal_entries
FOR EACH ROW
EXECUTE FUNCTION public.normalize_journal_library_note_media_type();

ALTER TABLE public.journal_entries
  ADD CONSTRAINT journal_library_note_consistency_check CHECK (
    (
      entry_kind IN ('freeform', 'guided')
      AND linked_media_type IS NULL
      AND linked_book_id IS NULL
      AND linked_book_title IS NULL
    )
    OR (
      entry_kind = 'book_note'
      AND linked_media_type IS NOT NULL
      AND linked_media_type = 'book'
      AND linked_book_id IS NOT NULL
      AND char_length(btrim(linked_book_id)) BETWEEN 1 AND 120
    )
    OR (
      entry_kind = 'video_note'
      AND linked_media_type IS NOT NULL
      AND linked_media_type = 'video'
      AND linked_book_id IS NOT NULL
      AND char_length(btrim(linked_book_id)) BETWEEN 1 AND 120
    )
    OR (
      entry_kind = 'story_note'
      AND linked_media_type IS NOT NULL
      AND linked_media_type = 'story'
      AND linked_book_id IS NOT NULL
      AND char_length(btrim(linked_book_id)) BETWEEN 1 AND 120
    )
  );
