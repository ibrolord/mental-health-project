#!/usr/bin/env bash
# Verifies the accountability-partner migration against a real Postgres.
# The central claim under test: an active partner CANNOT read the owner's raw
# moods / assessments / journal rows, and CAN read derived counts.
set -uo pipefail

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
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
GRANT anon, authenticated, service_role TO postgres;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.users (id UUID PRIMARY KEY DEFAULT gen_random_uuid());

-- Mirrors Supabase's implementation closely enough for RLS testing.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
SQL

echo "== applying repo migrations in order =="
for f in "$REPO"/supabase/migrations/*.sql; do
  name=$(basename "$f")
  if psql -q -f - < "$f" >/tmp/mig.log 2>&1; then
    echo "  ok    $name"
  else
    echo "  SKIP  $name  ($(tail -1 /tmp/mig.log | cut -c1-90))"
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

INSERT INTO public.moods (user_id, emoji, note, created_at) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', '🙂', 'SECRET MOOD NOTE', NOW()),
  ('aaaaaaaa-0000-0000-0000-000000000001', '😐', 'ANOTHER SECRET',  NOW() - INTERVAL '1 day');

INSERT INTO public.assessments (user_id, type, score, max_score, responses) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'PHQ9', 18, 27, '{"item9":2}'::jsonb);

INSERT INTO public.goals (user_id, content, status, date) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'SECRET GOAL TEXT', 'completed', CURRENT_DATE),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ANOTHER GOAL',     'pending',   CURRENT_DATE);

INSERT INTO public.partner_links
  (owner_id, partner_id, status, share_goals, share_habits, share_checkins, share_mood_trend)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002',
   'active', TRUE, TRUE, TRUE, TRUE);
SQL

run_as() { # role_uid, sql — -q suppresses the SET command tags so only the
  # query result is captured.
  docker exec -i -e PGPASSWORD="$PGPASSWORD" "$CONTAINER" \
    psql -U postgres -d postgres -tAq -c "SET ROLE authenticated; SET request.jwt.claim.sub = '$1'; $2" 2>&1
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
check "B cannot see mood note text"  "$(run_as $B "SELECT coalesce(string_agg(note,','),'NONE') FROM public.moods;")" 'NONE'

echo ""
echo "== POSITIVE: partner B gets derived counts =="
SNAP="$(run_as $B "SELECT public.partner_snapshot('$A');")"
check "snapshot returns goals counts"  "$SNAP" '"goals":'
check "snapshot goal completed = 1"    "$SNAP" '"completed": ?1'
check "snapshot has checkins"          "$SNAP" '"checkins":'
if echo "$SNAP" | grep -q 'SECRET GOAL TEXT'; then
  echo "  FAIL  snapshot leaks goal text"; fail=$((fail+1))
else
  echo "  PASS  snapshot leaks no goal text"; pass=$((pass+1))
fi
echo "        snapshot: $(echo "$SNAP" | cut -c1-170)"

echo ""
echo "== owner-only policies actually in force on moods =="
psql -tAq -c "SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='moods';"

echo ""
echo "== NEGATIVE: outsider C is refused =="
check "C cannot call snapshot on A" "$(run_as $C "SELECT public.partner_snapshot('$A');")" 'not an active partner'

echo ""
echo "== GUARD: partner B may revoke but not widen =="
check "B widening scopes is blocked" \
  "$(run_as $B "UPDATE public.partner_links SET share_mood_trend=TRUE, share_goals=TRUE WHERE owner_id='$A' AND partner_id='$B';")" \
  'may only|ERROR'
check "B setting status=active blocked" \
  "$(run_as $B "UPDATE public.partner_links SET status='active' WHERE owner_id='$A' AND partner_id='$B';")" \
  'may only|ERROR|UPDATE 0'
check "B revoking own link works" \
  "$(run_as $B "UPDATE public.partner_links SET status='revoked' WHERE owner_id='$A' AND partner_id='$B'; SELECT status FROM public.partner_links WHERE owner_id='$A';")" \
  'revoked'
check "after revoke, snapshot refused" \
  "$(run_as $B "SELECT public.partner_snapshot('$A');")" 'not an active partner'

echo ""
echo "================================"
echo "  PASS: $pass    FAIL: $fail"
echo "================================"
[ "$fail" -eq 0 ]
