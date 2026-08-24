import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  deleteUser: vi.fn(),
  rpc: vi.fn(),
  removeGoalAttachmentObjectsForUser: vi.fn(),
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

vi.mock('@/lib/goals/attachment-cleanup', () => ({
  removeGoalAttachmentObjectsForUser: mocks.removeGoalAttachmentObjectsForUser,
}));

import { POST } from '../../app/api/account/delete/route';

describe('account deletion owner binding', () => {
  beforeEach(() => {
    mocks.verifyAuth.mockReset();
    mocks.deleteUser.mockReset();
    mocks.rpc.mockReset();
    mocks.removeGoalAttachmentObjectsForUser.mockReset();
    mocks.verifyAuth.mockResolvedValue({
      valid: true,
      userId: 'owner-1',
      isAnonymous: false,
    });
    mocks.deleteUser.mockResolvedValue({ error: null });
    mocks.rpc.mockResolvedValue({ data: { deleted: true }, error: null });
    mocks.removeGoalAttachmentObjectsForUser.mockResolvedValue({ error: null });
  });

  it('deletes only when the confirmed owner matches the captured token', async () => {
    const response = await POST(
      new NextRequest('https://mhtoolkit.test/api/account/delete', {
        method: 'POST',
        body: JSON.stringify({ expectedUserId: 'owner-1' }),
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('delete_owned_data', {
      p_user_id: 'owner-1',
      p_session_id: null,
    });
    expect(mocks.removeGoalAttachmentObjectsForUser).toHaveBeenCalledWith('owner-1');
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
