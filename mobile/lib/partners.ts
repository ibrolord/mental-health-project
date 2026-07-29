import * as Crypto from 'expo-crypto';
import { supabase } from '@/lib/supabase';
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

const LINK_SELECT =
  'id, owner_id, partner_id, partner_label, status, created_at, share_goals, share_habits, share_checkins, share_mood_trend, share_streaks, allow_celebrations, share_journal_activity, share_assessment_activity, share_planner_progress, share_focus_progress, share_library_activity';
const INVITE_SELECT =
  'id, invitee_label, status, expires_at, created_at, share_goals, share_habits, share_checkins, share_mood_trend, share_streaks, allow_celebrations, share_journal_activity, share_assessment_activity, share_planner_progress, share_focus_progress, share_library_activity';

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** The database hashes this SHA-256 verifier again before storing it. */
export async function hashInviteToken(token: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    token,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
}

async function generateToken(): Promise<string> {
  return bytesToHex(await Crypto.getRandomBytesAsync(32));
}

export function inviteUrl(token: string): string {
  return `https://mhtoolkit.vercel.app/partner/accept?token=${encodeURIComponent(token)}`;
}

export async function createInvite(
  scopes: PartnerScopes,
  label: string
): Promise<{ invite: PartnerInvite; url: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) {
    throw new Error('Create an account before inviting a partner.');
  }

  const token = await generateToken();
  const tokenHash = await hashInviteToken(token);
  const { data, error } = await supabase
    .from('partner_invites')
    .insert({
      owner_id: user.id,
      token_hash: tokenHash,
      invitee_label: label.trim() || null,
      ...scopes,
    })
    .select(INVITE_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return { invite: data as PartnerInvite, url: inviteUrl(token) };
}

export async function listInvites(): Promise<PartnerInvite[]> {
  const { data, error } = await supabase
    .from('partner_invites')
    .select(INVITE_SELECT)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as PartnerInvite[];
}

export async function revokeInvite(id: string): Promise<void> {
  const { error } = await supabase
    .from('partner_invites')
    .update({ status: 'revoked' })
    .eq('id', id)
    .eq('status', 'pending');
  if (error) throw new Error(error.message);
}

export async function listSharingWith(userId: string): Promise<PartnerLink[]> {
  const { data, error } = await supabase
    .from('partner_links')
    .select(LINK_SELECT)
    .eq('owner_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as PartnerLink[];
}

export async function listSupporting(userId: string): Promise<PartnerLink[]> {
  const { data, error } = await supabase
    .from('partner_links')
    .select(LINK_SELECT)
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
    .select(
      'id, link_id, owner_id, partner_id, kind, source, milestone_count, reward_key, seen_at, created_at'
    )
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return (data ?? []) as PartnerCelebration[];
}

export async function markCelebrationSeen(id: string): Promise<boolean> {
  const { data, error } = await supabase.rpc(
    'mark_partner_celebration_seen',
    { p_celebration_id: id }
  );
  if (error) throw new Error(error.message);
  return data as boolean;
}
