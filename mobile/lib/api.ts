import { supabase } from './supabase';
import { fetchWithTimeout } from './request';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://mhtoolkit.vercel.app';

interface ApiRequestOptions {
  timeoutMs?: number;
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
  };

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('No authenticated Supabase session');
  }
  headers['Authorization'] = `Bearer ${session.access_token}`;

  const res = await fetchWithTimeout(`${API_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  }, options.timeoutMs);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `API error: ${res.status}`);
  }

  return res.json() as Promise<T>;
}
