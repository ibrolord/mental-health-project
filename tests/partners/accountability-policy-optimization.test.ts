import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260728161846_optimize_accountability_policies.sql'
  ),
  'utf8'
);

describe('accountability policy optimization migration', () => {
  it('covers the composite celebration relationship foreign key', () => {
    expect(migration).toContain(
      'ON public.partner_celebrations (link_id, owner_id, partner_id)'
    );
  });

  it('consolidates participant access without allowing anonymous accounts', () => {
    expect(migration).toContain(
      'CREATE POLICY "Permanent participants read celebrations"'
    );
    expect(migration).toContain(
      'CREATE POLICY "Permanent participants read their links"'
    );
    expect(migration).toContain(
      'CREATE POLICY "Permanent participants update their links"'
    );
    expect(migration.match(/is_anonymous/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
