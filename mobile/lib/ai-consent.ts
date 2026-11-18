import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Linking } from 'react-native';
import { AI_DATA_SHARING_DISCLOSURE } from './ai-consent-copy';

const AI_CONSENT_PREFIX = 'mhtoolkit.ai_data_sharing_consent.v4';
export const PRIVACY_POLICY_URL = 'https://mhtoolkit.vercel.app/privacy';

function consentKey(subjectId: string): string | null {
  const normalized = subjectId.trim();
  return normalized
    ? `${AI_CONSENT_PREFIX}:${encodeURIComponent(normalized)}`
    : null;
}

export { AI_DATA_SHARING_DISCLOSURE };

export async function hasAiDataSharingConsent(subjectId: string): Promise<boolean> {
  const key = consentKey(subjectId);
  if (!key) return false;
  try {
    return (await AsyncStorage.getItem(key)) === 'granted';
  } catch {
    return false;
  }
}

export async function resetAiDataSharingConsent(subjectId: string): Promise<void> {
  const key = consentKey(subjectId);
  if (!key) return;
  await AsyncStorage.removeItem(key);
}

export async function ensureAiDataSharingConsent(subjectId: string): Promise<boolean> {
  const key = consentKey(subjectId);
  if (!key) return false;
  if (await hasAiDataSharingConsent(subjectId)) {
    return true;
  }

  return new Promise((resolve) => {
    Alert.alert(
      'AI Data Sharing Consent',
      AI_DATA_SHARING_DISCLOSURE,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: 'Privacy Policy',
          onPress: () => {
            Linking.openURL(PRIVACY_POLICY_URL).catch(() => {});
            resolve(false);
          },
        },
        {
          text: 'I Agree',
          onPress: async () => {
            try {
              await AsyncStorage.setItem(key, 'granted');
              resolve(true);
            } catch {
              resolve(false);
            }
          },
        },
      ],
      {
        cancelable: true,
        onDismiss: () => resolve(false),
      }
    );
  });
}
