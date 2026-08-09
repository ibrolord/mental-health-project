import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../../app/api/data/export/route';

const mocks = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  recordServerPrivacyEvent: vi.fn(),
}));

vi.mock('@/lib/api/auth', () => ({
  corsHeaders: () => ({ 'Access-Control-Allow-Origin': '*' }),
  unauthorizedResponse: () =>
    NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  verifyAuth: mocks.verifyAuth,
}));

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {},
}));

vi.mock('@/lib/privacy-events/server', () => ({
  privacyPlatformFromRequest: vi.fn(),
  recordServerPrivacyEvent: mocks.recordServerPrivacyEvent,
}));

describe('data export owner binding', () => {
  beforeEach(() => {
    mocks.verifyAuth.mockReset();
    mocks.verifyAuth.mockResolvedValue({
      valid: true,
      userId: 'owner-1',
      isAnonymous: false,
    });
    mocks.recordServerPrivacyEvent.mockReset();
  });

  it('rejects a signed-in export without a captured owner', async () => {
    const response = await POST(
      new NextRequest('https://mhtoolkit.test/api/data/export', {
        method: 'POST',
      })
    );

    expect(response.status).toBe(409);
    expect(mocks.recordServerPrivacyEvent).not.toHaveBeenCalled();
  });

  it('rejects an export after the signed-in owner changes', async () => {
    const response = await POST(
      new NextRequest('https://mhtoolkit.test/api/data/export', {
        method: 'POST',
        body: JSON.stringify({ expectedUserId: 'owner-2' }),
      })
    );

    expect(response.status).toBe(409);
    expect(mocks.recordServerPrivacyEvent).not.toHaveBeenCalled();
  });
});
