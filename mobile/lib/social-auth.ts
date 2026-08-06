import type { User } from '@supabase/supabase-js';

type AppleFullName = {
  givenName?: string | null;
  middleName?: string | null;
  familyName?: string | null;
};

export type OAuthCallbackTokens = {
  accessToken: string;
  refreshToken: string;
};

export function isIdentityAlreadyLinkedError(error: unknown): boolean {
  const values: string[] = [];
  if (typeof error === 'string') values.push(error);
  if (error instanceof Error) values.push(error.message);
  if (typeof error === 'object' && error !== null) {
    for (const key of ['message', 'code', 'error_code'] as const) {
      const value = (error as Record<string, unknown>)[key];
      if (typeof value === 'string') values.push(value);
    }
  }

  const normalized = values.join(' ').toLowerCase().replace(/[_-]+/g, ' ');
  return (
    normalized.includes('identity is already linked') ||
    normalized.includes('identity already linked') ||
    normalized.includes('identity already exists')
  );
}

export function isAppleAuthCancellation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ERR_REQUEST_CANCELED'
  );
}

export function appleProfileMetadata(
  fullName: AppleFullName | null | undefined
): Record<string, string | null> | null {
  const givenName = fullName?.givenName?.trim() || null;
  const middleName = fullName?.middleName?.trim() || null;
  const familyName = fullName?.familyName?.trim() || null;
  const displayName = [givenName, middleName, familyName]
    .filter((part): part is string => Boolean(part))
    .join(' ');

  if (!displayName) return null;

  return {
    full_name: displayName,
    given_name: givenName,
    middle_name: middleName,
    family_name: familyName,
  };
}

function callbackParams(url: string): {
  query: URLSearchParams;
  hash: URLSearchParams;
} {
  const parsed = new URL(url);
  if (
    parsed.protocol !== 'mhtoolkit:' ||
    parsed.hostname !== 'auth' ||
    parsed.pathname !== '/callback'
  ) {
    throw new Error('The provider returned to an invalid MHtoolkit callback.');
  }
  return {
    query: parsed.searchParams,
    hash: new URLSearchParams(parsed.hash.replace(/^#/, '')),
  };
}

export function parseOAuthCallback(url: string): OAuthCallbackTokens {
  const { query, hash } = callbackParams(url);
  const providerError =
    query.get('error_description') ??
    query.get('error') ??
    hash.get('error_description') ??
    hash.get('error');
  const providerErrorCode =
    query.get('error_code') ?? hash.get('error_code');
  if (providerError || providerErrorCode) {
    const callbackError = new Error(
      providerError ??
        'The identity provider could not complete sign-in. Please try again.'
    );
    if (providerErrorCode) {
      Object.assign(callbackError, { code: providerErrorCode });
    }
    throw callbackError;
  }

  const accessToken = hash.get('access_token') ?? query.get('access_token');
  const refreshToken = hash.get('refresh_token') ?? query.get('refresh_token');
  if (!accessToken || !refreshToken) {
    throw new Error('The provider returned without a usable MHtoolkit session.');
  }
  return { accessToken, refreshToken };
}

export function linkedProviderVerificationError(
  user: User,
  identities: { provider: string }[],
  provider: 'google' | 'apple',
  expectedUserId?: string
): string | null {
  const providerName = provider === 'google' ? 'Google' : 'Apple';
  if (user.is_anonymous) {
    return `Continue with ${providerName} did not finish.`;
  }
  if (expectedUserId && user.id !== expectedUserId) {
    return 'Account setup did not preserve the profile that started it.';
  }
  if (!identities.some((identity) => identity.provider === provider)) {
    return `The ${providerName} identity was not linked.`;
  }
  return null;
}
