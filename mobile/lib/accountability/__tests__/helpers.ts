/**
 * Test fixtures for the mobile accountability API layer.
 *
 * Every helper returns a NEW object. Nothing is shared or mutated between
 * tests. Do not add module-level mutable state to this file.
 */

/** Encode a JS object as a base64url JWT segment. */
export function b64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Build a JWT-shaped token. The signature is a fixed opaque string — the
 * client must never verify signatures locally, only parse claims defensively.
 */
export function makeToken(
  payload: Record<string, unknown> = {},
  opts: { segments?: number } = {}
): string {
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const body = b64url({
    sub: '11111111-2222-3333-4444-555555555555',
    exp: Math.floor(Date.UTC(2026, 7, 11, 12, 0, 0) / 1000) + 3600,
    ...payload,
  });
  const parts = [header, body, 'c2lnbmF0dXJl'];
  const segments = opts.segments ?? 3;
  return parts.slice(0, segments).join('.');
}

/** The value the client should treat as "now" in tests. Deterministic. */
export const NOW_MS = Date.UTC(2026, 7, 11, 12, 0, 0);

export interface CapturedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

export interface Harness {
  calls: CapturedCall[];
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
  getAccessToken: () => Promise<string | null>;
  deps: Record<string, unknown>;
}

/**
 * Build the dependency bundle handed to createAccountabilityClient.
 *
 * The accountability module must accept these dependencies by injection so it
 * can be imported in plain node. mobile/lib/supabase.ts calls `new URL(...)` at
 * module scope and throws on import outside Expo — the accountability module
 * must not import it transitively.
 */
export function createHarness(
  options: {
    role?: 'owner' | 'partner';
    token?: string | null;
    status?: number;
    responseBody?: unknown;
    responseText?: string;
  } = {}
): Harness {
  const calls: CapturedCall[] = [];
  const status = options.status ?? 200;
  const payload =
    options.responseText !== undefined
      ? options.responseText
      : JSON.stringify(options.responseBody ?? { data: {} });

  const fetchImpl = async (input: string, init: RequestInit = {}) => {
    calls.push({
      url: input,
      method: init.method ?? 'GET',
      headers: { ...((init.headers as Record<string, string>) ?? {}) },
      body: init.body === undefined ? undefined : init.body,
    });
    return new Response(payload, {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const token = options.token === undefined ? makeToken() : options.token;

  return {
    calls,
    fetch: fetchImpl as Harness['fetch'],
    getAccessToken: async () => token,
    deps: {
      baseUrl: 'https://api.test',
      role: options.role ?? 'owner',
      getAccessToken: async () => token,
      fetch: fetchImpl,
      now: () => NOW_MS,
    },
  };
}

/** Parse a captured request body back into a plain object. */
export function bodyOf(call: CapturedCall): unknown {
  return typeof call.body === 'string' ? JSON.parse(call.body) : call.body;
}
