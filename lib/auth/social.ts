type AuthCompletionUser = {
  id: string;
  is_anonymous?: boolean;
};

export type SupportedSocialAuthProvider = 'google' | 'apple';

const OAUTH_CALLBACK_KEYS = [
  'code',
  'access_token',
  'refresh_token',
  'error',
  'error_code',
  'error_description',
] as const;

export function hasOAuthCallbackParameters(search: string, hash: string): boolean {
  const queryParams = new URLSearchParams(search.replace(/^\?/, ''));
  const hashParams = new URLSearchParams(hash.replace(/^#/, ''));

  return OAUTH_CALLBACK_KEYS.some(
    (key) => queryParams.has(key) || hashParams.has(key)
  );
}

export function parseSocialAuthProvider(
  value: string | null | undefined
): SupportedSocialAuthProvider | null {
  return value === 'google' || value === 'apple' ? value : null;
}

export function isIdentityAlreadyLinkedError(
  ...values: Array<string | null | undefined>
): boolean {
  const normalized = values
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase()
    .replace(/[_-]+/g, ' ');

  return (
    normalized.includes('identity is already linked') ||
    normalized.includes('identity already linked') ||
    normalized.includes('identity already exists')
  );
}

export function socialAuthCompletionError(
  user: AuthCompletionUser,
  expectedUpgradeUserId: string | null
): string | null {
  if (user.is_anonymous) {
    return expectedUpgradeUserId
      ? 'This provider could not be linked to the profile that started account setup.'
      : 'Social sign-in did not finish.';
  }
  if (!expectedUpgradeUserId) return null;
  if (user.id !== expectedUpgradeUserId) {
    return 'This provider could not be linked to the profile that started account setup.';
  }
  return null;
}
