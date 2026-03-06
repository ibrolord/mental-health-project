-- ============================================================
-- Migration 004: Fix RLS policies + Add habit streak trigger
-- ============================================================

-- NOTE ON ANONYMOUS SESSION SECURITY:
-- Anonymous users connect via the Supabase anon key without a JWT.
-- Postgres RLS cannot verify which session_id belongs to which client
-- at the database level alone. Our security layers are:
--   1. API auth middleware validates session_id exists in DB before processing
--   2. Client-side queries always filter by the user's own session_id
--   3. INSERT policies ensure users can only write with their own identifiers
-- For full DB-level isolation of anonymous users, migrate to
-- supabase.auth.signInAnonymously() which provides real JWTs.

-- ============================================================
-- Habit streak trigger (fixes bug: streak_count never incremented)
-- ============================================================

CREATE OR REPLACE FUNCTION update_habit_streak()
RETURNS TRIGGER AS $$
DECLARE
  yesterday_completed BOOLEAN;
  current_streak INT;
BEGIN
  -- Only process when marking as completed
  IF NEW.completed = true AND (OLD IS NULL OR OLD.completed = false) THEN
    -- Check if habit was completed yesterday
    SELECT completed INTO yesterday_completed
    FROM habit_logs
    WHERE habit_id = NEW.habit_id
      AND log_date = NEW.log_date::date - INTERVAL '1 day'
      AND completed = true;

    -- Get current streak
    SELECT streak_count INTO current_streak
    FROM habits WHERE id = NEW.habit_id;

    IF yesterday_completed THEN
      -- Continue streak
      UPDATE habits SET streak_count = current_streak + 1, updated_at = NOW()
      WHERE id = NEW.habit_id;
    ELSE
      -- Start new streak
      UPDATE habits SET streak_count = 1, updated_at = NOW()
      WHERE id = NEW.habit_id;
    END IF;

  -- If un-completing today's log, reset streak
  ELSIF NEW.completed = false AND OLD IS NOT NULL AND OLD.completed = true THEN
    -- Check if yesterday was completed
    SELECT completed INTO yesterday_completed
    FROM habit_logs
    WHERE habit_id = NEW.habit_id
      AND log_date = NEW.log_date::date - INTERVAL '1 day'
      AND completed = true;

    IF yesterday_completed THEN
      -- Recalculate streak from yesterday backwards
      WITH RECURSIVE streak AS (
        SELECT NEW.log_date::date - INTERVAL '1 day' AS check_date, 1 AS days
        UNION ALL
        SELECT s.check_date - INTERVAL '1 day', s.days + 1
        FROM streak s
        WHERE EXISTS (
          SELECT 1 FROM habit_logs
          WHERE habit_id = NEW.habit_id
            AND log_date = s.check_date - INTERVAL '1 day'
            AND completed = true
        )
      )
      SELECT MAX(days) INTO current_streak FROM streak;

      UPDATE habits SET streak_count = COALESCE(current_streak, 0), updated_at = NOW()
      WHERE id = NEW.habit_id;
    ELSE
      UPDATE habits SET streak_count = 0, updated_at = NOW()
      WHERE id = NEW.habit_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS habit_streak_trigger ON habit_logs;

CREATE TRIGGER habit_streak_trigger
  AFTER INSERT OR UPDATE ON habit_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_habit_streak();
