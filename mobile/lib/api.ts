import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://mhtoolkit.vercel.app';

/**
 * Make an authenticated API request to the web backend.
 * Attaches either Bearer token (authenticated) or X-Session-Id (anonymous).
 */
export async function apiRequest(path: string, body: any): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Try to get JWT from Supabase session
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  } else {
    // Fall back to anonymous session ID
    const sessionId = await AsyncStorage.getItem('anonymous_session_id');
    if (sessionId) {
      headers['X-Session-Id'] = sessionId;
    }
  }

  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `API error: ${res.status}`);
  }

  return res.json();
}
