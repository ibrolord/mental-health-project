import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import type { User } from '@supabase/supabase-js';

const SESSION_KEY = 'anonymous_session_id';

interface AuthContextType {
  user: User | null;
  sessionId: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAnonymous: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
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

async function getOrCreateSession(): Promise<string> {
  let sessionId = await AsyncStorage.getItem(SESSION_KEY);

  if (!sessionId) {
    sessionId = Crypto.randomUUID();
    await AsyncStorage.setItem(SESSION_KEY, sessionId);
  }

  try {
    await supabase
      .from('anonymous_sessions')
      .upsert(
        {
          session_id: sessionId,
          device_fingerprint: 'mobile-app',
          last_active_at: new Date().toISOString(),
        },
        { onConflict: 'session_id', ignoreDuplicates: false }
      );
  } catch (e) {
    console.error('Session registration error:', e);
  }

  return sessionId;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);

      if (!session?.user) {
        const anonSession = await getOrCreateSession();
        setSessionId(anonSession);
      }

      setLoading(false);
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);

      if (!session?.user) {
        const anonSession = await getOrCreateSession();
        setSessionId(anonSession);
      } else {
        setSessionId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const isAuthenticated = !!user;
  const isAnonymous = !user && !!sessionId;

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider
      value={{ user, sessionId, loading, isAuthenticated, isAnonymous, signIn, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
