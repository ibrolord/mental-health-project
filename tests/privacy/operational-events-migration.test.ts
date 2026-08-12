import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  path.join(
    process.cwd(),
    'supabase/migrations/20260809011106_add_operational_events_primary_key.sql'
  ),
  'utf8'
);

describe('operational event row identity migration', () => {
  it('adds a generated primary key without changing the bounded event payload', () => {
    expect(migration).toContain('ADD COLUMN id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY');
    expect(migration).not.toMatch(/metadata|payload|message|details/i);
  });
});
