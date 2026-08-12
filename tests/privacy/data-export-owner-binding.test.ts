import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../../app/api/data/export/route';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getUserById: vi.fn(),
  privacyPlatformFromRequest: vi.fn(),
  queries: [] as Array<{
    table: string;
    selected?: string;
    filter?: { method: 'eq' | 'or' | 'in'; column?: string; value: unknown };
  }>,
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
  getSupabaseAdmin: () => ({
    auth: { admin: { getUserById: mocks.getUserById } },
    from: mocks.from,
  }),
}));

vi.mock('@/lib/privacy-events/server', () => ({
  privacyPlatformFromRequest: mocks.privacyPlatformFromRequest,
  recordServerPrivacyEvent: mocks.recordServerPrivacyEvent,
}));

function emptyQuery(table: string) {
  const record: (typeof mocks.queries)[number] = { table };
  mocks.queries.push(record);
  const query = {
    data: [],
    error: null,
    select: vi.fn((selected: string) => {
      record.selected = selected;
      return query;
    }),
    eq: vi.fn((column: string, value: unknown) => {
      record.filter = { method: 'eq', column, value };
      return query;
    }),
    or: vi.fn((value: string) => {
      record.filter = { method: 'or', value };
      return query;
    }),
    in: vi.fn((column: string, value: unknown) => {
      record.filter = { method: 'in', column, value };
      return query;
    }),
    order: vi.fn(() => query),
    range: vi.fn(() => query),
  };
  return query;
}

describe('data export owner binding', () => {
  beforeEach(() => {
    mocks.verifyAuth.mockReset();
    mocks.verifyAuth.mockResolvedValue({
      valid: true,
      userId: 'owner-1',
      isAnonymous: false,
    });
    mocks.recordServerPrivacyEvent.mockReset();
    mocks.recordServerPrivacyEvent.mockResolvedValue(undefined);
    mocks.privacyPlatformFromRequest.mockReset();
    mocks.privacyPlatformFromRequest.mockReturnValue('web');
    mocks.queries.length = 0;
    mocks.from.mockReset();
    mocks.from.mockImplementation((table: string) => emptyQuery(table));
    mocks.getUserById.mockReset();
    mocks.getUserById.mockResolvedValue({ data: { user: null }, error: null });
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

  it('exports Together data only through explicit owner or connection filters', async () => {
    const response = await POST(
      new NextRequest('https://mhtoolkit.test/api/data/export', {
        method: 'POST',
        body: JSON.stringify({ expectedUserId: 'owner-1' }),
      })
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.together).toEqual({
      connections: [],
      memberships: [],
      sharing_controls: [],
      commitments: [],
      check_ins: [],
      commitment_notes: [],
      check_in_notes: [],
      comments_authored: [],
      nudges_sent_or_received: [],
      suggestions_authored: [],
      rewards: [],
      blocks_created: [],
    });

    const byTable = Object.fromEntries(
      mocks.queries
        .filter(({ table }) => table.startsWith('accountability_'))
        .map((query) => [query.table, query])
    );
    expect(byTable.accountability_connections.selected).toBe(
      'id,owner_id,partner_id,status,expires_at,used_at,accepted_at,ended_at,ended_by,created_at'
    );
    expect(byTable.accountability_connections.selected).not.toMatch(/hash|email/i);
    expect(byTable.accountability_connections.filter).toEqual({
      method: 'or',
      value: 'owner_id.eq.owner-1,partner_id.eq.owner-1',
    });
    expect(byTable.accountability_memberships.filter).toEqual({ method: 'eq', column: 'user_id', value: 'owner-1' });
    expect(byTable.accountability_scope_controls.filter).toEqual({ method: 'eq', column: 'owner_id', value: 'owner-1' });
    expect(byTable.accountability_commitments.filter).toEqual({ method: 'eq', column: 'owner_id', value: 'owner-1' });
    expect(byTable.accountability_check_ins.filter).toEqual({ method: 'eq', column: 'owner_id', value: 'owner-1' });
    expect(byTable.accountability_commitment_notes.filter).toEqual({ method: 'eq', column: 'owner_id', value: 'owner-1' });
    expect(byTable.accountability_check_in_notes.filter).toEqual({ method: 'eq', column: 'owner_id', value: 'owner-1' });
    expect(byTable.accountability_comments.filter).toEqual({ method: 'eq', column: 'author_id', value: 'owner-1' });
    expect(byTable.accountability_nudges.filter).toEqual({
      method: 'or',
      value: 'sender_id.eq.owner-1,recipient_id.eq.owner-1',
    });
    expect(byTable.accountability_priority_suggestions.filter).toEqual({ method: 'eq', column: 'suggested_by', value: 'owner-1' });
    expect(byTable.accountability_rewards.filter).toEqual({ method: 'eq', column: 'owner_id', value: 'owner-1' });
    expect(byTable.accountability_blocks.filter).toEqual({ method: 'eq', column: 'blocker_id', value: 'owner-1' });
  });
});
