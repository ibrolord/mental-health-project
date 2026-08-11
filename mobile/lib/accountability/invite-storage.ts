import * as SecureStore from 'expo-secure-store';

const KEY = 'mhtoolkit_together_invite_v1';

export interface StoredAccountabilityInvite {
  connectionId: string;
  token: string;
  partnerEmail: string;
  expiresAt?: string;
}

export async function saveAccountabilityInvite(invite: StoredAccountabilityInvite): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(invite));
}

export async function loadAccountabilityInvite(): Promise<StoredAccountabilityInvite | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredAccountabilityInvite>;
    if (!value.connectionId || !value.token || !value.partnerEmail) return null;
    return value as StoredAccountabilityInvite;
  } catch {
    return null;
  }
}

export async function clearAccountabilityInvite(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}

export function accountabilityInviteUrl(token: string): string {
  return `https://mhtoolkit.vercel.app/partner/join?token=${encodeURIComponent(token)}`;
}
