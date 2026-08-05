import AsyncStorage from '@react-native-async-storage/async-storage';

const FULL_CONTEXT_PREFERENCE_KEY = 'mhtoolkit.ai_full_context.v3';

function key(ownerKey: string): string {
  return `${FULL_CONTEXT_PREFERENCE_KEY}:${encodeURIComponent(ownerKey)}`;
}

export async function hasFullContextPreference(
  ownerKey: string | null
): Promise<boolean> {
  if (!ownerKey) return false;
  try {
    return (await AsyncStorage.getItem(key(ownerKey))) === 'enabled';
  } catch {
    return false;
  }
}

export async function saveFullContextPreference(
  ownerKey: string | null,
  enabled: boolean
): Promise<void> {
  if (!ownerKey) return;
  try {
    await AsyncStorage.setItem(key(ownerKey), enabled ? 'enabled' : 'disabled');
  } catch {
    // The current conversation remains fail-closed when storage is unavailable.
  }
}

export async function clearFullContextPreference(
  ownerKey: string | null
): Promise<void> {
  if (!ownerKey) return;
  await AsyncStorage.removeItem(key(ownerKey));
}
