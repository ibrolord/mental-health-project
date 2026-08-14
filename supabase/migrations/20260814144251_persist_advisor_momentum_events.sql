-- XP is earned only from an owner saving a completed habit log. The event
-- ledger is append-only to clients and survives rolling-window changes.
CREATE TABLE public.advisor_momentum_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_log_id UUID NOT NULL REFERENCES public.habit_logs(id) ON DELETE CASCADE,
  points SMALLINT NOT NULL DEFAULT 10,
  earned_on DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT advisor_momentum_events_habit_log_unique UNIQUE (habit_log_id),
  CONSTRAINT advisor_momentum_events_points_check CHECK (points = 10)
);

CREATE INDEX advisor_momentum_events_user_earned_idx
  ON public.advisor_momentum_events (user_id, earned_on DESC);

COMMENT ON TABLE public.advisor_momentum_events IS
  'Owner-readable XP ledger generated from completed habit logs. Mood and Health data never create events.';

ALTER TABLE public.advisor_momentum_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.advisor_momentum_events
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.advisor_momentum_events TO authenticated, service_role;

CREATE POLICY "Owners read their own momentum events"
  ON public.advisor_momentum_events
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.sync_advisor_momentum_from_habit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF NEW.completed IS NOT TRUE THEN
    DELETE FROM public.advisor_momentum_events
    WHERE habit_log_id = NEW.id;
    RETURN NEW;
  END IF;

  SELECT habit.user_id
  INTO v_user_id
  FROM public.habits AS habit
  WHERE habit.id = NEW.habit_id;

  -- Anonymous habit data is supported elsewhere but has no account-level XP.
  IF v_user_id IS NULL THEN
    DELETE FROM public.advisor_momentum_events
    WHERE habit_log_id = NEW.id;
    RETURN NEW;
  END IF;

  INSERT INTO public.advisor_momentum_events (
    user_id,
    habit_log_id,
    points,
    earned_on
  )
  VALUES (
    v_user_id,
    NEW.id,
    10,
    NEW.log_date
  )
  ON CONFLICT (habit_log_id)
  DO UPDATE SET
    user_id = EXCLUDED.user_id,
    points = EXCLUDED.points,
    earned_on = EXCLUDED.earned_on;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_advisor_momentum_from_habit_log()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER sync_advisor_momentum_after_habit_log
AFTER INSERT OR UPDATE OF completed, habit_id, log_date
ON public.habit_logs
FOR EACH ROW
EXECUTE FUNCTION public.sync_advisor_momentum_from_habit_log();

-- Existing completions become the starting XP balance without changing the
-- original habit records or exposing any mood/Health content.
INSERT INTO public.advisor_momentum_events (
  user_id,
  habit_log_id,
  points,
  earned_on,
  created_at
)
SELECT
  habit.user_id,
  habit_log.id,
  10,
  habit_log.log_date,
  habit_log.created_at
FROM public.habit_logs AS habit_log
JOIN public.habits AS habit ON habit.id = habit_log.habit_id
WHERE habit_log.completed IS TRUE
  AND habit.user_id IS NOT NULL
ON CONFLICT (habit_log_id) DO NOTHING;
