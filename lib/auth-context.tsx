'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase/client';
import { clearLegacySession, ensureAnonymousSession, getSessionId } from './session';
import type { User } from '@supabase/supabase-js';
import type { Session } from '@supabase/supabase-js';
import { apiRequest } from './api/client';

const USER_DATA_TABLES = [
  'moods',
  'assessments',
  'goals',
  'habits',
  'chat_history',
  'user_affirmation_history',
  'user_book_favorites',
] as const;

async function assertAnonymousAccountIsEmpty(): Promise<void> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.user.is_anonymous) return;

  const results = await Promise.all(
    USER_DATA_TABLES.map((table) => supabase.from(table).select('id').limit(1))
  );
  if (results.some(({ error }) => error)) {
    throw new Error('Unable to verify that your anonymous data is safe. Sign in was blocked; please try again.');
  }
  if (results.some(({ data }) => (data?.length ?? 0) > 0)) {
    throw new Error(
      'Sign in is blocked because this anonymous profile has saved data. Export or delete that data in Settings before switching accounts.'
    );
  }
}

async function migrateLegacyData(session: Session): Promise<void> {
  const legacySessionId = getSessionId();
  if (!legacySessionId) return;

  const result = await apiRequest('/api/session/migrate', { legacySessionId });
  if (result?.verified !== true) {
    throw new Error('Legacy data migration was not verified');
  }

  clearLegacySession();
}

interface AuthContextType {
  user: User | null;
  sessionId: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAnonymous: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, redirectPath?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  sessionId: null,
  loading: true,
  isAuthenticated: false,
  isAnonymous: false,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const initAuth = async () => {
      try {
        const session = await ensureAnonymousSession();
        try {
          await migrateLegacyData(session);
        } catch (error) {
          // Keep the local key so the atomic migration can be retried next launch.
          console.error('Legacy data migration error:', error);
        }
        if (active) setUser(session.user);
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        if (active) setLoading(false);
      }
    };

    void initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);

      if (!session) {
        // Avoid calling another auth method from inside the auth callback lock.
        setTimeout(() => {
          void ensureAnonymousSession()
            .then(async (anonymousSession) => {
              try {
                await migrateLegacyData(anonymousSession);
              } catch (error) {
                console.error('Legacy data migration error:', error);
              }
              if (active) setUser(anonymousSession.user);
            })
            .catch((error) => console.error('Anonymous sign-in error:', error));
        }, 0);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const isAuthenticated = !!user;
  const isAnonymous = user?.is_anonymous === true;
  const sessionId = null;

  const signIn = async (email: string, password: string) => {
    await assertAnonymousAccountIsEmpty();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, redirectPath = '/dashboard') => {
    const { data: current, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;

    const safePath = redirectPath.startsWith('/') && !redirectPath.startsWith('//') ? redirectPath : '/dashboard';
    const emailRedirectTo = `${window.location.origin}/auth/login?next=${encodeURIComponent(safePath)}`;

    // Convert the current anonymous identity in place so locally created data
    // remains attached to the same user ID after email verification. Supabase
    // requires the email to be verified before a password can be added.
    if (current.session?.user.is_anonymous) {
      const { error } = await supabase.auth.updateUser(
        { email },
        { emailRedirectTo: `${window.location.origin}/auth/complete-signup?next=${encodeURIComponent(safePath)}` }
      );
      if (error) throw error;
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, sessionId, loading, isAuthenticated, isAnonymous, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
