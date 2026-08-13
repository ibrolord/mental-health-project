export function shouldDetectAuthSessionInUrl(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname.replace(/\/+$/, '') !== '/auth/reset-password';
}
