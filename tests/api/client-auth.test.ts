import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  getSession: vi.fn(),
  getSessionId: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: { auth: { getSession: mocks.getSession } },
}));

vi.mock('@/lib/session', () => ({
  getSessionId: mocks.getSessionId,
}));

import { apiRequest } from '../../lib/api/client';

describe('web API authentication headers', () => {
  beforeEach(() => {
    mocks.getSession.mockReset();
    mocks.getSessionId.mockReset();
    mocks.fetch.mockReset();
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    mocks.getSessionId.mockReturnValue(null);
    mocks.fetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        headers: { 'content-type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', mocks.fetch);
  });

  it('lets data lifecycle requests bind to a captured access token', async () => {
    mocks.getSessionId.mockReturnValue('legacy-session');

    await apiRequest('/api/data/delete', {}, { accessToken: 'captured-token' });

    expect(mocks.fetch).toHaveBeenCalledWith(
      '/api/data/delete',
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer captured-token',
          'Content-Type': 'application/json',
          'X-Client-Platform': 'web',
        },
      })
    );
  });
});
