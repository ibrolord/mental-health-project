import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseAdmin: vi.fn(() => {
    throw new Error('Supabase must not be used by the in-memory store');
  }),
}));

import {
  AI_USAGE_BURST_MESSAGE,
  AI_USAGE_DAILY_MESSAGE,
  MemoryUsageStore,
  aiUsageLimits,
  clientIp,
  consumeAiUsage,
  setUsageStore,
  usageLimitResponse,
  type UsageStore,
} from '../../lib/ai/usage-limit';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

function headers(ip?: string): Headers {
  return new Headers(ip ? { 'x-forwarded-for': `${ip}, 10.0.0.1` } : {});
}

afterEach(() => {
  setUsageStore(null);
  vi.unstubAllEnvs();
});

describe('AI usage limits', () => {
  it('defaults to 200 a day and 20 a minute', () => {
    vi.stubEnv('AI_USAGE_DAILY_LIMIT', '');
    vi.stubEnv('AI_USAGE_BURST_PER_MINUTE', '');
    expect(aiUsageLimits()).toEqual({ daily: 200, burstPerMinute: 20 });
  });

  it('reads both caps from env and ignores invalid values', () => {
    vi.stubEnv('AI_USAGE_DAILY_LIMIT', '50');
    vi.stubEnv('AI_USAGE_BURST_PER_MINUTE', '5');
    expect(aiUsageLimits()).toEqual({ daily: 50, burstPerMinute: 5 });
    vi.stubEnv('AI_USAGE_DAILY_LIMIT', 'lots');
    vi.stubEnv('AI_USAGE_BURST_PER_MINUTE', '0');
    expect(aiUsageLimits()).toEqual({ daily: 200, burstPerMinute: 20 });
  });

  it('stops a burst within the minute with a wait-a-moment message', async () => {
    setUsageStore(new MemoryUsageStore());
    const now = Date.UTC(2026, 10, 18, 12, 0, 0);
    for (let i = 0; i < 20; i += 1) {
      expect(await consumeAiUsage({ userId: 'u1' }, headers('1.1.1.1'), now)).toEqual({ allowed: true });
    }
    const denied = await consumeAiUsage({ userId: 'u1' }, headers('1.1.1.1'), now + 1_000);
    expect(denied).toEqual({ allowed: false, retryAfterSeconds: 59, message: AI_USAGE_BURST_MESSAGE });
    expect(AI_USAGE_BURST_MESSAGE).toMatch(/wait a moment/i);
    expect(AI_USAGE_BURST_MESSAGE).toMatch(/helpline/i);
  });

  it('enforces the daily cap across minutes and says it resets tomorrow', async () => {
    setUsageStore(new MemoryUsageStore());
    const start = Date.UTC(2026, 10, 18, 0, 0, 0);
    let allowed = 0;
    let last;
    for (let minute = 0; minute < 15; minute += 1) {
      for (let i = 0; i < 15; i += 1) {
        last = await consumeAiUsage({ userId: 'u1' }, headers(), start + minute * MINUTE);
        if (last.allowed) allowed += 1;
      }
    }
    expect(allowed).toBe(200);
    expect(last).toEqual({
      allowed: false,
      retryAfterSeconds: (DAY - 14 * MINUTE) / 1_000,
      message: AI_USAGE_DAILY_MESSAGE,
    });
    expect(AI_USAGE_DAILY_MESSAGE).toMatch(/today's limit/);
    expect(AI_USAGE_DAILY_MESSAGE).toMatch(/resets tomorrow/);
    expect(AI_USAGE_DAILY_MESSAGE).toMatch(/helpline or emergency services/);

    // A new day starts fresh.
    expect(await consumeAiUsage({ userId: 'u1' }, headers(), start + DAY)).toEqual({ allowed: true });
  });

  it('uses the env caps', async () => {
    vi.stubEnv('AI_USAGE_DAILY_LIMIT', '3');
    vi.stubEnv('AI_USAGE_BURST_PER_MINUTE', '100');
    setUsageStore(new MemoryUsageStore());
    const now = Date.UTC(2026, 10, 18, 12, 0, 0);
    const results = [];
    for (let i = 0; i < 4; i += 1) results.push((await consumeAiUsage({ userId: 'u1' }, headers(), now)).allowed);
    expect(results).toEqual([true, true, true, false]);
  });

  it('keeps callers separate, even on a shared IP', async () => {
    vi.stubEnv('AI_USAGE_BURST_PER_MINUTE', '2');
    setUsageStore(new MemoryUsageStore());
    const now = Date.UTC(2026, 10, 18, 12, 0, 0);
    for (const userId of ['a', 'b', 'c']) {
      for (let i = 0; i < 2; i += 1) {
        expect((await consumeAiUsage({ userId }, headers('2.2.2.2'), now)).allowed).toBe(true);
      }
    }
    expect((await consumeAiUsage({ userId: 'a' }, headers('2.2.2.2'), now)).allowed).toBe(false);
  });

  it('falls back to session id, then IP, as the client key', async () => {
    vi.stubEnv('AI_USAGE_BURST_PER_MINUTE', '1');
    setUsageStore(new MemoryUsageStore());
    const now = Date.UTC(2026, 10, 18, 12, 0, 0);
    expect((await consumeAiUsage({ sessionId: 's1' }, headers('3.3.3.3'), now)).allowed).toBe(true);
    expect((await consumeAiUsage({ sessionId: 's1' }, headers('3.3.3.4'), now)).allowed).toBe(false);
    expect((await consumeAiUsage({}, headers('3.3.3.3'), now)).allowed).toBe(true);
    expect((await consumeAiUsage({}, headers('3.3.3.3'), now)).allowed).toBe(false);
  });

  it('never passes a raw user id or IP to the store', async () => {
    const keys: string[] = [];
    const store: UsageStore = {
      async hit(key) {
        keys.push(key);
        return { count: 1, resetAt: Date.now() + MINUTE };
      },
    };
    setUsageStore(store);
    await consumeAiUsage({ userId: 'user-123' }, headers('4.4.4.4'));
    await consumeAiUsage({}, headers('4.4.4.4'));
    expect(keys.length).toBe(4);
    expect(keys.join(' ')).not.toContain('user-123');
    expect(keys.join(' ')).not.toContain('4.4.4.4');
  });

  it('reads the client IP from the first forwarded hop', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '5.5.5.5, 10.0.0.1' }))).toBe('5.5.5.5');
    expect(clientIp(new Headers({ 'x-real-ip': '6.6.6.6', 'x-forwarded-for': '7.7.7.7' }))).toBe('6.6.6.6');
    expect(clientIp(new Headers())).toBeNull();
  });

  it('builds a 429 with Retry-After, CORS, no-store and the message clients display', async () => {
    const response = usageLimitResponse({ allowed: false, retryAfterSeconds: 42, message: 'Slow down' });
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('42');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(await response.json()).toEqual({ error: 'Slow down', retryAfterSeconds: 42 });
  });

  it('bounds memory use', async () => {
    const store = new MemoryUsageStore(10);
    for (let i = 0; i < 50; i += 1) await store.hit(`k${i}`, MINUTE, 0);
    // @ts-expect-error private field read for the test
    expect(store.counters.size).toBeLessThanOrEqual(10);
  });
});
