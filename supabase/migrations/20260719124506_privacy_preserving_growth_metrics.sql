-- Store only the launch taxonomy needed to evaluate acquisition channels.
-- No mood value, note, assessment, chat content, email, referrer URL, or
-- advertising identifier is copied into this table.
CREATE TABLE public.acquisition_attribution (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  medium TEXT NOT NULL,
  campaign TEXT NOT NULL,
  content TEXT NOT NULL,
  platform TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT acquisition_source_format CHECK (
    char_length(source) BETWEEN 1 AND 32
    AND source ~ '^[a-z0-9][a-z0-9_-]*$'
  ),
  CONSTRAINT acquisition_source_allowed CHECK (
    source IN (
      'direct',
      'founder',
      'referral',
      'campus',
      'practitioner',
      'creator',
      'community',
      'producthunt',
      'linkedin',
      'x',
      'instagram',
      'newsletter',
      'other'
    )
  ),
  CONSTRAINT acquisition_medium_format CHECK (
    char_length(medium) BETWEEN 1 AND 32
    AND medium ~ '^[a-z0-9][a-z0-9_-]*$'
  ),
  CONSTRAINT acquisition_medium_allowed CHECK (
    medium IN (
      'direct',
      'dm',
      'email',
      'organic',
      'partner',
      'referral',
      'social',
      'qr',
      'newsletter',
      'other'
    )
  ),
  CONSTRAINT acquisition_campaign_format CHECK (
    char_length(campaign) BETWEEN 1 AND 48
    AND campaign ~ '^[a-z0-9][a-z0-9_-]*$'
  ),
  CONSTRAINT acquisition_campaign_allowed CHECK (
    campaign IN (
      'seven_day_check_in',
      'closed_test',
      'focused_launch',
      'other'
    )
  ),
  CONSTRAINT acquisition_content_format CHECK (
    char_length(content) BETWEEN 1 AND 48
    AND content ~ '^[a-z0-9][a-z0-9_-]*$'
  ),
  CONSTRAINT acquisition_content_allowed CHECK (
    content IN (
      'unspecified',
      'founder_note',
      'student_group',
      'practitioner_intro',
      'creator_demo',
      'member_share',
      'launch_post',
      'qr_card',
      'other'
    )
  ),
  CONSTRAINT acquisition_platform_allowed CHECK (
    platform IN ('web', 'ios', 'android')
  )
);

COMMENT ON TABLE public.acquisition_attribution IS
  'First-touch, allowlisted campaign labels captured after a user saves a check-in.';

ALTER TABLE public.acquisition_attribution ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.acquisition_attribution FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.acquisition_attribution TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.acquisition_attribution TO service_role;

CREATE POLICY "Users can read their own acquisition attribution"
  ON public.acquisition_attribution FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create their own acquisition attribution"
  ON public.acquisition_attribution FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their own acquisition attribution"
  ON public.acquisition_attribution FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- This view exposes only cohort counts. Service-role callers cannot use it to
-- recover a user ID or any mental-health content.
CREATE VIEW public.growth_metrics_by_source
WITH (security_invoker = true)
AS
WITH first_check_in AS (
  SELECT
    user_id,
    MIN(created_at) AS first_check_in_at
  FROM public.moods
  WHERE user_id IS NOT NULL
  GROUP BY user_id
),
cohort_activity AS (
  SELECT
    first_check_in.user_id,
    first_check_in.first_check_in_at,
    COUNT(DISTINCT (moods.created_at AT TIME ZONE 'UTC')::date)
      FILTER (
        WHERE moods.created_at >= first_check_in.first_check_in_at
          AND moods.created_at < first_check_in.first_check_in_at + INTERVAL '7 days'
      ) AS active_days_first_7,
    BOOL_OR(
      moods.created_at >= first_check_in.first_check_in_at + INTERVAL '7 days'
      AND moods.created_at < first_check_in.first_check_in_at + INTERVAL '14 days'
    ) AS returned_days_8_to_14
  FROM first_check_in
  JOIN public.moods
    ON moods.user_id = first_check_in.user_id
  GROUP BY first_check_in.user_id, first_check_in.first_check_in_at
)
SELECT
  (cohort_activity.first_check_in_at AT TIME ZONE 'UTC')::date AS cohort_date,
  COALESCE(acquisition_attribution.source, 'direct') AS source,
  COALESCE(acquisition_attribution.medium, 'direct') AS medium,
  COALESCE(acquisition_attribution.campaign, 'seven_day_check_in') AS campaign,
  COALESCE(acquisition_attribution.content, 'unspecified') AS content,
  COALESCE(acquisition_attribution.platform, 'unknown') AS platform,
  COUNT(*)::BIGINT AS activated_users,
  COUNT(*) FILTER (
    WHERE cohort_activity.first_check_in_at <= NOW() - INTERVAL '7 days'
  )::BIGINT AS eligible_for_week_one,
  COUNT(*) FILTER (
    WHERE cohort_activity.first_check_in_at <= NOW() - INTERVAL '7 days'
      AND cohort_activity.active_days_first_7 >= 3
  )::BIGINT AS engaged_users_3_of_7,
  COUNT(*) FILTER (
    WHERE cohort_activity.first_check_in_at <= NOW() - INTERVAL '14 days'
  )::BIGINT AS eligible_for_repeat_use,
  COUNT(*) FILTER (
    WHERE cohort_activity.first_check_in_at <= NOW() - INTERVAL '14 days'
      AND cohort_activity.returned_days_8_to_14
  )::BIGINT AS returned_users_days_8_to_14
FROM cohort_activity
LEFT JOIN public.acquisition_attribution
  ON acquisition_attribution.user_id = cohort_activity.user_id
GROUP BY 1, 2, 3, 4, 5, 6;

COMMENT ON VIEW public.growth_metrics_by_source IS
  'Aggregate activation and retention cohorts; contains no user-level or mental-health content.';

REVOKE ALL ON TABLE public.growth_metrics_by_source FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.growth_metrics_by_source TO service_role;

-- Include growth attribution in the existing transactional clear-data path.
CREATE OR REPLACE FUNCTION public.delete_owned_data(
  p_user_id UUID,
  p_session_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (p_user_id IS NULL) = (p_session_id IS NULL) THEN
    RAISE EXCEPTION 'Exactly one owner identifier is required';
  END IF;

  IF p_user_id IS NOT NULL THEN
    DELETE FROM public.acquisition_attribution WHERE user_id = p_user_id;
    DELETE FROM public.ai_response_reports WHERE user_id = p_user_id;
    DELETE FROM public.user_affirmation_history WHERE user_id = p_user_id;
    DELETE FROM public.user_book_favorites WHERE user_id = p_user_id;
    DELETE FROM public.chat_history WHERE user_id = p_user_id;
    DELETE FROM public.habits WHERE user_id = p_user_id;
    DELETE FROM public.goals WHERE user_id = p_user_id;
    DELETE FROM public.assessments WHERE user_id = p_user_id;
    DELETE FROM public.moods WHERE user_id = p_user_id;
  ELSE
    DELETE FROM public.user_affirmation_history WHERE session_id = p_session_id;
    DELETE FROM public.user_book_favorites WHERE session_id = p_session_id;
    DELETE FROM public.chat_history WHERE session_id = p_session_id;
    DELETE FROM public.habits WHERE session_id = p_session_id;
    DELETE FROM public.goals WHERE session_id = p_session_id;
    DELETE FROM public.assessments WHERE session_id = p_session_id;
    DELETE FROM public.moods WHERE session_id = p_session_id;
  END IF;

  RETURN jsonb_build_object('deleted', true);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_owned_data(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_owned_data(uuid, text) TO service_role;
