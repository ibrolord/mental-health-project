import type { SupabaseClient } from '@supabase/supabase-js';

import { calculateDaysShownUp } from './progress';
import type { AccountabilityNudgeKind, CommitmentCadence } from './types';
import { mapDatabaseError } from './http';

type DbRow = Record<string, unknown>;

const CONNECTION_COLUMNS = 'id,owner_id,partner_id,status,accepted_at,ended_at,created_at';
const COMMITMENT_COLUMNS = 'id,connection_id,owner_id,title,cadence,status,priority,due_date,created_at,updated_at';
const CHECK_IN_COLUMNS = 'id,commitment_id,owner_id,shown_up_on,created_at';
const COMMENT_COLUMNS = 'id,commitment_id,author_id,body,created_at';
const SUGGESTION_COLUMNS = 'id,commitment_id,suggested_by,suggested_priority,note,status,responded_at,created_at';
const REWARD_COLUMNS = 'id,commitment_id,owner_id,description,earned_at,created_at,updated_at';
const SCOPE_COLUMNS = 'connection_id,owner_id,shares_progress,shares_commitment_titles,shares_notes,updated_at';

function rows<T>(data: T[] | null, error: { code?: string; message: string } | null): T[] {
  if (error) mapDatabaseError(error);
  return data ?? [];
}

function row<T>(data: T | null, error: { code?: string; message: string } | null): T {
  if (error) mapDatabaseError(error);
  if (!data) mapDatabaseError({ code: 'P0002', message: 'Together item not found' });
  return data;
}

function camel(row: DbRow): DbRow {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [
    key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()), value,
  ]));
}

export async function listConnections(db: SupabaseClient) {
  const result = await db.from('accountability_connections').select(CONNECTION_COLUMNS).order('created_at', { ascending: false });
  return rows<DbRow>(result.data, result.error).map(camel);
}

export async function createConnection(db: SupabaseClient, partnerEmail: string) {
  const result = await db.rpc('create_accountability_invite', { p_partner_email: partnerEmail });
  return camel(row<DbRow>(result.data, result.error));
}

export async function joinConnection(db: SupabaseClient, inviteToken: string) {
  const result = await db.rpc('accept_accountability_invite', { p_invite_token: inviteToken });
  if (result.error) mapDatabaseError(result.error);
  return getConnection(db, String(result.data));
}

export async function getConnection(db: SupabaseClient, connectionId: string) {
  const result = await db.from('accountability_connections').select(CONNECTION_COLUMNS).eq('id', connectionId).single();
  return camel(row<DbRow>(result.data, result.error));
}

export async function endConnection(db: SupabaseClient, connectionId: string, action: 'revoke' | 'block') {
  const result = await db.rpc('end_accountability_connection', { p_connection_id: connectionId, p_action: action });
  if (result.error) mapDatabaseError(result.error);
  return { id: connectionId, status: action === 'block' ? 'blocked' : 'revoked' };
}

export async function listCommitments(db: SupabaseClient, connectionId: string) {
  const result = await db.from('accountability_commitments').select(COMMITMENT_COLUMNS).eq('connection_id', connectionId).order('created_at');
  return rows<DbRow>(result.data, result.error).map(camel);
}

export async function getCommitment(db: SupabaseClient, commitmentId: string) {
  const result = await db.from('accountability_commitments').select(COMMITMENT_COLUMNS).eq('id', commitmentId).single();
  return camel(row<DbRow>(result.data, result.error));
}

export async function createCommitment(db: SupabaseClient, input: { connectionId: string; title: string; cadence: CommitmentCadence; note?: string; shareNote?: boolean }) {
  const result = await db.rpc('create_accountability_commitment', {
    p_connection_id: input.connectionId, p_title: input.title, p_cadence: input.cadence,
    p_note: input.note ?? null, p_share_note: input.shareNote ?? false,
  });
  if (result.error) mapDatabaseError(result.error);
  return getCommitment(db, String(result.data));
}

export async function createCheckIn(db: SupabaseClient, input: { commitmentId: string; shownUpOn: string; note?: string; shareNote?: boolean }) {
  const result = await db.rpc('create_accountability_check_in', {
    p_commitment_id: input.commitmentId, p_shown_up_on: input.shownUpOn,
    p_note: input.note ?? null, p_share_note: input.shareNote ?? false,
  });
  if (result.error) mapDatabaseError(result.error);
  const checkIn = await db.from('accountability_check_ins').select(CHECK_IN_COLUMNS).eq('id', String(result.data)).single();
  const value = camel(row<DbRow>(checkIn.data, checkIn.error));
  return { ...value, checkInDate: value.shownUpOn };
}

export async function getProgress(db: SupabaseClient, connectionId: string, asOfDate: string) {
  const window = calculateDaysShownUp([], asOfDate);
  const result = await db.rpc('get_accountability_check_in_dates', {
    p_connection_id: connectionId, p_window_start: window.windowStart, p_window_end: window.windowEnd,
  });
  const dates = rows<{ shown_up_on: string }>(result.data, result.error).map((item) => item.shown_up_on);
  return calculateDaysShownUp(dates, asOfDate);
}

export async function sendNudge(db: SupabaseClient, input: { connectionId: string; commitmentId?: string; kind: AccountabilityNudgeKind }) {
  const result = await db.rpc('send_accountability_nudge', {
    p_connection_id: input.connectionId, p_commitment_id: input.commitmentId ?? null, p_kind: input.kind,
  });
  if (result.error) mapDatabaseError(result.error);
  return { id: result.data, kind: input.kind };
}

export async function listComments(db: SupabaseClient, commitmentId: string, userId: string) {
  const result = await db.from('accountability_comments').select(COMMENT_COLUMNS).eq('commitment_id', commitmentId).order('created_at');
  return rows<DbRow>(result.data, result.error).map((item) => ({
    ...camel(item), authorName: item.author_id === userId ? 'You' : 'Partner',
  }));
}

export async function createComment(db: SupabaseClient, commitmentId: string, body: string) {
  const result = await db.rpc('create_accountability_comment', { p_commitment_id: commitmentId, p_body: body });
  if (result.error) mapDatabaseError(result.error);
  const comment = await db.from('accountability_comments').select(COMMENT_COLUMNS).eq('id', String(result.data)).single();
  return { ...camel(row<DbRow>(comment.data, comment.error)), authorName: 'You' };
}

export async function listSuggestions(db: SupabaseClient, connectionId: string) {
  const commitments = await listCommitments(db, connectionId);
  const ids = commitments.map((item) => String(item.id));
  if (ids.length === 0) return [];
  const result = await db.from('accountability_priority_suggestions').select(SUGGESTION_COLUMNS).in('commitment_id', ids).order('created_at', { ascending: false });
  return rows<DbRow>(result.data, result.error).map(camel);
}

export async function createSuggestion(db: SupabaseClient, input: { commitmentId: string; priority: string; note?: string }) {
  const result = await db.rpc('propose_accountability_priority', {
    p_commitment_id: input.commitmentId, p_priority: input.priority, p_note: input.note ?? null,
  });
  if (result.error) mapDatabaseError(result.error);
  const suggestion = await db.from('accountability_priority_suggestions').select(SUGGESTION_COLUMNS).eq('id', String(result.data)).single();
  return camel(row<DbRow>(suggestion.data, suggestion.error));
}

export async function respondSuggestion(db: SupabaseClient, suggestionId: string, approved: boolean) {
  const result = await db.rpc('respond_accountability_priority', {
    p_suggestion_id: suggestionId, p_approved: approved,
  });
  if (result.error) mapDatabaseError(result.error);
  return { id: suggestionId, status: approved ? 'approved' : 'rejected' };
}

export async function listRewards(db: SupabaseClient, connectionId: string) {
  const commitments = await listCommitments(db, connectionId);
  const ownedIds = commitments.map((item) => String(item.id));
  if (ownedIds.length === 0) return [];
  const result = await db.from('accountability_rewards').select(REWARD_COLUMNS).in('commitment_id', ownedIds).order('created_at');
  return rows<DbRow>(result.data, result.error).map((item) => {
    const value = camel(item);
    return { ...value, label: value.description };
  });
}

export async function createReward(db: SupabaseClient, commitmentId: string, description: string) {
  const result = await db.rpc('set_accountability_reward', {
    p_commitment_id: commitmentId, p_description: description,
  });
  if (result.error) mapDatabaseError(result.error);
  const reward = await db.from('accountability_rewards').select(REWARD_COLUMNS).eq('id', String(result.data)).single();
  const value = camel(row<DbRow>(reward.data, reward.error));
  return { ...value, label: value.description };
}

export async function getScopeControl(db: SupabaseClient, connectionId: string, userId: string) {
  const result = await db.from('accountability_scope_controls').select(SCOPE_COLUMNS).eq('connection_id', connectionId).eq('owner_id', userId).single();
  return camel(row<DbRow>(result.data, result.error));
}

export async function updateScopeControl(db: SupabaseClient, connectionId: string, userId: string, values: { sharesProgress: boolean; sharesCommitmentTitles: boolean; sharesNotes: boolean }) {
  const result = await db.rpc('update_accountability_scope', {
    p_connection_id: connectionId, p_shares_progress: values.sharesProgress,
    p_shares_commitment_titles: values.sharesCommitmentTitles, p_shares_notes: values.sharesNotes,
  });
  if (result.error) mapDatabaseError(result.error);
  return getScopeControl(db, connectionId, userId);
}
