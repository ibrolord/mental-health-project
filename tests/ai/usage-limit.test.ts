import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseAdmin: vi.fn(() => {
    throw new Error('Supabase must not be used by the in-memory store');
  }),
}));

import {
  AI_USAGE_RULES,
  MemoryUsageStore,
  clientIp,
  consumeAiUsage,
  setUsageStore,
  usageLimitResponse,
  type UsageRule,
  type UsageStore,
} from '../../lib/ai/usage-limit';

const MINUTE = 60_000;
const rule: UsageRule = {
  name: 'test',
  subject: [{ limit: 3, windowMs: 10 * MINUTE }, { limit: 5, windowMs: 24 * 60 * MINUTE }],
  ip: [{ limit: 6, windowMs: 10 * MINUTE }],
  message: 'Slow down',
};

function headers(ip?: string): Headers {
  return new Headers(ip ? { 'x-forwarded-for': `${ip}, 10.0.0.1` } : {});
}

afterEach(() => setUsageStore(null));

describe('AI usage limits', () => {
  it('allows up to the limit and then returns Retry-After for the window', async () => {
    setUsageStore(new MemoryUsageStore());
    const now = Date.UTC(2026, 10, 18, 12, 0, 0);
    for (let i = 0; i < 3; i += 1) {
      expect(await consumeAiUsage(rule, { userId: 'u1' }, headers('1.1.1.1'), now)).toEqual({ allowed: true });
    }
    const denied = await consumeAiUsage(rule, { userId: 'u1' }, headers('1.1.1.1'), now + 1_000);
    expect(denied).toEqual({ allowed: false, retryAfterSeconds: 10 * 60 - 1, message: 'Slow down' });
  });

  it('resets after the window and enforces the daily cap', async () => {
    setUsageStore(new MemoryUsageStore());
    const start = Date.UTC(2026, 10, 18, 0, 0, 0);
    let allowed = 0;
    for (let window = 0; window < 4; window += 1) {
      for (let i = 0; i < 3; i += 1) {
        const decision = await consumeAiUsage(rule, { userId: 'u1' }, headers(), start + window * 10 * MINUTE);
        if (decision.allowed) allowed += 1;
      }
    }
    expect(allowed).toBe(5);
  });

  it('keeps callers separate and limits a shared IP more loosely', async () => {
    setUsageStore(new MemoryUsageStore());
    const now = Date.UTC(2026, 10, 18, 12, 0, 0);
    const results = [];
    for (const userId of ['a', 'b', 'c']) {
      for (let i = 0; i < 3; i += 1) {
        results.push((await consumeAiUsage(rule, { userId }, headers('2.2.2.2'), now)).allowed);
      }
    }
    // Each user is under their own limit; the IP stops the 7th request.
    expect(results.filter(Boolean)).toHaveLength(6);
    expect(results.slice(0, 6).every(Boolean)).toBe(true);
  });

  it('holds an IP with no caller identity to the per-person limit', async () => {
    setUsageStore(new MemoryUsageStore());
    const now = Date.UTC(2026, 10, 18, 12, 0, 0);
    const results = [];
    for (let i = 0; i < 4; i += 1) {
      results.push((await consumeAiUsage(rule, {}, headers('3.3.3.3'), now)).allowed);
    }
    expect(results).toEqual([true, true, true, false]);
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
    await consumeAiUsage(rule, { userId: 'user-123' }, headers('4.4.4.4'));
    expect(keys.length).toBe(3);
    expect(keys.join(' ')).not.toContain('user-123');
    expect(keys.join(' ')).not.toContain('4.4.4.4');
  });

  it('reads the client IP from the first forwarded hop', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '5.5.5.5, 10.0.0.1' }))).toBe('5.5.5.5');
    expect(clientIp(new Headers({ 'x-real-ip': '6.6.6.6', 'x-forwarded-for': '7.7.7.7' }))).toBe('6.6.6.6');
    expect(clientIp(new Headers())).toBeNull();
  });

  it('builds a 429 with Retry-After, CORS and the message clients display', async () => {
    const response = usageLimitResponse({ allowed: false, retryAfterSeconds: 42, message: 'Slow down' });
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('42');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(await response.json()).toEqual({ error: 'Slow down', retryAfterSeconds: 42 });
  });

  it('keeps chat limits above what one person sends', () => {
    // Every live-voice and push-to-talk turn also posts to /api/chat.
    const [burst, daily] = AI_USAGE_RULES.chat.subject;
    expect(burst.limit).toBeGreaterThanOrEqual(30);
    expect(burst.windowMs).toBeLessThanOrEqual(10 * MINUTE);
    expect(daily.limit).toBeGreaterThanOrEqual(200);
    for (const usage of Object.values(AI_USAGE_RULES)) {
      usage.ip.forEach((window, index) => {
        expect(window.limit).toBeGreaterThan(usage.subject[index].limit);
      });
    }
  });

  it('bounds memory use', async () => {
    const store = new MemoryUsageStore(10);
    for (let i = 0; i < 50; i += 1) await store.hit(`k${i}`, MINUTE, 0);
    // @ts-expect-error private field read for the test
    expect(store.counters.size).toBeLessThanOrEqual(10);
  });
});
