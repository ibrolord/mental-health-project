import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: { getSession: supabaseMocks.getSession },
    rpc: supabaseMocks.rpc,
    from: supabaseMocks.from,
  },
}));

import {
  AccountabilityClientError,
  createAccountabilityInvite,
  loadAccountabilityOverview,
  loadJoinInvite,
} from './accountability-client';

describe('accountability web adapter boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'test-token',
          user: { id: 'viewer-1', is_anonymous: false },
        },
      },
      error: null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps only owner-actionable suggestions and active commitments', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            viewerId: 'viewer-1',
            connection: {
              id: 'connection-1',
              status: 'connected',
              partner: { id: 'partner-1', displayName: 'Partner' },
              invite: null,
            },
            mine: [
              { id: 'mine-1', ownerId: 'viewer-1', title: 'My commitment', status: 'active' },
              { id: 'archived-1', ownerId: 'viewer-1', title: 'Old commitment', status: 'archived' },
            ],
            theirs: [
              { id: 'theirs-1', ownerId: 'partner-1', title: 'Their commitment', status: 'active' },
            ],
            suggestions: [
              { id: 'suggestion-1', commitmentId: 'mine-1', suggestedPriority: 'high' },
              { id: 'suggestion-2', commitmentId: 'theirs-1', suggestedPriority: 'low' },
            ],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const overview = await loadAccountabilityOverview();

    expect(overview.mine.map((item) => item.id)).toEqual(['mine-1']);
    expect(overview.suggestions).toHaveLength(1);
    expect(overview.suggestions[0]).toMatchObject({
      id: 'suggestion-1',
      commitmentId: 'mine-1',
      commitmentTitle: 'My commitment',
    });
    expect(supabaseMocks.from).not.toHaveBeenCalled();
  });

  it('fails closed for an unknown invitation status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ data: { status: 'mystery' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )));

    try {
      await loadJoinInvite('invite-token');
      expect.unreachable('unknown invitation status should be rejected');
    } catch (error) {
      expect(error).toBeInstanceOf(AccountabilityClientError);
      if (!(error instanceof AccountabilityClientError)) throw error;
      expect(error.status).toBe(502);
    }
  });

  it('never reuses a stored invitation token for another account', async () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
    });
    const pendingOverview = (viewerId: string) => ({
      data: {
        viewerId,
        connection: {
          id: 'connection-1',
          status: 'invite_pending',
          partner: null,
          invite: { id: 'connection-1', token: '', expiresAt: '2026-08-18T12:00:00Z' },
        },
        mine: [],
        theirs: [],
        suggestions: [],
      },
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: {
          id: 'connection-1',
          inviteToken: 'private-token',
          expiresAt: '2026-08-18T12:00:00Z',
        },
      }), { status: 201, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(pendingOverview('viewer-1')), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify(pendingOverview('viewer-2')), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
    vi.stubGlobal('fetch', fetchMock);

    await createAccountabilityInvite('partner@example.com', 'viewer-1');
    const firstOverview = await loadAccountabilityOverview();
    expect(firstOverview.connection.invite?.token).toBe('private-token');

    supabaseMocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'test-token-2',
          user: { id: 'viewer-2', is_anonymous: false },
        },
      },
      error: null,
    });
    const secondOverview = await loadAccountabilityOverview();
    expect(secondOverview.connection.invite?.token).toBe('');
  });
});
