import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const webAuth = read('lib/auth-context.tsx');
const mobileAuth = read('mobile/lib/auth-context.tsx');
const mobileSupabase = read('mobile/lib/supabase.ts');
const mobileSignup = read('mobile/app/auth/signup.tsx');
const confirmation = read('app/auth/mobile-confirmed/page.tsx');
const webSignup = read('app/auth/signup/page.tsx');
const webCallback = read('app/auth/callback/page.tsx');
const partnerAccept = read('app/partner/accept/page.tsx');
const mobilePartner = read('mobile/app/partner.tsx');
const mobileLogin = read('mobile/app/auth/login.tsx');
const webLogin = read('app/auth/login/page.tsx');
const webSocialAuth = read('components/auth/social-auth-buttons.tsx');
const mobileSocialAuth = read('mobile/components/social-auth-buttons.tsx');
const anonymousProfileSwitch = read('mobile/lib/anonymous-profile-switch.ts');

describe('anonymous account upgrade journey', () => {
  it('links email to the existing web identity instead of creating another user', () => {
    const signupBody =
      webAuth
        .split('const signUp = async')[1]
        ?.split('const continueWithProvider')[0] ?? '';

    expect(signupBody).toContain('supabase.auth.updateUser');
    expect(signupBody).not.toContain('supabase.auth.signUp');
    expect(signupBody).toContain('upgrade_user_id=');
  });

  it('finishes a confirmed mobile upgrade with an in-app password', () => {
    expect(mobileAuth).toContain("return 'password-required'");
    expect(mobileAuth).toContain('password,');
    expect(mobileAuth).toContain('[ACCOUNT_UPGRADE_COMPLETION_FLAG]: true');
    expect(mobileSignup).toContain("type SignupStep = 'email' | 'confirmation' | 'password'");
    expect(mobileSignup).toContain('Resend email');
    expect(mobileSignup).toContain('Use a different email');
    expect(mobileSignup).toContain("AppState.addEventListener('change'");
    expect(mobileSignup).toContain('Finish Account Setup');
    expect(mobileAuth).toContain('supabase.auth.getUser()');
    expect(mobileAuth).toContain("type: 'email_change'");
    expect(confirmation).toContain("confirmationSource === 'web'");
    expect(confirmation).toContain('supabase.auth.verifyOtp');
    expect(confirmation).toContain('token_hash: tokenHash');
    expect(confirmation).toContain('mhtoolkit://auth/signup');
    expect(mobileSupabase).toContain("flowType: 'implicit'");
  });

  it('returns account creation to the partner journey', () => {
    expect(partnerAccept).toContain("authPathWithNext('/auth/signup', returnPath)");
    expect(partnerAccept).toContain("authPathWithNext('/auth/login', returnPath)");
    expect(mobilePartner).toContain("params: { returnTo: '/partner' }");
    expect(mobileSignup).toContain("params.returnTo === '/partner'");
    expect(mobileLogin).toContain("params.returnTo === '/partner'");
    expect(webCallback).toContain("authPathWithNext('/auth/login', nextPath)");
  });

  it('uses synchronous single-flight guards for signup and invite acceptance', () => {
    expect(webSignup).toContain('if (submissionRef.current) return');
    expect(mobileSignup).toContain('if (submissionRef.current) return');
    expect(partnerAccept).toContain('acceptanceRef.current?.token !== token');
    expect(partnerAccept).toContain('acceptance.promise');
  });

  it('preserves anonymous data while offering explicit discard controls', () => {
    expect(anonymousProfileSwitch).toContain("'anonymous_profile_data_conflict'");
    for (const authContext of [webAuth, mobileAuth]) {
      expect(authContext).toContain(
        'discardAnonymousProfile: (expectedAnonymousUserId: string) => Promise<void>'
      );
      expect(authContext).toContain("'/api/data/delete'");
      expect(authContext).toContain('{ expectedAnonymousUserId }');
    }

    expect(webAuth).toContain(
      'removeCurrentDevicePushSubscription(expectedAnonymousUserId)'
    );
    expect(mobileAuth).toContain('mergeAnonymousSessionIntoCurrentAccount');
    expect(mobileAuth).toContain("'/api/data/merge-anonymous'");
    expect(mobileAuth).toContain('clearAllReminders()');
    expect(webLogin).toContain('Keep data and create an account');
    expect(webLogin).toContain('Delete data and sign in');
    expect(mobileLogin).toContain('Keep Data and Continue');
    expect(mobileLogin).toContain('Delete Data and Sign In');
  });

  it('surfaces social sign-in conflicts to the login resolution flow', () => {
    for (const socialAuth of [webSocialAuth, mobileSocialAuth]) {
      expect(socialAuth).toContain('onAnonymousDataBlocked');
      expect(socialAuth).toContain('isAnonymousProfileDataConflict');
    }
    expect(webLogin).toContain(
      'setBlockedAttempt({ kind: \'provider\', provider, anonymousUserId })'
    );
    expect(mobileLogin).toContain(
      'setBlockedAttempt({ kind: \'provider\', provider, anonymousUserId })'
    );
  });

  it('recovers when an upgrade provider already belongs to an account', () => {
    expect(webAuth).toContain('&provider=');
    expect(webAuth).toContain('&auth_intent=upgrade');
    expect(webCallback).toContain('isIdentityAlreadyLinkedError');
    expect(webCallback).toContain("reason: 'identity_already_linked'");
    expect(webCallback).toContain('Sign in to existing account');
    expect(webLogin).toContain("searchParams.get('reason') === 'identity_already_linked'");
    expect(webSignup).toContain('onIdentityAlreadyLinked={setLinkedIdentityProvider}');
    expect(mobileSignup).toContain('onIdentityAlreadyLinked={(provider) =>');
    expect(mobileSignup).toContain('Any anonymous activity stays separate');
  });
});
