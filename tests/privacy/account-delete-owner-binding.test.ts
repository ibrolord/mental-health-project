import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  deleteUser: vi.fn(),
  rpc: vi.fn(),
  verifyAuth: vi.fn(),
}));

vi.mock('@/lib/api/auth', () => ({
  corsHeaders: () => ({ 'Access-Control-Allow-Origin': '*' }),
  unauthorizedResponse: () =>
    NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  verifyAuth: mocks.verifyAuth,
}));

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseAdmin: () => ({
    auth: { admin: { deleteUser: mocks.deleteUser } },
    rpc: mocks.rpc,
  }),
}));

import { POST } from '../../app/api/account/delete/route';

describe('account deletion owner binding', () => {
  beforeEach(() => {
    mocks.verifyAuth.mockReset();
    mocks.deleteUser.mockReset();
    mocks.rpc.mockReset();
    mocks.verifyAuth.mockResolvedValue({
      valid: true,
      userId: 'owner-1',
      isAnonymous: false,
    });
    mocks.deleteUser.mockResolvedValue({ error: null });
    mocks.rpc.mockResolvedValue({ data: { deleted: true }, error: null });
  });

  it('deletes only when the confirmed owner matches the captured token', async () => {
    const response = await POST(
      new NextRequest('https://mhtoolkit.test/api/account/delete', {
        method: 'POST',
        body: JSON.stringify({ expectedUserId: 'owner-1' }),
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.deleteUser).toHaveBeenCalledWith('owner-1');
  });

  it('fails closed when the account changed before confirmation completed', async () => {
    const response = await POST(
      new NextRequest('https://mhtoolkit.test/api/account/delete', {
        method: 'POST',
        body: JSON.stringify({ expectedUserId: 'owner-2' }),
      })
    );

    expect(response.status).toBe(409);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });
});
