#!/usr/bin/env bash
# Verifies the accountability-partner migration against a real Postgres.
# The central claim under test: an active partner CANNOT read the owner's raw
# moods / assessments / journal rows, and CAN read derived counts.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINER=mh-partner-rls-test
PGPASSWORD=testpw

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup

echo "== starting postgres =="
docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD="$PGPASSWORD" -p 55433:5432 postgres:16-alpine >/dev/null
for i in $(seq 1 40); do
  docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done

psql() { docker exec -i -e PGPASSWORD="$PGPASSWORD" "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"; }
psql_soft() { docker exec -i -e PGPASSWORD="$PGPASSWORD" "$CONTAINER" psql -U postgres -d postgres "$@"; }

echo "== installing supabase-compatible auth shim =="
psql <<'SQL'
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
GRANT anon, authenticated, service_role TO postgres;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE
);

-- Model the small part of Supabase Storage used by repo migrations. The real
-- local Supabase stack supplies these objects; this standalone Postgres harness
-- must provide them so migrations and their owner-folder policies are tested.
CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE storage.buckets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  public BOOLEAN NOT NULL DEFAULT FALSE,
  file_size_limit BIGINT,
  allowed_mime_types TEXT[]
);
CREATE TABLE storage.objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id TEXT NOT NULL REFERENCES storage.buckets(id) ON DELETE CASCADE,
  name TEXT NOT NULL
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION storage.foldername(name TEXT)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN name = '' THEN ARRAY[]::TEXT[]
    ELSE string_to_array(name, '/')
  END
$$;

-- The stock PostgreSQL image does not ship Supabase's pg_cron extension.
-- Emulate only the scheduling call so the rest of that migration must still
-- apply successfully and can participate in the privacy verification.
CREATE SCHEMA IF NOT EXISTS cron;
CREATE OR REPLACE FUNCTION cron.schedule(
  job_name TEXT,
  schedule TEXT,
  command TEXT
) RETURNS BIGINT
LANGUAGE sql
AS $$ SELECT 1::BIGINT $$;

-- Mirrors Supabase's implementation closely enough for RLS testing.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS JSONB
LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'sub', NULLIF(current_setting('request.jwt.claim.sub', true), ''),
    'is_anonymous',
      COALESCE(NULLIF(current_setting('request.jwt.claim.is_anonymous', true), ''), 'false')::boolean
  )
$$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT SELECT, INSERT, DELETE ON storage.objects TO authenticated;
SQL

echo "== applying repo migrations in order =="
apply_migration() {
  local file="$1"
  local name="$2"

  if [ "$name" = "20260716190633_secure_anonymous_auth.sql" ]; then
    sed '/^CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;$/d' \
      "$file" | psql -q -f -
  else
    psql -q -f - < "$file"
  fi
}

for f in "$REPO"/supabase/migrations/*.sql; do
  name=$(basename "$f")
  if apply_migration "$f" "$name" >/tmp/mig.log 2>&1; then
    if [ "$name" = "20260716190633_secure_anonymous_auth.sql" ]; then
      echo "  ok    $name  (pg_cron scheduling shim)"
    else
      echo "  ok    $name"
    fi
  else
    echo "  FAIL  $name"
    tail -20 /tmp/mig.log
    exit 1
  fi
done

echo "== mirroring Supabase's default grants (RLS, not GRANT, is the gate) =="
# Supabase grants authenticated/anon broad table access on public and relies on
# row-level security to filter. Without this the test would prove only that a
# GRANT was missing, which is not the property we care about.
psql <<'SQL'
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
SQL

echo "== seeding owner A, partner B, and outsider C =="
psql <<'SQL'
INSERT INTO auth.users (id) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000002'),
  ('cccccccc-0000-0000-0000-000000000003');

INSERT INTO public.moods
  (user_id, emoji, note, created_at, local_date, utc_offset_minutes)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', '🙂', 'SECRET MOOD NOTE',
   NOW(), CURRENT_DATE, 0),
  ('aaaaaaaa-0000-0000-0000-000000000001', '😐', 'ANOTHER SECRET',
   NOW() - INTERVAL '1 day', CURRENT_DATE - 1, 0),
  ('aaaaaaaa-0000-0000-0000-000000000001', '😄', 'OUTSIDE WINDOW',
   NOW() - INTERVAL '7 days', CURRENT_DATE - 7, 0);

INSERT INTO public.assessments (user_id, type, score, max_score, responses) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'PHQ9', 18, 27, '{"item9":2}'::jsonb);

INSERT INTO public.journal_entries (user_id, title, content) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'SECRET JOURNAL', 'PRIVATE CONTENT');

INSERT INTO public.chat_history (user_id, messages, saved) VALUES
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    '[{"role":"user","content":"SECRET CHAT"}]'::jsonb,
    TRUE
  );

INSERT INTO public.goals (user_id, content, status, date) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'SECRET GOAL TEXT', 'completed', CURRENT_DATE),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ANOTHER GOAL',     'pending',   CURRENT_DATE),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'OUTSIDE WINDOW',   'completed', CURRENT_DATE - 7);

WITH new_habit AS (
  INSERT INTO public.habits (
    user_id,
    name,
    is_active,
    accountability_enabled,
    accountability_days,
    accountability_timezone,
    accountability_share_streak
  )
  VALUES (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'SECRET HABIT NAME',
    TRUE,
    TRUE,
    ARRAY[0, 1, 2, 3, 4, 5, 6]::SMALLINT[],
    'UTC',
    TRUE
  )
  RETURNING id
)
INSERT INTO public.habit_logs (habit_id, completed, log_date)
SELECT id, TRUE, CURRENT_DATE - day_offset
  FROM new_habit
 CROSS JOIN generate_series(0, 5) AS day_offset;

INSERT INTO public.life_plan_items (
  user_id,
  item_type,
  horizon,
  title,
  reflection,
  next_step,
  status
)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'milestone',
  '30_days',
  'SECRET PLAN TITLE',
  'SECRET PLAN REFLECTION',
  'SECRET PLAN STEP',
  'complete'
);

INSERT INTO public.focus_sessions (
  user_id,
  task_label,
  completed_cycles,
  status,
  completed_at
)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'SECRET FOCUS TASK',
  1,
  'complete',
  NOW()
);

INSERT INTO public.user_library_items (
  user_id,
  content_id,
  media_type,
  is_saved,
  custom_notes
)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'privacy-test-book',
  'book',
  TRUE,
  'SECRET LIBRARY NOTE'
);

INSERT INTO public.partner_links
  (
    owner_id, partner_id, status, share_goals, share_habits,
    share_checkins, share_mood_trend, share_streaks, allow_celebrations,
    share_journal_activity, share_assessment_activity, share_planner_progress,
    share_focus_progress, share_library_activity
  )
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002',
   'active', TRUE, TRUE, TRUE, FALSE, TRUE, TRUE,
   TRUE, TRUE, TRUE, TRUE, TRUE);
SQL

run_as() { # role_uid, sql — -q suppresses the SET command tags so only the
  # query result is captured.
  docker exec -i -e PGPASSWORD="$PGPASSWORD" "$CONTAINER" \
    psql -U postgres -d postgres -tAq -c "SET ROLE authenticated; SET request.jwt.claim.sub = '$1'; SET request.jwt.claim.is_anonymous = 'false'; $2" 2>&1
}

run_as_anonymous() {
  docker exec -i -e PGPASSWORD="$PGPASSWORD" "$CONTAINER" \
    psql -U postgres -d postgres -tAq -c "SET ROLE authenticated; SET request.jwt.claim.sub = '$1'; SET request.jwt.claim.is_anonymous = 'true'; $2" 2>&1
}

A=aaaaaaaa-0000-0000-0000-000000000001
B=bbbbbbbb-0000-0000-0000-000000000002
C=cccccccc-0000-0000-0000-000000000003

pass=0; fail=0
check() { # label, actual, expected_regex
  if echo "$2" | grep -qE "$3"; then echo "  PASS  $1"; pass=$((pass+1));
  else echo "  FAIL  $1"; echo "        got: $(echo "$2" | head -2 | tr '\n' ' ')"; fail=$((fail+1)); fi
}

ACTIVITY_PLAN_ID=11111111-1111-4111-8111-111111111111
ACTIVITY_STEP_ID=11111111-1111-4111-8111-111111111112
SAFETY_PLAN_ID=22222222-2222-4222-8222-222222222221
SAFETY_ITEM_ID=22222222-2222-4222-8222-222222222222
STAYING_WELL_PLAN_ID=33333333-3333-4333-8333-333333333331
STAYING_WELL_ITEM_ID=33333333-3333-4333-8333-333333333332
SLEEP_ENTRY_ID=44444444-4444-4444-8444-444444444441

echo ""
echo "== PRACTICE PROGRESS: owner-bound RPC and raw-row privacy =="
check "A saves version 1 of paused practice progress" \
  "$(run_as $A "SELECT (public.save_practice_progress('$A', 'meditation', 'gentle-breath-reset', '/meditate', 0, 5, 0)).version;")" \
  '^1$'
check "A cannot save with a stale owner identity" \
  "$(run_as $A "SELECT public.save_practice_progress('$C', 'meditation', 'gentle-breath-reset', '/meditate', 0, 6, 1);")" \
  'practice_progress_owner_changed|ERROR'
check "B reads 0 of A's paused practice rows" \
  "$(run_as $B "SELECT count(*) FROM public.practice_progress WHERE user_id='$A';")" \
  '^0$'
check "B cannot save a paused practice for A" \
  "$(run_as $B "SELECT public.save_practice_progress('$A', 'meditation', 'gentle-breath-reset', '/meditate', 0, 6, 1);")" \
  'practice_progress_owner_changed|ERROR'
check "A gets an optimistic-version conflict" \
  "$(run_as $A "SELECT public.save_practice_progress('$A', 'meditation', 'gentle-breath-reset', '/meditate', 0, 6, 0);")" \
  'practice_progress_conflict|ERROR'
check "A clears the exact saved version" \
  "$(run_as $A "SELECT public.clear_practice_progress('$A', 'meditation', 'gentle-breath-reset', '/meditate', 1);")" \
  '^t$'
check "A has no paused practice row after clear" \
  "$(run_as $A "SELECT count(*) FROM public.practice_progress WHERE user_id='$A';")" \
  '^0$'

echo ""
echo "== PRIVATE WELLBEING: owner A can create and read every owned row =="
check "A creates an activity plan" \
  "$(run_as $A "INSERT INTO public.activity_plans (id, user_id, plan_date, activity_kind, title, details, planned_minutes) VALUES ('$ACTIVITY_PLAN_ID', '$A', CURRENT_DATE, 'movement', 'PRIVATE ACTIVITY', 'PRIVATE ACTIVITY DETAILS', 20) RETURNING id;")" \
  "^$ACTIVITY_PLAN_ID$"
check "A creates an activity plan step" \
  "$(run_as $A "INSERT INTO public.activity_plan_steps (id, plan_id, user_id, action, timing, location, estimated_minutes, position) VALUES ('$ACTIVITY_STEP_ID', '$ACTIVITY_PLAN_ID', '$A', 'PRIVATE STEP', 'morning', 'home', 10, 1) RETURNING id;")" \
  "^$ACTIVITY_STEP_ID$"
check "A creates a safety plan" \
  "$(run_as $A "INSERT INTO public.safety_plans (id, user_id, title, status) VALUES ('$SAFETY_PLAN_ID', '$A', 'PRIVATE SAFETY PLAN', 'draft') RETURNING id;")" \
  "^$SAFETY_PLAN_ID$"
check "A creates a safety plan item" \
  "$(run_as $A "INSERT INTO public.safety_plan_items (id, plan_id, user_id, item_kind, label, details, position) VALUES ('$SAFETY_ITEM_ID', '$SAFETY_PLAN_ID', '$A', 'warning_sign', 'PRIVATE WARNING', 'PRIVATE SAFETY DETAILS', 0) RETURNING id;")" \
  "^$SAFETY_ITEM_ID$"
check "A creates a staying-well plan" \
  "$(run_as $A "INSERT INTO public.staying_well_plans (id, user_id, title, status) VALUES ('$STAYING_WELL_PLAN_ID', '$A', 'PRIVATE STAYING WELL PLAN', 'draft') RETURNING id;")" \
  "^$STAYING_WELL_PLAN_ID$"
check "A creates a staying-well plan item" \
  "$(run_as $A "INSERT INTO public.staying_well_plan_items (id, plan_id, user_id, item_kind, label, details, position) VALUES ('$STAYING_WELL_ITEM_ID', '$STAYING_WELL_PLAN_ID', '$A', 'trigger', 'PRIVATE TRIGGER', 'PRIVATE STAYING WELL DETAILS', 0) RETURNING id;")" \
  "^$STAYING_WELL_ITEM_ID$"
check "A creates a sleep diary entry" \
  "$(run_as $A "INSERT INTO public.sleep_diary_entries (id, user_id, entry_date, went_to_bed_at, tried_to_sleep_at, fell_asleep_at, woke_up_at, got_out_of_bed_at, awakenings, awake_minutes, sleep_quality, restedness, notes) VALUES ('$SLEEP_ENTRY_ID', '$A', CURRENT_DATE, NOW() - INTERVAL '9 hours', NOW() - INTERVAL '8 hours 45 minutes', NOW() - INTERVAL '8 hours 30 minutes', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '15 minutes', 1, 10, 4, 3, 'PRIVATE SLEEP NOTES') RETURNING id;")" \
  "^$SLEEP_ENTRY_ID$"
check "A creates partner support preferences" \
  "$(run_as $A "INSERT INTO public.partner_support_preferences (user_id, support_style, check_in_frequency, advice_mode) VALUES ('$A', 'listening', 'weekly', 'ask_first') RETURNING user_id;")" \
  "^$A$"
check "A reads all eight private wellbeing row types" \
  "$(run_as $A "SELECT (SELECT count(*) FROM public.activity_plans WHERE user_id='$A') || ':' || (SELECT count(*) FROM public.activity_plan_steps WHERE user_id='$A') || ':' || (SELECT count(*) FROM public.safety_plans WHERE user_id='$A') || ':' || (SELECT count(*) FROM public.safety_plan_items WHERE user_id='$A') || ':' || (SELECT count(*) FROM public.staying_well_plans WHERE user_id='$A') || ':' || (SELECT count(*) FROM public.staying_well_plan_items WHERE user_id='$A') || ':' || (SELECT count(*) FROM public.sleep_diary_entries WHERE user_id='$A') || ':' || (SELECT count(*) FROM public.partner_support_preferences WHERE user_id='$A');")" \
  '^1:1:1:1:1:1:1:1$'

echo ""
echo "== PRIVATE WELLBEING: owner A can update every mutable row =="
check "A updates an activity plan" \
  "$(run_as $A "UPDATE public.activity_plans SET title='UPDATED PRIVATE ACTIVITY' WHERE id='$ACTIVITY_PLAN_ID' RETURNING title;")" \
  '^UPDATED PRIVATE ACTIVITY$'
check "A updates an activity plan step" \
  "$(run_as $A "UPDATE public.activity_plan_steps SET action='UPDATED PRIVATE STEP' WHERE id='$ACTIVITY_STEP_ID' RETURNING action;")" \
  '^UPDATED PRIVATE STEP$'
check "A updates a safety plan" \
  "$(run_as $A "UPDATE public.safety_plans SET title='UPDATED PRIVATE SAFETY PLAN' WHERE id='$SAFETY_PLAN_ID' RETURNING title;")" \
  '^UPDATED PRIVATE SAFETY PLAN$'
check "A updates a safety plan item" \
  "$(run_as $A "UPDATE public.safety_plan_items SET label='UPDATED PRIVATE WARNING' WHERE id='$SAFETY_ITEM_ID' RETURNING label;")" \
  '^UPDATED PRIVATE WARNING$'
check "A updates a staying-well plan" \
  "$(run_as $A "UPDATE public.staying_well_plans SET title='UPDATED PRIVATE STAYING WELL PLAN' WHERE id='$STAYING_WELL_PLAN_ID' RETURNING title;")" \
  '^UPDATED PRIVATE STAYING WELL PLAN$'
check "A updates a staying-well plan item" \
  "$(run_as $A "UPDATE public.staying_well_plan_items SET label='UPDATED PRIVATE TRIGGER' WHERE id='$STAYING_WELL_ITEM_ID' RETURNING label;")" \
  '^UPDATED PRIVATE TRIGGER$'
check "A updates a sleep diary entry" \
  "$(run_as $A "UPDATE public.sleep_diary_entries SET notes='UPDATED PRIVATE SLEEP NOTES' WHERE id='$SLEEP_ENTRY_ID' RETURNING notes;")" \
  '^UPDATED PRIVATE SLEEP NOTES$'
check "A updates partner support preferences" \
  "$(run_as $A "UPDATE public.partner_support_preferences SET support_style='encouragement' WHERE user_id='$A' RETURNING support_style;")" \
  '^encouragement$'

echo ""
echo "== PRIVATE WELLBEING: owner A can delete and recreate every mutable row =="
check "A deletes an activity plan step" \
  "$(run_as $A "DELETE FROM public.activity_plan_steps WHERE id='$ACTIVITY_STEP_ID' RETURNING id;")" \
  "^$ACTIVITY_STEP_ID$"
check "A deletes an activity plan" \
  "$(run_as $A "DELETE FROM public.activity_plans WHERE id='$ACTIVITY_PLAN_ID' RETURNING id;")" \
  "^$ACTIVITY_PLAN_ID$"
check "A deletes a safety plan item" \
  "$(run_as $A "DELETE FROM public.safety_plan_items WHERE id='$SAFETY_ITEM_ID' RETURNING id;")" \
  "^$SAFETY_ITEM_ID$"
check "A deletes a safety plan" \
  "$(run_as $A "DELETE FROM public.safety_plans WHERE id='$SAFETY_PLAN_ID' RETURNING id;")" \
  "^$SAFETY_PLAN_ID$"
check "A deletes a staying-well plan item" \
  "$(run_as $A "DELETE FROM public.staying_well_plan_items WHERE id='$STAYING_WELL_ITEM_ID' RETURNING id;")" \
  "^$STAYING_WELL_ITEM_ID$"
check "A deletes a staying-well plan" \
  "$(run_as $A "DELETE FROM public.staying_well_plans WHERE id='$STAYING_WELL_PLAN_ID' RETURNING id;")" \
  "^$STAYING_WELL_PLAN_ID$"
check "A deletes a sleep diary entry" \
  "$(run_as $A "DELETE FROM public.sleep_diary_entries WHERE id='$SLEEP_ENTRY_ID' RETURNING id;")" \
  "^$SLEEP_ENTRY_ID$"
check "A deletes partner support preferences" \
  "$(run_as $A "DELETE FROM public.partner_support_preferences WHERE user_id='$A' RETURNING user_id;")" \
  "^$A$"
check "A recreates the private rows for denial and lifecycle tests" \
  "$(run_as $A "INSERT INTO public.activity_plans (id, user_id, plan_date, activity_kind, title, details, planned_minutes) VALUES ('$ACTIVITY_PLAN_ID', '$A', CURRENT_DATE, 'movement', 'PRIVATE ACTIVITY', 'PRIVATE ACTIVITY DETAILS', 20); INSERT INTO public.activity_plan_steps (id, plan_id, user_id, action, position) VALUES ('$ACTIVITY_STEP_ID', '$ACTIVITY_PLAN_ID', '$A', 'PRIVATE STEP', 1); INSERT INTO public.safety_plans (id, user_id, title) VALUES ('$SAFETY_PLAN_ID', '$A', 'PRIVATE SAFETY PLAN'); INSERT INTO public.safety_plan_items (id, plan_id, user_id, item_kind, label, details, position) VALUES ('$SAFETY_ITEM_ID', '$SAFETY_PLAN_ID', '$A', 'warning_sign', 'PRIVATE WARNING', 'PRIVATE SAFETY DETAILS', 0); INSERT INTO public.staying_well_plans (id, user_id, title) VALUES ('$STAYING_WELL_PLAN_ID', '$A', 'PRIVATE STAYING WELL PLAN'); INSERT INTO public.staying_well_plan_items (id, plan_id, user_id, item_kind, label, details, position) VALUES ('$STAYING_WELL_ITEM_ID', '$STAYING_WELL_PLAN_ID', '$A', 'trigger', 'PRIVATE TRIGGER', 'PRIVATE STAYING WELL DETAILS', 0); INSERT INTO public.sleep_diary_entries (id, user_id, entry_date, notes) VALUES ('$SLEEP_ENTRY_ID', '$A', CURRENT_DATE, 'PRIVATE SLEEP NOTES'); INSERT INTO public.partner_support_preferences (user_id, support_style) VALUES ('$A', 'listening'); SELECT (SELECT count(*) FROM public.activity_plans WHERE user_id='$A') || ':' || (SELECT count(*) FROM public.activity_plan_steps WHERE user_id='$A') || ':' || (SELECT count(*) FROM public.safety_plans WHERE user_id='$A') || ':' || (SELECT count(*) FROM public.safety_plan_items WHERE user_id='$A') || ':' || (SELECT count(*) FROM public.staying_well_plans WHERE user_id='$A') || ':' || (SELECT count(*) FROM public.staying_well_plan_items WHERE user_id='$A') || ':' || (SELECT count(*) FROM public.sleep_diary_entries WHERE user_id='$A') || ':' || (SELECT count(*) FROM public.partner_support_preferences WHERE user_id='$A');")" \
  '^1:1:1:1:1:1:1:1$'

echo ""
echo "== PRIVATE WELLBEING: active partner B cannot read A's raw rows =="
check "B reads 0 of A's activity plans" "$(run_as $B "SELECT count(*) FROM public.activity_plans WHERE user_id='$A';")" '^0$'
check "B reads 0 of A's activity steps" "$(run_as $B "SELECT count(*) FROM public.activity_plan_steps WHERE user_id='$A';")" '^0$'
check "B reads 0 of A's safety plans" "$(run_as $B "SELECT count(*) FROM public.safety_plans WHERE user_id='$A';")" '^0$'
check "B reads 0 of A's safety items" "$(run_as $B "SELECT count(*) FROM public.safety_plan_items WHERE user_id='$A';")" '^0$'
check "B reads 0 of A's staying-well plans" "$(run_as $B "SELECT count(*) FROM public.staying_well_plans WHERE user_id='$A';")" '^0$'
check "B reads 0 of A's staying-well items" "$(run_as $B "SELECT count(*) FROM public.staying_well_plan_items WHERE user_id='$A';")" '^0$'
check "B reads 0 of A's sleep diary" "$(run_as $B "SELECT count(*) FROM public.sleep_diary_entries WHERE user_id='$A';")" '^0$'
check "B reads 0 of A's support preferences" "$(run_as $B "SELECT count(*) FROM public.partner_support_preferences WHERE user_id='$A';")" '^0$'

echo ""
echo "== PRIVATE WELLBEING: outsider C cannot read A's raw rows =="
check "C reads 0 of A's activity plans" "$(run_as $C "SELECT count(*) FROM public.activity_plans WHERE user_id='$A';")" '^0$'
check "C reads 0 of A's activity steps" "$(run_as $C "SELECT count(*) FROM public.activity_plan_steps WHERE user_id='$A';")" '^0$'
check "C reads 0 of A's safety plans" "$(run_as $C "SELECT count(*) FROM public.safety_plans WHERE user_id='$A';")" '^0$'
check "C reads 0 of A's safety items" "$(run_as $C "SELECT count(*) FROM public.safety_plan_items WHERE user_id='$A';")" '^0$'
check "C reads 0 of A's staying-well plans" "$(run_as $C "SELECT count(*) FROM public.staying_well_plans WHERE user_id='$A';")" '^0$'
check "C reads 0 of A's staying-well items" "$(run_as $C "SELECT count(*) FROM public.staying_well_plan_items WHERE user_id='$A';")" '^0$'
check "C reads 0 of A's sleep diary" "$(run_as $C "SELECT count(*) FROM public.sleep_diary_entries WHERE user_id='$A';")" '^0$'
check "C reads 0 of A's support preferences" "$(run_as $C "SELECT count(*) FROM public.partner_support_preferences WHERE user_id='$A';")" '^0$'

echo ""
echo "== PRIVATE WELLBEING: partner B cannot mutate A's rows =="
check "B cannot insert an activity plan for A" "$(run_as $B "INSERT INTO public.activity_plans (user_id, plan_date, activity_kind, title) VALUES ('$A', CURRENT_DATE, 'other', 'CRAFTED');")" 'row-level security|permission denied|ERROR'
check "B cannot insert an activity step for A" "$(run_as $B "INSERT INTO public.activity_plan_steps (plan_id, user_id, action, position) VALUES ('$ACTIVITY_PLAN_ID', '$A', 'CRAFTED', 2);")" 'row-level security|permission denied|ERROR'
check "B cannot insert a safety plan for A" "$(run_as $B "INSERT INTO public.safety_plans (user_id, title) VALUES ('$A', 'CRAFTED');")" 'row-level security|permission denied|ERROR'
check "B cannot insert a safety item for A" "$(run_as $B "INSERT INTO public.safety_plan_items (plan_id, user_id, item_kind, label, position) VALUES ('$SAFETY_PLAN_ID', '$A', 'other', 'CRAFTED', 1);")" 'row-level security|permission denied|ERROR'
check "B cannot insert a staying-well plan for A" "$(run_as $B "INSERT INTO public.staying_well_plans (user_id, title) VALUES ('$A', 'CRAFTED');")" 'row-level security|permission denied|ERROR'
check "B cannot insert a staying-well item for A" "$(run_as $B "INSERT INTO public.staying_well_plan_items (plan_id, user_id, item_kind, label, position) VALUES ('$STAYING_WELL_PLAN_ID', '$A', 'other', 'CRAFTED', 1);")" 'row-level security|permission denied|ERROR'
check "B cannot insert a sleep entry for A" "$(run_as $B "INSERT INTO public.sleep_diary_entries (user_id, entry_date) VALUES ('$A', CURRENT_DATE - 1);")" 'row-level security|permission denied|ERROR'
check "B cannot insert support preferences for A" "$(run_as $B "INSERT INTO public.partner_support_preferences (user_id) VALUES ('$A');")" 'row-level security|permission denied|duplicate key|ERROR'
check "B updates 0 of A's activity plans" "$(run_as $B "UPDATE public.activity_plans SET title='CRAFTED' WHERE user_id='$A' RETURNING id;")" '^$'
check "B updates 0 of A's activity steps" "$(run_as $B "UPDATE public.activity_plan_steps SET action='CRAFTED' WHERE user_id='$A' RETURNING id;")" '^$'
check "B updates 0 of A's safety plans" "$(run_as $B "UPDATE public.safety_plans SET title='CRAFTED' WHERE user_id='$A' RETURNING id;")" '^$'
check "B updates 0 of A's safety items" "$(run_as $B "UPDATE public.safety_plan_items SET label='CRAFTED' WHERE user_id='$A' RETURNING id;")" '^$'
check "B updates 0 of A's staying-well plans" "$(run_as $B "UPDATE public.staying_well_plans SET title='CRAFTED' WHERE user_id='$A' RETURNING id;")" '^$'
check "B updates 0 of A's staying-well items" "$(run_as $B "UPDATE public.staying_well_plan_items SET label='CRAFTED' WHERE user_id='$A' RETURNING id;")" '^$'
check "B updates 0 of A's sleep diary" "$(run_as $B "UPDATE public.sleep_diary_entries SET notes='CRAFTED' WHERE user_id='$A' RETURNING id;")" '^$'
check "B updates 0 of A's support preferences" "$(run_as $B "UPDATE public.partner_support_preferences SET support_style='mixed' WHERE user_id='$A' RETURNING user_id;")" '^$'
check "B deletes 0 of A's eight private row types" \
  "$(run_as $B "WITH d1 AS (DELETE FROM public.activity_plan_steps WHERE user_id='$A' RETURNING 1), d2 AS (DELETE FROM public.activity_plans WHERE user_id='$A' RETURNING 1), d3 AS (DELETE FROM public.safety_plan_items WHERE user_id='$A' RETURNING 1), d4 AS (DELETE FROM public.safety_plans WHERE user_id='$A' RETURNING 1), d5 AS (DELETE FROM public.staying_well_plan_items WHERE user_id='$A' RETURNING 1), d6 AS (DELETE FROM public.staying_well_plans WHERE user_id='$A' RETURNING 1), d7 AS (DELETE FROM public.sleep_diary_entries WHERE user_id='$A' RETURNING 1), d8 AS (DELETE FROM public.partner_support_preferences WHERE user_id='$A' RETURNING 1) SELECT (SELECT count(*) FROM d1) || ':' || (SELECT count(*) FROM d2) || ':' || (SELECT count(*) FROM d3) || ':' || (SELECT count(*) FROM d4) || ':' || (SELECT count(*) FROM d5) || ':' || (SELECT count(*) FROM d6) || ':' || (SELECT count(*) FROM d7) || ':' || (SELECT count(*) FROM d8);")" \
  '^0:0:0:0:0:0:0:0$'

echo ""
echo "== PRIVACY EVENTS: approved RPC append only, raw DML refused =="
PRIVACY_EVENT_ID="$(run_as $A "SELECT public.record_privacy_event('consent_granted', 'ios', '{\"policy_version\":\"2026.08\",\"method\":\"privacy_settings\"}'::jsonb);")"
check "A appends a privacy event through the approved RPC" "$PRIVACY_EVENT_ID" '^[0-9a-f-]{36}$'
check "A reads its appended privacy event" \
  "$(run_as $A "SELECT event_type || ':' || platform FROM public.privacy_events WHERE id='$PRIVACY_EVENT_ID';")" \
  '^consent_granted:ios$'
check "B reads 0 of A's privacy events" "$(run_as $B "SELECT count(*) FROM public.privacy_events WHERE user_id='$A';")" '^0$'
check "C reads 0 of A's privacy events" "$(run_as $C "SELECT count(*) FROM public.privacy_events WHERE user_id='$A';")" '^0$'
check "A cannot directly insert a privacy event" \
  "$(run_as $A "INSERT INTO public.privacy_events (user_id, event_type, platform) VALUES ('$A', 'consent_withdrawn', 'web');")" \
  'row-level security|permission denied|ERROR'
check "A cannot directly update a privacy event" \
  "$(run_as $A "UPDATE public.privacy_events SET event_type='consent_withdrawn' WHERE id='$PRIVACY_EVENT_ID' RETURNING id;")" \
  '^$'
check "A cannot directly delete a privacy event" \
  "$(run_as $A "DELETE FROM public.privacy_events WHERE id='$PRIVACY_EVENT_ID' RETURNING id;")" \
  '^$'
check "direct privacy-event DML left the append unchanged" \
  "$(run_as $A "SELECT event_type || ':' || count(*) FROM public.privacy_events WHERE id='$PRIVACY_EVENT_ID' GROUP BY event_type;")" \
  '^consent_granted:1$'
check "privacy RPC rejects arbitrary metadata" \
  "$(run_as $A "SELECT public.record_privacy_event('consent_granted', 'ios', '{\"private_note\":\"must not be logged\"}'::jsonb);")" \
  'privacy_events_metadata_shape_check|violates check constraint|ERROR'

echo ""
echo "== OPERATIONAL EVENTS: fixed authenticated taxonomy only =="
run_as $A "SELECT public.record_operational_event('render_error', 'ios');" >/dev/null
check "A appends one operational event through the approved RPC" \
  "$(run_as $A "SELECT count(*) FROM public.operational_events WHERE event_type='render_error' AND source='ios';")" \
  '^1$'
check "B reads 0 of A's operational events" "$(run_as $B "SELECT count(*) FROM public.operational_events WHERE user_id='$A';")" '^0$'
check "C reads 0 of A's operational events" "$(run_as $C "SELECT count(*) FROM public.operational_events WHERE user_id='$A';")" '^0$'
check "A cannot directly insert an operational event" \
  "$(run_as $A "INSERT INTO public.operational_events (user_id, event_type, source) VALUES ('$A', 'render_error', 'ios');")" \
  'row-level security|permission denied|ERROR'
check "A updates 0 operational events" \
  "$(run_as $A "UPDATE public.operational_events SET event_type='notification_response_failed' WHERE user_id='$A' RETURNING event_type;")" \
  '^$'
check "A deletes 0 operational events" \
  "$(run_as $A "DELETE FROM public.operational_events WHERE user_id='$A' RETURNING event_type;")" \
  '^$'
check "operational RPC rejects unknown event names" \
  "$(run_as $A "SELECT public.record_operational_event('custom_event', 'ios');")" \
  'operational_events_type_check|violates check constraint|ERROR'
check "operational RPC rejects Android sources" \
  "$(run_as $A "SELECT public.record_operational_event('render_error', 'android');")" \
  'operational_events_source_check|violates check constraint|ERROR'
check "operational RPC rejects cross-source error names" \
  "$(run_as $A "SELECT public.record_operational_event('route_error', 'ios');")" \
  'operational_events_source_type_check|violates check constraint|ERROR'

echo ""
echo "== NEGATIVE: partner B must not reach A's raw rows =="
check "B reads 0 of A's moods"       "$(run_as $B "SELECT count(*) FROM public.moods WHERE user_id='$A';")" '^0$'
check "B reads 0 of A's assessments" "$(run_as $B "SELECT count(*) FROM public.assessments WHERE user_id='$A';")" '^0$'
check "B reads 0 of A's goals"       "$(run_as $B "SELECT count(*) FROM public.goals WHERE user_id='$A';")" '^0$'
check "B reads 0 of A's journal"     "$(run_as $B "SELECT count(*) FROM public.journal_entries WHERE user_id='$A';")" '^0$'
check "B reads 0 of A's AI chat"     "$(run_as $B "SELECT count(*) FROM public.chat_history WHERE user_id='$A';")" '^0$'
check "B reads 0 of A's planner"     "$(run_as $B "SELECT count(*) FROM public.life_plan_items WHERE user_id='$A';")" '^0$'
check "B reads 0 of A's focus data"  "$(run_as $B "SELECT count(*) FROM public.focus_sessions WHERE user_id='$A';")" '^0$'
check "B reads 0 of A's library"     "$(run_as $B "SELECT count(*) FROM public.user_library_items WHERE user_id='$A';")" '^0$'
check "B cannot see mood note text"  "$(run_as $B "SELECT coalesce(string_agg(note,','),'NONE') FROM public.moods;")" 'NONE'

echo ""
echo "== POSITIVE: partner B gets derived counts =="
SNAP="$(run_as $B "SELECT public.partner_snapshot('$A');")"
check "snapshot returns goals counts"  "$SNAP" '"goals":'
check "snapshot goal completed = 1"    "$SNAP" '"completed": ?1'
check "snapshot has checkins"          "$SNAP" '"checkins":'
check "snapshot counts two distinct check-in days" "$SNAP" '"days": ?2'
check "snapshot habit is due today"    "$SNAP" '"due_today": ?1'
check "snapshot habit is complete"     "$SNAP" '"completed_today": ?1'
check "snapshot returns best streak count" "$SNAP" '"best_current": ?6'
check "snapshot journal entries = 1"   "$SNAP" '"journal": ?\{"entries": ?1\}'
check "snapshot assessments = 1"       "$SNAP" '"assessments": ?\{"completed": ?1\}'
check "snapshot planner items = 1"     "$SNAP" '"planner": ?\{"completed": ?1\}'
check "snapshot focus sessions = 1"    "$SNAP" '"focus": ?\{"sessions": ?1\}'
check "snapshot library activity = 1"  "$SNAP" '"library": ?\{"items": ?1\}'
if echo "$SNAP" | grep -qE '"(total|tracked)":'; then
  echo "  FAIL  snapshot contains an undisclosed secondary count"; fail=$((fail+1))
else
  echo "  PASS  each enabled category returns only its disclosed count"; pass=$((pass+1))
fi
if echo "$SNAP" | grep -qE 'mood_trend|🙂|😐|[0-9]{4}-[0-9]{2}-[0-9]{2}'; then
  echo "  FAIL  snapshot contains non-count mood data"; fail=$((fail+1))
else
  echo "  PASS  snapshot contains no dates or mood emoji"; pass=$((pass+1))
fi
if echo "$SNAP" | grep -q 'SECRET GOAL TEXT'; then
  echo "  FAIL  snapshot leaks goal text"; fail=$((fail+1))
else
  echo "  PASS  snapshot leaks no goal text"; pass=$((pass+1))
fi
if echo "$SNAP" | grep -q 'SECRET HABIT NAME'; then
  echo "  FAIL  snapshot leaks habit name"; fail=$((fail+1))
else
  echo "  PASS  snapshot leaks no habit name"; pass=$((pass+1))
fi
if echo "$SNAP" | grep -qE 'SECRET (MOOD|JOURNAL|CHAT|PLAN|FOCUS|LIBRARY)|"score": ?18'; then
  echo "  FAIL  snapshot leaks sensitive content"; fail=$((fail+1))
else
  echo "  PASS  snapshot leaks no sensitive content or assessment score"; pass=$((pass+1))
fi
echo "        snapshot: $(echo "$SNAP" | cut -c1-170)"

echo ""
echo "== FIXED-FORMAT CELEBRATIONS =="
CELEBRATION_ID="$(run_as $B "SELECT public.send_partner_celebration('$A', 'habit_streak', 'cheer', NULL);")"
check "B can cheer a visible streak" "$CELEBRATION_ID" '^[0-9a-f-]{36}$'
check "B sees only its fixed celebration row" \
  "$(run_as $B "SELECT source || ':' || milestone_count FROM public.partner_celebrations WHERE id='$CELEBRATION_ID';")" \
  '^habit_streak:6$'
check "A sees the received celebration" \
  "$(run_as $A "SELECT count(*) FROM public.partner_celebrations WHERE id='$CELEBRATION_ID';")" \
  '^1$'
check "C sees no celebration rows" \
  "$(run_as $C "SELECT count(*) FROM public.partner_celebrations;")" \
  '^0$'
check "B cannot insert a custom celebration row" \
  "$(run_as $B "INSERT INTO public.partner_celebrations (link_id, owner_id, partner_id, kind, source, milestone_count, dedupe_key) SELECT id, owner_id, partner_id, 'cheer', 'general', 0, 'crafted' FROM public.partner_links WHERE owner_id='$A';")" \
  'row-level security|permission denied|ERROR'
check "duplicate cheer is idempotent" \
  "$(run_as $B "SELECT public.send_partner_celebration('$A', 'habit_streak', 'cheer', NULL);")" \
  "^$CELEBRATION_ID$"

echo ""
echo "== owner-only policies actually in force on moods =="
psql -tAq -c "SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='moods';"

echo ""
echo "== NEGATIVE: outsider C is refused =="
check "C cannot call snapshot on A" "$(run_as $C "SELECT public.partner_snapshot('$A');")" 'not an active partner'
check "anonymous auth cannot call snapshot" \
  "$(run_as_anonymous $B "SELECT public.partner_snapshot('$A');")" \
  'permanent account'

echo ""
echo "== GUARD: partner B may revoke but not widen =="
check "B widening scopes is blocked" \
  "$(run_as $B "UPDATE public.partner_links SET share_mood_trend=TRUE, share_goals=TRUE WHERE owner_id='$A' AND partner_id='$B';")" \
  'may only|ERROR'
check "B changing a new scope is blocked" \
  "$(run_as $B "UPDATE public.partner_links SET share_library_activity=FALSE WHERE owner_id='$A' AND partner_id='$B';")" \
  'may only|ERROR'
check "B setting status=active blocked" \
  "$(run_as $B "UPDATE public.partner_links SET status='active' WHERE owner_id='$A' AND partner_id='$B';")" \
  'may only|ERROR|UPDATE 0'
check "B revoking own link works" \
  "$(run_as $B "UPDATE public.partner_links SET status='revoked' WHERE owner_id='$A' AND partner_id='$B'; SELECT status FROM public.partner_links WHERE owner_id='$A';")" \
  'revoked'
check "after revoke, snapshot refused" \
  "$(run_as $B "SELECT public.partner_snapshot('$A');")" 'not an active partner'
check "owner cannot reactivate revoked link" \
  "$(run_as $A "UPDATE public.partner_links SET status='active' WHERE owner_id='$A' AND partner_id='$B';")" \
  'cannot be reactivated|ERROR'

echo ""
echo "== RECONNECT: a fresh accepted invite creates a new active row =="
psql -q <<'SQL'
INSERT INTO public.partner_invites (owner_id, token_hash)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  encode(extensions.digest('fresh-token', 'sha256'), 'hex')
);
SQL
FIRST_HASH="$(psql -tAq -c "SELECT encode(extensions.digest('fresh-token', 'sha256'), 'hex');")"
STORED_HASH="$(psql -tAq -c "SELECT token_hash FROM public.partner_invites WHERE owner_id='$A' AND status='pending';")"
check "database stores a second hash" \
  "$(psql -tAq -c "SELECT ('$FIRST_HASH' <> '$STORED_HASH')::text;")" \
  '^true$'
check "stored hash cannot be replayed" \
  "$(run_as $B "SELECT public.accept_partner_invite('$STORED_HASH');")" \
  'invalid or has expired'
check "fresh invite is accepted" \
  "$(run_as $B "SELECT public.accept_partner_invite('$FIRST_HASH');")" \
  '^[0-9a-f-]{36}$'
check "one active link exists after reconnect" \
  "$(run_as $A "SELECT count(*) FROM public.partner_links WHERE partner_id='$B' AND status='active';")" \
  '^1$'
check "revoked history is preserved" \
  "$(run_as $A "SELECT count(*) FROM public.partner_links WHERE partner_id='$B' AND status='revoked';")" \
  '^1$'
check "partner cannot rewrite active link metadata" \
  "$(run_as $B "UPDATE public.partner_links SET partner_label='tampered' WHERE owner_id='$A' AND partner_id='$B' AND status='active';")" \
  'may only|ERROR'

echo ""
echo "== NEGATIVE: both participants must be permanent accounts =="
psql -q <<'SQL'
INSERT INTO auth.users (id, is_anonymous) VALUES
  ('dddddddd-0000-0000-0000-000000000004', TRUE),
  ('eeeeeeee-0000-0000-0000-000000000005', FALSE);

INSERT INTO public.partner_links
  (
    owner_id, partner_id, status, share_goals, share_habits,
    share_checkins, share_mood_trend, share_streaks, allow_celebrations
  )
VALUES
  ('dddddddd-0000-0000-0000-000000000004','eeeeeeee-0000-0000-0000-000000000005',
   'active', TRUE, TRUE, TRUE, FALSE, TRUE, TRUE),
  ('aaaaaaaa-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000004',
   'active', TRUE, TRUE, TRUE, FALSE, TRUE, TRUE);
SQL
D=dddddddd-0000-0000-0000-000000000004
E=eeeeeeee-0000-0000-0000-000000000005
check "permanent partner cannot read anonymous-owner link" \
  "$(run_as $E "SELECT count(*) FROM public.partner_links WHERE owner_id='$D';")" \
  '^0$'
check "permanent partner cannot snapshot anonymous owner" \
  "$(run_as $E "SELECT public.partner_snapshot('$D');")" \
  'both accountability participants must be permanent accounts'
check "anonymous partner cannot read permanent-owner link" \
  "$(run_as_anonymous $D "SELECT count(*) FROM public.partner_links WHERE owner_id='$A';")" \
  '^0$'

echo ""
echo "== TRANSACTIONAL PLAN AND SLEEP CONSTRAINTS =="
check "activity RPC rejects a fourth step before writing" \
  "$(run_as $A "SELECT public.save_activity_plan(NULL, CURRENT_DATE, 'movement', 'TOO MANY STEPS', '', 'anytime', 20, '[{\"action\":\"one\",\"timing\":\"\",\"estimated_minutes\":null,\"position\":1},{\"action\":\"two\",\"timing\":\"\",\"estimated_minutes\":null,\"position\":2},{\"action\":\"three\",\"timing\":\"\",\"estimated_minutes\":null,\"position\":3},{\"action\":\"four\",\"timing\":\"\",\"estimated_minutes\":null,\"position\":4}]'::jsonb);")" \
  'at most 3 steps|ERROR'
check "rejected activity RPC leaves no parent behind" \
  "$(run_as $A "SELECT count(*) FROM public.activity_plans WHERE title='TOO MANY STEPS';")" \
  '^0$'
check "activity RPC rolls back parent when a child is invalid" \
  "$(run_as $A "SELECT public.save_activity_plan(NULL, CURRENT_DATE, 'movement', 'ROLLBACK ACTIVITY', '', 'anytime', 20, '[{\"action\":\"\",\"timing\":\"\",\"estimated_minutes\":null,\"position\":1}]'::jsonb);")" \
  'invalid|ERROR'
check "invalid child rollback leaves no activity parent" \
  "$(run_as $A "SELECT count(*) FROM public.activity_plans WHERE title='ROLLBACK ACTIVITY';")" \
  '^0$'
ATOMIC_SAFETY_ID="$(run_as $A "SELECT public.save_safety_plan(NULL, 'ATOMIC SAFETY', '[{\"item_kind\":\"warning_sign\",\"label\":\"notice isolation\",\"details\":\"\",\"position\":0}]'::jsonb);")"
check "first safety save creates parent and item atomically" \
  "$(run_as $A "SELECT (SELECT count(*) FROM public.safety_plans WHERE id='$ATOMIC_SAFETY_ID') || ':' || (SELECT count(*) FROM public.safety_plan_items WHERE plan_id='$ATOMIC_SAFETY_ID');")" \
  '^1:1$'
check "sleep chronology compares non-adjacent entered fields" \
  "$(run_as $A "INSERT INTO public.sleep_diary_entries (user_id, entry_date, went_to_bed_at, fell_asleep_at) VALUES ('$A', CURRENT_DATE - 2, NOW(), NOW() - INTERVAL '1 hour');")" \
  'sleep_diary_entries_timeline_check|violates check constraint|ERROR'
check "sleep timezone rejects malformed IANA identifiers" \
  "$(run_as $A "INSERT INTO public.sleep_diary_entries (user_id, entry_date, timezone_name) VALUES ('$A', CURRENT_DATE - 3, 'Not/A Valid Zone');")" \
  'sleep_diary_entries_timezone_check|violates check constraint|ERROR'

echo ""
echo "== SESSION DATA LIFECYCLE =="
psql -q <<SQL
INSERT INTO public.anonymous_sessions (session_id) VALUES ('mapped-owner-a'), ('session-lifecycle');
INSERT INTO public.user_data_migration (session_id, user_id) VALUES
  ('mapped-owner-a', '$A'),
  ('session-lifecycle', '$C');
INSERT INTO public.moods (session_id, emoji) VALUES ('session-lifecycle', '😐');
SQL
check "service role deletes a session-owned profile" \
  "$(docker exec -i -e PGPASSWORD="$PGPASSWORD" "$CONTAINER" psql -U postgres -d postgres -tAq -c "SET ROLE service_role; SELECT public.delete_owned_data(NULL, 'session-lifecycle');")" \
  '"deleted": true'
check "session deletion removes content, mapping, and anonymous owner" \
  "$(psql -tAq -c "SELECT (SELECT count(*) FROM public.moods WHERE session_id='session-lifecycle') || ':' || (SELECT count(*) FROM public.user_data_migration WHERE session_id='session-lifecycle') || ':' || (SELECT count(*) FROM public.anonymous_sessions WHERE session_id='session-lifecycle');")" \
  '^0:0:0$'

echo ""
echo "== DATA LIFECYCLE: delete_owned_data removes every new A-owned row =="
check "service role deletes A's owned data" \
  "$(docker exec -i -e PGPASSWORD="$PGPASSWORD" "$CONTAINER" psql -U postgres -d postgres -tAq -c "SET ROLE service_role; SELECT public.delete_owned_data('$A', NULL);")" \
  '"deleted": true'
check "all A-owned private wellbeing, privacy, and operational rows are gone" \
  "$(psql -tAq -c "SELECT (SELECT count(*) FROM public.activity_plans WHERE user_id='$A') || ':' || (SELECT count(*) FROM public.activity_plan_steps WHERE user_id='$A') || ':' || (SELECT count(*) FROM public.safety_plans WHERE user_id='$A') || ':' || (SELECT count(*) FROM public.safety_plan_items WHERE user_id='$A') || ':' || (SELECT count(*) FROM public.staying_well_plans WHERE user_id='$A') || ':' || (SELECT count(*) FROM public.staying_well_plan_items WHERE user_id='$A') || ':' || (SELECT count(*) FROM public.sleep_diary_entries WHERE user_id='$A') || ':' || (SELECT count(*) FROM public.partner_support_preferences WHERE user_id='$A') || ':' || (SELECT count(*) FROM public.privacy_events WHERE user_id='$A') || ':' || (SELECT count(*) FROM public.operational_events WHERE user_id='$A');")" \
  '^0:0:0:0:0:0:0:0:0:0$'
check "user deletion removes its migration mapping and orphaned anonymous owner" \
  "$(psql -tAq -c "SELECT (SELECT count(*) FROM public.user_data_migration WHERE user_id='$A') || ':' || (SELECT count(*) FROM public.anonymous_sessions WHERE session_id='mapped-owner-a');")" \
  '^0:0$'

echo ""
echo "================================"
echo "  PASS: $pass    FAIL: $fail"
echo "================================"
[ "$fail" -eq 0 ]
