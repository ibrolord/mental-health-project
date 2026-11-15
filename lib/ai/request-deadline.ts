/**
 * Clients send how long they will wait for a response, so the server can
 * budget model attempts (primary + fallback) to finish before the client
 * gives up. The header can raise the budget up to the route's maximum.
 */
export const CLIENT_TIMEOUT_HEADER = 'X-Client-Timeout-Ms';

/** Smallest deadline the server will budget, whatever the client sends. */
export const MIN_SERVER_DEADLINE_MS = 2_000;

/**
 * Budget for requests without a usable timeout header. Older app builds do
 * not send one, and their shortest caller (the voice fallback) gives up after
 * 20s, so both attempts must finish inside that.
 */
export const DEFAULT_SERVER_DEADLINE_MS = 18_000;

/**
 * Time kept back for auth, parsing and the network round trip: 20% of the
 * client timeout, between 1s and 2s.
 */
export function clientDeadlineMarginMs(clientTimeoutMs: number): number {
  return Math.min(2_000, Math.max(1_000, Math.round(clientTimeoutMs * 0.2)));
}

/**
 * Overall server deadline for a request. Without a valid header this is
 * DEFAULT_SERVER_DEADLINE_MS (or `maxMs` if smaller). With one it is the
 * client's timeout minus a margin, capped at `maxMs`.
 */
export function serverDeadlineMs(headers: Pick<Headers, 'get'>, maxMs: number): number {
  const fallbackMs = Math.min(maxMs, DEFAULT_SERVER_DEADLINE_MS);
  const raw = headers.get(CLIENT_TIMEOUT_HEADER)?.trim();
  if (!raw || !/^\d{1,7}$/.test(raw)) return fallbackMs;
  const clientTimeoutMs = Number(raw);
  if (clientTimeoutMs <= 0) return fallbackMs;
  const budget = clientTimeoutMs - clientDeadlineMarginMs(clientTimeoutMs);
  return Math.min(maxMs, Math.max(MIN_SERVER_DEADLINE_MS, budget));
}

/** Milliseconds left until `deadlineAt` (a `Date.now()` timestamp), at least 1. */
export function remainingMs(deadlineAt: number): number {
  return Math.max(1, deadlineAt - Date.now());
}
