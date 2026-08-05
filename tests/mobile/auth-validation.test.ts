import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_UPGRADE_COMPLETION_FLAG,
  ACCOUNT_UPGRADE_EMAIL_FIELD,
  ACCOUNT_UPGRADE_STARTED_FLAG,
  getPendingAccountUpgradeEmail,
  isAccountEmailConfirmed,
  isAccountUpgradeComplete,
  isAccountUpgradePending,
  normalizeEmail,
  signupErrorMessage,
  validateAccountEmail,
} from '../../mobile/lib/auth-validation';

describe('mobile signup validation', () => {
  it('normalizes email addresses', () => {
    expect(normalizeEmail('  Person@Example.COM ')).toBe('person@example.com');
  });

  it('rejects missing and malformed email addresses', () => {
    expect(validateAccountEmail('')).toBe('Enter your email address.');
    expect(validateAccountEmail('not-an-email')).toBe('Enter a valid email address.');
  });

  it('accepts a valid account email', () => {
    expect(validateAccountEmail('person@example.com')).toBeNull();
  });

  it('turns provider rate limits into actionable copy', () => {
    expect(signupErrorMessage(new Error('email rate limit exceeded'))).toContain('wait an hour');
  });

  it('requires email confirmation and the completed password step', () => {
    expect(isAccountUpgradeComplete(null)).toBe(false);
    expect(isAccountUpgradeComplete({
      is_anonymous: false,
      email_confirmed_at: '2026-07-27T12:00:00Z',
      user_metadata: {},
    })).toBe(false);
    expect(isAccountUpgradeComplete({
      is_anonymous: false,
      email_confirmed_at: '2026-07-27T12:00:00Z',
      user_metadata: { [ACCOUNT_UPGRADE_COMPLETION_FLAG]: true },
    })).toBe(true);
  });

  it('allows a confirmed upgrade to finish its password inside the app', () => {
    expect(isAccountEmailConfirmed({
      is_anonymous: false,
      email_confirmed_at: '2026-07-30T18:19:09Z',
      user_metadata: { [ACCOUNT_UPGRADE_STARTED_FLAG]: true },
    })).toBe(true);
    expect(isAccountEmailConfirmed({
      is_anonymous: true,
      email_confirmed_at: '2026-07-30T18:19:09Z',
      user_metadata: { [ACCOUNT_UPGRADE_STARTED_FLAG]: true },
    })).toBe(false);
  });

  it('keeps incomplete account upgrades recoverable after a restart', () => {
    const pendingUser = {
      is_anonymous: true,
      user_metadata: {
        [ACCOUNT_UPGRADE_STARTED_FLAG]: true,
        [ACCOUNT_UPGRADE_EMAIL_FIELD]: ' Person@Example.COM ',
      },
    };

    expect(isAccountUpgradePending(pendingUser)).toBe(true);
    expect(getPendingAccountUpgradeEmail(pendingUser)).toBe('person@example.com');
    expect(isAccountUpgradePending({
      ...pendingUser,
      user_metadata: {
        ...pendingUser.user_metadata,
        [ACCOUNT_UPGRADE_COMPLETION_FLAG]: true,
      },
    })).toBe(false);
  });
});
