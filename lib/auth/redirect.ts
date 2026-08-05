const DEFAULT_AUTH_REDIRECT = '/dashboard';

export function getSafeAuthRedirect(
  value: string | null | undefined,
  fallback = DEFAULT_AUTH_REDIRECT
): string {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return fallback;
  }

  return value;
}

export function authPathWithNext(path: string, next: string): string {
  return `${path}?next=${encodeURIComponent(getSafeAuthRedirect(next))}`;
}
