import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Linking } from 'react-native';

const AI_CONSENT_KEY = 'mhtoolkit.ai_data_sharing_consent.v1';
export const PRIVACY_POLICY_URL = 'https://mhtoolkit.vercel.app/privacy';

export const AI_DATA_SHARING_DISCLOSURE =
  'MHtoolkit AI features send the content you choose to provide to third-party AI providers through the MHtoolkit backend. This can include chat messages, voice recordings/transcripts, and optional recent moods, assessments, goals, or habits when you use personalized features.\n\nRecipients may include Google Gemini, Anthropic Claude, and OpenAI. They process this data to generate chat responses, affirmations, transcription, and spoken responses. We do not sell your data or share it for advertising.\n\nDo you agree to send this data for AI processing?';

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
