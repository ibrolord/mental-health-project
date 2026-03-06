'use client';

import { supabase } from '@/lib/supabase/client';
import { getSessionId } from '@/lib/session';

/**
 * Make an authenticated API request from the web client.
 * Attaches Bearer token or X-Session-Id header.
 */
export async function apiRequest(path: string, body: any): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  } else {
    const sessionId = getSessionId();
    if (sessionId) {
      headers['X-Session-Id'] = sessionId;
    }
  }

  const res = await fetch(path, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  return res.json();
}
