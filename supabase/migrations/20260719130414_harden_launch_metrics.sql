-- Launch measurement begins at this explicit UTC boundary. Users whose first
-- check-in predates it are existing users and are not counted toward the
-- 500-user launch goal.
ALTER TABLE public.moods
  ADD COLUMN local_date DATE,
  ADD COLUMN utc_offset_minutes SMALLINT;

UPDATE public.moods
SET
  local_date = (created_at AT TIME ZONE 'UTC')::date,
  utc_offset_minutes = 0
WHERE local_date IS NULL OR utc_offset_minutes IS NULL;

ALTER TABLE public.moods
  ALTER COLUMN local_date SET DEFAULT CURRENT_DATE,
  ALTER COLUMN local_date SET NOT NULL,
  ALTER COLUMN utc_offset_minutes SET DEFAULT 0,
  ALTER COLUMN utc_offset_minutes SET NOT NULL,
  ADD CONSTRAINT moods_utc_offset_range
    CHECK (utc_offset_minutes BETWEEN -720 AND 840);

COMMENT ON COLUMN public.moods.local_date IS
  'Calendar date on the device when the check-in was saved.';
COMMENT ON COLUMN public.moods.utc_offset_minutes IS
  'Device UTC offset in minutes when the check-in was saved.';

CREATE INDEX idx_moods_user_local_date
  ON public.moods(user_id, local_date)
  WHERE user_id IS NOT NULL;

CREATE OR REPLACE VIEW public.growth_metrics_by_source
WITH (security_invoker = true)
AS
WITH first_check_in AS (
  SELECT DISTINCT ON (moods.user_id)
    moods.user_id,
    moods.created_at AS first_check_in_at,
    moods.local_date AS first_local_date
  FROM public.moods
  WHERE moods.user_id IS NOT NULL
  ORDER BY moods.user_id, moods.created_at, moods.id
),
launch_cohorts AS (
  SELECT *
  FROM first_check_in
  WHERE first_check_in_at >= TIMESTAMPTZ '2026-07-19 13:00:00+00'
),
cohort_activity AS (
  SELECT
    launch_cohorts.user_id,
    launch_cohorts.first_check_in_at,
    launch_cohorts.first_local_date,
    COUNT(DISTINCT moods.local_date)
      FILTER (
        WHERE moods.local_date >= launch_cohorts.first_local_date
          AND moods.local_date < launch_cohorts.first_local_date + 7
      ) AS active_days_first_7,
    BOOL_OR(
      moods.local_date >= launch_cohorts.first_local_date + 7
      AND moods.local_date < launch_cohorts.first_local_date + 14
    ) AS returned_days_8_to_14
  FROM launch_cohorts
  JOIN public.moods
    ON moods.user_id = launch_cohorts.user_id
  GROUP BY
    launch_cohorts.user_id,
    launch_cohorts.first_check_in_at,
    launch_cohorts.first_local_date
)
SELECT
  cohort_activity.first_local_date AS cohort_date,
  COALESCE(acquisition_attribution.source, 'unattributed') AS source,
  COALESCE(acquisition_attribution.medium, 'unattributed') AS medium,
  COALESCE(acquisition_attribution.campaign, 'unattributed') AS campaign,
  COALESCE(acquisition_attribution.content, 'unattributed') AS content,
  COALESCE(acquisition_attribution.platform, 'unattributed') AS platform,
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
  'Aggregate launch cohorts since 2026-07-19T13:00:00Z, bucketed by device-local check-in date; missing attribution is explicit.';

REVOKE ALL ON TABLE public.growth_metrics_by_source FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.growth_metrics_by_source TO service_role;
