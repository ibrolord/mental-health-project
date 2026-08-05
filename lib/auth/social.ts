type AuthCompletionUser = {
  id: string;
  is_anonymous?: boolean;
};

const OAUTH_CALLBACK_KEYS = [
  'code',
  'access_token',
  'refresh_token',
  'error',
  'error_description',
] as const;

export function hasOAuthCallbackParameters(search: string, hash: string): boolean {
  const queryParams = new URLSearchParams(search.replace(/^\?/, ''));
  const hashParams = new URLSearchParams(hash.replace(/^#/, ''));

  return OAUTH_CALLBACK_KEYS.some(
    (key) => queryParams.has(key) || hashParams.has(key)
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
