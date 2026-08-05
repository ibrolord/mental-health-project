import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';
import { createClient, processLock } from '@supabase/supabase-js';
import { createSecureSessionStorage } from './secure-session-storage';
import { resolveSupabaseConfig } from './supabase-config';

const supabaseConfig = resolveSupabaseConfig(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);
export const isSupabaseConfigured = supabaseConfig.isConfigured;

// Keep configuration errors inside the recoverable auth flow instead of
// crashing Expo Router while it imports the route tree.
const AUTH_STORAGE_KEY = `sb-${supabaseConfig.storageNamespace}-auth-token`;
const ANONYMOUS_SIGN_IN_PENDING_KEY = `${AUTH_STORAGE_KEY}-anonymous-sign-in-pending`;
const secureStorage = createSecureSessionStorage({
  secureStore: SecureStore,
  legacyStorage: AsyncStorage,
  onCleanupError: (error) => {
    console.warn('Unable to clean up previous secure session generation:', error);
  },
});

export async function clearPersistedSupabaseSession(): Promise<void> {
  const results = await Promise.allSettled([
    secureStorage.removeItem(AUTH_STORAGE_KEY),
    secureStorage.removeItem(`${AUTH_STORAGE_KEY}-code-verifier`),
    secureStorage.removeItem(`${AUTH_STORAGE_KEY}-user`),
    secureStorage.removeItem(ANONYMOUS_SIGN_IN_PENDING_KEY),
  ]);
  const failure = results.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected'
  );
  if (failure) throw failure.reason;
}

export const anonymousSignInState = {
  async isPending(): Promise<boolean> {
    return (await secureStorage.getItem(ANONYMOUS_SIGN_IN_PENDING_KEY)) !== null;
  },
  async markPending(): Promise<void> {
    await secureStorage.setItem(ANONYMOUS_SIGN_IN_PENDING_KEY, 'pending');
  },
  async clearPending(): Promise<void> {
    await secureStorage.removeItem(ANONYMOUS_SIGN_IN_PENDING_KEY);
  },
};

export const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
  auth: {
    storage: secureStorage,
    storageKey: AUTH_STORAGE_KEY,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'implicit',
    lock: processLock,
  },
});

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
