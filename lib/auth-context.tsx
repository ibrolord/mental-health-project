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
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  sessionId: null,
  loading: true,
  isAuthenticated: false,
  isAnonymous: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        const anonSession = getOrCreateSession();
        setSessionId(anonSession);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        const anonSession = getOrCreateSession();
        setSessionId(anonSession);
      } else {
        setSessionId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const isAuthenticated = !!user;
  const isAnonymous = !user && !!sessionId;

  return (
    <AuthContext.Provider value={{ user, sessionId, loading, isAuthenticated, isAnonymous }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
