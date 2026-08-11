CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE auth.users (
  id UUID PRIMARY KEY,
  email TEXT,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  email_confirmed_at TIMESTAMPTZ
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
$$;

CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS JSONB LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::JSONB, '{}'::JSONB);
$$;
