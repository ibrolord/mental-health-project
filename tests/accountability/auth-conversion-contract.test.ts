import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const webAuth = readFileSync(resolve(process.cwd(), 'lib/auth-context.tsx'), 'utf8');
const mobileAuth = readFileSync(resolve(process.cwd(), 'mobile/lib/auth-context.tsx'), 'utf8');
const webCompletion = readFileSync(resolve(process.cwd(), 'app/auth/complete-signup/page.tsx'), 'utf8');
const mobileCompletion = readFileSync(resolve(process.cwd(), 'mobile/app/auth/complete-signup.tsx'), 'utf8');

describe('anonymous account conversion contract', () => {
  it('verifies the email before setting a password on web and mobile', () => {
    expect(webAuth).toContain("{ email },");
    expect(mobileAuth).toContain("{ email },");
    expect(webAuth).not.toMatch(/updateUser\(\s*\{ email, password \}/);
    expect(mobileAuth).not.toMatch(/updateUser\(\s*\{ email, password \}/);
    expect(webCompletion).toContain('updateUser({ password })');
    expect(mobileCompletion).toContain('updateUser({ password })');
  });

  it('uses a verified callback without storing or forwarding the password', () => {
    expect(webAuth).toContain('/auth/complete-signup');
    expect(mobileAuth).toContain("Linking.createURL('/auth/complete-signup')");
    expect(webAuth).not.toMatch(/complete-signup[^\n]*password/);
    expect(mobileAuth).not.toMatch(/complete-signup[^\n]*password/);
    expect(mobileCompletion).toContain('exchangeCodeForSession(code)');
  });
});
