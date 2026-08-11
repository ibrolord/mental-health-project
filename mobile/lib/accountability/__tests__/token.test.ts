import { describe, expect, it } from 'vitest';

import { parseAccessToken } from '../token';
import { AccountabilityAuthError } from '../errors';
import { b64url, makeToken, NOW_MS } from './helpers';

/**
 * CRITICAL — safe token parsing.
 *
 * parseAccessToken must never throw a raw runtime error (atob/JSON.parse), must
 * never echo token material into an error message, and must never be treated as
 * a signature check. It extracts claims defensively so the client can fail fast
 * before spending a network round trip.
 */
describe('parseAccessToken', () => {
  // --- happy path ---

  it('returns the sub claim as userId for a well formed token', () => {
    const token = makeToken({ sub: 'user-abc' });

    expect(parseAccessToken(token).userId).toBe('user-abc');
  });

  it('returns the exp claim as expiresAtMs in milliseconds', () => {
    const token = makeToken({ exp: 1_800_000_000 });

    expect(parseAccessToken(token).expiresAtMs).toBe(1_800_000_000_000);
  });

  it('parses a payload containing base64url specific characters', () => {
    // A payload that base64-encodes with '-' and '_' after url-safe replacement.
    const token = makeToken({ sub: 'a?b>c~dÿþ' });

    expect(parseAccessToken(token).userId).toBe('a?b>c~dÿþ');
  });

  // --- edge cases ---

  it('ignores unknown extra claims rather than failing', () => {
    const token = makeToken({ sub: 'user-abc', role: 'authenticated', foo: [1, 2] });

    expect(parseAccessToken(token).userId).toBe('user-abc');
  });

  it('reports a token as expired when exp is in the past', () => {
    const token = makeToken({ exp: Math.floor(NOW_MS / 1000) - 1 });

    expect(parseAccessToken(token).expiresAtMs < NOW_MS).toBe(true);
  });

  // --- error cases ---

  it('throws AccountabilityAuthError when the token has fewer than three segments', () => {
    expect(() => parseAccessToken(makeToken({}, { segments: 2 }))).toThrow(
      AccountabilityAuthError
    );
  });

  it('throws AccountabilityAuthError when the payload segment is not valid base64url', () => {
    expect(() => parseAccessToken('aaa.!!!not-base64!!!.ccc')).toThrow(
      AccountabilityAuthError
    );
  });

  it('throws AccountabilityAuthError when the payload segment is not JSON', () => {
    expect(() => parseAccessToken(`aaa.${b64url('')}zzz.ccc`)).toThrow(
      AccountabilityAuthError
    );
  });

  it('throws AccountabilityAuthError when the payload is a JSON array rather than an object', () => {
    expect(() => parseAccessToken(`aaa.${b64url([1, 2, 3])}.ccc`)).toThrow(
      AccountabilityAuthError
    );
  });

  it('throws AccountabilityAuthError when the sub claim is missing', () => {
    expect(() => parseAccessToken(`aaa.${b64url({ exp: 1 })}.ccc`)).toThrow(
      AccountabilityAuthError
    );
  });

  it('throws AccountabilityAuthError when the sub claim is not a string', () => {
    expect(() => parseAccessToken(`aaa.${b64url({ sub: 42, exp: 1 })}.ccc`)).toThrow(
      AccountabilityAuthError
    );
  });

  it('throws AccountabilityAuthError when the exp claim is not a finite number', () => {
    expect(() => parseAccessToken(`aaa.${b64url({ sub: 'u', exp: 'soon' })}.ccc`)).toThrow(
      AccountabilityAuthError
    );
  });

  it('throws AccountabilityAuthError for an empty string token', () => {
    expect(() => parseAccessToken('')).toThrow(AccountabilityAuthError);
  });

  it('throws AccountabilityAuthError for a null token', () => {
    expect(() => parseAccessToken(null as unknown as string)).toThrow(
      AccountabilityAuthError
    );
  });

  // --- leakage ---

  it('never includes the token in the thrown error message', () => {
    const token = makeToken({ sub: 42 });
    let message = '';
    try {
      parseAccessToken(token);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message.includes(token.split('.')[1])).toBe(false);
  });

  it('never includes the token in the serialised error', () => {
    const token = makeToken({ sub: 42 });
    let serialised = '';
    try {
      parseAccessToken(token);
    } catch (error) {
      serialised = JSON.stringify(error, Object.getOwnPropertyNames(error));
    }

    expect(serialised.includes(token)).toBe(false);
  });
});
