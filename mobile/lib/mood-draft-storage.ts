import * as SecureStore from 'expo-secure-store';
import { createMoodDraftStorage } from './mood-draft';

export const moodDraftStorage = createMoodDraftStorage(SecureStore);
