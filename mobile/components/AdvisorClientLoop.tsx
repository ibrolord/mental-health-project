import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { useAuth } from '@/lib/auth-context';
import { advisorProfileStorage } from '@/lib/advisor-profile-storage';
import { appleHealthPreference } from '@/lib/apple-health-preference';
import { subscribeAdvisorClient } from '@/lib/advisor-client-events';
import { runAdvisorClientRefresh } from '@/lib/advisor-client-runtime';

export function AdvisorClientLoop() {
  const { user, loading } = useAuth();
  const owner = user?.id ? `user_id:${user.id}` : null;
  useEffect(() => {
    if (Platform.OS !== 'ios' || loading || !owner) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (disposed || AppState.currentState !== 'active') return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        if (disposed) return;
        void runAdvisorClientRefresh('change').catch(() => {
          // Retry on the next meaningful change or foreground transition, not a polling loop.
          console.warn('Advisor follow-up sync will retry when the app updates.');
        });
      }, 350);
    };
    refresh();
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    const unsubscribe = subscribeAdvisorClient((event) => {
      if (event.ownerKey === owner && event.kind === 'changed') refresh();
    });
    const unsubscribeProfile = advisorProfileStorage.subscribe(owner, refresh);
    const unsubscribeHealth = appleHealthPreference.subscribe(owner.slice('user_id:'.length), refresh);
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      unsubscribe();
      unsubscribeProfile();
      unsubscribeHealth();
      appState.remove();
    };
  }, [owner, loading]);
  return null;
}
