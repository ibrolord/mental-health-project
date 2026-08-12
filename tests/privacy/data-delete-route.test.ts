import { NextRequest, NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../../app/api/data/delete/route';

const mocks = vi.hoisted(() => ({
  privacyPlatformFromRequest: vi.fn(),
  recordServerPrivacyEvent: vi.fn(),
  removeGoalAttachmentObjectsForUser: vi.fn(),
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
  getSupabaseAdmin: () => ({ rpc: mocks.rpc }),
}));

vi.mock('@/lib/privacy-events/server', () => ({
  privacyPlatformFromRequest: mocks.privacyPlatformFromRequest,
  recordServerPrivacyEvent: mocks.recordServerPrivacyEvent,
}));

vi.mock('@/lib/goals/attachment-cleanup', () => ({
  removeGoalAttachmentObjectsForUser: mocks.removeGoalAttachmentObjectsForUser,
}));

describe('transactional data deletion route', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    mocks.verifyAuth.mockReset();
    mocks.verifyAuth.mockResolvedValue({ valid: true, userId: 'owner-1' });
    mocks.privacyPlatformFromRequest.mockReset();
    mocks.privacyPlatformFromRequest.mockReturnValue('ios');
    mocks.recordServerPrivacyEvent.mockReset();
    mocks.recordServerPrivacyEvent.mockResolvedValue(undefined);
    mocks.removeGoalAttachmentObjectsForUser.mockReset();
    mocks.removeGoalAttachmentObjectsForUser.mockResolvedValue({ error: null });
    mocks.rpc.mockReset();
    mocks.rpc.mockResolvedValue({ data: { deleted: true }, error: null });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('continues deletion when best-effort privacy logging fails', async () => {
    const loggingFailure = new Error('privacy event unavailable');
    mocks.recordServerPrivacyEvent.mockRejectedValueOnce(loggingFailure);

    const response = await POST(
      new NextRequest('https://mhtoolkit.test/api/data/delete', {
        method: 'POST',
        body: JSON.stringify({ expectedUserId: 'owner-1' }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ deleted: true });
    expect(mocks.rpc).toHaveBeenCalledWith('delete_owned_data', {
      p_session_id: null,
      p_user_id: 'owner-1',
    });
    expect(console.error).toHaveBeenCalledWith(
      'Deletion privacy event could not be recorded:',
      loggingFailure
    );
  });

  it('does not log or delete data for an unauthenticated request', async () => {
    mocks.verifyAuth.mockResolvedValueOnce({ valid: false });

    const response = await POST(
      new NextRequest('https://mhtoolkit.test/api/data/delete', {
        method: 'POST',
      })
    );

    expect(response.status).toBe(401);
    expect(mocks.recordServerPrivacyEvent).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('rejects deletion when the captured anonymous owner no longer matches', async () => {
    mocks.verifyAuth.mockResolvedValueOnce({
      valid: true,
      userId: 'different-user',
      isAnonymous: true,
    });

    const response = await POST(
      new NextRequest('https://mhtoolkit.test/api/data/delete', {
        method: 'POST',
        body: JSON.stringify({ expectedAnonymousUserId: 'anonymous-1' }),
      })
    );

    expect(response.status).toBe(409);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('rejects deletion when the captured signed-in owner no longer matches', async () => {
    mocks.verifyAuth.mockResolvedValueOnce({
      valid: true,
      userId: 'different-user',
      isAnonymous: false,
    });

    const response = await POST(
      new NextRequest('https://mhtoolkit.test/api/data/delete', {
        method: 'POST',
        body: JSON.stringify({ expectedUserId: 'owner-1' }),
      })
    );

    expect(response.status).toBe(409);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('rejects deletion when a signed-in request omits the captured owner', async () => {
    const response = await POST(
      new NextRequest('https://mhtoolkit.test/api/data/delete', {
        method: 'POST',
      })
    );

    expect(response.status).toBe(409);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('deletes only the anonymous owner authenticated by the captured token', async () => {
    mocks.verifyAuth.mockResolvedValueOnce({
      valid: true,
      userId: 'anonymous-1',
      isAnonymous: true,
    });

    const response = await POST(
      new NextRequest('https://mhtoolkit.test/api/data/delete', {
        method: 'POST',
        body: JSON.stringify({ expectedAnonymousUserId: 'anonymous-1' }),
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('delete_owned_data', {
      p_session_id: null,
      p_user_id: 'anonymous-1',
    });
  });
});
