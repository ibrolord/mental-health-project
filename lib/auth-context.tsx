'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from './supabase/client';
import { getSessionId, clearSession, getDeviceFingerprint } from './session';

interface AuthContextType {
  user: User | null;
  sessionId: string;
  isAuthenticated: boolean;
  isAnonymous: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  migrateAnonymousData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get or create session ID
    const sid = getSessionId();
    setSessionId(sid);

    // Initialize anonymous session in database
    if (sid) {
      initializeAnonymousSession(sid);
    }

    // Check auth state
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const initializeAnonymousSession = async (sid: string) => {
    try {
      const fingerprint = getDeviceFingerprint();
      
      // Check if session exists
      const { data: existing } = await supabase
        .from('anonymous_sessions')
        .select('id')
        .eq('session_id', sid)
        .single();

      if (!existing) {
        // Create new anonymous session
        await supabase
          .from('anonymous_sessions')
          .insert({
            session_id: sid,
            device_fingerprint: fingerprint,
          });
      } else {
        // Update last active
        await supabase
          .from('anonymous_sessions')
          .update({ last_active_at: new Date().toISOString() })
          .eq('session_id', sid);
      }
    } catch (error) {
      console.error('Error initializing anonymous session:', error);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    // After successful login, migrate anonymous data
    await migrateAnonymousData();
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw error;

    // After successful signup, migrate anonymous data
    await migrateAnonymousData();
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    // Generate new session ID for continued anonymous use
    clearSession();
    const newSid = getSessionId();
    setSessionId(newSid);
    await initializeAnonymousSession(newSid);
  };

  const migrateAnonymousData = async () => {
    if (!user || !sessionId) return;

    try {
      // Check if migration already happened
      const { data: existing } = await supabase
        .from('user_data_migration')
        .select('id')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .single();

      if (existing) return; // Already migrated

      // Migrate moods
      await supabase
        .from('moods')
        .update({ user_id: user.id, session_id: null })
        .eq('session_id', sessionId);

      // Migrate assessments
      await supabase
        .from('assessments')
        .update({ user_id: user.id, session_id: null })
        .eq('session_id', sessionId);

      // Migrate goals
      await supabase
        .from('goals')
        .update({ user_id: user.id, session_id: null })
        .eq('session_id', sessionId);

      // Migrate habits
      await supabase
        .from('habits')
        .update({ user_id: user.id, session_id: null })
        .eq('session_id', sessionId);

      // Migrate chat history
      await supabase
        .from('chat_history')
        .update({ user_id: user.id, session_id: null })
        .eq('session_id', sessionId);

      // Migrate affirmation history
      await supabase
        .from('user_affirmation_history')
        .update({ user_id: user.id, session_id: null })
        .eq('session_id', sessionId);

      // Migrate book favorites
      await supabase
        .from('user_book_favorites')
        .update({ user_id: user.id, session_id: null })
        .eq('session_id', sessionId);

      // Record migration
      await supabase
        .from('user_data_migration')
        .insert({
          session_id: sessionId,
          user_id: user.id,
        });

      // Clear session ID after migration
      clearSession();
    } catch (error) {
      console.error('Error migrating anonymous data:', error);
    }
  };

  const value = {
    user,
    sessionId,
    isAuthenticated: !!user,
    isAnonymous: !user,
    loading,
    signIn,
    signUp,
    signOut,
    migrateAnonymousData,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

