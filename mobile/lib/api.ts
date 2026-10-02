import { supabase } from './supabase';
import { fetchWithTimeout } from './request';
import { Platform } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://mhtoolkit.vercel.app';

interface ApiRequestOptions {
  timeoutMs?: number;
  accessToken?: string;
  signal?: AbortSignal;
  isCurrent?: () => boolean;
  expectedUserId?: string;
}

/**
 * Make an authenticated API request to the web backend.
 * Attaches the Supabase JWT used by both permanent and anonymous users.
 */
export async function apiRequest<T = any>(
  path: string,
  body: unknown,
  options: ApiRequestOptions = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Client-Platform': Platform.OS === 'android' ? 'android' : 'ios',
  };

  const { data: { session } } = options.accessToken && options.expectedUserId === undefined
    ? { data: { session: null } }
    : await supabase.auth.getSession();
  const accessToken = options.accessToken ?? session?.access_token;
  const assertCurrent = () => {
    if (options.isCurrent?.() === false) throw new Error('Request is no longer current');
    if (options.expectedUserId !== undefined && (
      session?.user?.id !== options.expectedUserId || accessToken !== session?.access_token
    )) {
      throw new Error('Authenticated user changed before request');
    }
  };
  // Session lookup can finish after an account switch but before React updates.
  assertCurrent();
  if (!accessToken) {
    throw new Error('No authenticated Supabase session');
  }
  headers['Authorization'] = `Bearer ${accessToken}`;

  const requestBody = JSON.stringify(body);
  assertCurrent();
  const res = await fetchWithTimeout(`${API_URL}${path}`, {
    method: 'POST',
    headers,
    body: requestBody,
    signal: options.signal,
  }, options.timeoutMs);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `API error: ${res.status}`);
  }

  return res.json() as Promise<T>;
}
