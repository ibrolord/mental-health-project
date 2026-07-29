import { supabase } from '@/lib/supabase/client';
import type {
  CelebrationKind,
  CelebrationSource,
  PartnerCelebration,
  RewardKey,
} from '@/lib/partner-celebrations';
import type { PartnerScopes, ScopeKey } from '@/lib/partner-sharing';

export {
  REWARD_COPY,
  describeCelebration,
  type CelebrationKind,
  type CelebrationSource,
  type PartnerCelebration,
  type RewardKey,
} from '@/lib/partner-celebrations';
export {
  DEFAULT_SCOPES,
  PRIVATE_CONTENT,
  SCOPE_COPY,
  type PartnerScopes,
  type ScopeKey,
} from '@/lib/partner-sharing';

/**
 * Accountability partners.
 *
 * The invite token is generated in the browser, shown to the owner exactly
 * once as a shareable link, and never persisted in raw form. The browser sends
 * SHA-256(raw token), and a database trigger hashes that verifier again before
 * storage. Reading the table therefore does not yield an acceptable verifier.
 */

export type PartnerInvite = {
  id: string;
  invitee_label: string | null;
  status: 'pending' | 'accepted' | 'revoked';
  expires_at: string;
  created_at: string;
} & PartnerScopes;

export type PartnerLink = {
  id: string;
  owner_id: string;
  partner_id: string;
  partner_label: string | null;
  status: 'active' | 'revoked';
  created_at: string;
} & PartnerScopes;

export type PartnerSnapshot = {
  window_days: number;
  scopes: {
    goals: boolean;
    habits: boolean;
    checkins: boolean;
    streaks: boolean;
    celebrations: boolean;
    journal: boolean;
    assessments: boolean;
    planner: boolean;
    focus: boolean;
    library: boolean;
  };
  goals?: { completed: number };
  habits?: { due_today: number; completed_today: number };
  checkins?: { days: number };
  streaks?: { best_current: number };
  journal?: { entries: number };
  assessments?: { completed: number };
  planner?: { completed: number };
  focus?: { sessions: number };
  library?: { items: number };
};

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** SHA-256 verifier. The database hashes this value again before storage. */
export async function hashInviteToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export function inviteUrl(token: string): string {
  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://mhtoolkit.vercel.app';
  return `${origin}/partner/accept?token=${encodeURIComponent(token)}`;
}

/**
 * Creates an invite and returns the one-time link. The raw token is only ever
 * present in this return value, so the caller must surface it immediately.
 */
export async function createInvite(
  scopes: PartnerScopes,
  label: string
): Promise<{ invite: PartnerInvite; url: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('You need an account to invite a partner.');

  const token = generateToken();
  const tokenHash = await hashInviteToken(token);

  const { data, error } = await supabase
    .from('partner_invites')
    .insert({
      owner_id: user.id,
      token_hash: tokenHash,
      invitee_label: label.trim() || null,
      ...scopes,
    })
    .select('id, invitee_label, status, expires_at, created_at, share_goals, share_habits, share_checkins, share_mood_trend, share_streaks, allow_celebrations, share_journal_activity, share_assessment_activity, share_planner_progress, share_focus_progress, share_library_activity')
    .single();

  if (error) throw new Error(error.message);
  return { invite: data as PartnerInvite, url: inviteUrl(token) };
}

export async function listInvites(): Promise<PartnerInvite[]> {
  const { data, error } = await supabase
    .from('partner_invites')
    .select('id, invitee_label, status, expires_at, created_at, share_goals, share_habits, share_checkins, share_mood_trend, share_streaks, allow_celebrations, share_journal_activity, share_assessment_activity, share_planner_progress, share_focus_progress, share_library_activity')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as PartnerInvite[];
}

export async function revokeInvite(id: string): Promise<void> {
  const { error } = await supabase
    .from('partner_invites')
    .update({ status: 'revoked' })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/** Partners the current user has invited in, i.e. people who can see them. */
export async function listSharingWith(userId: string): Promise<PartnerLink[]> {
  const { data, error } = await supabase
    .from('partner_links')
    .select('*')
    .eq('owner_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as PartnerLink[];
}

/** Accounts the current user is supporting, i.e. people they can see. */
export async function listSupporting(userId: string): Promise<PartnerLink[]> {
  const { data, error } = await supabase
    .from('partner_links')
    .select('*')
    .eq('partner_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as PartnerLink[];
}

export async function updateScope(
  linkId: string,
  scopeKey: ScopeKey,
  next: boolean
): Promise<void> {
  const update: Partial<PartnerScopes> = { [scopeKey]: next };
  const { error } = await supabase
    .from('partner_links')
    .update(update)
    .eq('id', linkId);
  if (error) throw new Error(error.message);
}

export async function revokeLink(linkId: string): Promise<void> {
  const { error } = await supabase
    .from('partner_links')
    .update({ status: 'revoked' })
    .eq('id', linkId);
  if (error) throw new Error(error.message);
}

export async function acceptInvite(token: string): Promise<string> {
  const tokenHash = await hashInviteToken(token);
  const { data, error } = await supabase.rpc('accept_partner_invite', {
    p_token_hash: tokenHash,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function fetchSnapshot(ownerId: string): Promise<PartnerSnapshot> {
  const { data, error } = await supabase.rpc('partner_snapshot', {
    p_owner_id: ownerId,
  });
  if (error) throw new Error(error.message);
  return data as PartnerSnapshot;
}

export async function sendPartnerCelebration(
  ownerId: string,
  source: CelebrationSource,
  kind: CelebrationKind,
  rewardKey?: RewardKey
): Promise<string> {
  const { data, error } = await supabase.rpc('send_partner_celebration', {
    p_owner_id: ownerId,
    p_source: source,
    p_kind: kind,
    p_reward_key: rewardKey ?? null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function listReceivedCelebrations(
  userId: string
): Promise<PartnerCelebration[]> {
  const { data, error } = await supabase
    .from('partner_celebrations')
    .select('id, link_id, owner_id, partner_id, kind, source, milestone_count, reward_key, seen_at, created_at')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) throw new Error(error.message);
  return (data ?? []) as PartnerCelebration[];
}

export async function markCelebrationSeen(id: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('mark_partner_celebration_seen', {
    p_celebration_id: id,
  });
  if (error) throw new Error(error.message);
  return data as boolean;
}
