import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInAnonymously: vi.fn(),
}));

vi.mock('../../lib/supabase/client', () => ({
  supabase: {
    auth: authMocks,
  },
}));

import { ensureAnonymousSession } from '../../lib/session';

const webAuthSource = readFileSync(
  resolve(process.cwd(), 'lib/auth-context.tsx'),
  'utf8'
);
const mobileAuthSource = readFileSync(
  resolve(process.cwd(), 'mobile/lib/auth-context.tsx'),
  'utf8'
);
const mobileSessionSource = readFileSync(
  resolve(process.cwd(), 'mobile/lib/session-bootstrap.ts'),
  'utf8'
);
const webSessionSource = readFileSync(
  resolve(process.cwd(), 'lib/session.ts'),
  'utf8'
);
const dashboardSource = readFileSync(
  resolve(process.cwd(), 'app/dashboard/page.tsx'),
  'utf8'
);
const trackerCheckInSource = readFileSync(
  resolve(process.cwd(), 'components/mood/inline-mood-check-in.tsx'),
  'utf8'
);
const mobileLayoutSource = readFileSync(
  resolve(process.cwd(), 'mobile/app/_layout.tsx'),
  'utf8'
);

describe('session and mood readiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('bounds a stalled browser session lookup', async () => {
    vi.useFakeTimers();
    authMocks.getSession.mockReturnValue(new Promise(() => {}));

    const result = expect(ensureAnonymousSession()).rejects.toThrow(
      'Session initialization timed out'
    );
    await vi.advanceTimersByTimeAsync(12_000);

    await result;
    expect(authMocks.signInAnonymously).not.toHaveBeenCalled();
  });

  it('makes the current profile usable before legacy migration completes', () => {
    for (const source of [webAuthSource, mobileAuthSource]) {
      const userReady = source.indexOf('setUser(session.user)');
      const migrationStarts = source.indexOf('void migrateLegacyData(session)');

      expect(userReady).toBeGreaterThan(-1);
      expect(migrationStarts).toBeGreaterThan(userReady);
      expect(source).toContain('setLoading(false)');
    }
    expect(webSessionSource).toContain('Session initialization timed out');
    expect(mobileSessionSource).toContain('Session initialization timed out');
  });

  it('never presents mood save controls as ready without an owner', () => {
    expect(dashboardSource).toContain(
      'disabled={savingMood || authLoading || !moodOwnerKey}'
    );
    expect(dashboardSource).toContain('Check-in saved.');
    expect(dashboardSource).toContain('Your check-in was not saved.');
    expect(trackerCheckInSource).toContain('disabled={controlsUnavailable}');
    expect(trackerCheckInSource).toContain('Your private profile is not ready.');
    expect(trackerCheckInSource).toContain('Not saved');
  });

  it('uses a user-facing iOS back title instead of the route group name', () => {
    expect(mobileLayoutSource).toContain("headerBackTitle: 'Back'");
  });
});
