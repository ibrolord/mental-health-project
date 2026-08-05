-- Save each web wellbeing plan and its bounded children in one transaction.
-- These functions bypass RLS only after deriving and validating the caller.

CREATE OR REPLACE FUNCTION public.save_activity_plan(
  p_plan_id UUID,
  p_plan_date DATE,
  p_activity_kind TEXT,
  p_title TEXT,
  p_details TEXT,
  p_time_of_day TEXT,
  p_planned_minutes INTEGER,
  p_steps JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := (SELECT auth.uid());
  v_plan_id UUID;
  v_step JSONB;
  v_requested_step_id UUID;
  v_step_id UUID;
  v_step_created_at TIMESTAMPTZ;
  v_step_completed BOOLEAN;
  v_step_location TEXT;
  v_step_action TEXT;
  v_step_timing TEXT;
  v_step_estimated_minutes INTEGER;
  v_step_position INTEGER;
  v_step_ids UUID[] := ARRAY[]::UUID[];
  v_step_created_ats TIMESTAMPTZ[] := ARRAY[]::TIMESTAMPTZ[];
  v_step_completed_values BOOLEAN[] := ARRAY[]::BOOLEAN[];
  v_step_locations TEXT[] := ARRAY[]::TEXT[];
  v_step_actions TEXT[] := ARRAY[]::TEXT[];
  v_step_timings TEXT[] := ARRAY[]::TEXT[];
  v_step_estimated_minutes_values INTEGER[] := ARRAY[]::INTEGER[];
  v_step_positions INTEGER[] := ARRAY[]::INTEGER[];
  v_index INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required'
      USING ERRCODE = '42501';
  END IF;

  IF p_plan_date IS NULL
     OR p_activity_kind IS NULL
     OR p_activity_kind NOT IN (
       'movement',
       'social',
       'creative',
       'outdoors',
       'self_care',
       'learning',
       'rest',
       'other'
     )
     OR p_title IS NULL
     OR char_length(btrim(p_title)) NOT BETWEEN 1 AND 160
     OR p_details IS NULL
     OR char_length(p_details) > 1000
     OR p_time_of_day IS NULL
     OR p_time_of_day NOT IN ('morning', 'afternoon', 'evening', 'anytime')
     OR p_planned_minutes IS NULL
     OR p_planned_minutes NOT BETWEEN 1 AND 180 THEN
    RAISE EXCEPTION 'Invalid activity plan fields'
      USING ERRCODE = '22023';
  END IF;

  IF p_steps IS NULL OR jsonb_typeof(p_steps) <> 'array' THEN
    RAISE EXCEPTION 'Activity steps must be a JSON array'
      USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_steps) > 3 THEN
    RAISE EXCEPTION 'Activity plans support at most 3 steps'
      USING ERRCODE = '22023';
  END IF;

  IF p_plan_id IS NULL THEN
    INSERT INTO public.activity_plans (
      user_id,
      plan_date,
      activity_kind,
      title,
      details,
      time_of_day,
      planned_minutes,
      status
    )
    VALUES (
      v_user_id,
      p_plan_date,
      p_activity_kind,
      btrim(p_title),
      btrim(p_details),
      p_time_of_day,
      p_planned_minutes,
      'planned'
    )
    RETURNING id INTO v_plan_id;
  ELSE
    SELECT id
    INTO v_plan_id
    FROM public.activity_plans
    WHERE id = p_plan_id
      AND user_id = v_user_id
      AND status IN ('planned', 'in_progress')
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Activity plan is unavailable'
        USING ERRCODE = '42501';
    END IF;

    UPDATE public.activity_plans
    SET plan_date = p_plan_date,
        activity_kind = p_activity_kind,
        title = btrim(p_title),
        details = btrim(p_details),
        time_of_day = p_time_of_day,
        planned_minutes = p_planned_minutes,
        updated_at = NOW()
    WHERE id = v_plan_id
      AND user_id = v_user_id;
  END IF;

  FOR v_step IN
    SELECT value
    FROM jsonb_array_elements(p_steps) WITH ORDINALITY AS steps(value, position)
    ORDER BY position
  LOOP
    IF jsonb_typeof(v_step) <> 'object'
       OR (v_step - ARRAY[
         'id',
         'action',
         'timing',
         'estimated_minutes',
         'position'
       ]) <> '{}'::JSONB THEN
      RAISE EXCEPTION 'Activity step contains unsupported fields'
        USING ERRCODE = '22023';
    END IF;

    IF NOT (v_step ? 'action')
       OR jsonb_typeof(v_step -> 'action') <> 'string'
       OR NOT (v_step ? 'timing')
       OR jsonb_typeof(v_step -> 'timing') <> 'string'
       OR NOT (v_step ? 'estimated_minutes')
       OR jsonb_typeof(v_step -> 'estimated_minutes') NOT IN ('number', 'null')
       OR NOT (v_step ? 'position')
       OR jsonb_typeof(v_step -> 'position') <> 'number'
       OR (
         v_step ? 'id'
         AND jsonb_typeof(v_step -> 'id') <> 'string'
       ) THEN
      RAISE EXCEPTION 'Activity step has invalid field types'
        USING ERRCODE = '22023';
    END IF;

    BEGIN
      v_step_action := btrim(v_step ->> 'action');
      v_step_timing := btrim(v_step ->> 'timing');
      v_step_estimated_minutes := CASE
        WHEN jsonb_typeof(v_step -> 'estimated_minutes') = 'null' THEN NULL
        ELSE (v_step ->> 'estimated_minutes')::INTEGER
      END;
      v_step_position := (v_step ->> 'position')::INTEGER;
    EXCEPTION
      WHEN invalid_text_representation OR numeric_value_out_of_range THEN
        RAISE EXCEPTION 'Activity step has invalid numeric fields'
          USING ERRCODE = '22023';
    END;

    IF char_length(v_step_action) NOT BETWEEN 1 AND 160
       OR char_length(v_step_timing) > 100
       OR (
         v_step_estimated_minutes IS NOT NULL
         AND v_step_estimated_minutes NOT BETWEEN 1 AND 180
       )
       OR v_step_position NOT BETWEEN 1 AND 3
       OR v_step_position = ANY(v_step_positions) THEN
      RAISE EXCEPTION 'Activity step values are invalid or duplicated'
        USING ERRCODE = '22023';
    END IF;

    v_step_id := NULL;
    v_step_created_at := NULL;
    v_step_completed := FALSE;
    v_step_location := '';
    IF v_step ? 'id' THEN
      BEGIN
        v_requested_step_id := (v_step ->> 'id')::UUID;
      EXCEPTION
        WHEN invalid_text_representation THEN
          RAISE EXCEPTION 'Activity step id is invalid'
            USING ERRCODE = '22023';
      END;

      SELECT id, created_at, completed, location
      INTO v_step_id, v_step_created_at, v_step_completed, v_step_location
      FROM public.activity_plan_steps
      WHERE id = v_requested_step_id
        AND plan_id = v_plan_id
        AND user_id = v_user_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Activity step is unavailable'
          USING ERRCODE = '42501';
      END IF;
    ELSE
      SELECT id, created_at, completed, location
      INTO v_step_id, v_step_created_at, v_step_completed, v_step_location
      FROM public.activity_plan_steps
      WHERE plan_id = v_plan_id
        AND user_id = v_user_id
        AND position = v_step_position
      FOR UPDATE;

      IF NOT FOUND THEN
        v_step_id := gen_random_uuid();
        v_step_created_at := NOW();
        v_step_completed := FALSE;
        v_step_location := '';
      END IF;
    END IF;

    IF v_step_id = ANY(v_step_ids) THEN
      RAISE EXCEPTION 'Activity step id is duplicated'
        USING ERRCODE = '22023';
    END IF;

    v_step_ids := array_append(v_step_ids, v_step_id);
    v_step_created_ats := array_append(v_step_created_ats, v_step_created_at);
    v_step_completed_values := array_append(
      v_step_completed_values,
      v_step_completed
    );
    v_step_locations := array_append(v_step_locations, v_step_location);
    v_step_actions := array_append(v_step_actions, v_step_action);
    v_step_timings := array_append(v_step_timings, v_step_timing);
    v_step_estimated_minutes_values := array_append(
      v_step_estimated_minutes_values,
      v_step_estimated_minutes
    );
    v_step_positions := array_append(v_step_positions, v_step_position);
  END LOOP;

  DELETE FROM public.activity_plan_steps
  WHERE plan_id = v_plan_id
    AND user_id = v_user_id;

  IF cardinality(v_step_ids) > 0 THEN
    FOR v_index IN 1..cardinality(v_step_ids) LOOP
      INSERT INTO public.activity_plan_steps (
        id,
        plan_id,
        user_id,
        action,
        timing,
        location,
        estimated_minutes,
        position,
        completed,
        created_at,
        updated_at
      )
      VALUES (
        v_step_ids[v_index],
        v_plan_id,
        v_user_id,
        v_step_actions[v_index],
        v_step_timings[v_index],
        v_step_locations[v_index],
        v_step_estimated_minutes_values[v_index],
        v_step_positions[v_index],
        v_step_completed_values[v_index],
        v_step_created_ats[v_index],
        NOW()
      );
    END LOOP;
  END IF;

  RETURN v_plan_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_activity_plan(
  UUID,
  DATE,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  INTEGER,
  JSONB
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_activity_plan(
  UUID,
  DATE,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  INTEGER,
  JSONB
) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_safety_plan(
  p_plan_id UUID,
  p_title TEXT,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := (SELECT auth.uid());
  v_plan_id UUID;
  v_item JSONB;
  v_requested_item_id UUID;
  v_item_id UUID;
  v_item_created_at TIMESTAMPTZ;
  v_item_kind TEXT;
  v_item_label TEXT;
  v_item_details TEXT;
  v_item_position INTEGER;
  v_item_ids UUID[] := ARRAY[]::UUID[];
  v_item_created_ats TIMESTAMPTZ[] := ARRAY[]::TIMESTAMPTZ[];
  v_item_kinds TEXT[] := ARRAY[]::TEXT[];
  v_item_labels TEXT[] := ARRAY[]::TEXT[];
  v_item_details_values TEXT[] := ARRAY[]::TEXT[];
  v_item_positions INTEGER[] := ARRAY[]::INTEGER[];
  v_index INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required'
      USING ERRCODE = '42501';
  END IF;

  IF p_title IS NULL
     OR char_length(btrim(p_title)) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'Invalid safety plan fields'
      USING ERRCODE = '22023';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'Safety plan items must be a JSON array'
      USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_items) > 6 THEN
    RAISE EXCEPTION 'Safety plans support at most 6 items'
      USING ERRCODE = '22023';
  END IF;

  IF p_plan_id IS NULL THEN
    INSERT INTO public.safety_plans (user_id, title, status)
    VALUES (v_user_id, btrim(p_title), 'draft')
    RETURNING id INTO v_plan_id;
  ELSE
    SELECT id
    INTO v_plan_id
    FROM public.safety_plans
    WHERE id = p_plan_id
      AND user_id = v_user_id
      AND status IN ('draft', 'active')
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Safety plan is unavailable'
        USING ERRCODE = '42501';
    END IF;

    UPDATE public.safety_plans
    SET title = btrim(p_title),
        updated_at = NOW()
    WHERE id = v_plan_id
      AND user_id = v_user_id;
  END IF;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items) WITH ORDINALITY AS items(value, position)
    ORDER BY position
  LOOP
    IF jsonb_typeof(v_item) <> 'object'
       OR (v_item - ARRAY[
         'id',
         'item_kind',
         'label',
         'details',
         'position'
       ]) <> '{}'::JSONB THEN
      RAISE EXCEPTION 'Safety plan item contains unsupported fields'
        USING ERRCODE = '22023';
    END IF;

    IF NOT (v_item ? 'item_kind')
       OR jsonb_typeof(v_item -> 'item_kind') <> 'string'
       OR NOT (v_item ? 'label')
       OR jsonb_typeof(v_item -> 'label') <> 'string'
       OR NOT (v_item ? 'details')
       OR jsonb_typeof(v_item -> 'details') <> 'string'
       OR NOT (v_item ? 'position')
       OR jsonb_typeof(v_item -> 'position') <> 'number'
       OR (
         v_item ? 'id'
         AND jsonb_typeof(v_item -> 'id') <> 'string'
       ) THEN
      RAISE EXCEPTION 'Safety plan item has invalid field types'
        USING ERRCODE = '22023';
    END IF;

    BEGIN
      v_item_kind := v_item ->> 'item_kind';
      v_item_label := btrim(v_item ->> 'label');
      v_item_details := btrim(v_item ->> 'details');
      v_item_position := (v_item ->> 'position')::INTEGER;
    EXCEPTION
      WHEN invalid_text_representation OR numeric_value_out_of_range THEN
        RAISE EXCEPTION 'Safety plan item has an invalid position'
          USING ERRCODE = '22023';
    END;

    IF v_item_kind NOT IN (
         'warning_sign',
         'coping_strategy',
         'distraction',
         'safe_environment',
         'support_contact',
         'professional_support',
         'reason_to_live',
         'other'
       )
       OR char_length(v_item_label) NOT BETWEEN 1 AND 120
       OR char_length(v_item_details) > 1000
       OR v_item_position NOT BETWEEN 0 AND 5
       OR v_item_position = ANY(v_item_positions) THEN
      RAISE EXCEPTION 'Safety plan item values are invalid or duplicated'
        USING ERRCODE = '22023';
    END IF;

    v_item_id := NULL;
    v_item_created_at := NULL;
    IF v_item ? 'id' THEN
      BEGIN
        v_requested_item_id := (v_item ->> 'id')::UUID;
      EXCEPTION
        WHEN invalid_text_representation THEN
          RAISE EXCEPTION 'Safety plan item id is invalid'
            USING ERRCODE = '22023';
      END;

      SELECT id, created_at
      INTO v_item_id, v_item_created_at
      FROM public.safety_plan_items
      WHERE id = v_requested_item_id
        AND plan_id = v_plan_id
        AND user_id = v_user_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Safety plan item is unavailable'
          USING ERRCODE = '42501';
      END IF;
    ELSE
      SELECT id, created_at
      INTO v_item_id, v_item_created_at
      FROM public.safety_plan_items
      WHERE plan_id = v_plan_id
        AND user_id = v_user_id
        AND position = v_item_position
      FOR UPDATE;

      IF NOT FOUND THEN
        v_item_id := gen_random_uuid();
        v_item_created_at := NOW();
      END IF;
    END IF;

    IF v_item_id = ANY(v_item_ids) THEN
      RAISE EXCEPTION 'Safety plan item id is duplicated'
        USING ERRCODE = '22023';
    END IF;

    v_item_ids := array_append(v_item_ids, v_item_id);
    v_item_created_ats := array_append(v_item_created_ats, v_item_created_at);
    v_item_kinds := array_append(v_item_kinds, v_item_kind);
    v_item_labels := array_append(v_item_labels, v_item_label);
    v_item_details_values := array_append(
      v_item_details_values,
      v_item_details
    );
    v_item_positions := array_append(v_item_positions, v_item_position);
  END LOOP;

  DELETE FROM public.safety_plan_items
  WHERE plan_id = v_plan_id
    AND user_id = v_user_id;

  IF cardinality(v_item_ids) > 0 THEN
    FOR v_index IN 1..cardinality(v_item_ids) LOOP
      INSERT INTO public.safety_plan_items (
        id,
        plan_id,
        user_id,
        item_kind,
        label,
        details,
        position,
        created_at,
        updated_at
      )
      VALUES (
        v_item_ids[v_index],
        v_plan_id,
        v_user_id,
        v_item_kinds[v_index],
        v_item_labels[v_index],
        v_item_details_values[v_index],
        v_item_positions[v_index],
        v_item_created_ats[v_index],
        NOW()
      );
    END LOOP;
  END IF;

  RETURN v_plan_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_safety_plan(UUID, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_safety_plan(UUID, TEXT, JSONB)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.save_staying_well_plan(
  p_plan_id UUID,
  p_title TEXT,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := (SELECT auth.uid());
  v_plan_id UUID;
  v_item JSONB;
  v_requested_item_id UUID;
  v_item_id UUID;
  v_item_created_at TIMESTAMPTZ;
  v_item_kind TEXT;
  v_item_label TEXT;
  v_item_details TEXT;
  v_item_position INTEGER;
  v_item_ids UUID[] := ARRAY[]::UUID[];
  v_item_created_ats TIMESTAMPTZ[] := ARRAY[]::TIMESTAMPTZ[];
  v_item_kinds TEXT[] := ARRAY[]::TEXT[];
  v_item_labels TEXT[] := ARRAY[]::TEXT[];
  v_item_details_values TEXT[] := ARRAY[]::TEXT[];
  v_item_positions INTEGER[] := ARRAY[]::INTEGER[];
  v_index INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required'
      USING ERRCODE = '42501';
  END IF;

  IF p_title IS NULL
     OR char_length(btrim(p_title)) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'Invalid staying-well plan fields'
      USING ERRCODE = '22023';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'Staying-well plan items must be a JSON array'
      USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_items) > 6 THEN
    RAISE EXCEPTION 'Staying-well plans support at most 6 items'
      USING ERRCODE = '22023';
  END IF;

  IF p_plan_id IS NULL THEN
    INSERT INTO public.staying_well_plans (user_id, title, status)
    VALUES (v_user_id, btrim(p_title), 'draft')
    RETURNING id INTO v_plan_id;
  ELSE
    SELECT id
    INTO v_plan_id
    FROM public.staying_well_plans
    WHERE id = p_plan_id
      AND user_id = v_user_id
      AND status IN ('draft', 'active')
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Staying-well plan is unavailable'
        USING ERRCODE = '42501';
    END IF;

    UPDATE public.staying_well_plans
    SET title = btrim(p_title),
        updated_at = NOW()
    WHERE id = v_plan_id
      AND user_id = v_user_id;
  END IF;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items) WITH ORDINALITY AS items(value, position)
    ORDER BY position
  LOOP
    IF jsonb_typeof(v_item) <> 'object'
       OR (v_item - ARRAY[
         'id',
         'item_kind',
         'label',
         'details',
         'position'
       ]) <> '{}'::JSONB THEN
      RAISE EXCEPTION 'Staying-well plan item contains unsupported fields'
        USING ERRCODE = '22023';
    END IF;

    IF NOT (v_item ? 'item_kind')
       OR jsonb_typeof(v_item -> 'item_kind') <> 'string'
       OR NOT (v_item ? 'label')
       OR jsonb_typeof(v_item -> 'label') <> 'string'
       OR NOT (v_item ? 'details')
       OR jsonb_typeof(v_item -> 'details') <> 'string'
       OR NOT (v_item ? 'position')
       OR jsonb_typeof(v_item -> 'position') <> 'number'
       OR (
         v_item ? 'id'
         AND jsonb_typeof(v_item -> 'id') <> 'string'
       ) THEN
      RAISE EXCEPTION 'Staying-well plan item has invalid field types'
        USING ERRCODE = '22023';
    END IF;

    BEGIN
      v_item_kind := v_item ->> 'item_kind';
      v_item_label := btrim(v_item ->> 'label');
      v_item_details := btrim(v_item ->> 'details');
      v_item_position := (v_item ->> 'position')::INTEGER;
    EXCEPTION
      WHEN invalid_text_representation OR numeric_value_out_of_range THEN
        RAISE EXCEPTION 'Staying-well plan item has an invalid position'
          USING ERRCODE = '22023';
    END;

    IF v_item_kind NOT IN (
         'protective_routine',
         'trigger',
         'early_warning_sign',
         'coping_strategy',
         'support_step',
         'clinical_step',
         'other'
       )
       OR char_length(v_item_label) NOT BETWEEN 1 AND 120
       OR char_length(v_item_details) > 2000
       OR v_item_position NOT BETWEEN 0 AND 5
       OR v_item_position = ANY(v_item_positions) THEN
      RAISE EXCEPTION 'Staying-well plan item values are invalid or duplicated'
        USING ERRCODE = '22023';
    END IF;

    v_item_id := NULL;
    v_item_created_at := NULL;
    IF v_item ? 'id' THEN
      BEGIN
        v_requested_item_id := (v_item ->> 'id')::UUID;
      EXCEPTION
        WHEN invalid_text_representation THEN
          RAISE EXCEPTION 'Staying-well plan item id is invalid'
            USING ERRCODE = '22023';
      END;

      SELECT id, created_at
      INTO v_item_id, v_item_created_at
      FROM public.staying_well_plan_items
      WHERE id = v_requested_item_id
        AND plan_id = v_plan_id
        AND user_id = v_user_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Staying-well plan item is unavailable'
          USING ERRCODE = '42501';
      END IF;
    ELSE
      SELECT id, created_at
      INTO v_item_id, v_item_created_at
      FROM public.staying_well_plan_items
      WHERE plan_id = v_plan_id
        AND user_id = v_user_id
        AND position = v_item_position
      FOR UPDATE;

      IF NOT FOUND THEN
        v_item_id := gen_random_uuid();
        v_item_created_at := NOW();
      END IF;
    END IF;

    IF v_item_id = ANY(v_item_ids) THEN
      RAISE EXCEPTION 'Staying-well plan item id is duplicated'
        USING ERRCODE = '22023';
    END IF;

    v_item_ids := array_append(v_item_ids, v_item_id);
    v_item_created_ats := array_append(v_item_created_ats, v_item_created_at);
    v_item_kinds := array_append(v_item_kinds, v_item_kind);
    v_item_labels := array_append(v_item_labels, v_item_label);
    v_item_details_values := array_append(
      v_item_details_values,
      v_item_details
    );
    v_item_positions := array_append(v_item_positions, v_item_position);
  END LOOP;

  DELETE FROM public.staying_well_plan_items
  WHERE plan_id = v_plan_id
    AND user_id = v_user_id;

  IF cardinality(v_item_ids) > 0 THEN
    FOR v_index IN 1..cardinality(v_item_ids) LOOP
      INSERT INTO public.staying_well_plan_items (
        id,
        plan_id,
        user_id,
        item_kind,
        label,
        details,
        position,
        created_at,
        updated_at
      )
      VALUES (
        v_item_ids[v_index],
        v_plan_id,
        v_user_id,
        v_item_kinds[v_index],
        v_item_labels[v_index],
        v_item_details_values[v_index],
        v_item_positions[v_index],
        v_item_created_ats[v_index],
        NOW()
      );
    END LOOP;
  END IF;

  RETURN v_plan_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_staying_well_plan(UUID, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_staying_well_plan(UUID, TEXT, JSONB)
  TO authenticated;
