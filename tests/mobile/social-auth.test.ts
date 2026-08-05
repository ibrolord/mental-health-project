import { describe, expect, it } from 'vitest';
import type { User } from '@supabase/supabase-js';
import {
  appleProfileMetadata,
  isAppleAuthCancellation,
  linkedProviderVerificationError,
  parseOAuthCallback,
} from '../../mobile/lib/social-auth';
import { parseEnabledAuthProviders } from '../../mobile/lib/auth-providers';

describe('mobile social auth provider settings', () => {
  it('enables only providers explicitly enabled by Supabase', () => {
    expect(
      parseEnabledAuthProviders({
        external: { google: true, apple: false, github: true },
      })
    ).toEqual({ google: true, apple: false });
  });

  it('fails closed for missing or malformed provider settings', () => {
    expect(parseEnabledAuthProviders(null)).toEqual({ google: false, apple: false });
    expect(parseEnabledAuthProviders({ external: 'invalid' })).toEqual({
      google: false,
      apple: false,
    });
  });
});

describe('mobile social auth callback', () => {
  it('reads implicit-flow tokens from a hash callback', () => {
    expect(
      parseOAuthCallback(
        'mhtoolkit://auth/callback#access_token=access&refresh_token=refresh'
      )
    ).toEqual({ accessToken: 'access', refreshToken: 'refresh' });
  });

  it('reads tokens from query parameters', () => {
    expect(
      parseOAuthCallback(
        'mhtoolkit://auth/callback?access_token=access&refresh_token=refresh'
      )
    ).toEqual({ accessToken: 'access', refreshToken: 'refresh' });
  });

  it('surfaces provider errors before looking for tokens', () => {
    expect(() =>
      parseOAuthCallback(
        'mhtoolkit://auth/callback#error_description=Access%20denied'
      )
    ).toThrow('Access denied');
  });

  it('rejects incomplete callbacks', () => {
    expect(() =>
      parseOAuthCallback('mhtoolkit://auth/callback#access_token=access')
    ).toThrow(/usable MHtoolkit session/);
  });

  it('rejects tokens delivered to an unexpected callback URL', () => {
    expect(() =>
      parseOAuthCallback(
        'https://example.com/auth/callback#access_token=access&refresh_token=refresh'
      )
    ).toThrow(/invalid MHtoolkit callback/);
    expect(() =>
      parseOAuthCallback(
        'mhtoolkit://other/callback#access_token=access&refresh_token=refresh'
      )
    ).toThrow(/invalid MHtoolkit callback/);
    expect(() =>
      parseOAuthCallback(
        'mhtoolkit://auth/not-callback#access_token=access&refresh_token=refresh'
      )
    ).toThrow(/invalid MHtoolkit callback/);
  });
});

describe('native Apple response handling', () => {
  it('recognizes only the native cancellation error', () => {
    expect(isAppleAuthCancellation({ code: 'ERR_REQUEST_CANCELED' })).toBe(true);
    expect(isAppleAuthCancellation({ code: 'ERR_REQUEST_FAILED' })).toBe(false);
    expect(isAppleAuthCancellation(new Error('cancel'))).toBe(false);
  });

  it('preserves the complete one-time Apple name response', () => {
    expect(
      appleProfileMetadata({
        givenName: ' Ada ',
        middleName: 'M.',
        familyName: ' Lovelace ',
      })
    ).toEqual({
      full_name: 'Ada M. Lovelace',
      given_name: 'Ada',
      middle_name: 'M.',
      family_name: 'Lovelace',
    });
  });

  it('does not issue an empty metadata update', () => {
    expect(appleProfileMetadata(null)).toBeNull();
    expect(appleProfileMetadata({ givenName: '  ' })).toBeNull();
  });
});

describe('linked provider verification', () => {
  const permanentUser = {
    id: 'starting-user',
    is_anonymous: false,
  } as User;

  it('accepts the expected linked identity', () => {
    expect(
      linkedProviderVerificationError(
        permanentUser,
        [{ provider: 'google' }],
        'google',
        'starting-user'
      )
    ).toBeNull();
  });

  it('rejects a changed user id during upgrade', () => {
    expect(
      linkedProviderVerificationError(
        { ...permanentUser, id: 'different-user' },
        [{ provider: 'google' }],
        'google',
        'starting-user'
      )
    ).toMatch(/did not preserve/);
  });

  it('rejects a missing provider identity', () => {
    expect(
      linkedProviderVerificationError(
        permanentUser,
        [{ provider: 'email' }],
        'apple'
      )
    ).toMatch(/Apple identity was not linked/);
  });
});
