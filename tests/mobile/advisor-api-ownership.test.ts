import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('../../mobile/lib/supabase', () => ({ supabase: { auth: { getSession } } }));
vi.mock('../../mobile/node_modules/react-native', () => ({ Platform: { OS: 'ios' } }));

import { apiRequest } from '../../mobile/lib/api';
import { requestModelAdvisorRecommendation } from '../../mobile/lib/advisor-ai';
import { selectAdvisorRecommendation, type AdvisorContext } from '../../mobile/lib/advisor-core';

const input: AdvisorContext = {
  nowIso: '2026-09-27T12:00:00.000Z', mood: null, habits: [], health: null,
  goals: [{ id: 'owner-a-goal', title: 'Owner A private application', dueAt: null }],
};
const candidate = selectAdvisorRecommendation(input);
const sessionFor = (id: string, anonymous = false) => ({ data: {
  session: { access_token: `test-token-${id}`, user: { id, is_anonymous: anonymous } },
} });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  getSession.mockReset();
  getSession.mockResolvedValue(sessionFor('owner-a'));
  fetchMock = vi.fn(async () => new Response(JSON.stringify({
    model: 'gemini', personalized: true,
    selection: { candidateId: candidate.id, observations: ['One useful step.'], signalIds: [], focus: 'steady' },
  }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('Advisor request ownership at dispatch', () => {
  it('rejects before fetch when ownership changes during delayed session lookup', async () => {
    let resolveSession!: (value: ReturnType<typeof sessionFor>) => void;
    getSession.mockImplementation(() => new Promise((resolve) => { resolveSession = resolve; }));
    let current = true;
    const pending = apiRequest('/api/advisor', { privateContext: 'owner-a-only' }, {
      isCurrent: () => current,
    });
    const rejected = expect(pending).rejects.toThrow('no longer current');
    expect(getSession).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
    current = false;
    resolveSession(sessionFor('owner-b'));
    await rejected;
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a different session user even when the React guard is still true', async () => {
    getSession.mockResolvedValue(sessionFor('owner-b'));
    await expect(apiRequest('/api/advisor', { privateContext: 'owner-a-only' }, {
      isCurrent: () => true, expectedUserId: 'owner-a',
    })).rejects.toThrow('Authenticated user changed');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('carries both ownership checks through the real Advisor model adapter', async () => {
    let resolveSession!: (value: ReturnType<typeof sessionFor>) => void;
    getSession.mockImplementation(() => new Promise((resolve) => { resolveSession = resolve; }));
    const pending = requestModelAdvisorRecommendation(input, [candidate], [], null, {
      isCurrent: () => true, expectedUserId: 'owner-a',
    });
    const rejected = expect(pending).rejects.toThrow('Authenticated user changed');
    resolveSession(sessionFor('owner-b'));
    await rejected;
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('checks the guard immediately before dispatch, after body serialization', async () => {
    let current = true;
    await expect(apiRequest('/api/advisor', {
      toJSON: () => { current = false; return { privateContext: 'owner-a-only' }; },
    }, { isCurrent: () => current, expectedUserId: 'owner-a' })).rejects.toThrow('no longer current');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([false, true])('allows a matching session (anonymous=%s)', async (anonymous) => {
    getSession.mockResolvedValue(sessionFor('owner-a', anonymous));
    const result = await requestModelAdvisorRecommendation(input, [candidate], [], null, {
      isCurrent: () => true, expectedUserId: 'owner-a',
    });
    expect(result.recommendation.id).toBe(candidate.id);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.headers).toMatchObject({ Authorization: 'Bearer test-token-owner-a' });
    expect(JSON.parse(init.body as string).candidates[0].id).toBe(candidate.id);
  });

  it('keeps existing unguarded calls and explicit-token calls unchanged', async () => {
    await apiRequest('/api/example', { mode: 'session' });
    expect(getSession).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toMatchObject({ Authorization: 'Bearer test-token-owner-a' });
    getSession.mockClear();
    await apiRequest('/api/example', { mode: 'explicit' }, { accessToken: 'explicit-test-token' });
    expect(getSession).not.toHaveBeenCalled();
    expect((fetchMock.mock.calls[1][1] as RequestInit).headers).toMatchObject({ Authorization: 'Bearer explicit-test-token' });
  });

  it('does not let an explicit token bypass an expected-user binding', async () => {
    await expect(apiRequest('/api/advisor', {}, {
      accessToken: 'test-token-owner-b', expectedUserId: 'owner-a',
    })).rejects.toThrow('Authenticated user changed');
    expect(fetchMock).not.toHaveBeenCalled();
    await apiRequest('/api/advisor', {}, { accessToken: 'test-token-owner-a', expectedUserId: 'owner-a' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects a missing session without dispatch or authentication side effects', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    await expect(apiRequest('/api/advisor', {}, { expectedUserId: 'owner-a' })).rejects.toThrow('Authenticated user changed');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
