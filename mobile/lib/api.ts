import { supabase } from './supabase';
import { fetchWithTimeout } from './request';
import { Platform } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://mhtoolkit.vercel.app';

interface ApiRequestOptions {
  timeoutMs?: number;
  accessToken?: string;
  signal?: AbortSignal;
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

  const { data: { session } } = options.accessToken
    ? { data: { session: null } }
    : await supabase.auth.getSession();
  const accessToken = options.accessToken ?? session?.access_token;
  if (!accessToken) {
    throw new Error('No authenticated Supabase session');
  }
  headers['Authorization'] = `Bearer ${accessToken}`;

  const res = await fetchWithTimeout(`${API_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: options.signal,
  }, options.timeoutMs);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `API error: ${res.status}`);
  }

  return res.json() as Promise<T>;
}
