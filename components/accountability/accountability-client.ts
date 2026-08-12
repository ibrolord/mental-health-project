'use client';

import type { AccountabilityNudgeKind, AccountabilityPriority } from '@/lib/accountability';
import { supabase } from '@/lib/supabase/client';

import type {
  AccountabilityComment,
  AccountabilityConnection,
  AccountabilityOverview,
  AccountabilityScope,
  JoinInvitePreview,
  PrioritySuggestion,
  SharedCommitment,
} from './accountability-types';

type JsonRecord = Record<string, unknown>;

const INVITE_STORAGE_KEY = 'mhtoolkit:together-invite:v1';

export class AccountabilityClientError extends Error {
  constructor(readonly status: number, readonly detail?: string) {
    super('Together request failed');
    this.name = 'AccountabilityClientError';
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function storedInvite(connectionId: string, userId: string): { token: string; expiresAt: string; partnerEmail?: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(INVITE_STORAGE_KEY) ?? 'null');
    if (
      !isRecord(value)
      || stringValue(value.connectionId) !== connectionId
      || stringValue(value.userId) !== userId
    ) return null;
    const token = stringValue(value.token);
    return token ? { token, expiresAt: stringValue(value.expiresAt), partnerEmail: stringValue(value.partnerEmail) || undefined } : null;
  } catch {
    return null;
  }
}

function storeInvite(connectionId: string, token: string, expiresAt: string, userId: string, partnerEmail: string): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(
    INVITE_STORAGE_KEY,
    JSON.stringify({ connectionId, token, expiresAt, userId, partnerEmail })
  );
}

function clearStoredInvite(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(INVITE_STORAGE_KEY);
}

async function authorizationHeaders(): Promise<HeadersInit> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session || data.session.user.is_anonymous) {
    throw new AccountabilityClientError(401);
  }
  return {
    Authorization: `Bearer ${data.session.access_token}`,
    'Content-Type': 'application/json',
  };
}

async function request(path: string, init: RequestInit = {}): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(path, { ...init, headers: await authorizationHeaders() });
  } catch {
    throw new AccountabilityClientError(0);
  }
  const payload: unknown = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const detail = isRecord(payload) ? stringValue(payload.error) : '';
    throw new AccountabilityClientError(response.status, detail || undefined);
  }
  return isRecord(payload) && 'data' in payload ? payload.data : payload;
}

async function post(path: string, body: JsonRecord): Promise<unknown> {
  return request(path, { method: 'POST', body: JSON.stringify(body) });
}

function mapComment(value: unknown): AccountabilityComment | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const body = stringValue(value.body);
  if (!id || !body) return null;
  return {
    id,
    authorId: stringValue(value.authorId ?? value.author_id),
    authorName: stringValue(value.authorName, 'Partner'),
    body,
    createdAt: stringValue(value.createdAt),
  };
}

function mapCommitment(value: unknown): SharedCommitment | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const ownerId = stringValue(value.ownerId ?? value.owner_id);
  const title = stringValue(value.title);
  if (!id || !ownerId || !title) return null;
  const rawStatus = stringValue(value.status);
  if (rawStatus !== 'active' && rawStatus !== 'completed') return null;
  const progressShared = value.progressShared !== false && value.daysShownUp !== null;
  const daysShownUp = progressShared
    ? Math.max(0, Math.min(14, Math.trunc(numberValue(value.daysShownUp))))
    : null;
  return {
    id,
    ownerId,
    ownerName: stringValue(value.ownerName, 'Your partner'),
    title,
    detail: nullableString(value.detail ?? value.note),
    noteShared: value.notesShared === true,
    cadence: stringValue(value.cadence, 'custom'),
    status: rawStatus,
    progressShared,
    daysShownUp,
    lastCheckInAt: nullableString(value.lastCheckInAt ?? value.last_check_in_at),
    lastCheckInId: nullableString(value.lastCheckInId ?? value.last_check_in_id),
    lastCheckInNote: nullableString(value.lastCheckInNote),
    reward: nullableString(value.reward),
    comments: arrayValue(value.comments)
      .map(mapComment)
      .filter((item): item is AccountabilityComment => item !== null),
  };
}

function mapConnection(value: unknown, viewerId: string): AccountabilityConnection {
  if (!isRecord(value)) return { id: null, status: 'disconnected', partner: null, invite: null };
  const id = nullableString(value.id);
  const rawStatus = stringValue(value.status);
  const status: AccountabilityConnection['status'] = rawStatus === 'connected' || rawStatus === 'active'
    ? 'connected'
    : rawStatus === 'invite_pending' || rawStatus === 'pending' || rawStatus === 'invited'
      ? 'invite_pending'
      : 'disconnected';
  const partnerValue = value.partner;
  const partnerId = stringValue(value.partner_id);
  const partner = isRecord(partnerValue)
    ? { id: stringValue(partnerValue.id, 'partner'), displayName: stringValue(partnerValue.displayName, 'Your partner') }
    : partnerId
      ? { id: partnerId, displayName: 'Your partner' }
      : null;
  const inviteValue = value.invite;
  let invite = isRecord(inviteValue) && id
    ? { id, token: stringValue(inviteValue.token), expiresAt: stringValue(inviteValue.expiresAt), partnerEmail: stringValue(inviteValue.partnerEmail) || undefined }
    : null;
  if (id && status === 'invite_pending' && (!invite || !invite.token)) {
    const stored = storedInvite(id, viewerId);
    if (stored) invite = { id, token: stored.token, expiresAt: stored.expiresAt, partnerEmail: stored.partnerEmail };
  }
  return { id, status, partner, invite };
}

function mapSuggestion(value: unknown): PrioritySuggestion | null {
  if (!isRecord(value)) return null;
  const suggestedPriority = value.suggestedPriority ?? value.suggested_priority;
  if (suggestedPriority !== 'high' && suggestedPriority !== 'medium' && suggestedPriority !== 'low') return null;
  const id = stringValue(value.id);
  const commitmentId = stringValue(value.commitmentId ?? value.commitment_id);
  if (!id || !commitmentId) return null;
  const suggestedBy = isRecord(value.suggestedBy) ? value.suggestedBy : {};
  return {
    id,
    commitmentId,
    commitmentTitle: stringValue(value.commitmentTitle, 'Shared commitment'),
    suggestedPriority,
    suggestedBy: {
      id: stringValue(suggestedBy.id ?? value.suggested_by, 'partner'),
      displayName: stringValue(suggestedBy.displayName, 'Your partner'),
    },
    createdAt: stringValue(value.createdAt),
  };
}

function mapOverview(value: unknown): AccountabilityOverview {
  if (!isRecord(value)) throw new AccountabilityClientError(502);
  const viewerId = stringValue(value.viewerId);
  if (!viewerId) throw new AccountabilityClientError(502);
  const mine = arrayValue(value.mine)
    .map(mapCommitment)
    .filter((item): item is SharedCommitment => item !== null && item.ownerId === viewerId);
  const theirs = arrayValue(value.theirs)
    .map(mapCommitment)
    .filter((item): item is SharedCommitment => item !== null && item.ownerId !== viewerId);
  const commitments = [...mine, ...theirs];
  const suggestions = arrayValue(value.suggestions)
    .map(mapSuggestion)
    .filter((item): item is PrioritySuggestion => item !== null)
    .filter((item) => {
      const commitment = commitments.find((candidate) => candidate.id === item.commitmentId);
      if (!commitment || commitment.ownerId !== viewerId) return false;
      item.commitmentTitle = commitment.title;
      return true;
    });
  return {
    viewerId,
    connection: mapConnection(value.connection, viewerId),
    // Together commitments are created explicitly in Together. Goal records are
    // intentionally ignored even if an older overview response includes them.
    availableToShare: [],
    mine,
    theirs,
    suggestions,
    receivedNudges: arrayValue(value.receivedNudges).flatMap((item) => {
      if (!isRecord(item)) return [];
      const id = stringValue(item.id);
      const kind = item.kind;
      if (!id || (kind !== 'encouragement' && kind !== 'gentle_reminder' && kind !== 'celebrate_progress')) return [];
      return [{
        id,
        connectionId: stringValue(item.connectionId),
        commitmentId: nullableString(item.commitmentId),
        kind,
        senderName: stringValue(item.senderName, 'Your partner'),
        createdAt: stringValue(item.createdAt),
      }];
    }),
    scope: isRecord(value.scope) ? {
      connectionId: stringValue(value.scope.connectionId),
      sharesProgress: value.scope.sharesProgress === true,
      sharesCommitmentTitles: value.scope.sharesCommitmentTitles === true,
      sharesNotes: value.scope.sharesNotes === true,
    } : null,
    nudgeCooldownUntil: nullableString(value.nudgeCooldownUntil),
  };
}

export function getAccountabilityErrorMessage(error: unknown): string {
  if (!(error instanceof AccountabilityClientError)) return 'Something went wrong. Please try again.';
  if (error.status === 0) return 'Together could not be reached. Check your connection and try again.';
  if (error.status === 400) return 'Check the details and try again.';
  if (error.status === 403 && /not for this account/i.test(error.detail ?? '')) {
    return 'This invite was sent to a different email address.';
  }
  if (error.status === 401 || error.status === 403) return 'Sign in with a verified account to use Together.';
  if (error.status === 404) return 'This Together item is no longer available.';
  if (error.status === 409) return 'That changed in another session. Refresh and try again.';
  if (error.status === 429) return 'That nudge was sent recently. Give your partner a little space.';
  return 'Together could not complete that action. Please try again.';
}

export async function loadAccountabilityOverview(): Promise<AccountabilityOverview> {
  return mapOverview(await request('/api/accountability/overview'));
}

export async function createAccountabilityInvite(partnerEmail: string, userId: string): Promise<void> {
  const value = await post('/api/accountability/connections', { inviteeEmail: partnerEmail });
  if (!isRecord(value)) throw new AccountabilityClientError(502);
  const connectionId = stringValue(value.id ?? value.connectionId);
  const token = stringValue(value.inviteToken);
  if (!connectionId || !token) throw new AccountabilityClientError(502);
  storeInvite(connectionId, token, stringValue(value.inviteExpiresAt ?? value.expiresAt), userId, partnerEmail.trim().toLowerCase());
}

export async function revokeAccountabilityInvite(inviteId: string): Promise<void> {
  await request(`/api/accountability/invites/${encodeURIComponent(inviteId)}`, { method: 'DELETE' });
  clearStoredInvite();
}

export async function shareCommitment(input: {
  connectionId: string;
  title: string;
  cadence: 'daily' | 'weekly' | 'custom';
}): Promise<void> {
  await post('/api/accountability/commitments', input);
}

export async function revokeCommitmentShare(commitmentId: string): Promise<void> {
  await post('/api/accountability/commitments/archive', { commitmentId });
}

export async function setCommitmentNoteSharing(commitmentId: string, shared: boolean): Promise<void> {
  await post('/api/accountability/notes/commitment-sharing', { commitmentId, shared });
}

export async function setCheckInNoteSharing(checkInId: string, shared: boolean): Promise<void> {
  await post('/api/accountability/notes/check-in-sharing', { checkInId, shared });
}

export async function addCheckIn(input: {
  commitmentId: string;
  date: string;
  note: string;
  shareNote: boolean;
}): Promise<void> {
  await post('/api/accountability/check-ins', {
    commitmentId: input.commitmentId,
    checkInDate: input.date,
    note: input.note,
    shareNote: input.shareNote,
  });
}

export async function addComment(commitmentId: string, body: string): Promise<void> {
  await post('/api/accountability/comments', { commitmentId, body });
}

export async function sendNudge(
  connectionId: string,
  commitmentId: string,
  templateId: AccountabilityNudgeKind
): Promise<void> {
  await post('/api/accountability/nudges', { connectionId, commitmentId, kind: templateId });
}

export async function suggestPriority(
  commitmentId: string,
  suggestedPriority: AccountabilityPriority
): Promise<void> {
  await post('/api/accountability/suggestions', { commitmentId, priority: suggestedPriority });
}

export async function decideSuggestion(
  suggestionId: string,
  decision: 'accepted' | 'declined'
): Promise<void> {
  await post('/api/accountability/suggestions/respond', {
    suggestionId,
    approved: decision === 'accepted',
  });
}

export async function setCommitmentReward(commitmentId: string, description: string): Promise<void> {
  await post('/api/accountability/rewards', { commitmentId, description });
}

export async function revokeConnection(connectionId: string): Promise<void> {
  await post('/api/accountability/connections/revoke', { connectionId });
  clearStoredInvite();
}

export async function blockConnection(connectionId: string): Promise<void> {
  await post('/api/accountability/connections/block', { connectionId });
  clearStoredInvite();
}

export async function updateAccountabilityScope(scope: AccountabilityScope): Promise<void> {
  await post('/api/accountability/scope-control', {
    connectionId: scope.connectionId,
    sharesProgress: scope.sharesProgress,
    sharesCommitmentTitles: scope.sharesCommitmentTitles,
    sharesNotes: scope.sharesNotes,
  });
}

export async function loadJoinInvite(token: string): Promise<JoinInvitePreview> {
  const value: unknown = await request(`/api/accountability/invites/${encodeURIComponent(token)}`);
  if (!isRecord(value)) throw new AccountabilityClientError(404);
  const rawStatus = stringValue(value.status);
  if (!['available', 'expired', 'used', 'revoked'].includes(rawStatus)) {
    throw new AccountabilityClientError(502);
  }
  const status = rawStatus as JoinInvitePreview['status'];
  return {
    token,
    inviterName: stringValue(value.inviterName, 'Your accountability partner'),
    expiresAt: stringValue(value.expiresAt),
    status,
  };
}

export async function acceptJoinInvite(token: string): Promise<void> {
  await post('/api/accountability/connections/join', { inviteToken: token });
}
