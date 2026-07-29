import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Linking } from 'react-native';

const AI_CONSENT_KEY = 'mhtoolkit.ai_data_sharing_consent.v1';
export const PRIVACY_POLICY_URL = 'https://mhtoolkit.vercel.app/privacy';

export const AI_DATA_SHARING_DISCLOSURE =
  'MHtoolkit sends the AI content you choose through its backend to Google Gemini, Anthropic Claude, or OpenAI. This can include chat or voice content and any app context you turn on, such as mood notes, assessments, goals, habits, journal entries, library notes, plans, or focus sessions.\n\nThe data is used to generate your response. It is not sold or used for advertising.\n\nDo you agree to this AI processing?';

export async function hasAiDataSharingConsent(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(AI_CONSENT_KEY)) === 'granted';
  } catch {
    return false;
  }
}

export async function resetAiDataSharingConsent(): Promise<void> {
  try {
    await AsyncStorage.removeItem(AI_CONSENT_KEY);
  } catch {
    // Fail closed: a storage failure should not preserve assumed consent.
  }
}

export async function ensureAiDataSharingConsent(): Promise<boolean> {
  if (await hasAiDataSharingConsent()) {
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
              await AsyncStorage.setItem(AI_CONSENT_KEY, 'granted');
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
