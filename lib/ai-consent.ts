'use client';

const AI_CONSENT_PREFIX = 'mhtoolkit.ai_data_sharing_consent.v2';

function consentKey(subjectId: string): string | null {
  const normalized = subjectId.trim();
  return normalized
    ? `${AI_CONSENT_PREFIX}:${encodeURIComponent(normalized)}`
    : null;
}

export const AI_DATA_SHARING_TITLE = 'AI Data Sharing Consent';

export const AI_DATA_SHARING_DISCLOSURE =
  'Your message and any MHtoolkit context you turn on may be sent securely to AI providers including Google Gemini, Anthropic Claude, and OpenAI. Voice features also send recordings for transcription, live voice may return provider-generated audio, and mobile push-to-talk may use your operating system\'s speech service. We do not sell this data or use it for advertising.';

export function hasAiDataSharingConsent(subjectId: string): boolean {
  if (typeof window === 'undefined') return false;
  const key = consentKey(subjectId);
  if (!key) return false;
  try {
    return window.localStorage.getItem(key) === 'granted';
  } catch {
    return false;
  }
}

export function resetAiDataSharingConsent(subjectId: string): boolean {
  if (typeof window === 'undefined') return false;
  const key = consentKey(subjectId);
  if (!key) return false;
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function grantAiDataSharingConsent(subjectId: string): boolean {
  if (typeof window === 'undefined') return false;
  const key = consentKey(subjectId);
  if (!key) return false;
  try {
    window.localStorage.setItem(key, 'granted');
    return true;
  } catch {
    return false;
  }
}
