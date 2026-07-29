import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const verifier = readFileSync(
  resolve(process.cwd(), 'scripts/verify-partner-rls.sh'),
  'utf8'
);

describe('accountability RLS verifier', () => {
  it('fails closed when a required migration cannot be applied', () => {
    expect(verifier).toContain('set -euo pipefail');
    expect(verifier).toContain('apply_migration');
    expect(verifier).toContain('echo "  FAIL  $name"');
    expect(verifier).toContain('exit 1');
    expect(verifier).not.toContain('echo "  SKIP');
  });

  it('shims only scheduling while applying the secure auth migration', () => {
    expect(verifier).toContain('CREATE OR REPLACE FUNCTION cron.schedule');
    expect(verifier).toContain(
      "20260716190633_secure_anonymous_auth.sql"
    );
    expect(verifier).toContain(
      "sed '/^CREATE EXTENSION IF NOT EXISTS pg_cron"
    );
  });

  it('rejects secondary counts that lack their own sharing control', () => {
    expect(verifier).toContain('snapshot contains an undisclosed secondary count');
    expect(verifier).toContain('"(total|tracked)"');
  });
});
