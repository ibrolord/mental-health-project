-- Restore current web and iOS mood saves without deleting historical rows.
-- A transaction-scoped advisory lock serializes writers for one owner/day. The
-- canonical row is the newest existing row, so this rollout stops new
-- duplicates while preserving legacy duplicates for a separately approved
-- cleanup migration.
CREATE OR REPLACE FUNCTION public.patch_daily_mood_check_in(
  p_expected_user_id UUID,
  p_emoji public.mood_emoji,
  p_note TEXT,
  p_update_note BOOLEAN,
  p_tags TEXT[],
  p_update_tags BOOLEAN,
  p_local_date DATE,
  p_utc_offset_minutes SMALLINT,
  p_source TEXT,
  p_medium TEXT,
  p_campaign TEXT,
  p_content TEXT,
  p_platform TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_mood_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_expected_user_id IS NULL OR p_expected_user_id <> v_user_id THEN
    RAISE EXCEPTION 'Authenticated owner changed before check-in save'
      USING ERRCODE = '42501';
  END IF;

  IF p_local_date IS NULL THEN
    RAISE EXCEPTION 'Local check-in date is required' USING ERRCODE = '22023';
  END IF;

  -- Collisions only serialize unrelated users; they cannot cross ownership
  -- because every following query remains constrained to v_user_id.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_user_id::TEXT || ':' || p_local_date::TEXT,
      0
    )
  );

  INSERT INTO public.acquisition_attribution (
    user_id,
    source,
    medium,
    campaign,
    content,
    platform
  )
  VALUES (
    v_user_id,
    p_source,
    p_medium,
    p_campaign,
    p_content,
    p_platform
  )
  ON CONFLICT (user_id) DO NOTHING;

  SELECT moods.id
  INTO v_mood_id
  FROM public.moods AS moods
  WHERE moods.user_id = v_user_id
    AND moods.local_date = p_local_date
  ORDER BY moods.created_at DESC, moods.id DESC
  LIMIT 1
  FOR UPDATE;

  IF v_mood_id IS NULL THEN
    INSERT INTO public.moods (
      user_id,
      session_id,
      emoji,
      note,
      tags,
      local_date,
      utc_offset_minutes
    )
    VALUES (
      v_user_id,
      NULL,
      p_emoji,
      CASE WHEN p_update_note THEN p_note ELSE NULL END,
      CASE
        WHEN p_update_tags THEN COALESCE(p_tags, '{}'::TEXT[])
        ELSE '{}'::TEXT[]
      END,
      p_local_date,
      p_utc_offset_minutes
    )
    RETURNING id INTO v_mood_id;
  ELSE
    UPDATE public.moods AS moods
    SET
      emoji = p_emoji,
      note = CASE WHEN p_update_note THEN p_note ELSE moods.note END,
      tags = CASE
        WHEN p_update_tags THEN COALESCE(p_tags, '{}'::TEXT[])
        ELSE moods.tags
      END,
      utc_offset_minutes = p_utc_offset_minutes
    WHERE moods.id = v_mood_id
      AND moods.user_id = v_user_id
    RETURNING moods.id INTO v_mood_id;
  END IF;

  RETURN v_mood_id;
END;
$$;

COMMENT ON FUNCTION public.patch_daily_mood_check_in(
  UUID,
  public.mood_emoji,
  TEXT,
  BOOLEAN,
  TEXT[],
  BOOLEAN,
  DATE,
  SMALLINT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT
) IS
  'Non-destructively patches the newest owner-bound mood row per local day.';

REVOKE ALL ON FUNCTION public.patch_daily_mood_check_in(
  UUID,
  public.mood_emoji,
  TEXT,
  BOOLEAN,
  TEXT[],
  BOOLEAN,
  DATE,
  SMALLINT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.patch_daily_mood_check_in(
  UUID,
  public.mood_emoji,
  TEXT,
  BOOLEAN,
  TEXT[],
  BOOLEAN,
  DATE,
  SMALLINT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT
) TO authenticated;
