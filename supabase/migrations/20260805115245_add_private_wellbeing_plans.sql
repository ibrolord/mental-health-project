-- Private wellbeing plans and privacy audit events.
--
-- All content remains owner-only. Accountability partners intentionally receive
-- no table policy or RPC that can read these rows, including support preferences.

CREATE TABLE public.activity_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_date DATE NOT NULL,
  activity_kind TEXT NOT NULL,
  title TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  time_of_day TEXT NOT NULL DEFAULT 'anytime',
  planned_minutes SMALLINT NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'planned',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT activity_plans_owner_identity_unique UNIQUE (id, user_id),
  CONSTRAINT activity_plans_kind_check CHECK (
    activity_kind IN (
      'movement',
      'social',
      'creative',
      'outdoors',
      'self_care',
      'learning',
      'rest',
      'other'
    )
  ),
  CONSTRAINT activity_plans_time_of_day_check CHECK (
    time_of_day IN ('morning', 'afternoon', 'evening', 'anytime')
  ),
  CONSTRAINT activity_plans_status_check CHECK (
    status IN ('planned', 'in_progress', 'completed', 'skipped')
  ),
  CONSTRAINT activity_plans_text_lengths_check CHECK (
    char_length(btrim(title)) BETWEEN 1 AND 160
    AND char_length(details) <= 1000
  ),
  CONSTRAINT activity_plans_minutes_check CHECK (
    planned_minutes BETWEEN 1 AND 180
  ),
  CONSTRAINT activity_plans_completion_check CHECK (
    (status = 'completed' AND completed_at IS NOT NULL)
    OR (status <> 'completed' AND completed_at IS NULL)
  )
);

CREATE INDEX activity_plans_user_date_idx
  ON public.activity_plans (user_id, plan_date DESC, created_at DESC);
CREATE INDEX activity_plans_user_status_idx
  ON public.activity_plans (user_id, status, updated_at DESC);

CREATE TABLE public.activity_plan_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  timing TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  estimated_minutes SMALLINT,
  position SMALLINT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT activity_plan_steps_plan_owner_fk
    FOREIGN KEY (plan_id, user_id)
    REFERENCES public.activity_plans(id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT activity_plan_steps_position_unique UNIQUE (plan_id, position),
  CONSTRAINT activity_plan_steps_text_lengths_check CHECK (
    char_length(btrim(action)) BETWEEN 1 AND 160
    AND char_length(timing) <= 100
    AND char_length(location) <= 100
  ),
  CONSTRAINT activity_plan_steps_minutes_check CHECK (
    estimated_minutes IS NULL OR estimated_minutes BETWEEN 1 AND 180
  ),
  CONSTRAINT activity_plan_steps_position_check CHECK (
    position BETWEEN 1 AND 3
  )
);

CREATE INDEX activity_plan_steps_user_plan_idx
  ON public.activity_plan_steps (user_id, plan_id, position);

CREATE TABLE public.safety_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'My safety plan',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT safety_plans_owner_identity_unique UNIQUE (id, user_id),
  CONSTRAINT safety_plans_title_length_check CHECK (
    char_length(btrim(title)) BETWEEN 1 AND 120
  ),
  CONSTRAINT safety_plans_status_check CHECK (
    status IN ('draft', 'active', 'archived')
  )
);

CREATE INDEX safety_plans_user_status_idx
  ON public.safety_plans (user_id, status, updated_at DESC);
CREATE UNIQUE INDEX safety_plans_one_active_per_user_idx
  ON public.safety_plans (user_id)
  WHERE status = 'active';

CREATE TABLE public.safety_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_kind TEXT NOT NULL,
  label TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  position SMALLINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT safety_plan_items_plan_owner_fk
    FOREIGN KEY (plan_id, user_id)
    REFERENCES public.safety_plans(id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT safety_plan_items_position_unique UNIQUE (plan_id, position),
  CONSTRAINT safety_plan_items_kind_check CHECK (
    item_kind IN (
      'warning_sign',
      'coping_strategy',
      'distraction',
      'safe_environment',
      'support_contact',
      'professional_support',
      'reason_to_live',
      'other'
    )
  ),
  CONSTRAINT safety_plan_items_text_lengths_check CHECK (
    char_length(btrim(label)) BETWEEN 1 AND 120
    AND char_length(details) <= 1000
  ),
  CONSTRAINT safety_plan_items_position_check CHECK (
    position BETWEEN 0 AND 5
  )
);

CREATE INDEX safety_plan_items_user_plan_idx
  ON public.safety_plan_items (user_id, plan_id, position);

CREATE TABLE public.staying_well_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'My staying-well plan',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT staying_well_plans_owner_identity_unique UNIQUE (id, user_id),
  CONSTRAINT staying_well_plans_title_length_check CHECK (
    char_length(btrim(title)) BETWEEN 1 AND 120
  ),
  CONSTRAINT staying_well_plans_status_check CHECK (
    status IN ('draft', 'active', 'archived')
  )
);

CREATE INDEX staying_well_plans_user_status_idx
  ON public.staying_well_plans (user_id, status, updated_at DESC);
CREATE UNIQUE INDEX staying_well_plans_one_active_per_user_idx
  ON public.staying_well_plans (user_id)
  WHERE status = 'active';

CREATE TABLE public.staying_well_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_kind TEXT NOT NULL,
  label TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  position SMALLINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT staying_well_plan_items_plan_owner_fk
    FOREIGN KEY (plan_id, user_id)
    REFERENCES public.staying_well_plans(id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT staying_well_plan_items_position_unique UNIQUE (plan_id, position),
  CONSTRAINT staying_well_plan_items_kind_check CHECK (
    item_kind IN (
      'protective_routine',
      'trigger',
      'early_warning_sign',
      'coping_strategy',
      'support_step',
      'clinical_step',
      'other'
    )
  ),
  CONSTRAINT staying_well_plan_items_text_lengths_check CHECK (
    char_length(btrim(label)) BETWEEN 1 AND 120
    AND char_length(details) <= 2000
  ),
  CONSTRAINT staying_well_plan_items_position_check CHECK (
    position BETWEEN 0 AND 5
  )
);

CREATE INDEX staying_well_plan_items_user_plan_idx
  ON public.staying_well_plan_items (user_id, plan_id, position);

CREATE TABLE public.sleep_diary_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  went_to_bed_at TIMESTAMPTZ,
  tried_to_sleep_at TIMESTAMPTZ,
  fell_asleep_at TIMESTAMPTZ,
  woke_up_at TIMESTAMPTZ,
  got_out_of_bed_at TIMESTAMPTZ,
  awakenings SMALLINT,
  awake_minutes SMALLINT,
  nap_minutes SMALLINT,
  timezone_offset_minutes SMALLINT,
  timezone_name TEXT,
  sleep_quality SMALLINT,
  restedness SMALLINT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sleep_diary_entries_user_date_unique UNIQUE (user_id, entry_date),
  CONSTRAINT sleep_diary_entries_counts_check CHECK (
    (awakenings IS NULL OR awakenings BETWEEN 0 AND 50)
    AND (awake_minutes IS NULL OR awake_minutes BETWEEN 0 AND 1440)
    AND (nap_minutes IS NULL OR nap_minutes BETWEEN 0 AND 1440)
  ),
  CONSTRAINT sleep_diary_entries_timezone_check CHECK (
    (timezone_offset_minutes IS NULL OR timezone_offset_minutes BETWEEN -840 AND 840)
    AND (
      timezone_name IS NULL
      OR (
        char_length(timezone_name) BETWEEN 1 AND 100
        AND timezone_name ~ '^(UTC|GMT|[A-Za-z][A-Za-z0-9._+-]*(/[A-Za-z0-9._+-]+)+)$'
      )
    )
  ),
  CONSTRAINT sleep_diary_entries_ratings_check CHECK (
    (sleep_quality IS NULL OR sleep_quality BETWEEN 1 AND 5)
    AND (restedness IS NULL OR restedness BETWEEN 1 AND 5)
  ),
  CONSTRAINT sleep_diary_entries_notes_length_check CHECK (
    char_length(notes) <= 2000
  ),
  CONSTRAINT sleep_diary_entries_timeline_check CHECK (
    (tried_to_sleep_at IS NULL OR went_to_bed_at IS NULL OR tried_to_sleep_at >= went_to_bed_at)
    AND (fell_asleep_at IS NULL OR went_to_bed_at IS NULL OR fell_asleep_at >= went_to_bed_at)
    AND (woke_up_at IS NULL OR went_to_bed_at IS NULL OR woke_up_at >= went_to_bed_at)
    AND (got_out_of_bed_at IS NULL OR went_to_bed_at IS NULL OR got_out_of_bed_at >= went_to_bed_at)
    AND (fell_asleep_at IS NULL OR tried_to_sleep_at IS NULL OR fell_asleep_at >= tried_to_sleep_at)
    AND (woke_up_at IS NULL OR tried_to_sleep_at IS NULL OR woke_up_at >= tried_to_sleep_at)
    AND (got_out_of_bed_at IS NULL OR tried_to_sleep_at IS NULL OR got_out_of_bed_at >= tried_to_sleep_at)
    AND (woke_up_at IS NULL OR fell_asleep_at IS NULL OR woke_up_at >= fell_asleep_at)
    AND (got_out_of_bed_at IS NULL OR fell_asleep_at IS NULL OR got_out_of_bed_at >= fell_asleep_at)
    AND (got_out_of_bed_at IS NULL OR woke_up_at IS NULL OR got_out_of_bed_at >= woke_up_at)
  )
);

CREATE INDEX sleep_diary_entries_user_created_idx
  ON public.sleep_diary_entries (user_id, created_at DESC);

-- These preferences are structured so future sharing can be consented to field
-- by field. This migration keeps the entire row visible only to its owner.
CREATE TABLE public.partner_support_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  support_style TEXT NOT NULL DEFAULT 'not_set',
  check_in_frequency TEXT NOT NULL DEFAULT 'never',
  advice_mode TEXT NOT NULL DEFAULT 'when_requested',
  celebrate_progress BOOLEAN NOT NULL DEFAULT FALSE,
  gentle_reminders BOOLEAN NOT NULL DEFAULT FALSE,
  acknowledge_setbacks BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT partner_support_preferences_style_check CHECK (
    support_style IN (
      'not_set',
      'encouragement',
      'listening',
      'accountability',
      'practical_help',
      'mixed'
    )
  ),
  CONSTRAINT partner_support_preferences_frequency_check CHECK (
    check_in_frequency IN (
      'never',
      'daily',
      'few_times_week',
      'weekly',
      'as_needed'
    )
  ),
  CONSTRAINT partner_support_preferences_advice_check CHECK (
    advice_mode IN ('ask_first', 'when_requested', 'welcome')
  )
);

CREATE INDEX partner_support_preferences_updated_idx
  ON public.partner_support_preferences (user_id, updated_at DESC);

-- Append-only privacy audit rows contain taxonomy only. Arbitrary content,
-- free-text notes, URLs, emails, and user-supplied identifiers are not accepted.
CREATE TABLE public.privacy_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  platform TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT privacy_events_type_check CHECK (
    event_type IN (
      'privacy_notice_viewed',
      'consent_granted',
      'consent_withdrawn',
      'sharing_enabled',
      'sharing_disabled',
      'export_requested',
      'deletion_requested'
    )
  ),
  CONSTRAINT privacy_events_platform_check CHECK (
    platform IN ('web', 'ios', 'android')
  ),
  CONSTRAINT privacy_events_metadata_shape_check CHECK (
    jsonb_typeof(metadata) = 'object'
    AND octet_length(metadata::TEXT) <= 512
    AND metadata - ARRAY[
      'policy_version',
      'app_version',
      'setting',
      'method'
    ]::TEXT[] = '{}'::JSONB
  ),
  CONSTRAINT privacy_events_policy_version_check CHECK (
    metadata->'policy_version' IS NULL
    OR (
      jsonb_typeof(metadata->'policy_version') = 'string'
      AND char_length(metadata->>'policy_version') BETWEEN 1 AND 32
      AND metadata->>'policy_version' ~ '^[A-Za-z0-9][A-Za-z0-9._-]*$'
    )
  ),
  CONSTRAINT privacy_events_app_version_check CHECK (
    metadata->'app_version' IS NULL
    OR (
      jsonb_typeof(metadata->'app_version') = 'string'
      AND char_length(metadata->>'app_version') BETWEEN 1 AND 32
      AND metadata->>'app_version' ~ '^[A-Za-z0-9][A-Za-z0-9._+-]*$'
    )
  ),
  CONSTRAINT privacy_events_setting_check CHECK (
    metadata->'setting' IS NULL
    OR (
      jsonb_typeof(metadata->'setting') = 'string'
      AND metadata->>'setting' IN (
        'partner_sharing',
        'analytics',
        'crash_reporting',
        'reminders'
      )
    )
  ),
  CONSTRAINT privacy_events_method_check CHECK (
    metadata->'method' IS NULL
    OR (
      jsonb_typeof(metadata->'method') = 'string'
      AND metadata->>'method' IN (
        'onboarding',
        'privacy_settings',
        'account_settings',
        'support_request'
      )
    )
  )
);

CREATE INDEX privacy_events_user_occurred_idx
  ON public.privacy_events (user_id, occurred_at DESC, id);

COMMENT ON TABLE public.privacy_events IS
  'Append-only owner privacy actions with allowlisted, non-content metadata.';

ALTER TABLE public.activity_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_plan_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staying_well_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staying_well_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sleep_diary_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_support_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.activity_plans,
  public.activity_plan_steps,
  public.safety_plans,
  public.safety_plan_items,
  public.staying_well_plans,
  public.staying_well_plan_items,
  public.sleep_diary_entries,
  public.partner_support_preferences,
  public.privacy_events
FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.activity_plans,
  public.activity_plan_steps,
  public.safety_plans,
  public.safety_plan_items,
  public.staying_well_plans,
  public.staying_well_plan_items,
  public.sleep_diary_entries,
  public.partner_support_preferences
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.activity_plans,
  public.activity_plan_steps,
  public.safety_plans,
  public.safety_plan_items,
  public.staying_well_plans,
  public.staying_well_plan_items,
  public.sleep_diary_entries,
  public.partner_support_preferences
TO service_role;

-- Authenticated users can append only through record_privacy_event and cannot
-- update or delete audit rows. The service role may ingest but not rewrite rows.
GRANT SELECT ON TABLE public.privacy_events TO authenticated;
GRANT SELECT, INSERT ON TABLE public.privacy_events TO service_role;

CREATE POLICY "Users own activity plans"
  ON public.activity_plans
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users own activity plan steps"
  ON public.activity_plan_steps
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users own safety plans"
  ON public.safety_plans
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users own safety plan items"
  ON public.safety_plan_items
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users own staying-well plans"
  ON public.staying_well_plans
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users own staying-well plan items"
  ON public.staying_well_plan_items
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users own sleep diary entries"
  ON public.sleep_diary_entries
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users own partner support preferences"
  ON public.partner_support_preferences
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users read their own privacy events"
  ON public.privacy_events
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.record_privacy_event(
  p_event_type TEXT,
  p_platform TEXT,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_event_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.privacy_events (
    user_id,
    event_type,
    platform,
    metadata
  )
  VALUES (
    v_user_id,
    p_event_type,
    p_platform,
    COALESCE(p_metadata, '{}'::JSONB)
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_privacy_event(TEXT, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_privacy_event(TEXT, TEXT, JSONB)
  TO authenticated;

-- A function invocation is one transaction, so child and parent cleanup either
-- completes together or rolls back together.
CREATE OR REPLACE FUNCTION public.delete_owned_data(
  p_user_id UUID,
  p_session_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_migrated_session_ids TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF (p_user_id IS NULL) = (p_session_id IS NULL) THEN
    RAISE EXCEPTION 'Exactly one owner identifier is required';
  END IF;

  IF p_user_id IS NOT NULL THEN
    SELECT COALESCE(array_agg(session_id), ARRAY[]::TEXT[])
      INTO v_migrated_session_ids
      FROM public.user_data_migration
      WHERE user_id = p_user_id;

    DELETE FROM public.privacy_events WHERE user_id = p_user_id;
    DELETE FROM public.partner_support_preferences WHERE user_id = p_user_id;
    DELETE FROM public.sleep_diary_entries WHERE user_id = p_user_id;
    DELETE FROM public.safety_plan_items WHERE user_id = p_user_id;
    DELETE FROM public.safety_plans WHERE user_id = p_user_id;
    DELETE FROM public.staying_well_plan_items WHERE user_id = p_user_id;
    DELETE FROM public.staying_well_plans WHERE user_id = p_user_id;
    DELETE FROM public.activity_plan_steps WHERE user_id = p_user_id;
    DELETE FROM public.activity_plans WHERE user_id = p_user_id;
    DELETE FROM public.partner_celebrations
      WHERE owner_id = p_user_id OR partner_id = p_user_id;
    DELETE FROM public.partner_links
      WHERE owner_id = p_user_id OR partner_id = p_user_id;
    DELETE FROM public.partner_invites WHERE owner_id = p_user_id;
    DELETE FROM public.reminder_deliveries WHERE user_id = p_user_id;
    DELETE FROM public.wellbeing_reminders WHERE user_id = p_user_id;
    DELETE FROM public.push_subscriptions WHERE user_id = p_user_id;
    DELETE FROM public.dismissed_notices WHERE user_id = p_user_id;
    DELETE FROM public.focus_sessions WHERE user_id = p_user_id;
    DELETE FROM public.life_plan_items WHERE user_id = p_user_id;
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
    DELETE FROM public.user_data_migration WHERE user_id = p_user_id;
    DELETE FROM public.anonymous_sessions AS session
      WHERE session.session_id = ANY(v_migrated_session_ids)
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_data_migration AS migration
        WHERE migration.session_id = session.session_id
      );
  ELSE
    DELETE FROM public.user_affirmation_history WHERE session_id = p_session_id;
    DELETE FROM public.user_book_favorites WHERE session_id = p_session_id;
    DELETE FROM public.chat_history WHERE session_id = p_session_id;
    DELETE FROM public.habits WHERE session_id = p_session_id;
    DELETE FROM public.goals WHERE session_id = p_session_id;
    DELETE FROM public.assessments WHERE session_id = p_session_id;
    DELETE FROM public.moods WHERE session_id = p_session_id;
    DELETE FROM public.user_data_migration WHERE session_id = p_session_id;
    DELETE FROM public.anonymous_sessions WHERE session_id = p_session_id;
  END IF;

  RETURN jsonb_build_object('deleted', true);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_owned_data(UUID, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_owned_data(UUID, TEXT)
  TO service_role;
