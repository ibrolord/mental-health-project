'use client';

const AI_CONSENT_KEY = 'mhtoolkit.ai_data_sharing_consent.v1';

export const AI_DATA_SHARING_TITLE = 'AI Data Sharing Consent';

export const AI_DATA_SHARING_DISCLOSURE =
  'MHtoolkit AI features send the content you choose to provide to third-party AI providers through the MHtoolkit backend. This can include chat messages, voice recordings/transcripts, and optional recent moods, assessments, goals, or habits when you use personalized features.\n\nRecipients may include Google Gemini, Anthropic Claude, and OpenAI. They process this data to generate chat responses, affirmations, transcription, and spoken responses. We do not sell your data or share it for advertising.\n\nDo you agree to send this data for AI processing?';

export function hasAiDataSharingConsent(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(AI_CONSENT_KEY) === 'granted';
  } catch {
    return false;
  }
}

export function resetAiDataSharingConsent(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(AI_CONSENT_KEY);
  } catch {
    // Fail closed if storage is unavailable.
  }
}

export function ensureAiDataSharingConsent(): boolean {
  if (hasAiDataSharingConsent()) return true;
  if (typeof window === 'undefined') return false;

  const agreed = window.confirm(AI_DATA_SHARING_DISCLOSURE);
  if (agreed) {
    try {
      window.localStorage.setItem(AI_CONSENT_KEY, 'granted');
    } catch {
      return false;
    }
  }
  return agreed;
}
