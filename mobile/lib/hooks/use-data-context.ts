import { useAuth } from '../auth-context';
import { useMemo } from 'react';

export function useDataContext() {
  const { user, isAuthenticated, isAnonymous, loading: authLoading } = useAuth();

  const context = useMemo(() => {
    if (isAuthenticated && user) {
      return { user_id: user.id, session_id: null };
    }
    return { user_id: null, session_id: null };
  }, [isAuthenticated, user]);

  const query = useMemo(() => {
    if (isAuthenticated && user) {
      return { column: 'user_id' as const, value: user.id };
    }
    return null;
  }, [isAuthenticated, user]);

  return {
    context,
    query,
    user,
    sessionId: null,
    isAuthenticated,
    isAnonymous,
    authLoading,
  };
}
