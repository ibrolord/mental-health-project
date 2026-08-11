import { AccountabilityApiError, AccountabilityAuthError } from './errors';

export interface ParsedAccessToken {
  userId: string;
  expiresAtMs: number;
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function decodeBase64Url(value: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid base64url');
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  let bits = '';
  for (const character of normalized) {
    const index = BASE64_ALPHABET.indexOf(character);
    if (index < 0) throw new Error('Invalid base64url');
    bits += index.toString(2).padStart(6, '0');
  }

  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

export function parseAccessToken(token: string): ParsedAccessToken {
  try {
    if (typeof token !== 'string') throw new Error('Missing token');
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) throw new Error('Malformed token');
    const payload: unknown = JSON.parse(decodeBase64Url(parts[1]));
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('Malformed payload');
    }
    const claims = payload as Record<string, unknown>;
    if (typeof claims.sub !== 'string' || claims.sub.length === 0) {
      throw new Error('Missing subject');
    }
    if (typeof claims.exp !== 'number' || !Number.isFinite(claims.exp)) {
      throw new Error('Missing expiry');
    }
    return { userId: claims.sub, expiresAtMs: claims.exp * 1000 };
  } catch {
    throw new AccountabilityAuthError('Your session is invalid. Please sign in again.');
  }
}

export function parseInviteToken(value: string): string {
  const token = value.trim();
  if (!/^[A-Za-z0-9_-]{8,256}$/.test(token)) {
    throw new AccountabilityApiError('Enter a valid invite code.');
  }
  return token;
}
