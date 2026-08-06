'use client';

import { getApiAuthHeaders } from '@/lib/api/auth-headers';

/**
 * Make an authenticated API request from the web client.
 * Attaches Bearer token or X-Session-Id header.
 */
export async function apiRequest(
  path: string,
  body: any,
  options: { signal?: AbortSignal; accessToken?: string } = {}
): Promise<any> {
  const headers = await getApiAuthHeaders({
    'Content-Type': 'application/json',
  });

  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
    delete headers['X-Session-Id'];
  }

  const res = await fetch(path, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: options.signal,
  });

  const result = await res.json().catch(() => ({ error: 'Request failed' }));
  if (!res.ok) {
    throw new Error(result.error || `API error: ${res.status}`);
  }
  return result;
}

export { getApiAuthHeaders } from '@/lib/api/auth-headers';
