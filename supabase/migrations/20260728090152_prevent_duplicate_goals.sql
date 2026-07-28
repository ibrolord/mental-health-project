ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

COMMENT ON COLUMN public.goals.dedupe_key IS
  'Server-generated MD5 identity digest. NULL is reserved for retained historical duplicates.';

CREATE OR REPLACE FUNCTION public.set_goal_dedupe_key()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_identity_key text;
BEGIN
  v_identity_key := pg_catalog.md5(
    pg_catalog.jsonb_build_array(
      NEW.date,
      COALESCE(NEW.framework::text, ''),
      COALESCE(NEW.priority::text, ''),
      COALESCE(NEW.eisenhower_quadrant, ''),
      pg_catalog.lower(
        pg_catalog.regexp_replace(
          pg_catalog.btrim(NEW.content),
          '[[:space:]]+',
          ' ',
          'g'
        )
      )
    )::text
  );

  -- Account migration can legitimately converge a legacy and current goal.
  -- Retain both rows, but leave only the existing row as the uniqueness anchor.
  IF TG_OP = 'UPDATE' THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        COALESCE(
          'user:' || NEW.user_id::text,
          'session:' || NEW.session_id
        ) || ':' || v_identity_key,
        0
      )
    );

    IF (
      (
        NEW.user_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.goals AS existing
          WHERE existing.user_id = NEW.user_id
            AND existing.dedupe_key = v_identity_key
            AND existing.id <> NEW.id
        )
      )
      OR
      (
        NEW.session_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.goals AS existing
          WHERE existing.session_id = NEW.session_id
            AND existing.dedupe_key = v_identity_key
            AND existing.id <> NEW.id
        )
      )
    )
    THEN
      NEW.dedupe_key := NULL;
    ELSE
      NEW.dedupe_key := v_identity_key;
    END IF;
  ELSE
    NEW.dedupe_key := v_identity_key;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_goal_dedupe_key ON public.goals;

-- Reinitialize only internal metadata so the backfill remains deterministic if
-- this migration is reapplied after a partial rollout.
UPDATE public.goals
SET dedupe_key = NULL
WHERE dedupe_key IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.goals
    WHERE (user_id IS NULL) = (session_id IS NULL)
  ) THEN
    RAISE EXCEPTION 'Goals must have exactly one owner before dedupe backfill';
  END IF;
END;
$$;

WITH goal_identities AS (
  SELECT
    id,
    CASE
      WHEN user_id IS NOT NULL THEN 'user:' || user_id::text
      ELSE 'session:' || session_id
    END AS owner_key,
    pg_catalog.md5(
      pg_catalog.jsonb_build_array(
        date,
        COALESCE(framework::text, ''),
        COALESCE(priority::text, ''),
        COALESCE(eisenhower_quadrant, ''),
        pg_catalog.lower(
          pg_catalog.regexp_replace(
            pg_catalog.btrim(content),
            '[[:space:]]+',
            ' ',
            'g'
          )
        )
      )::text
    ) AS identity_key,
    created_at
  FROM public.goals
),
ranked_goals AS (
  SELECT
    id,
    identity_key,
    pg_catalog.row_number() OVER (
      PARTITION BY owner_key, identity_key
      ORDER BY created_at, id
    ) AS identity_rank
  FROM goal_identities
)
UPDATE public.goals AS goal
SET dedupe_key = canonical.identity_key
FROM ranked_goals AS canonical
WHERE goal.id = canonical.id
  AND canonical.identity_rank = 1;

ALTER TABLE public.goals
  DROP CONSTRAINT IF EXISTS goals_dedupe_key_format;
ALTER TABLE public.goals
  ADD CONSTRAINT goals_dedupe_key_format
  CHECK (dedupe_key IS NULL OR dedupe_key ~ '^[0-9a-f]{32}$');

CREATE UNIQUE INDEX IF NOT EXISTS goals_user_dedupe_key_unique
  ON public.goals (user_id, dedupe_key)
  WHERE user_id IS NOT NULL AND dedupe_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS goals_session_dedupe_key_unique
  ON public.goals (session_id, dedupe_key)
  WHERE session_id IS NOT NULL AND dedupe_key IS NOT NULL;

CREATE TRIGGER set_goal_dedupe_key
  BEFORE INSERT OR UPDATE
  ON public.goals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_goal_dedupe_key();
