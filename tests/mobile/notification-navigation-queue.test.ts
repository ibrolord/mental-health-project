import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type QueueFactory = (options: {
  navigate: (route: string) => void;
  clearResponse: () => Promise<void>;
  onError?: (error: unknown) => void;
  delayMs?: number;
  maxAutomaticRetries?: number;
  schedule?: (
    callback: () => void,
    delayMs: number
  ) => ReturnType<typeof setTimeout>;
}) => {
  enqueue: (route: string) => void;
  retry: () => void;
  setReady: (ready: boolean) => void;
};

function loadQueueFactory(): QueueFactory {
  const source = readFileSync(
    resolve(process.cwd(), 'mobile/lib/notifications.ts'),
    'utf8'
  );
  const start = source.indexOf('export function createNotificationNavigationQueue');
  const end = source.indexOf('\nfunction getService', start);
  if (start < 0 || end < 0) throw new Error('Notification queue source not found');

  const compiled = ts.transpileModule(
    source.slice(start, end).replace('export function', 'function'),
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } }
  ).outputText;
  return new Function(
    'setTimeout',
    'clearTimeout',
    `${compiled}; return createNotificationNavigationQueue;`
  )(setTimeout, clearTimeout) as QueueFactory;
}

const createNotificationNavigationQueue = loadQueueFactory();

const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('iOS notification navigation queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('waits for navigator readiness and clears only after navigation', async () => {
    const order: string[] = [];
    let scheduled: (() => void) | null = null;
    const queue = createNotificationNavigationQueue({
      navigate: (route: string) => order.push(`navigate:${route}`),
      clearResponse: async () => {
        order.push('clear');
      },
      schedule: (callback) => {
        scheduled = callback;
        return 1 as unknown as ReturnType<typeof setTimeout>;
      },
    });

    queue.enqueue('/library');
    expect(order).toEqual([]);
    expect(scheduled).toBeNull();

    queue.setReady(true);
    expect(scheduled).not.toBeNull();
    (scheduled as unknown as () => void)();
    await settle();

    expect(order).toEqual(['navigate:/library', 'clear']);
  });

  it('retains the response when navigation fails and retries it', async () => {
    const navigate = vi.fn(() => {
      if (navigate.mock.calls.length === 1) throw new Error('navigator not ready');
    });
    const clearResponse = vi.fn(async () => undefined);
    const onError = vi.fn();
    const queue = createNotificationNavigationQueue({
      navigate,
      clearResponse,
      onError,
      delayMs: 0,
      maxAutomaticRetries: 0,
    });

    queue.setReady(true);
    queue.enqueue('/planner');
    await settle();
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(clearResponse).not.toHaveBeenCalled();

    queue.retry();
    await settle();
    expect(navigate).toHaveBeenCalledTimes(2);
    expect(clearResponse).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('retries native clearing without navigating a second time', async () => {
    const navigate = vi.fn();
    const clearResponse = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('native clear failed'))
      .mockResolvedValueOnce(undefined);
    const queue = createNotificationNavigationQueue({
      navigate,
      clearResponse,
      delayMs: 0,
      maxAutomaticRetries: 0,
    });

    queue.setReady(true);
    queue.enqueue('/goals');
    await settle();
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(clearResponse).toHaveBeenCalledTimes(1);

    queue.retry();
    await settle();
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(clearResponse).toHaveBeenCalledTimes(2);
  });

  it('automatically retries a transient clear failure without duplicate routing', async () => {
    const callbacks: Array<() => void> = [];
    const navigate = vi.fn();
    const clearResponse = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('native clear failed'))
      .mockResolvedValueOnce(undefined);
    const queue = createNotificationNavigationQueue({
      navigate,
      clearResponse,
      delayMs: 250,
      maxAutomaticRetries: 1,
      schedule: (callback) => {
        callbacks.push(callback);
        return callbacks.length as unknown as ReturnType<typeof setTimeout>;
      },
    });

    queue.setReady(true);
    queue.enqueue('/affirmations');
    callbacks.shift()?.();
    await settle();
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(clearResponse).toHaveBeenCalledTimes(1);

    callbacks.shift()?.();
    await settle();
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(clearResponse).toHaveBeenCalledTimes(2);
  });
});
