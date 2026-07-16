'use client';

import { supabase } from './supabase/client';
import type { Session } from '@supabase/supabase-js';

const SESSION_KEY = 'anonymous_session_id';
let anonymousSignIn: Promise<Session> | null = null;

export async function ensureAnonymousSession(): Promise<Session> {
  const { data: current, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (current.session) return current.session;

  if (!anonymousSignIn) {
    anonymousSignIn = supabase.auth.signInAnonymously().then(({ data, error }) => {
      if (error) throw error;
      if (!data.session) throw new Error('Anonymous sign-in did not return a session');
      return data.session;
    }).finally(() => {
      anonymousSignIn = null;
    });
  }

  return anonymousSignIn;
}

/**
 * LEGACY COMPATIBILITY ONLY: old deployed clients may still send this value.
 * New clients authenticate anonymous users with a Supabase JWT instead.
 */
export function getSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(SESSION_KEY);
}

export function clearLegacySession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_KEY);
}
