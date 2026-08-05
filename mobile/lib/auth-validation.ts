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

export function signupErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';

  if (/rate limit/i.test(message)) {
    return 'Too many confirmation emails were requested. Please wait an hour, then try again.';
  }

  return message || 'Could not create your account. Please try again.';
}
