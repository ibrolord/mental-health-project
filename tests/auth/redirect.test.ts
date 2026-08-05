import { describe, expect, it } from 'vitest';
import {
  authPathWithNext,
  getSafeAuthRedirect,
} from '../../lib/auth/redirect';

describe('auth return paths', () => {
  it('preserves an accountability invite through authentication', () => {
    const invite = '/partner/accept?token=one-time-token';

    expect(getSafeAuthRedirect(invite)).toBe(invite);
    expect(authPathWithNext('/auth/signup', invite)).toBe(
      '/auth/signup?next=%2Fpartner%2Faccept%3Ftoken%3Done-time-token'
    );
  });

  it('rejects external and malformed return paths', () => {
    expect(getSafeAuthRedirect('https://example.com')).toBe('/dashboard');
    expect(getSafeAuthRedirect('//example.com')).toBe('/dashboard');
    expect(getSafeAuthRedirect('/\\example.com')).toBe('/dashboard');
    expect(getSafeAuthRedirect('/partner\u0000')).toBe('/dashboard');
  });
});
