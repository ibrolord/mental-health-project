import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

import { corsHeaders } from '@/lib/api/auth';

type RouteContext = { params: Promise<{ path: string[] }> };
type Row = Record<string, unknown>;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const MAX_BODY_BYTES = 16_384;

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json({ data }, { status, headers: corsHeaders() });
}

function errorResponse(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status, headers: corsHeaders() });
  }
  console.error('Together API error:', error);
  const message = error instanceof Error ? error.message : 'Together could not complete that action.';
  const status = /rate limit/i.test(message) ? 429
    : /not found|invalid or expired/i.test(message) ? 404
      : /permission|required|not for this account/i.test(message) ? 403
        : /already|duplicate|active partner/i.test(message) ? 409
          : 500;
  const publicMessage = status === 429 ? 'Please wait before sending another support message.'
    : /not for this account/i.test(message) ? 'This invite was sent to a different email address.'
      : status === 404 ? 'That Together item is no longer available.'
        : status === 403 ? 'You do not have access to that Together item.'
          : status === 409 ? 'That action conflicts with an existing Together connection.'
            : 'Together could not complete that action. Please try again.';
  return NextResponse.json({ error: publicMessage }, { status, headers: corsHeaders() });
}

async function context(request: NextRequest): Promise<{ db: SupabaseClient; user: User }> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) throw new HttpError(401, 'Sign in to use Together.');
  const token = authorization.slice(7);
  const db = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Your session expired. Please sign in again.');
  if (data.user.is_anonymous || !data.user.email_confirmed_at) {
    throw new HttpError(403, 'Together requires a verified account.');
  }
  return { db, user: data.user };
}

async function body(request: NextRequest): Promise<Row> {
  const length = Number(request.headers.get('content-length') ?? '0');
  if (length > MAX_BODY_BYTES) throw new HttpError(413, 'Request is too large.');

  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'Invalid request.');
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new HttpError(413, 'Request is too large.');
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const raw = new TextDecoder().decode(bytes);
  let value: unknown = null;
  try { value = JSON.parse(raw); } catch { value = null; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'Invalid request.');
  return value as Row;
}

function string(value: unknown, name: string, max = 500): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new HttpError(400, `Invalid ${name}.`);
  }
  return value.trim();
}

function optionalString(value: unknown, max = 2000): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > max) throw new HttpError(400, 'Invalid text.');
  return value.trim() || null;
}

function rows(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter((item): item is Row => Boolean(item) && typeof item === 'object') : [];
}

function isoDate(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function progressWindow(asOf: string): { start: string; end: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw new HttpError(400, 'Invalid date.');
  const end = new Date(`${asOf}T00:00:00.000Z`);
  if (Number.isNaN(end.getTime())) throw new HttpError(400, 'Invalid date.');
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 13);
  return { start: isoDate(start), end: asOf };
}

async function rpc<T>(db: SupabaseClient, name: string, args: Row): Promise<T> {
  const { data, error } = await db.rpc(name, args);
  if (error) throw error;
  return data as T;
}

function mapConnection(row: Row, userId: string, inviteToken?: string): Row {
  const status = row.status === 'invited' ? 'pending' : row.status;
  return {
    id: row.id,
    status,
    partnerName: row.status === 'invited' ? 'Invitation pending' : 'Your partner',
    inviteToken,
    inviteExpiresAt: row.expires_at,
    createdAt: row.created_at,
    isInviter: row.owner_id === userId,
  };
}

async function listConnections(db: SupabaseClient, userId: string): Promise<Row[]> {
  const { data, error } = await db
    .from('accountability_connections')
    .select('id,status,owner_id,partner_id,expires_at,created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return rows(data).map((item) => mapConnection(item, userId));
}

async function listCommitments(db: SupabaseClient, userId: string, connectionId?: string): Promise<Row[]> {
  let query = db.from('accountability_commitments')
    .select('id,connection_id,owner_id,title,cadence,status,priority,due_date,created_at')
    .neq('status', 'archived')
    .order('created_at', { ascending: false });
  if (connectionId) query = query.eq('connection_id', connectionId);
  const { data, error } = await query;
  if (error) throw error;
  const commitments = rows(data);
  const ids = commitments.map((item) => String(item.id));
  if (ids.length === 0) return [];

  const [{ data: checkIns, error: checkError }, { data: notes, error: noteError }, { data: scopes, error: scopeError }] = await Promise.all([
    db.from('accountability_check_ins').select('id,commitment_id,shown_up_on,created_at').in('commitment_id', ids),
    db.from('accountability_commitment_notes').select('commitment_id,body,shared_with_partner').in('commitment_id', ids),
    db.from('accountability_scope_controls').select('connection_id,owner_id,shares_progress,shares_notes'),
  ]);
  if (checkError) throw checkError;
  if (noteError) throw noteError;
  if (scopeError) throw scopeError;
  const checkRows = rows(checkIns);
  const noteRows = rows(notes);
  const scopeRows = rows(scopes);
  const checkInIds = checkRows.map((item) => String(item.id));
  const { data: checkInNotes, error: checkInNoteError } = checkInIds.length
    ? await db.from('accountability_check_in_notes').select('id,check_in_id,body,shared_with_partner').in('check_in_id', checkInIds)
    : { data: [], error: null };
  if (checkInNoteError) throw checkInNoteError;
  const checkInNoteRows = rows(checkInNotes);
  const today = isoDate();
  const window = progressWindow(today);

  return commitments.map((item) => {
    const commitmentId = String(item.id);
    const mine = item.owner_id === userId;
    const ownCheckIns = checkRows.filter((entry) => entry.commitment_id === item.id);
    const sortedCheckIns = [...ownCheckIns].sort((a, b) => String(b.shown_up_on).localeCompare(String(a.shown_up_on)));
    const latestCheckIn = sortedCheckIns[0];
    const latestCheckInNote = latestCheckIn
      ? checkInNoteRows.find((entry) => entry.check_in_id === latestCheckIn.id)
      : undefined;
    const scope = scopeRows.find((entry) => entry.connection_id === item.connection_id && entry.owner_id === item.owner_id);
    const progressShared = mine || scope?.shares_progress === true;
    const dates = new Set(ownCheckIns
      .map((entry) => String(entry.shown_up_on))
      .filter((date) => date >= window.start && date <= window.end));
    const note = noteRows.find((entry) => entry.commitment_id === item.id);
    return {
      id: commitmentId,
      connectionId: item.connection_id,
      ownerId: item.owner_id,
      ownerName: mine ? 'You' : 'Your partner',
      title: item.title,
      cadence: item.cadence,
      status: item.status,
      note: note?.body ?? null,
      notesShared: Boolean(note?.shared_with_partner),
      isMine: mine,
      checkedInToday: ownCheckIns.some((entry) => entry.shown_up_on === today),
      progressShared,
      daysShownUp: progressShared ? dates.size : null,
      lastCheckInAt: progressShared ? latestCheckIn?.shown_up_on ?? null : null,
      lastCheckInId: mine ? latestCheckIn?.id ?? null : null,
      lastCheckInNote: latestCheckInNote?.body ?? null,
      createdAt: item.created_at,
    };
  });
}

async function nudgesFor(db: SupabaseClient, connectionId: string, recipientId: string): Promise<Row[]> {
  const { data, error } = await db.from('accountability_nudges')
    .select('id,connection_id,commitment_id,sender_id,recipient_id,kind,created_at')
    .eq('connection_id', connectionId)
    .eq('recipient_id', recipientId)
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) throw error;
  return rows(data).map((item) => ({
    id: item.id,
    connectionId: item.connection_id,
    commitmentId: item.commitment_id,
    kind: item.kind,
    senderName: 'Your partner',
    createdAt: item.created_at,
  }));
}

async function commentsFor(db: SupabaseClient, commitmentId: string, viewerId?: string): Promise<Row[]> {
  const { data, error } = await db.from('accountability_comments')
    .select('id,commitment_id,author_id,body,created_at')
    .eq('commitment_id', commitmentId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return rows(data).map((item) => ({
    id: item.id,
    commitmentId: item.commitment_id,
    authorId: item.author_id,
    authorName: viewerId && item.author_id === viewerId ? 'You' : 'Your partner',
    body: item.body,
    createdAt: item.created_at,
  }));
}

async function suggestionsFor(db: SupabaseClient, connectionId: string): Promise<Row[]> {
  const { data: commitments, error: commitmentError } = await db
    .from('accountability_commitments')
    .select('id,title,connection_id')
    .eq('connection_id', connectionId);
  if (commitmentError) throw commitmentError;
  const commitmentRows = rows(commitments);
  const commitmentIds = commitmentRows.map((item) => String(item.id));
  if (commitmentIds.length === 0) return [];

  const { data, error } = await db
    .from('accountability_priority_suggestions')
    .select('id,commitment_id,suggested_by,suggested_priority,note,status,created_at')
    .in('commitment_id', commitmentIds)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return rows(data).map((item) => ({
    id: item.id,
    connectionId,
    commitmentId: item.commitment_id,
    commitmentTitle: commitmentRows.find((commitment) => commitment.id === item.commitment_id)?.title ?? 'Shared commitment',
    suggestedPriority: item.suggested_priority,
    suggestedBy: { id: item.suggested_by, displayName: 'Your partner' },
    body: item.note ?? '',
    status: item.status === 'rejected' ? 'declined' : item.status,
    createdAt: item.created_at,
  }));
}

async function rewardsFor(db: SupabaseClient, connectionId: string): Promise<Row[]> {
  const { data: commitments, error: commitmentError } = await db
    .from('accountability_commitments')
    .select('id')
    .eq('connection_id', connectionId);
  if (commitmentError) throw commitmentError;
  const commitmentIds = rows(commitments).map((item) => String(item.id));
  if (commitmentIds.length === 0) return [];

  const { data, error } = await db
    .from('accountability_rewards')
    .select('id,commitment_id,description,earned_at,created_at')
    .in('commitment_id', commitmentIds)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return rows(data).map((item) => ({
    id: item.id,
    connectionId,
    commitmentId: item.commitment_id,
    label: item.description,
    description: item.description,
    earnedAt: item.earned_at,
    createdAt: item.created_at,
  }));
}

async function overview(db: SupabaseClient, userId: string): Promise<Row> {
  const connections = await listConnections(db, userId);
  const active = connections.find((item) => item.status === 'active');
  const pending = connections.find((item) => item.status === 'pending' && item.isInviter === true);
  const commitments = active ? await listCommitments(db, userId, String(active.id)) : [];
  const connectionId = active ? String(active.id) : null;
  const [suggestions, rewards, receivedNudges, scope] = connectionId
    ? await Promise.all([
      suggestionsFor(db, connectionId),
      rewardsFor(db, connectionId),
      nudgesFor(db, connectionId, userId),
      db.from('accountability_scope_controls').select('*')
        .eq('connection_id', connectionId).eq('owner_id', userId).single()
        .then(({ data, error }) => { if (error) throw error; return data as Row; }),
    ])
    : [[], [], [], null];
  const withComments: Row[] = await Promise.all(commitments.map(async (item): Promise<Row> => ({
    ...item,
    detail: item.note,
    reward: rewards.find((reward) => reward.commitmentId === item.id)?.description ?? null,
    comments: await commentsFor(db, String(item.id), userId),
  })));
  let nudgeCooldownUntil: string | null = null;
  if (connectionId) {
    const { data: latestNudge, error: nudgeError } = await db
      .from('accountability_nudges')
      .select('created_at')
      .eq('connection_id', connectionId)
      .eq('sender_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (nudgeError) throw nudgeError;
    if (latestNudge?.created_at) {
      const cooldown = new Date(String(latestNudge.created_at));
      cooldown.setHours(cooldown.getHours() + 1);
      if (cooldown.getTime() > Date.now()) nudgeCooldownUntil = cooldown.toISOString();
    }
  }
  return {
    viewerId: userId,
    connection: active ? {
      id: active.id,
      status: 'connected',
      partner: { id: 'partner', displayName: 'Your partner' },
      invite: null,
    } : pending ? {
      id: pending.id,
      status: 'invite_pending',
      partner: null,
      invite: { id: pending.id, token: '', expiresAt: pending.inviteExpiresAt },
    } : { id: null, status: 'disconnected', partner: null, invite: null },
    availableToShare: [],
    mine: withComments.filter((item) => item.isMine === true),
    theirs: withComments.filter((item) => item.isMine !== true),
    suggestions: suggestions.filter((item) => item.status === 'pending'),
    receivedNudges,
    scope: scope ? {
      connectionId,
      sharesProgress: scope.shares_progress,
      sharesCommitmentTitles: scope.shares_commitment_titles,
      sharesNotes: scope.shares_notes,
    } : null,
    nudgeCooldownUntil,
  };
}

async function handleGet(request: NextRequest, path: string[]): Promise<NextResponse> {
  const { db, user } = await context(request);
  const key = path.join('/');
  if (key === 'connections') return json(await listConnections(db, user.id));
  if (key === 'commitments') {
    const connectionId = request.nextUrl.searchParams.get('connectionId') ?? undefined;
    return json(await listCommitments(db, user.id, connectionId));
  }
  if (key === 'commitments/detail') {
    const commitmentId = string(request.nextUrl.searchParams.get('commitmentId'), 'commitment');
    const found = (await listCommitments(db, user.id)).find((item) => item.id === commitmentId);
    if (!found) throw new HttpError(404, 'Commitment not found.');
    return json(found);
  }
  if (key === 'progress') {
    const connectionId = string(request.nextUrl.searchParams.get('connectionId'), 'connection');
    const asOf = request.nextUrl.searchParams.get('asOfDate') ?? isoDate();
    const window = progressWindow(asOf);
    const checkInDates = await rpc<Row[]>(db, 'get_accountability_check_in_dates', {
      p_connection_id: connectionId,
      p_window_start: window.start,
      p_window_end: window.end,
    });
    const dates = new Set(rows(checkInDates).map((item) => String(item.shown_up_on)));
    return json({ daysShownUp: dates.size, windowDays: 14, windowStart: window.start, windowEnd: window.end });
  }
  if (key === 'comments') {
    return json(await commentsFor(db, string(request.nextUrl.searchParams.get('commitmentId'), 'commitment'), user.id));
  }
  if (key === 'overview') return json(await overview(db, user.id));
  if (key === 'suggestions') {
    return json(await suggestionsFor(db, string(request.nextUrl.searchParams.get('connectionId'), 'connection')));
  }
  if (key === 'rewards') {
    return json(await rewardsFor(db, string(request.nextUrl.searchParams.get('connectionId'), 'connection')));
  }
  if (key === 'nudges') {
    const connectionId = string(request.nextUrl.searchParams.get('connectionId'), 'connection');
    return json(await nudgesFor(db, connectionId, user.id));
  }
  if (key === 'scope-control') {
    const connectionId = string(request.nextUrl.searchParams.get('connectionId'), 'connection');
    const { data, error } = await db.from('accountability_scope_controls').select('*')
      .eq('connection_id', connectionId).eq('owner_id', user.id).single();
    if (error) throw error;
    const item = data as Row;
    return json({ connectionId, sharesProgress: item.shares_progress, sharesCommitmentTitles: item.shares_commitment_titles, sharesNotes: item.shares_notes });
  }
  if (path[0] === 'invites' && path.length === 2) {
    const preview = await rpc<Row>(db, 'preview_accountability_invite', { p_invite_token: path[1] });
    return json({ ...preview, inviterName: 'Your accountability partner' });
  }
  throw new HttpError(404, 'Together endpoint not found.');
}

async function handlePost(request: NextRequest, path: string[]): Promise<NextResponse> {
  const { db, user } = await context(request);
  const key = path.join('/');
  const input = await body(request);
  if (key === 'connections' || key === 'invites') {
    const email = string(input.inviteeEmail ?? input.partnerEmail, 'partner email', 320).toLowerCase();
    const result = await rpc<Row>(db, 'create_accountability_invite', { p_partner_email: email });
    return json(mapConnection({ id: result.connectionId, status: 'invited', owner_id: user.id, expires_at: result.expiresAt }, user.id, String(result.inviteToken)), 201);
  }
  if (key === 'connections/join' || (path[0] === 'invites' && path[2] === 'accept')) {
    const token = path[0] === 'invites' ? path[1] : string(input.inviteToken, 'invite code', 128);
    const id = await rpc<string>(db, 'accept_accountability_invite', { p_invite_token: token });
    const found = (await listConnections(db, user.id)).find((item) => item.id === id);
    return json(found ?? { id, status: 'active', partnerName: 'Your partner' });
  }
  if (key === 'connections/revoke' || key === 'connections/block') {
    const connectionId = string(input.connectionId, 'connection');
    await rpc(db, 'end_accountability_connection', { p_connection_id: connectionId, p_action: key.endsWith('block') ? 'block' : 'revoke' });
    return json({ id: connectionId, status: key.endsWith('block') ? 'blocked' : 'revoked', partnerName: 'Your partner' });
  }
  if (key === 'commitments') {
    const cadence = string(input.cadence, 'cadence', 16);
    const id = await rpc<string>(db, 'create_accountability_commitment', {
      p_connection_id: string(input.connectionId, 'connection'),
      p_title: string(input.title, 'commitment title', 240),
      p_cadence: cadence,
      p_note: optionalString(input.note),
      p_share_note: input.notesShared === true,
    });
    const found = (await listCommitments(db, user.id)).find((item) => item.id === id);
    return json(found, 201);
  }
  if (key === 'commitments/archive') {
    const commitmentId = string(input.commitmentId, 'commitment');
    await rpc<boolean>(db, 'archive_accountability_commitment', { p_commitment_id: commitmentId });
    return json({ archived: true, commitmentId });
  }
  if (key === 'notes/commitment-sharing') {
    const commitmentId = string(input.commitmentId, 'commitment');
    await rpc<boolean>(db, 'set_accountability_commitment_note_sharing', {
      p_commitment_id: commitmentId,
      p_shared: input.shared === true,
    });
    return json({ updated: true, commitmentId, shared: input.shared === true });
  }
  if (key === 'notes/check-in-sharing') {
    const checkInId = string(input.checkInId, 'check-in');
    await rpc<boolean>(db, 'set_accountability_check_in_note_sharing', {
      p_check_in_id: checkInId,
      p_shared: input.shared === true,
    });
    return json({ updated: true, checkInId, shared: input.shared === true });
  }
  if (key === 'check-ins') {
    const commitmentId = string(input.commitmentId, 'commitment');
    const date = string(input.checkInDate ?? input.date, 'check-in date', 10);
    const id = await rpc<string>(db, 'create_accountability_check_in', {
      p_commitment_id: commitmentId,
      p_shown_up_on: date,
      p_note: optionalString(input.note),
      p_share_note: input.shareNote === true,
    });
    return json({ id, commitmentId, checkInDate: date, createdAt: new Date().toISOString() }, 201);
  }
  if (key === 'comments') {
    const commitmentId = string(input.commitmentId, 'commitment');
    const id = await rpc<string>(db, 'create_accountability_comment', { p_commitment_id: commitmentId, p_body: string(input.body, 'comment', 1000) });
    return json({ id, commitmentId, authorName: 'You', body: input.body, createdAt: new Date().toISOString() }, 201);
  }
  if (key === 'nudges') {
    const raw = string(input.kind ?? input.templateId, 'nudge', 40);
    const kind = raw === 'check_in' ? 'gentle_reminder' : raw === 'celebrate' ? 'celebrate_progress' : raw;
    const connectionId = string(input.connectionId, 'connection');
    const id = await rpc<string>(db, 'send_accountability_nudge', { p_connection_id: connectionId, p_commitment_id: input.commitmentId ?? null, p_kind: kind });
    return json({ id }, 201);
  }
  if (key === 'suggestions') {
    const commitmentId = string(input.commitmentId, 'commitment');
    const priority = string(input.priority ?? input.suggestedPriority, 'priority', 16);
    const note = optionalString(input.note ?? input.body, 500);
    const id = await rpc<string>(db, 'propose_accountability_priority', {
      p_commitment_id: commitmentId,
      p_priority: priority,
      p_note: note,
    });
    return json({
      id,
      commitmentId,
      suggestedPriority: priority,
      suggestedBy: { id: user.id, displayName: 'You' },
      body: note ?? '',
      status: 'pending',
      createdAt: new Date().toISOString(),
    }, 201);
  }
  if (key === 'suggestions/respond') {
    const suggestionId = string(input.suggestionId, 'suggestion');
    if (typeof input.approved !== 'boolean') throw new HttpError(400, 'Invalid decision.');
    await rpc<boolean>(db, 'respond_accountability_priority', {
      p_suggestion_id: suggestionId,
      p_approved: input.approved,
    });
    return json({ updated: true });
  }
  if (key === 'rewards') {
    const commitmentId = string(input.commitmentId, 'commitment');
    const description = string(input.description ?? input.label, 'reward', 500);
    const id = await rpc<string>(db, 'set_accountability_reward', {
      p_commitment_id: commitmentId,
      p_description: description,
    });
    return json({ id, commitmentId, label: description, description, earnedAt: null }, 201);
  }
  if (key === 'scope-control') {
    const connectionId = string(input.connectionId, 'connection');
    await rpc<boolean>(db, 'update_accountability_scope', {
      p_connection_id: connectionId,
      p_shares_progress: input.sharesProgress === true,
      p_shares_commitment_titles: input.sharesCommitmentTitles === true,
      p_shares_notes: input.sharesNotes === true,
    });
    const { data, error } = await db.from('accountability_scope_controls').select('*')
      .eq('connection_id', connectionId).eq('owner_id', user.id).single();
    if (error) throw error;
    const item = data as Row;
    return json({ connectionId, sharesProgress: item.shares_progress, sharesCommitmentTitles: item.shares_commitment_titles, sharesNotes: item.shares_notes });
  }
  throw new HttpError(404, 'Together endpoint not found.');
}

async function handleDelete(request: NextRequest, path: string[]): Promise<NextResponse> {
  const { db } = await context(request);
  if (path[0] === 'invites' && path[1]) {
    await rpc(db, 'cancel_accountability_invite', { p_connection_id: path[1] });
    return json({ cancelled: true });
  }
  if (path.join('/') === 'connection') {
    const connections = await listConnections(db, '');
    const active = connections.find((item) => item.status === 'active');
    if (!active) throw new HttpError(404, 'Active connection not found.');
    await rpc(db, 'end_accountability_connection', { p_connection_id: active.id, p_action: 'revoke' });
    return json({ revoked: true });
  }
  throw new HttpError(404, 'Together endpoint not found.');
}

export function OPTIONS(): NextResponse {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(request: NextRequest, route: RouteContext): Promise<NextResponse> {
  try { return await handleGet(request, (await route.params).path); } catch (error) { return errorResponse(error); }
}

export async function POST(request: NextRequest, route: RouteContext): Promise<NextResponse> {
  try { return await handlePost(request, (await route.params).path); } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: NextRequest, route: RouteContext): Promise<NextResponse> {
  try { return await handleDelete(request, (await route.params).path); } catch (error) { return errorResponse(error); }
}
