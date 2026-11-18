'use client';

const AI_CONSENT_PREFIX = 'mhtoolkit.ai_data_sharing_consent.v4';

function consentKey(subjectId: string): string | null {
  const normalized = subjectId.trim();
  return normalized
    ? `${AI_CONSENT_PREFIX}:${encodeURIComponent(normalized)}`
    : null;
}

export const AI_DATA_SHARING_TITLE = 'AI Data Sharing Consent';

export const AI_DATA_SHARING_DISCLOSURE =
  'Chat messages and any MHtoolkit context you turn on are sent through the MHtoolkit server to Anthropic Claude or Google Gemini. Personalized affirmations send recent mood emojis, assessment scores, and goal counts to Anthropic Claude; mood notes are not sent. Voice recordings are transcribed by Google Gemini, with OpenAI as a backup, and live voice streams audio directly to OpenAI. Spoken replies send response text to Google Gemini or OpenAI for generated audio, and may use your operating system\'s speech service as a fallback. On iOS, a derived Apple Health summary is sent only after a separate preview and confirmation for that request; raw Health samples are never sent. We do not sell this data or use it for advertising.';

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
