import { supabase } from '@/lib/supabase/client';

/**
 * Accountability partners.
 *
 * The invite token is generated in the browser, shown to the owner exactly
 * once as a shareable link, and never persisted in raw form. Only its SHA-256
 * hash reaches the database, so reading the table does not yield anything
 * replayable.
 */

export type PartnerScopes = {
  share_goals: boolean;
  share_habits: boolean;
  share_checkins: boolean;
  share_mood_trend: boolean;
};

export const DEFAULT_SCOPES: PartnerScopes = {
  share_goals: true,
  share_habits: true,
  share_checkins: true,
  share_mood_trend: false,
};

export type ScopeKey = keyof PartnerScopes;

/**
 * The complete set of things a partner can ever be shown. Journal entries, AI
 * chat, assessment scores and mood notes are absent by design and must not be
 * added here without a corresponding change to the database function and the
 * consent copy.
 */
export const SCOPE_COPY: Record<
  ScopeKey,
  { label: string; description: string }
> = {
  share_checkins: {
    label: 'Check-in consistency',
    description: 'How many days you checked in this week. Never what you wrote.',
  },
  share_goals: {
    label: 'Goal completion',
    description: 'How many of your goals you finished. Not their contents.',
  },
  share_habits: {
    label: 'Habit streaks',
    description: 'How many days you logged habits. Not which habits.',
  },
  share_mood_trend: {
    label: 'Mood trend',
    description: 'The shape of your week as emoji. Never the notes you attach.',
  },
};

/** Things that are never shareable, surfaced in the UI so the promise is explicit. */
export const NEVER_SHARED = [
  'Journal entries',
  'AI chat history',
  'Assessment scores',
  'Notes on mood entries',
] as const;

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
  owner_id: string;
  window_days: number;
  scopes: {
    goals: boolean;
    habits: boolean;
    checkins: boolean;
    mood_trend: boolean;
  };
  goals?: { completed: number; total: number };
  habits?: { logged_days: number; tracked: number };
  checkins?: { days: number };
  mood_trend?: { day: string; emoji: string }[];
};

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** SHA-256 hex digest, matching what the database stores. */
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
    .select('id, invitee_label, status, expires_at, created_at, share_goals, share_habits, share_checkins, share_mood_trend')
    .single();

  if (error) throw new Error(error.message);
  return { invite: data as PartnerInvite, url: inviteUrl(token) };
}

export async function listInvites(): Promise<PartnerInvite[]> {
  const { data, error } = await supabase
    .from('partner_invites')
    .select('id, invitee_label, status, expires_at, created_at, share_goals, share_habits, share_checkins, share_mood_trend')
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

export async function updateScopes(
  linkId: string,
  scopes: PartnerScopes
): Promise<void> {
  const { error } = await supabase
    .from('partner_links')
    .update(scopes)
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
