import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationsDirectory = resolve(process.cwd(), 'supabase/migrations');
const migrationName = readdirSync(migrationsDirectory).find((name) =>
  name.endsWith('_prevent_duplicate_goals.sql')
);

if (!migrationName) {
  throw new Error('Missing prevent_duplicate_goals migration');
}

const migrationPath = resolve(migrationsDirectory, migrationName);

describe('duplicate goal migration', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  it('adds a nullable request key without deleting existing goals', () => {
    expect(sql).toMatch(/add column if not exists dedupe_key text/i);
    expect(sql).not.toMatch(/\bdelete\s+from\s+(public\.)?goals\b/i);
  });

  it('generates a fixed-width key on the server for every goal insert', () => {
    expect(sql).toMatch(/create or replace function public\.set_goal_dedupe_key/i);
    expect(sql).toMatch(/v_identity_key\s*:=\s*pg_catalog\.md5/i);
    expect(sql).toMatch(/new\.dedupe_key\s*:=\s*v_identity_key/i);
    expect(sql).toMatch(/before insert or update\s+on public\.goals/i);
    expect(sql).toMatch(/check \(dedupe_key is null or dedupe_key ~ '\^\[0-9a-f\]\{32\}\$'\)/i);
  });

  it('backfills one canonical key while retaining historical duplicate rows', () => {
    expect(sql).toMatch(/row_number\(\) over[\s\S]*as identity_rank/i);
    expect(sql).toMatch(/and canonical\.identity_rank = 1/i);
    expect(sql).toMatch(/set dedupe_key = null/i);
    expect(sql).not.toMatch(/union all/i);
    expect(sql).toMatch(/goals must have exactly one owner before dedupe backfill/i);
  });

  it('protects the key during updates and serializes ownership convergence', () => {
    expect(sql).toMatch(/before insert or update\s+on public\.goals/i);
    expect(sql).toMatch(/pg_advisory_xact_lock/i);
    expect(sql).toMatch(/existing\.dedupe_key = v_identity_key/i);
  });

  it('enforces the key independently for user and anonymous ownership', () => {
    expect(sql).toMatch(
      /create unique index[\s\S]*on public\.goals\s*\(user_id,\s*dedupe_key\)[\s\S]*where user_id is not null and dedupe_key is not null/i
    );
    expect(sql).toMatch(
      /create unique index[\s\S]*on public\.goals\s*\(session_id,\s*dedupe_key\)[\s\S]*where session_id is not null and dedupe_key is not null/i
    );
  });
});
