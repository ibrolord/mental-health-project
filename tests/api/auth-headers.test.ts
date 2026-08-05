import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getSessionId: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: { auth: { getSession: mocks.getSession } },
}));

vi.mock('@/lib/session', () => ({
  getSessionId: mocks.getSessionId,
}));

import { getApiAuthHeaders } from '../../lib/api/auth-headers';

describe('web API authentication headers', () => {
  beforeEach(() => {
    mocks.getSession.mockReset();
    mocks.getSessionId.mockReset();
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    mocks.getSessionId.mockReturnValue(null);
  });

  it('attaches the current Supabase bearer token without forcing a content type', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'current-token' } },
    });

    await expect(getApiAuthHeaders()).resolves.toEqual({
      Authorization: 'Bearer current-token',
      'X-Client-Platform': 'web',
    });
  });

  it('falls back to the validated legacy session identifier', async () => {
    mocks.getSessionId.mockReturnValue('legacy-session');

    await expect(getApiAuthHeaders()).resolves.toEqual({
      'X-Client-Platform': 'web',
      'X-Session-Id': 'legacy-session',
    });
  });
});
