#!/usr/bin/env bash
# Runs only against a fresh disposable container; no URLs or linked project access.
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINER="mh-tool-completions-test-$$"
LOG="$(mktemp)"
cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  rm -f "$LOG"
}
trap cleanup EXIT
docker run -d --name "$CONTAINER" -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine >/dev/null
for i in $(seq 1 40); do
  docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done
psql() { docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"; }
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
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email TEXT,
  email_confirmed_at TIMESTAMPTZ
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
GRANT USAGE ON SCHEMA public, auth TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
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
  if apply_migration "$f" "$name" >"$LOG" 2>&1; then
    if [ "$name" = "20260716190633_secure_anonymous_auth.sql" ]; then
      echo "  ok    $name  (pg_cron scheduling shim)"
    else
      echo "  ok    $name"
    fi
  else
    echo "  FAIL  $name"
    tail -20 "$LOG"
    exit 1
  fi
done

psql -f - < "$REPO/supabase/tests/tool_completions_rls.sql"
echo "PASS: tool completion ownership, retries, lifecycle, and retention guards"
