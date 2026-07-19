import { createContext, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import type { Session, User } from '@supabase/supabase-js';
import { apiRequest } from './api';
import { clearPersistedSupabaseSession } from './supabase';
import { clearStoredAcquisitionAttribution } from './acquisition';

let anonymousSignIn: Promise<Session> | null = null;
const LEGACY_SESSION_KEY = 'anonymous_session_id';
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

interface AuthContextType {
  user: User | null;
  sessionId: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAnonymous: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
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
  deleteAccount: async () => {},
});

async function ensureAnonymousSession(): Promise<Session> {
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

async function migrateLegacyData(session: Session): Promise<void> {
  const legacySessionId = await AsyncStorage.getItem(LEGACY_SESSION_KEY);
  if (!legacySessionId) return;

  const result = await apiRequest('/api/session/migrate', { legacySessionId });
  if (result?.verified !== true) {
    throw new Error('Legacy data migration was not verified');
  }

  await AsyncStorage.removeItem(LEGACY_SESSION_KEY);
}

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

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
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

  const signUp = async (_email: string, _password: string) => {
    throw new Error('Account creation is temporarily unavailable while email verification is being upgraded.');
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const deleteAccount = async () => {
    if (!user) {
      throw new Error('No authenticated account to delete');
    }

    await clearStoredAcquisitionAttribution();
    const result = await apiRequest('/api/account/delete', {});
    if (!result?.deleted) {
      throw new Error(result?.error || 'Failed to delete account');
    }

    let { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
    if (signOutError) {
      await clearPersistedSupabaseSession();
      ({ error: signOutError } = await supabase.auth.signOut({ scope: 'local' }));
    }
    const { data: clearedSession, error: sessionError } = await supabase.auth.getSession();
    if (signOutError || sessionError || clearedSession.session) {
      throw new Error(
        'Your account was deleted, but this device session could not be cleared. Close the app and contact support before continuing.'
      );
    }
    const anonymousSession = await ensureAnonymousSession();
    setUser(anonymousSession.user);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <AuthContext.Provider
      value={{ user, sessionId, loading, isAuthenticated, isAnonymous, signIn, signUp, signOut, deleteAccount }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
