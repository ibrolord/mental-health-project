-- Operational telemetry is intentionally taxonomy-only. The schema has no
-- free-form payload column, and every accepted value is bounded below.
CREATE TABLE public.operational_events (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT operational_events_type_check CHECK (
    event_type IN (
      'route_error',
      'global_error',
      'render_error',
      'notification_permission_granted',
      'notification_permission_denied',
      'notification_registration_succeeded',
      'notification_registration_failed',
      'notification_scheduling_succeeded',
      'notification_scheduling_failed',
      'notification_response_received',
      'notification_response_failed'
    )
  ),
  CONSTRAINT operational_events_source_check CHECK (
    source IN ('web', 'ios')
  ),
  CONSTRAINT operational_events_source_type_check CHECK (
    (
      source = 'web'
      AND event_type IN (
        'route_error',
        'global_error',
        'notification_permission_granted',
        'notification_permission_denied',
        'notification_registration_succeeded',
        'notification_registration_failed',
        'notification_scheduling_succeeded',
        'notification_scheduling_failed',
        'notification_response_received',
        'notification_response_failed'
      )
    )
    OR
    (
      source = 'ios'
      AND event_type IN (
        'render_error',
        'notification_permission_granted',
        'notification_permission_denied',
        'notification_registration_succeeded',
        'notification_registration_failed',
        'notification_scheduling_succeeded',
        'notification_scheduling_failed',
        'notification_response_received',
        'notification_response_failed'
      )
    )
  )
);

CREATE INDEX operational_events_user_occurred_idx
  ON public.operational_events (user_id, occurred_at DESC);

COMMENT ON TABLE public.operational_events IS
  'Owner-scoped operational event names from fixed web and iOS taxonomies.';

ALTER TABLE public.operational_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.operational_events
  FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON TABLE public.operational_events TO authenticated, service_role;

CREATE POLICY "Users read their own operational events"
  ON public.operational_events
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.record_operational_event(
  p_event_type TEXT,
  p_source TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.operational_events (
    user_id,
    event_type,
    source
  )
  VALUES (
    v_user_id,
    p_event_type,
    p_source
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_operational_event(TEXT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_operational_event(TEXT, TEXT)
  TO authenticated;

-- Keep clear-data deletion transactional as the ownership inventory expands.
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

    DELETE FROM public.operational_events WHERE user_id = p_user_id;
    DELETE FROM public.practice_progress WHERE user_id = p_user_id;
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
