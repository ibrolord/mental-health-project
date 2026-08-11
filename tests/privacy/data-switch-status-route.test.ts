import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../../app/api/data/switch-status/route';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  verifyAuth: vi.fn(),
}));

vi.mock('@/lib/api/auth', () => ({
  corsHeaders: () => ({ 'Access-Control-Allow-Origin': '*' }),
  unauthorizedResponse: () =>
    NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  verifyAuth: mocks.verifyAuth,
}));

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseAdmin: () => ({ from: mocks.from }),
}));

function queryResult(data: Array<{ id: string }> = [], error: unknown = null) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    or: vi.fn(),
    limit: vi.fn().mockResolvedValue({ data, error }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.or.mockReturnValue(query);
  return query;
}

describe('anonymous switch ownership inventory route', () => {
  beforeEach(() => {
    mocks.verifyAuth.mockReset();
    mocks.verifyAuth.mockResolvedValue({
      valid: true,
      userId: 'anonymous-1',
      isAnonymous: true,
    });
    mocks.from.mockReset();
    mocks.from.mockImplementation(() => queryResult());
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('reports an empty anonymous profile only when every domain is empty', async () => {
    const response = await POST(
      new NextRequest('https://mhtoolkit.test/api/data/switch-status', {
        method: 'POST',
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ hasOwnedData: false });
    expect(mocks.from).toHaveBeenCalledWith('activity_plans');
    expect(mocks.from).toHaveBeenCalledWith('sleep_diary_entries');
  });

  it('reports saved data when any owned domain contains a row', async () => {
    mocks.from.mockImplementation((table: string) =>
      queryResult(table === 'safety_plans' ? [{ id: 'plan-1' }] : [])
    );

    const response = await POST(
      new NextRequest('https://mhtoolkit.test/api/data/switch-status', {
        method: 'POST',
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ hasOwnedData: true });
  });

  it('does not let operational telemetry block account switching', async () => {
    mocks.from.mockImplementation((table: string) =>
      queryResult(table === 'operational_events' ? [{ id: 'event-1' }] : [])
    );

    const response = await POST(
      new NextRequest('https://mhtoolkit.test/api/data/switch-status', {
        method: 'POST',
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ hasOwnedData: false });
    expect(mocks.from).not.toHaveBeenCalledWith('operational_events');
  });

  it('rejects a permanent account instead of inventorying it for a switch', async () => {
    mocks.verifyAuth.mockResolvedValue({
      valid: true,
      userId: 'permanent-1',
      isAnonymous: false,
    });

    const response = await POST(
      new NextRequest('https://mhtoolkit.test/api/data/switch-status', {
        method: 'POST',
      })
    );

    expect(response.status).toBe(409);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
