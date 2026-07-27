#!/usr/bin/env bash
# Proves the anonymous-account reaper deletes ONLY empty anonymous accounts.
#
# This function removes rows from auth.users, so the important assertions are
# the negative ones: a permanent account is never touched, and an anonymous
# account holding any data at all survives.
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINER=mh-reaper-test
PGPASSWORD=testpw

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup

docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD="$PGPASSWORD" postgres:16-alpine >/dev/null
for _ in $(seq 1 40); do
  docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done

psql() { docker exec -i -e PGPASSWORD="$PGPASSWORD" "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"; }
q() { docker exec -i -e PGPASSWORD="$PGPASSWORD" "$CONTAINER" psql -U postgres -d postgres -tAq -c "$1" 2>&1; }

# auth shim. is_anonymous and created_at are what the reaper predicates on.
psql >/dev/null 2>&1 <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
GRANT anon, authenticated, service_role TO postgres;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
SQL

for f in "$REPO"/supabase/migrations/*.sql; do
  psql -q -f - < "$f" >/dev/null 2>&1
done

OLD="NOW() - INTERVAL '60 days'"
psql >/dev/null 2>&1 <<SQL
-- A: old, anonymous, completely empty            -> SHOULD be reaped
-- B: old, anonymous, has one mood                -> must survive
-- C: old, anonymous, only an attribution row     -> must survive (growth signal)
-- D: old, PERMANENT account, empty               -> must survive
-- E: recent, anonymous, empty                    -> must survive (inside window)
INSERT INTO auth.users (id, is_anonymous, created_at) VALUES
  ('a0000000-0000-0000-0000-00000000000a', TRUE,  $OLD),
  ('b0000000-0000-0000-0000-00000000000b', TRUE,  $OLD),
  ('c0000000-0000-0000-0000-00000000000c', TRUE,  $OLD),
  ('d0000000-0000-0000-0000-00000000000d', FALSE, $OLD),
  ('e0000000-0000-0000-0000-00000000000e', TRUE,  NOW());

INSERT INTO public.moods (user_id, emoji, local_date, utc_offset_minutes)
VALUES ('b0000000-0000-0000-0000-00000000000b', '🙂', CURRENT_DATE, 0);

INSERT INTO public.acquisition_attribution (user_id, source, medium, campaign, content, platform)
VALUES ('c0000000-0000-0000-0000-00000000000c','direct','direct','seven_day_check_in','unspecified','web');
SQL

pass=0; fail=0
check() {
  if [ "$2" = "$3" ]; then echo "  PASS  $1"; pass=$((pass+1));
  else echo "  FAIL  $1 (got '$2', want '$3')"; fail=$((fail+1)); fi
}
alive() { q "SELECT count(*) FROM auth.users WHERE id='$1';"; }

echo "== DRY RUN must delete nothing =="
DRY="$(q "SELECT public.reap_stale_anonymous_users(30, TRUE);")"
echo "        $DRY"
check "dry run reports 1 eligible" "$(echo "$DRY" | grep -o '"eligible": *[0-9]*' | grep -o '[0-9]*')" "1"
check "dry run deleted 0"          "$(echo "$DRY" | grep -o '"deleted": *[0-9]*' | grep -o '[0-9]*')" "0"
check "A still present after dry run" "$(alive a0000000-0000-0000-0000-00000000000a)" "1"

echo ""
echo "== DEFAULT is dry run (no second argument) =="
DEF="$(q "SELECT public.reap_stale_anonymous_users(30);")"
check "defaults to dry_run=true" "$(echo "$DEF" | grep -o '"dry_run": *[a-z]*' | grep -o 'true\|false')" "true"

echo ""
echo "== APPLY =="
APP="$(q "SELECT public.reap_stale_anonymous_users(30, FALSE);")"
echo "        $APP"
check "deleted exactly 1"                  "$(echo "$APP" | grep -o '"deleted": *[0-9]*' | grep -o '[0-9]*')" "1"
check "A (empty anon, old) reaped"         "$(alive a0000000-0000-0000-0000-00000000000a)" "0"
check "B (has a mood) survived"            "$(alive b0000000-0000-0000-0000-00000000000b)" "1"
check "C (attribution only) survived"      "$(alive c0000000-0000-0000-0000-00000000000c)" "1"
check "D (permanent account) survived"     "$(alive d0000000-0000-0000-0000-00000000000d)" "1"
check "E (recent anon) survived"           "$(alive e0000000-0000-0000-0000-00000000000e)" "1"
check "B's mood row intact"                "$(q "SELECT count(*) FROM public.moods WHERE user_id='b0000000-0000-0000-0000-00000000000b';")" "1"

echo ""
echo "== guard rails =="
check "rejects a zero-day window" "$(q "SELECT public.reap_stale_anonymous_users(0, TRUE);" | grep -c 'Refusing')" "1"

echo ""
echo "== legacy anonymous_sessions reaper =="
psql >/dev/null 2>&1 <<SQL
INSERT INTO public.anonymous_sessions (session_id, last_active_at)
VALUES ('stale-empty', $OLD), ('stale-with-data', $OLD), ('fresh', NOW());
INSERT INTO public.moods (session_id, emoji, local_date, utc_offset_minutes)
VALUES ('stale-with-data', '😐', CURRENT_DATE, 0);
SQL
SES="$(q "SELECT public.reap_stale_anonymous_sessions(30, FALSE);")"
echo "        $SES"
check "session reaper deleted 1"      "$(echo "$SES" | grep -o '"deleted": *[0-9]*' | grep -o '[0-9]*')" "1"
check "empty stale session gone"      "$(q "SELECT count(*) FROM public.anonymous_sessions WHERE session_id='stale-empty';")" "0"
check "session with data survived"    "$(q "SELECT count(*) FROM public.anonymous_sessions WHERE session_id='stale-with-data';")" "1"
check "fresh session survived"        "$(q "SELECT count(*) FROM public.anonymous_sessions WHERE session_id='fresh';")" "1"

echo ""
echo "================================"
echo "  PASS: $pass    FAIL: $fail"
echo "================================"
[ "$fail" -eq 0 ]
