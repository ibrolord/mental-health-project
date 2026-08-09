import * as SecureStore from 'expo-secure-store';
import { createReflectionDraftStorage } from './reflections';

export const reflectionDraftStorage = createReflectionDraftStorage({
  secureStore: SecureStore,
  onCleanupError: (error) => {
    console.warn('Unable to finish reflection draft cleanup:', error);
  },
});

export function clearReflectionDraft(ownerId: string): Promise<void> {
  return reflectionDraftStorage.clear(ownerId);
}
