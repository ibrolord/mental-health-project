import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Linking } from 'react-native';

const AI_CONSENT_PREFIX = 'mhtoolkit.ai_data_sharing_consent.v4';
export const PRIVACY_POLICY_URL = 'https://mhtoolkit.vercel.app/privacy';

function consentKey(subjectId: string): string | null {
  const normalized = subjectId.trim();
  return normalized
    ? `${AI_CONSENT_PREFIX}:${encodeURIComponent(normalized)}`
    : null;
}

export const AI_DATA_SHARING_DISCLOSURE =
  'MHtoolkit sends the AI content you choose through its backend to Google Gemini, Anthropic Claude, or OpenAI. This can include chat or voice content and any app context you turn on, such as mood notes, assessments, goals, habits, journal entries, library notes, plans, or focus sessions. On iOS, a derived Apple Health summary is sent only after you preview and confirm that individual request. Raw Health samples are never sent. Voice Support also sends recordings for transcription and response text to Google Gemini or OpenAI for generated speech. Your device speech service may be used if generated speech is unavailable.\n\nThe data is used to generate your response and spoken playback. It is not sold or used for advertising.\n\nDo you agree to this AI processing?';

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
