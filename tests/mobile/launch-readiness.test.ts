import { describe, expect, it } from 'vitest';

import { isLaunchReady } from '../../mobile/lib/launch-readiness';

describe('iOS launch readiness', () => {
  const readyState = {
    contentReady: true,
    fallbackReady: false,
    layoutReady: true,
    markReady: true,
    routeReady: true,
  };

  it('waits for authentication-backed content even after the route fallback', () => {
    expect(isLaunchReady({
      ...readyState,
      contentReady: false,
      fallbackReady: true,
      routeReady: false,
    })).toBe(false);
  });

  it('allows the route fallback only after content, layout, and mark are ready', () => {
    expect(isLaunchReady({
      ...readyState,
      fallbackReady: true,
      routeReady: false,
    })).toBe(true);
  });

  it('starts normally when every readiness signal is present', () => {
    expect(isLaunchReady(readyState)).toBe(true);
  });
});
