-- Commit the first-touch attribution and check-in in one database transaction.
-- This prevents a closed tab or backgrounded app from leaving a launch
-- activation without attribution. The attribution row contains only the
-- allowlisted campaign taxonomy; mood content remains in public.moods.
CREATE OR REPLACE FUNCTION public.save_check_in_with_attribution(
  p_emoji public.mood_emoji,
  p_note TEXT,
  p_tags TEXT[],
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
    RAISE EXCEPTION 'Authentication required';
  END IF;

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
    p_note,
    COALESCE(p_tags, '{}'::TEXT[]),
    p_local_date,
    p_utc_offset_minutes
  )
  RETURNING id INTO v_mood_id;

  RETURN v_mood_id;
END;
$$;

COMMENT ON FUNCTION public.save_check_in_with_attribution(
  public.mood_emoji,
  TEXT,
  TEXT[],
  DATE,
  SMALLINT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT
) IS
  'Atomically stores one owned check-in and first-touch allowlisted acquisition labels.';

REVOKE ALL ON FUNCTION public.save_check_in_with_attribution(
  public.mood_emoji,
  TEXT,
  TEXT[],
  DATE,
  SMALLINT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.save_check_in_with_attribution(
  public.mood_emoji,
  TEXT,
  TEXT[],
  DATE,
  SMALLINT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT
) TO authenticated;
