import { useAuth } from '../auth-context';

/**
 * Hook to get the appropriate context (user_id or session_id) for database operations
 */
export function useDataContext() {
  const { user, sessionId, isAuthenticated, isAnonymous } = useAuth();

  const getContext = () => {
    if (isAuthenticated && user) {
      return { user_id: user.id, session_id: null };
    } else if (isAnonymous && sessionId) {
      return { user_id: null, session_id: sessionId };
    }
    return { user_id: null, session_id: null };
  };

  const getQuery = () => {
    if (isAuthenticated && user) {
      return { column: 'user_id' as const, value: user.id };
    } else if (isAnonymous && sessionId) {
      return { column: 'session_id' as const, value: sessionId };
    }
    return null;
  };

  return {
    context: getContext(),
    query: getQuery(),
    user,
    sessionId,
    isAuthenticated,
    isAnonymous,
  };
}

