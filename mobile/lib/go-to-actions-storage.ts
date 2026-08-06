import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  parseGoToActions,
  serializeGoToActions,
  type GoToAction,
} from './wellbeing/go-to-actions';

const STORAGE_PREFIX = 'mhtoolkit.go_to_actions.v1';
const clearListeners = new Set<(ownerKey: string) => void>();

export function goToActionsStorageKey(ownerKey: string): string {
  return `${STORAGE_PREFIX}:${encodeURIComponent(ownerKey)}`;
}

export async function loadGoToActions(ownerKey: string | null): Promise<GoToAction[]> {
  if (!ownerKey) return parseGoToActions(null);
  try {
    return parseGoToActions(await AsyncStorage.getItem(goToActionsStorageKey(ownerKey)));
  } catch {
    return parseGoToActions(null);
  }
}

export async function saveGoToActions(
  ownerKey: string | null,
  actions: GoToAction[]
): Promise<boolean> {
  if (!ownerKey) return false;
  try {
    await AsyncStorage.setItem(
      goToActionsStorageKey(ownerKey),
      serializeGoToActions(actions)
    );
    return true;
  } catch {
    return false;
  }
}

export async function clearGoToActions(ownerKey: string | null): Promise<void> {
  if (!ownerKey) return;
  await AsyncStorage.removeItem(goToActionsStorageKey(ownerKey));
  for (const listener of clearListeners) listener(ownerKey);
}

export function subscribeGoToActionsCleared(
  listener: (ownerKey: string) => void
): () => void {
  clearListeners.add(listener);
  return () => clearListeners.delete(listener);
}
