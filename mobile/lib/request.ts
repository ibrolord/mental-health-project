export const DEFAULT_API_TIMEOUT_MS = 45_000;

export class RequestTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = 'RequestTimeoutError';
  }
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_API_TIMEOUT_MS,
  fetchImpl: typeof fetch = fetch
): Promise<Response> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError('timeoutMs must be a positive finite number');
  }

  const controller = new AbortController();
  const existingSignal = init.signal;
  let timedOut = false;
  let callerAborted = false;

  const forwardAbort = () => {
    callerAborted = true;
    controller.abort(existingSignal?.reason);
  };
  if (existingSignal?.aborted) {
    forwardAbort();
  } else {
    existingSignal?.addEventListener('abort', forwardAbort, { once: true });
  }

  const timeout = setTimeout(() => {
    if (controller.signal.aborted) return;
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetchImpl(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut && !callerAborted) {
      throw new RequestTimeoutError(timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    existingSignal?.removeEventListener('abort', forwardAbort);
  }
}
