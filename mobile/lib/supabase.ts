import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';
import { createClient, processLock } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const SECURE_CHUNK_SIZE = 1800;
const AUTH_STORAGE_KEY = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;

interface SecureManifest { generation: string; count: number; }

async function readManifest(key: string): Promise<SecureManifest | null> {
  const raw = await SecureStore.getItemAsync(`${key}.manifest`);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as SecureManifest;
    if (
      typeof value.generation !== 'string' ||
      !/^[a-z0-9-]+$/i.test(value.generation) ||
      !Number.isSafeInteger(value.count) ||
      value.count < 1 ||
      value.count > 100
    ) return null;
    return value;
  } catch {
    return null;
  }
}

async function deleteGeneration(key: string, manifest: SecureManifest | null): Promise<void> {
  if (manifest) {
    await Promise.all(
      Array.from(
        { length: manifest.count },
        (_, index) => SecureStore.deleteItemAsync(`${key}.${manifest.generation}.${index}`)
      )
    );
  }
}

const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const manifest = await readManifest(key);
    if (manifest) {
      const chunks = await Promise.all(
        Array.from(
          { length: manifest.count },
          (_, index) => SecureStore.getItemAsync(`${key}.${manifest.generation}.${index}`)
        )
      );
      if (chunks.some((chunk) => chunk === null)) return null;
      return chunks.join('');
    }

    const existingSecureValue = await SecureStore.getItemAsync(key);
    if (existingSecureValue) return existingSecureValue;

    // Preserve sessions created by released builds before SecureStore was used.
    const legacyValue = await AsyncStorage.getItem(key);
    if (!legacyValue) return null;
    await secureStorage.setItem(key, legacyValue);
    await AsyncStorage.removeItem(key);
    return legacyValue;
  },

  async setItem(key: string, value: string): Promise<void> {
    const previous = await readManifest(key);
    const generation = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const chunks = value.match(new RegExp(`.{1,${SECURE_CHUNK_SIZE}}`, 'gs')) || [''];
    await Promise.all(
      chunks.map((chunk, index) => SecureStore.setItemAsync(`${key}.${generation}.${index}`, chunk))
    );
    const written = await Promise.all(
      chunks.map((_, index) => SecureStore.getItemAsync(`${key}.${generation}.${index}`))
    );
    if (written.some((chunk) => chunk === null) || written.join('') !== value) {
      await deleteGeneration(key, { generation, count: chunks.length });
      throw new Error('Secure session write verification failed');
    }

    // This small pointer is the commit point. The previous generation remains
    // readable until the new generation has been fully written and verified.
    await SecureStore.setItemAsync(
      `${key}.manifest`,
      JSON.stringify({ generation, count: chunks.length } satisfies SecureManifest)
    );
    await deleteGeneration(key, previous).catch((error) => {
      console.warn('Unable to clean up previous secure session generation:', error);
    });
  },

  async removeItem(key: string): Promise<void> {
    const manifest = await readManifest(key);
    await Promise.all([
      deleteGeneration(key, manifest),
      SecureStore.deleteItemAsync(`${key}.manifest`),
      SecureStore.deleteItemAsync(key),
      AsyncStorage.removeItem(key),
    ]);
  },
};

export async function clearPersistedSupabaseSession(): Promise<void> {
  await Promise.all([
    secureStorage.removeItem(AUTH_STORAGE_KEY),
    secureStorage.removeItem(`${AUTH_STORAGE_KEY}-code-verifier`),
    secureStorage.removeItem(`${AUTH_STORAGE_KEY}-user`),
  ]);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureStorage,
    storageKey: AUTH_STORAGE_KEY,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
});

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
