import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const webAuth = readFileSync(resolve(process.cwd(), 'lib/auth-context.tsx'), 'utf8');
const mobileAuth = readFileSync(resolve(process.cwd(), 'mobile/lib/auth-context.tsx'), 'utf8');
const webCompletion = readFileSync(resolve(process.cwd(), 'app/auth/mobile-confirmed/page.tsx'), 'utf8');
const mobileCompletion = readFileSync(resolve(process.cwd(), 'mobile/app/auth/signup.tsx'), 'utf8');

describe('anonymous account conversion contract', () => {
  it('verifies the email before setting a password on web and mobile', () => {
    expect(webAuth).toContain('email: normalizedEmail');
    expect(mobileAuth).toContain('email: email.trim()');
    expect(webAuth).not.toMatch(/updateUser\(\s*\{ email, password \}/);
    expect(mobileAuth).not.toMatch(/updateUser\(\s*\{ email, password \}/);
    expect(webCompletion).toContain('supabase.auth.updateUser({');
    expect(webCompletion).toContain('password,');
    expect(mobileAuth).toContain('finishAccountUpgrade');
    expect(mobileAuth).toContain('supabase.auth.updateUser({');
    expect(mobileCompletion).toContain('await finishAccountUpgrade(password)');
  });

  it('uses a verified callback without storing or forwarding the password', () => {
    expect(webAuth).toContain('/auth/mobile-confirmed?source=web');
    expect(mobileAuth).toContain('/auth/mobile-confirmed?source=mobile');
    expect(webAuth).not.toMatch(/mobile-confirmed[^\n]*password/);
    expect(mobileAuth).not.toMatch(/mobile-confirmed[^\n]*password/);
    expect(webCompletion).toContain('supabase.auth.verifyOtp({');
    expect(webCompletion).toContain('supabase.auth.onAuthStateChange');
    expect(mobileAuth).toContain('isAccountEmailConfirmed');
  });
});
