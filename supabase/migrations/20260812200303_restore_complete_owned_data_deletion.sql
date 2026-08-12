-- Restore the complete deletion contract after the accountability migration
-- extended this function without preserving newer owned-data domains.
-- The filename matches the timestamp recorded by the production deployment.
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

    -- Keep the surviving person's relationship history while removing every
    -- membership and private contribution that belongs to the deleted user.
    DELETE FROM public.accountability_connections
      WHERE owner_id = p_user_id AND status = 'invited';
    UPDATE public.accountability_connections
      SET status = 'revoked',
          ended_at = COALESCE(ended_at, NOW()),
          ended_by = p_user_id,
          invite_token_hash = NULL
      WHERE owner_id = p_user_id OR partner_id = p_user_id;
    DELETE FROM public.accountability_memberships
      WHERE connection_id IN (
        SELECT id
        FROM public.accountability_connections
        WHERE owner_id = p_user_id OR partner_id = p_user_id
      );
    DELETE FROM public.accountability_comments WHERE author_id = p_user_id;
    DELETE FROM public.accountability_nudges
      WHERE sender_id = p_user_id OR recipient_id = p_user_id;
    DELETE FROM public.accountability_priority_suggestions
      WHERE suggested_by = p_user_id;
    DELETE FROM public.accountability_commitments WHERE owner_id = p_user_id;
    DELETE FROM public.accountability_scope_controls WHERE owner_id = p_user_id;
    DELETE FROM public.accountability_blocks
      WHERE blocker_id = p_user_id OR blocked_id = p_user_id;
    UPDATE public.accountability_connections
      SET owner_id = CASE WHEN owner_id = p_user_id THEN NULL ELSE owner_id END,
          partner_id = CASE WHEN partner_id = p_user_id THEN NULL ELSE partner_id END,
          ended_by = CASE WHEN ended_by = p_user_id THEN NULL ELSE ended_by END
      WHERE owner_id = p_user_id OR partner_id = p_user_id OR ended_by = p_user_id;

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
    DELETE FROM public.goal_attachments WHERE user_id = p_user_id;
    DELETE FROM public.goal_milestones WHERE user_id = p_user_id;
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
