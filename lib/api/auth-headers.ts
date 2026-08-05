'use client';

import { supabase } from '@/lib/supabase/client';
import { getSessionId } from '@/lib/session';

/**
 * Build the authentication headers required by protected API routes.
 * Content-Type is deliberately caller-controlled so this also works with FormData.
 */
export async function getApiAuthHeaders(
  initialHeaders: Record<string, string> = {}
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'X-Client-Platform': 'web',
    ...initialHeaders,
  };

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  } else {
    const sessionId = getSessionId();
    if (sessionId) {
      headers['X-Session-Id'] = sessionId;
    }
  }

  return headers;
}
