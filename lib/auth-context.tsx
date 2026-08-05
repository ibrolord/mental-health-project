'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase/client';
import { clearLegacySession, ensureAnonymousSession, getSessionId } from './session';
import type { User } from '@supabase/supabase-js';
import type { Session } from '@supabase/supabase-js';
import { apiRequest } from './api/client';
import { getSafeAuthRedirect } from './auth/redirect';
import {
  ACCOUNT_UPGRADE_EMAIL_FIELD,
  ACCOUNT_UPGRADE_STARTED_FLAG,
} from '@/mobile/lib/auth-validation';
import { resetAiDataSharingConsent } from './ai-consent';

export type SocialAuthProvider = 'google' | 'apple';
export type SocialAuthIntent = 'sign-in' | 'upgrade';

const USER_DATA_TABLES = [
  'moods',
  'assessments',
  'goals',
  'habits',
  'journal_entries',
  'chat_history',
  'user_affirmation_history',
  'user_book_favorites',
  'user_library_items',
  'life_plan_items',
  'focus_sessions',
  'wellbeing_reminders',
  'push_subscriptions',
] as const;

async function assertAnonymousAccountIsEmpty(): Promise<void> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (session && !session.user.is_anonymous) {
    throw new Error('This browser is already signed in. Sign out before using another account.');
  }
  if (!session) return;

  const results = await Promise.all(
    USER_DATA_TABLES.map((table) => supabase.from(table).select('id').limit(1))
  );
  if (results.some(({ error }) => error)) {
    throw new Error('Unable to verify that your anonymous data is safe. Sign in was blocked; please try again.');
  }
  if (results.some(({ data }) => (data?.length ?? 0) > 0)) {
    throw new Error(
      'Sign in is blocked because this anonymous profile has saved data or an active device reminder. Export or delete the data, and turn off device reminders in Settings before switching accounts.'
    );
  }
}

async function removeCurrentDevicePushSubscription(userId: string): Promise<void> {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    return;
  }

  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', subscription.endpoint);
  if (error) {
    throw new Error(
      'Sign out was blocked because device reminders could not be disconnected.'
    );
  }

  const unsubscribed = await subscription.unsubscribe();
  if (!unsubscribed) {
    throw new Error(
      'Sign out was blocked because device reminders could not be disconnected.'
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
  signUp: (email: string, next?: string) => Promise<void>;
  continueWithProvider: (
    provider: SocialAuthProvider,
    intent: SocialAuthIntent,
    next?: string
  ) => Promise<void>;
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
  continueWithProvider: async () => {},
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
        if (!active) return;

        // The current authenticated profile is usable before the one-time
        // legacy migration finishes. Do not block every save behind that request.
        setUser(session.user);
        setLoading(false);
        void migrateLegacyData(session).catch((error) => {
          // Keep the local key so the atomic migration can be retried next launch.
          console.error('Legacy data migration error:', error);
        });
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

      if (session) {
        setLoading(false);
      } else {
        setLoading(true);
        // Avoid calling another auth method from inside the auth callback lock.
        setTimeout(() => {
          void ensureAnonymousSession()
            .then(async (anonymousSession) => {
              if (!active) return;
              setUser(anonymousSession.user);
              setLoading(false);
              void migrateLegacyData(anonymousSession).catch((error) => {
                console.error('Legacy data migration error:', error);
              });
            })
            .catch((error) => {
              console.error('Anonymous sign-in error:', error);
              if (active) setLoading(false);
            });
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

  const signUp = async (email: string, next?: string): Promise<void> => {
    const { data: current, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!current.session?.user.is_anonymous) {
      throw new Error('This browser is already signed in to an account.');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const safeNext = getSafeAuthRedirect(next);
    const confirmationUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/auth/mobile-confirmed?source=web&upgrade_user_id=${encodeURIComponent(current.session.user.id)}&next=${encodeURIComponent(safeNext)}`
        : undefined;
    const { error } = await supabase.auth.updateUser(
      {
        email: normalizedEmail,
        data: {
          [ACCOUNT_UPGRADE_STARTED_FLAG]: true,
          [ACCOUNT_UPGRADE_EMAIL_FIELD]: normalizedEmail,
        },
      },
      { emailRedirectTo: confirmationUrl }
    );
    if (error) throw error;
  };

  const continueWithProvider = async (
    provider: SocialAuthProvider,
    intent: SocialAuthIntent,
    next?: string
  ) => {
    const { data: current, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const safeNext = getSafeAuthRedirect(next);
    const callbackUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`
        : undefined;

    if (intent === 'upgrade') {
      if (!current.session?.user.is_anonymous) {
        throw new Error('This browser is already signed in to an account.');
      }
      const redirectTo = callbackUrl
        ? `${callbackUrl}&upgrade_user_id=${encodeURIComponent(current.session.user.id)}`
        : undefined;
      const { error } = await supabase.auth.linkIdentity({
        provider,
        options: { redirectTo },
      });
      if (error) throw error;
      return;
    }

    await assertAnonymousAccountIsEmpty();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callbackUrl },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    if (user) {
      await removeCurrentDevicePushSubscription(user.id);
      resetAiDataSharingConsent(`user_id:${user.id}`);
    }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        sessionId,
        loading,
        isAuthenticated,
        isAnonymous,
        signIn,
        signUp,
        continueWithProvider,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
