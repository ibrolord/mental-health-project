'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase/client';
import { getOrCreateSession } from './session';
import type { User } from '@supabase/supabase-js';

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      
      if (!session?.user) {
        // Create and register anonymous session
        const anonSession = await getOrCreateSession();
        setSessionId(anonSession);
      }
      
      setLoading(false);
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
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
    <AuthContext.Provider value={{ user, sessionId, loading, isAuthenticated, isAnonymous, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

