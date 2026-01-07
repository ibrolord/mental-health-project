'use client';

import { useAuth } from '../auth-context';
import { useMemo } from 'react';

export function useDataContext() {
  const { user, sessionId, isAuthenticated, isAnonymous, loading: authLoading } = useAuth();

  const context = useMemo(() => {
    if (isAuthenticated && user) {
      return { user_id: user.id, session_id: null };
    } else if (isAnonymous && sessionId) {
      return { user_id: null, session_id: sessionId };
    }
    return { user_id: null, session_id: null };
  }, [isAuthenticated, user, isAnonymous, sessionId]);

  const query = useMemo(() => {
    if (isAuthenticated && user) {
      return { column: 'user_id' as const, value: user.id };
    } else if (isAnonymous && sessionId) {
      return { column: 'session_id' as const, value: sessionId };
    }
    return null;
  }, [isAuthenticated, user, isAnonymous, sessionId]);

  return {
    context,
    query,
    user,
    sessionId,
    isAuthenticated,
    isAnonymous,
    authLoading,
  };
}

