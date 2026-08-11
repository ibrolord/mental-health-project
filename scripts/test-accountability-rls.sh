#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATABASE="mhtoolkit_accountability_test"
ADMIN_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
TEST_URL="postgresql://postgres:postgres@127.0.0.1:54322/${DATABASE}"

cleanup() {
  psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${DATABASE} WITH (FORCE)" >/dev/null
}
trap cleanup EXIT

cleanup
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${DATABASE} TEMPLATE template0" >/dev/null
psql "$TEST_URL" -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/local_auth_prelude.sql" >/dev/null

for migration in "$ROOT"/supabase/migrations/*.sql; do
  if [[ "$(basename "$migration")" == "20260716190633_secure_anonymous_auth.sql" ]]; then
    # pg_cron is bound to the stack's postgres database. The disposable test
    # database still applies the migration's tables, functions, grants, and RLS.
    filtered_migration="$(mktemp)"
    sed '/^CREATE EXTENSION IF NOT EXISTS pg_cron/,/^);$/d' "$migration" > "$filtered_migration"
    psql "$TEST_URL" -v ON_ERROR_STOP=1 -f "$filtered_migration" >/dev/null
    rm -f "$filtered_migration"
  else
    psql "$TEST_URL" -v ON_ERROR_STOP=1 -f "$migration" >/dev/null
  fi
done

psql "$TEST_URL" -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/accountability_rls.sql"
