export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const ACCOUNT_UPGRADE_COMPLETION_FLAG = 'mobile_password_configured';
export const ACCOUNT_UPGRADE_STARTED_FLAG = 'mobile_account_upgrade_started';
export const ACCOUNT_UPGRADE_EMAIL_FIELD = 'mobile_account_upgrade_email';

interface AccountUpgradeUser {
  is_anonymous?: boolean;
  email_confirmed_at?: string;
  user_metadata?: Record<string, unknown>;
}

export function isAccountUpgradeComplete(user: AccountUpgradeUser | null): boolean {
  return Boolean(
    user &&
    user.is_anonymous === false &&
    user.email_confirmed_at &&
    user.user_metadata?.[ACCOUNT_UPGRADE_COMPLETION_FLAG] === true
  );
}

export function isAccountEmailConfirmed(user: AccountUpgradeUser | null): boolean {
  return Boolean(
    user &&
    user.is_anonymous === false &&
    user.email_confirmed_at
  );
}

export function isAccountUpgradePending(user: AccountUpgradeUser | null): boolean {
  return Boolean(
    user &&
    user.user_metadata?.[ACCOUNT_UPGRADE_STARTED_FLAG] === true &&
    user.user_metadata?.[ACCOUNT_UPGRADE_COMPLETION_FLAG] !== true
  );
}

export function getPendingAccountUpgradeEmail(user: AccountUpgradeUser | null): string | null {
  const value = user?.user_metadata?.[ACCOUNT_UPGRADE_EMAIL_FIELD];
  return typeof value === 'string' ? normalizeEmail(value) : null;
}

export function validateAccountEmail(email: string): string | null {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return 'Enter your email address.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return 'Enter a valid email address.';
  }

  return null;
}

function authErrorValues(error: unknown): string[] {
  const values: string[] = [];
  if (typeof error === 'string') values.push(error);
  if (error instanceof Error) values.push(error.message);
  if (typeof error === 'object' && error !== null) {
    for (const key of ['message', 'code', 'error_code'] as const) {
      const value = (error as Record<string, unknown>)[key];
      if (typeof value === 'string') values.push(value);
    }
  }
  return [...new Set(values)];
}

function normalizedAuthErrorText(error: unknown): string {
  return authErrorValues(error)
    .join(' ')
    .toLowerCase()
    .replace(/[_-]+/g, ' ');
}

export function isExistingAccountError(error: unknown): boolean {
  const normalized = normalizedAuthErrorText(error);

  return (
    normalized.includes('user already exists') ||
    normalized.includes('email exists') ||
    normalized.includes('email address has already been registered') ||
    normalized.includes('email already registered') ||
    normalized.includes('email already exists')
  );
}

export function signInErrorMessage(error: unknown): string {
  const rawMessage = authErrorValues(error).join(' ');
  const message = normalizedAuthErrorText(error);
  if (/invalid login credentials|invalid credentials/i.test(message)) {
    return 'That email and password do not match. Try again or reset your password.';
  }
  if (/email not confirmed/i.test(message)) {
    return 'Confirm your email before signing in.';
  }
  if (/rate limit/i.test(message)) {
    return 'Too many sign-in attempts. Wait a few minutes, then try again.';
  }
  return rawMessage || 'Could not sign in. Please try again.';
}

export function signupErrorMessage(error: unknown): string {
  const rawMessage = authErrorValues(error).join(' ');
  const message = normalizedAuthErrorText(error);

  if (isExistingAccountError(error)) {
    return 'An MHtoolkit account already uses this email. Sign in instead or reset your password.';
  }

  if (/rate limit/i.test(message)) {
    return 'Too many confirmation emails were requested. Please wait an hour, then try again.';
  }

  return rawMessage || 'Could not create your account. Please try again.';
}
