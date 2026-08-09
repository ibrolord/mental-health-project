import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const evidenceModuleUrl = pathToFileURL(
  resolve(process.cwd(), 'scripts/lib/social-auth-evidence.mjs')
).href;

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

  it('accepts only fresh complete dashboard evidence for the production project', async () => {
    const { validateSocialAuthDashboardEvidence } = await import(evidenceModuleUrl);
    const now = Date.parse('2026-08-09T22:00:00Z');
    const evidence = {
      schemaVersion: 1,
      method: 'supabase-dashboard',
      projectRef: 'production-ref',
      observedAt: '2026-08-09T21:43:55Z',
      checks: {
        redirectMobile: true,
        redirectWeb: true,
        redirectConfirmation: true,
        manualLinking: true,
        appleNativeAudience: true,
        googleClientIdConfigured: true,
      },
    };

    expect(
      validateSocialAuthDashboardEvidence(evidence, {
        projectRef: 'production-ref',
        now,
      })
    ).toEqual([]);
    expect(
      validateSocialAuthDashboardEvidence(
        { ...evidence, projectRef: 'another-ref' },
        { projectRef: 'production-ref', now }
      )
    ).toContain('Dashboard evidence does not match the production project ref.');
    expect(
      validateSocialAuthDashboardEvidence(
        {
          ...evidence,
          observedAt: '2026-08-07T21:43:55Z',
          checks: { ...evidence.checks, manualLinking: false },
        },
        { projectRef: 'production-ref', now }
      )
    ).toEqual(
      expect.arrayContaining([
        'Dashboard evidence is older than 24 hours.',
        'Dashboard evidence check manualLinking is not confirmed.',
      ])
    );
  });
});
