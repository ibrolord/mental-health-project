import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createEmptyAiContextSelections,
  type AiContextSelections,
} from './ai-context';

const CONTEXT_STORAGE_PREFIX = 'mhtoolkit.chat_context.v1';
const CONTEXT_ORDER = [
  'moodPattern',
  'moodNotes',
  'assessments',
  'goals',
  'habits',
  'journalEntries',
  'libraryNotes',
  'lifePlan',
  'focusSessions',
] as const satisfies readonly (keyof AiContextSelections)[];

export function contextSelectionKey(ownerKey: string): string {
  return `${CONTEXT_STORAGE_PREFIX}:${encodeURIComponent(ownerKey)}`;
}

export async function readContextSelections(
  ownerKey: string
): Promise<AiContextSelections> {
  try {
    const raw = await AsyncStorage.getItem(contextSelectionKey(ownerKey));
    if (!raw) return createEmptyAiContextSelections();
    const parsed = JSON.parse(raw) as Partial<AiContextSelections>;
    return Object.fromEntries(
      CONTEXT_ORDER.map((key) => [key, parsed[key] === true])
    ) as AiContextSelections;
  } catch {
    return createEmptyAiContextSelections();
  }
}

export async function storeContextSelections(
  ownerKey: string,
  selections: AiContextSelections
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      contextSelectionKey(ownerKey),
      JSON.stringify(selections)
    );
  } catch {
    // Conversation-scoped controls still work when persistence is unavailable.
  }
}

export async function clearContextSelections(ownerKey: string): Promise<void> {
  await AsyncStorage.removeItem(contextSelectionKey(ownerKey));
}
