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
echo "================================"
echo "  PASS: $pass    FAIL: $fail"
echo "================================"
[ "$fail" -eq 0 ]
