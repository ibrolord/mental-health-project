// Story notes expand "full context", so prior opt-ins must be confirmed again.
const FULL_CONTEXT_PREFERENCE_KEY = 'mhtoolkit.ai_full_context.v3';

export function fullContextPreferenceKey(ownerKey: string): string {
  return `${FULL_CONTEXT_PREFERENCE_KEY}:${encodeURIComponent(ownerKey)}`;
}

export function hasFullContextPreference(ownerKey: string | null): boolean {
  if (typeof window === 'undefined' || !ownerKey) return false;
  try {
    return (
      window.localStorage.getItem(fullContextPreferenceKey(ownerKey)) ===
      'enabled'
    );
  } catch {
    return false;
  }
}

export function saveFullContextPreference(
  ownerKey: string | null,
  enabled: boolean
): void {
  if (typeof window === 'undefined' || !ownerKey) return;
  try {
    window.localStorage.setItem(
      fullContextPreferenceKey(ownerKey),
      enabled ? 'enabled' : 'disabled'
    );
  } catch {
    // The current conversation still works when storage is unavailable.
  }
}
