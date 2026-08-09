import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('social auth management verification', () => {
  it('loads the management token from the ignored local environment file', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'scripts/verify-social-auth-readiness.mjs'),
      'utf8'
    );

    expect(source).toContain(
      'process.env.SUPABASE_ACCESS_TOKEN ?? fileEnv.SUPABASE_ACCESS_TOKEN'
    );
    expect(source).not.toMatch(/console\.log\([^\n]*accessToken/);
  });
});
