/**
 * Clients send how long they will wait for a response, so the server can
 * budget model attempts (primary + fallback) to finish before the client
 * gives up. The header is optional and only ever shortens the deadline.
 */
export const CLIENT_TIMEOUT_HEADER = 'X-Client-Timeout-Ms';

/** Smallest deadline the server will budget, whatever the client sends. */
export const MIN_SERVER_DEADLINE_MS = 2_000;

/**
 * Time kept back for auth, parsing and the network round trip: 20% of the
 * client timeout, between 1s and 2s.
 */
export function clientDeadlineMarginMs(clientTimeoutMs: number): number {
  return Math.min(2_000, Math.max(1_000, Math.round(clientTimeoutMs * 0.2)));
}

/**
 * Overall server deadline for a request: `maxMs`, or less when the client's
 * declared timeout (minus a margin) is shorter. Invalid headers are ignored.
 */
export function serverDeadlineMs(headers: Pick<Headers, 'get'>, maxMs: number): number {
  const raw = headers.get(CLIENT_TIMEOUT_HEADER)?.trim();
  if (!raw || !/^\d{1,7}$/.test(raw)) return maxMs;
  const clientTimeoutMs = Number(raw);
  if (clientTimeoutMs <= 0) return maxMs;
  const budget = clientTimeoutMs - clientDeadlineMarginMs(clientTimeoutMs);
  return Math.min(maxMs, Math.max(MIN_SERVER_DEADLINE_MS, budget));
}

/** Milliseconds left until `deadlineAt` (a `Date.now()` timestamp), at least 1. */
export function remainingMs(deadlineAt: number): number {
  return Math.max(1, deadlineAt - Date.now());
}
