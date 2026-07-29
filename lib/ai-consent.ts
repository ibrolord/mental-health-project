'use client';

const AI_CONSENT_KEY = 'mhtoolkit.ai_data_sharing_consent.v1';

export const AI_DATA_SHARING_TITLE = 'AI Data Sharing Consent';

export const AI_DATA_SHARING_DISCLOSURE =
  'Your message and any MHtoolkit context you turn on may be sent securely to AI providers including Google Gemini, Anthropic Claude, and OpenAI. Voice features also send audio for transcription and playback. We do not sell this data or use it for advertising.';

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

export function grantAiDataSharingConsent(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(AI_CONSENT_KEY, 'granted');
    return true;
  } catch {
    return false;
  }
}
