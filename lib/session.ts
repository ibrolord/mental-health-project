'use client';

import { v4 as uuidv4 } from 'uuid';
import { supabase } from './supabase/client';

const SESSION_KEY = 'anonymous_session_id';

export async function getOrCreateSession(): Promise<string> {
  if (typeof window === 'undefined') return '';
  
  let sessionId = localStorage.getItem(SESSION_KEY);
  
  if (!sessionId) {
    sessionId = uuidv4();
    localStorage.setItem(SESSION_KEY, sessionId);
  }
  
  // Always try to upsert the session - this handles both new sessions
  // and ensures existing sessions are registered in the database
  try {
    const { error } = await supabase
      .from('anonymous_sessions')
      .upsert({ 
        session_id: sessionId,
        device_fingerprint: navigator.userAgent,
        last_active_at: new Date().toISOString()
      }, { 
        onConflict: 'session_id',
        ignoreDuplicates: false 
      });
    
    if (error) {
      console.error('Session registration error:', error);
    }
  } catch (e) {
    console.error('Failed to register session:', e);
  }
  
  return sessionId;
}

export function getSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(SESSION_KEY);
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_KEY);
}

