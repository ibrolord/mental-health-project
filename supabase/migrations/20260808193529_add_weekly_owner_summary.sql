-- Return only owner-scoped weekly activity counts.
CREATE OR REPLACE FUNCTION public.weekly_owner_summary(
  p_week_start DATE,
  p_timezone TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner_id UUID := auth.uid();
  v_timezone TEXT := btrim(p_timezone);
  v_window_start TIMESTAMPTZ;
  v_window_end TIMESTAMPTZ;
  v_check_in_days INTEGER;
  v_completed_habit_days INTEGER;
  v_completed_focus_sessions INTEGER;
  v_journal_entries INTEGER;
BEGIN
  IF v_owner_id IS NULL OR COALESCE(auth.role(), '') <> 'authenticated' THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_week_start IS NULL OR EXTRACT(ISODOW FROM p_week_start) <> 1 THEN
    RAISE EXCEPTION 'week start must be a Monday' USING ERRCODE = '22007';
  END IF;

  IF v_timezone IS NULL
    OR char_length(v_timezone) NOT BETWEEN 1 AND 100
    OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_timezone_names AS timezone_name
      WHERE timezone_name.name = v_timezone
    )
  THEN
    RAISE EXCEPTION 'invalid timezone' USING ERRCODE = '22023';
  END IF;

  -- Converting each local midnight separately preserves 7 calendar days over DST.
  v_window_start := p_week_start::TIMESTAMP AT TIME ZONE v_timezone;
  v_window_end := (p_week_start + 7)::TIMESTAMP AT TIME ZONE v_timezone;

  SELECT COUNT(DISTINCT (m.created_at AT TIME ZONE v_timezone)::DATE)::INTEGER
  INTO v_check_in_days
  FROM public.moods AS m
  WHERE m.user_id = v_owner_id
    AND m.created_at >= v_window_start
    AND m.created_at < v_window_end;

  SELECT COUNT(DISTINCT hl.log_date)::INTEGER
  INTO v_completed_habit_days
  FROM public.habit_logs AS hl
  INNER JOIN public.habits AS h ON h.id = hl.habit_id
  WHERE h.user_id = v_owner_id
    AND hl.completed IS TRUE
    AND hl.log_date >= p_week_start
    AND hl.log_date < p_week_start + 7;

  SELECT COUNT(*)::INTEGER
  INTO v_completed_focus_sessions
  FROM public.focus_sessions AS fs
  WHERE fs.user_id = v_owner_id
    AND fs.status = 'complete'
    AND fs.completed_at >= v_window_start
    AND fs.completed_at < v_window_end;

  SELECT COUNT(*)::INTEGER
  INTO v_journal_entries
  FROM public.journal_entries AS je
  WHERE je.user_id = v_owner_id
    AND je.created_at >= v_window_start
    AND je.created_at < v_window_end;

  RETURN jsonb_build_object(
    'week_start', p_week_start,
    'week_end', p_week_start + 6,
    'timezone', v_timezone,
    'check_in_days', v_check_in_days,
    'completed_habit_days', v_completed_habit_days,
    'completed_focus_sessions', v_completed_focus_sessions,
    'journal_entries', v_journal_entries
  );
END;
$$;

REVOKE ALL ON FUNCTION public.weekly_owner_summary(DATE, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.weekly_owner_summary(DATE, TEXT)
  TO authenticated;

COMMENT ON FUNCTION public.weekly_owner_summary(DATE, TEXT) IS
  'Returns four counts for the authenticated owner and requested local week.';
