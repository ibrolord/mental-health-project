import * as SecureStore from 'expo-secure-store';

import { createOfflineSafetyPlanCache } from './offline-safety-plan';

export const offlineSafetyPlanCache = createOfflineSafetyPlanCache({
  secureStore: SecureStore,
  onCleanupError: (error) => {
    console.warn('Unable to finish safety plan cache cleanup:', error);
  },
});
