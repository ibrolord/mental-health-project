import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isValidatedPasswordRecovery } from '../../lib/auth/password-recovery';

const read = (path: string) => readFileSync(path, 'utf8');

describe('mobile password recovery contract', () => {
  const authContext = read('mobile/lib/auth-context.tsx');
  const login = read('mobile/app/auth/login.tsx');
  const signup = read('mobile/app/auth/signup.tsx');
  const forgotPassword = read('mobile/app/auth/forgot-password.tsx');
  const resetPage = read('app/auth/reset-password/page.tsx');

  it('uses the trusted web origin for reset completion', () => {
    expect(authContext).toContain('supabase.auth.resetPasswordForEmail');
    expect(authContext).toContain(
      "https://mhtoolkit.vercel.app/auth/reset-password?source=mobile"
    );
    expect(forgotPassword).toContain('If an account exists for');
  });

  it('routes duplicate email and linked social identities to sign-in', () => {
    expect(signup).toContain("reason: 'existing-account'");
    expect(signup).toContain('Sign In to Existing Account');
    expect(login).toContain('Use Sign in with Apple below.');
    expect(login).toContain('Use Sign in with Google below.');
  });

  it('requires a recovery session before accepting a new password', () => {
    expect(resetPage).toContain('isValidatedPasswordRecovery');
    expect(resetPage).toContain('recoveryClient.auth.updateUser({ password })');
    expect(resetPage).toContain('mhtoolkit://auth/login?reset=complete');
    expect(resetPage).toContain('mhtoolkit://auth/forgot-password');
  });

  it('rejects stale sessions and forged recovery URL markers', () => {
    const existingSession = { user: { id: 'existing-user' } } as never;

    expect(isValidatedPasswordRecovery('INITIAL_SESSION', existingSession)).toBe(false);
    expect(isValidatedPasswordRecovery('SIGNED_IN', existingSession)).toBe(false);
    expect(isValidatedPasswordRecovery('PASSWORD_RECOVERY', null)).toBe(false);
    expect(isValidatedPasswordRecovery('PASSWORD_RECOVERY', existingSession)).toBe(true);
  });

  it('clears the recovery browser session before showing completion', () => {
    expect(resetPage).toContain('persistSession: false');
    expect(resetPage).toContain('detectSessionInUrl: true');
    expect(resetPage).toContain("recoveryClient.auth.signOut({ scope: 'local' })");
    expect(resetPage).toContain("setPageState('cleanup')");
    expect(resetPage).toContain('Retry Session Cleanup');
  });
});
