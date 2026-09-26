import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useDataContext } from './use-data-context';
import {
  recordToolCompletion, startToolCompletion, type ToolCompletionSession,
} from '../tool-completion-runtime';
import type { ToolCompletionKind } from '../tool-completion-storage';

type CompletionResult = { id?: string; completedAt?: string };
type PendingCompletion = { session: ToolCompletionSession; result: CompletionResult };

export function useToolCompletion(kind: ToolCompletionKind) {
  const { context, authLoading } = useDataContext();
  const params = useLocalSearchParams<{ sourceStepId?: string | string[] }>();
  const sourceStepId = typeof params.sourceStepId === 'string' ? params.sourceStepId : null;
  const owner = !authLoading && context.user_id ? `user_id:${context.user_id}` : null;
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const [error, setError] = useState('');
  const [canRetry, setCanRetry] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const activeSessionRef = useRef<ToolCompletionSession | null>(null);
  const pendingRef = useRef<PendingCompletion | null>(null);
  const retryInFlightRef = useRef(false);
  useEffect(() => {
    activeSessionRef.current = null;
    pendingRef.current = null;
    setCanRetry(false);
    setError('');
  }, [owner]);
  const start = useCallback((itemId: string, options: { id?: string; startedAt?: string } = {}) => {
    if (!owner) {
      setError('Your private profile is still loading. Try again in a moment.');
      return null;
    }
    pendingRef.current = null;
    setCanRetry(false);
    setError('');
    const session = startToolCompletion(owner, kind, itemId, sourceStepId, options);
    activeSessionRef.current = session;
    return session;
  }, [kind, owner, sourceStepId]);
  const persist = useCallback(async (
    session: ToolCompletionSession,
    result: CompletionResult,
  ): Promise<boolean> => {
    if (ownerRef.current !== session.ownerKey) return false;
    try {
      const saved = await recordToolCompletion(session, result);
      if (ownerRef.current === session.ownerKey && activeSessionRef.current === session) {
        pendingRef.current = null;
        setCanRetry(false);
        setError(saved ? '' : 'Your profile changed. This activity was not added to Today.');
      }
      return saved;
    } catch {
      if (ownerRef.current === session.ownerKey && activeSessionRef.current === session) {
        pendingRef.current = { session, result };
        setCanRetry(true);
        setError('This activity could not be added to Today.');
      }
      return false;
    }
  }, []);
  const complete = useCallback(async (
    session: ToolCompletionSession | null,
    result: CompletionResult = {},
  ): Promise<boolean> => {
    if (!session) return false;
    // Retrying must retain the time the activity finished, not the time of retry.
    return persist(session, { ...result, completedAt: result.completedAt ?? new Date().toISOString() });
  }, [persist]);
  const retry = useCallback(async (): Promise<boolean> => {
    const pending = pendingRef.current;
    if (retryInFlightRef.current || !pending || ownerRef.current !== pending.session.ownerKey ||
      activeSessionRef.current !== pending.session) return false;
    retryInFlightRef.current = true;
    setRetrying(true);
    try {
      return await persist(pending.session, pending.result);
    } finally {
      retryInFlightRef.current = false;
      setRetrying(false);
    }
  }, [persist]);
  return { start, complete, error, canRetry, retry, retrying };
}
