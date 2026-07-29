import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const settingsSource = readFileSync(
  resolve(process.cwd(), 'app/settings/page.tsx'),
  'utf8'
);

describe('settings account state', () => {
  it('does not render a blank signed-in state while auth is loading', () => {
    expect(settingsSource).toContain('loading: authLoading');
    expect(settingsSource).toContain('Checking your account status');
    expect(settingsSource).toContain("user.email || 'Connected account'");
  });

  it('offers both account creation and existing-account sign in', () => {
    expect(settingsSource).toContain("router.push('/auth/signup')");
    expect(settingsSource).toContain('Create Account');
    expect(settingsSource).toContain("router.push('/auth/login')");
    expect(settingsSource).not.toContain(
      'New account creation is temporarily unavailable'
    );
  });
});
