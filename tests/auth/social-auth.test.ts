import { describe, expect, it } from 'vitest';
import {
  hasOAuthCallbackParameters,
  isIdentityAlreadyLinkedError,
  parseSocialAuthProvider,
  socialAuthCompletionError,
} from '../../lib/auth/social';

describe('social auth callback parameters', () => {
  it('detects PKCE and implicit OAuth callback payloads', () => {
    expect(hasOAuthCallbackParameters('?code=provider-code', '')).toBe(true);
    expect(
      hasOAuthCallbackParameters('', '#access_token=access&refresh_token=refresh')
    ).toBe(true);
  });

  it('detects provider errors and ignores app-only callback parameters', () => {
    expect(hasOAuthCallbackParameters('?error=access_denied', '')).toBe(true);
    expect(hasOAuthCallbackParameters('?error_code=identity_already_exists', '')).toBe(true);
    expect(
      hasOAuthCallbackParameters('?next=%2Fdashboard&upgrade_user_id=user-1', '')
    ).toBe(false);
  });
});

describe('social auth recovery', () => {
  it('recognizes linked-identity messages and error codes', () => {
    expect(isIdentityAlreadyLinkedError('Identity is already linked to another user')).toBe(true);
    expect(isIdentityAlreadyLinkedError(null, 'identity_already_exists')).toBe(true);
    expect(isIdentityAlreadyLinkedError('Access denied')).toBe(false);
  });

  it('allows only supported provider query values', () => {
    expect(parseSocialAuthProvider('google')).toBe('google');
    expect(parseSocialAuthProvider('apple')).toBe('apple');
    expect(parseSocialAuthProvider('github')).toBeNull();
    expect(parseSocialAuthProvider(null)).toBeNull();
  });
});

describe('social auth callback completion', () => {
  it('allows a normal social sign-in without an upgrade marker', () => {
    expect(
      socialAuthCompletionError({ id: 'permanent', is_anonymous: false }, null)
    ).toBeNull();
  });

  it('blocks a normal social sign-in that leaves the anonymous session active', () => {
    expect(
      socialAuthCompletionError({ id: 'anonymous', is_anonymous: true }, null)
    ).toMatch(/did not finish/);
  });

  it('accepts an upgrade only when it preserves the same permanent user', () => {
    expect(
      socialAuthCompletionError(
        { id: 'same-user', is_anonymous: false },
        'same-user'
      )
    ).toBeNull();
  });

  it('blocks an upgrade that changes the user id', () => {
    expect(
      socialAuthCompletionError(
        { id: 'different-user', is_anonymous: false },
        'starting-user'
      )
    ).toMatch(/could not be linked/);
  });

  it('blocks an upgrade that remains anonymous', () => {
    expect(
      socialAuthCompletionError(
        { id: 'same-user', is_anonymous: true },
        'same-user'
      )
    ).toMatch(/could not be linked/);
  });
});
