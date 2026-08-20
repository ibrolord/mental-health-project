-- Merge a Supabase anonymous account into an existing permanent account.
-- The API verifies both JWTs before calling this service-role-only function.
-- The move is transactional so a uniqueness or foreign-key conflict leaves
-- both profiles unchanged for an explicit retry or support resolution.

CREATE OR REPLACE FUNCTION public.merge_anonymous_user_data(
  p_source_user_id UUID,
  p_target_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_source_is_anonymous BOOLEAN;
  v_target_is_anonymous BOOLEAN;
  v_table RECORD;
  v_count INTEGER;
  v_total INTEGER := 0;
BEGIN
  IF p_source_user_id IS NULL
    OR p_target_user_id IS NULL
    OR p_source_user_id = p_target_user_id THEN
    RAISE EXCEPTION 'Invalid merge identities';
  END IF;

  SELECT is_anonymous INTO v_source_is_anonymous
  FROM auth.users
  WHERE id = p_source_user_id;
  SELECT is_anonymous INTO v_target_is_anonymous
  FROM auth.users
  WHERE id = p_target_user_id;

  IF v_source_is_anonymous IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Source profile is not anonymous';
  END IF;
  IF v_target_is_anonymous IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'Target profile is not a permanent account';
  END IF;

  -- Parent rows must move before child rows that use an owner-aware composite
  -- foreign key (for example goals before milestones).
  FOR v_table IN
    SELECT c.table_name
    FROM information_schema.columns AS c
    JOIN information_schema.tables AS t
      ON t.table_schema = c.table_schema
     AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'user_id'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name <> 'user_profiles'
    ORDER BY CASE c.table_name
      WHEN 'goals' THEN 10
      WHEN 'habits' THEN 10
      WHEN 'activity_plans' THEN 10
      WHEN 'safety_plans' THEN 10
      WHEN 'staying_well_plans' THEN 10
      WHEN 'wellbeing_reminders' THEN 20
      WHEN 'goal_milestones' THEN 30
      WHEN 'goal_attachments' THEN 30
      WHEN 'activity_plan_steps' THEN 30
      WHEN 'safety_plan_items' THEN 30
      WHEN 'staying_well_plan_items' THEN 30
      ELSE 50
    END,
    c.table_name
  LOOP
    EXECUTE format(
      'UPDATE public.%I SET user_id = $1 WHERE user_id = $2',
      v_table.table_name
    ) USING p_target_user_id, p_source_user_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_total := v_total + v_count;
  END LOOP;

  RETURN jsonb_build_object('merged', TRUE, 'rowsMoved', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.merge_anonymous_user_data(UUID, UUID)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.merge_anonymous_user_data(UUID, UUID)
  TO service_role;
