import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchWithTimeout,
  RequestTimeoutError,
} from '../../mobile/lib/request';

describe('fetchWithTimeout', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns responses that arrive before the deadline', async () => {
    const response = new Response('{}', { status: 200 });
    const fetchImpl = vi.fn().mockResolvedValue(response);

    await expect(fetchWithTimeout('https://example.test', {}, 100, fetchImpl)).resolves.toBe(response);
  });

  it('aborts and reports requests that exceed the deadline', async () => {
    vi.useFakeTimers();
    const fetchImpl: typeof fetch = vi.fn((_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'));
      });
    }));

    const request = fetchWithTimeout('https://example.test', {}, 50, fetchImpl);
    const rejection = expect(request).rejects.toBeInstanceOf(RequestTimeoutError);
    await vi.advanceTimersByTimeAsync(50);

    await rejection;
  });

  it('preserves caller-initiated aborts', async () => {
    const caller = new AbortController();
    const abortError = new DOMException('Aborted', 'AbortError');
    const fetchImpl: typeof fetch = vi.fn((_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(abortError));
    }));

    const request = fetchWithTimeout(
      'https://example.test',
      { signal: caller.signal },
      1_000,
      fetchImpl
    );
    caller.abort();

    await expect(request).rejects.toBe(abortError);
  });

  it('does not relabel a caller abort near the timeout deadline', async () => {
    vi.useFakeTimers();
    const caller = new AbortController();
    const abortError = new DOMException('Aborted', 'AbortError');
    const fetchImpl: typeof fetch = vi.fn((_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(abortError));
    }));

    const request = fetchWithTimeout(
      'https://example.test',
      { signal: caller.signal },
      50,
      fetchImpl
    );
    const rejection = expect(request).rejects.toBe(abortError);
    await vi.advanceTimersByTimeAsync(49);
    caller.abort();
    await vi.advanceTimersByTimeAsync(1);

    await rejection;
  });
});
