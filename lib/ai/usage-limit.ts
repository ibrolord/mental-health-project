import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { corsHeaders } from '@/lib/api/auth';
import { getSupabaseAdmin } from '@/lib/supabase/server';

/**
 * Per-client usage limits for routes that call an AI model.
 *
 * Limits are abuse caps, set well above what one person uses so a real user
 * never sees them, while a scripted spike stops costing money within minutes.
 * Each request counts against the caller (signed-in or anonymous Supabase
 * user, else legacy session id) and, separately and more loosely, against the
 * client IP, because anonymous accounts are free to create.
 *
 * STORE: the default store is in memory. On Vercel every function instance
 * has its own memory, so these limits are per instance and reset on cold
 * start: they blunt a burst but are not a hard global cap. For a global cap,
 * apply supabase/migrations/20261118120000_add_ai_usage_limits.sql and set
 * AI_USAGE_LIMIT_STORE=supabase (no new secret; it uses the existing service
 * role). If that store errors, requests fall back to the in-memory store
 * rather than failing or being let through uncounted.
 */

export type UsageWindow = { limit: number; windowMs: number };

export type UsageRule = {
  /** Stable bucket name, e.g. 'chat'. Part of the counter key. */
  name: string;
  subject: readonly UsageWindow[];
  ip: readonly UsageWindow[];
  /** Shown to the person. Clients display the server's `error` text. */
  message: string;
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Text chat also carries every voice turn (push-to-talk and live voice both
// send the transcript to /api/chat), so it gets more room than "30" alone.
// IP limits are 4x the subject limits so a shared network (school, office,
// mobile carrier NAT) is not punished for several people using the app.
export const AI_USAGE_RULES = {
  chat: {
    name: 'chat',
    subject: [{ limit: 40, windowMs: 10 * MINUTE }, { limit: 300, windowMs: DAY }],
    ip: [{ limit: 160, windowMs: 10 * MINUTE }, { limit: 1_200, windowMs: DAY }],
    message:
      'You have sent a lot of messages in a short time. Please take a short break and try again in a few minutes. If you need to talk to someone now, contact a local helpline or emergency services.',
  },
  advisor: {
    name: 'advisor',
    subject: [{ limit: 30, windowMs: 10 * MINUTE }, { limit: 150, windowMs: DAY }],
    ip: [{ limit: 120, windowMs: 10 * MINUTE }, { limit: 600, windowMs: DAY }],
    message: 'Advisor has refreshed many times recently. Please try again in a few minutes.',
  },
  // Each spoken turn is one transcription plus one playback request.
  voice: {
    name: 'voice',
    subject: [{ limit: 80, windowMs: 10 * MINUTE }, { limit: 500, windowMs: DAY }],
    ip: [{ limit: 320, windowMs: 10 * MINUTE }, { limit: 2_000, windowMs: DAY }],
    message:
      'Voice has been used a lot in a short time. Please take a short break and try again in a few minutes.',
  },
  affirmations: {
    name: 'affirmations',
    subject: [{ limit: 10, windowMs: 10 * MINUTE }, { limit: 50, windowMs: DAY }],
    ip: [{ limit: 40, windowMs: 10 * MINUTE }, { limit: 200, windowMs: DAY }],
    message:
      'You have made many personalized affirmations recently. Please try again in a few minutes.',
  },
} as const satisfies Record<string, UsageRule>;

export type UsageStoreHit = { count: number; resetAt: number };

export interface UsageStore {
  /** Adds one hit to the fixed window holding `now` and returns the new count. */
  hit(key: string, windowMs: number, now: number): Promise<UsageStoreHit>;
}

export class MemoryUsageStore implements UsageStore {
  private readonly counters = new Map<string, UsageStoreHit>();

  constructor(private readonly maxKeys = 50_000) {}

  async hit(key: string, windowMs: number, now: number): Promise<UsageStoreHit> {
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const counterKey = `${key}:${windowMs}:${windowStart}`;
    const existing = this.counters.get(counterKey);
    const next = existing
      ? { count: existing.count + 1, resetAt: existing.resetAt }
      : { count: 1, resetAt: windowStart + windowMs };
    this.counters.set(counterKey, next);
    if (this.counters.size > this.maxKeys) this.prune(now);
    return next;
  }

  private prune(now: number) {
    for (const [key, value] of this.counters) {
      if (value.resetAt <= now) this.counters.delete(key);
    }
    // Still full of live windows: drop the oldest entries (insertion order).
    for (const key of this.counters.keys()) {
      if (this.counters.size <= this.maxKeys) break;
      this.counters.delete(key);
    }
  }
}

/** Durable store backed by the optional consume_ai_usage RPC. */
export class SupabaseUsageStore implements UsageStore {
  async hit(key: string, windowMs: number, now: number): Promise<UsageStoreHit> {
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const { data, error } = await getSupabaseAdmin().rpc('consume_ai_usage', {
      p_key: key,
      p_window_start: new Date(windowStart).toISOString(),
      p_window_seconds: Math.round(windowMs / 1_000),
    });
    if (error) throw new Error(`AI usage store failed: ${error.message}`);
    if (typeof data !== 'number' || !Number.isFinite(data)) {
      throw new Error('AI usage store returned an invalid count');
    }
    return { count: data, resetAt: windowStart + windowMs };
  }
}

class FallbackUsageStore implements UsageStore {
  private warned = false;

  constructor(
    private readonly primary: UsageStore,
    private readonly fallback: UsageStore
  ) {}

  async hit(key: string, windowMs: number, now: number): Promise<UsageStoreHit> {
    try {
      return await this.primary.hit(key, windowMs, now);
    } catch (error) {
      if (!this.warned) {
        this.warned = true;
        console.error('AI usage store unavailable; using in-memory limits:', error);
      }
      return this.fallback.hit(key, windowMs, now);
    }
  }
}

function createDefaultStore(): UsageStore {
  const memory = new MemoryUsageStore();
  return process.env.AI_USAGE_LIMIT_STORE?.trim().toLowerCase() === 'supabase'
    ? new FallbackUsageStore(new SupabaseUsageStore(), memory)
    : memory;
}

let store: UsageStore | null = null;

function activeStore(): UsageStore {
  store ??= createDefaultStore();
  return store;
}

/** Tests and future durable stores can swap the store. */
export function setUsageStore(next: UsageStore | null): void {
  store = next;
}

export type UsageCaller = { userId?: string; sessionId?: string };

export function clientIp(headers: Headers): string | null {
  // Vercel sets both from the connecting client; take the first hop.
  const candidate =
    headers.get('x-real-ip')?.trim() ||
    headers.get('x-forwarded-for')?.split(',', 1)[0]?.trim() ||
    '';
  return candidate && candidate.length <= 64 ? candidate.toLowerCase() : null;
}

function hashedKey(rule: string, scope: string, value: string): string {
  // Counter keys never hold a raw user id or IP address.
  const digest = createHash('sha256').update(`ai-usage:${scope}:${value}`, 'utf8').digest('base64url');
  return `${rule}:${scope}:${digest}`;
}

export type UsageDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number; message: string };

export async function consumeAiUsage(
  rule: UsageRule,
  caller: UsageCaller,
  headers: Headers,
  now = Date.now()
): Promise<UsageDecision> {
  const subject = caller.userId
    ? `user:${caller.userId}`
    : caller.sessionId
      ? `session:${caller.sessionId}`
      : null;
  const ip = clientIp(headers);
  const checks: { key: string; window: UsageWindow }[] = [];
  if (subject) {
    for (const window of rule.subject) {
      checks.push({ key: hashedKey(rule.name, 'subject', subject), window });
    }
  }
  if (ip) {
    // With no caller identity the IP is the only key, so hold it to the
    // per-person limit rather than the looser shared-network one.
    const windows = subject ? rule.ip : rule.subject;
    for (const window of windows) {
      checks.push({ key: hashedKey(rule.name, 'ip', ip), window });
    }
  }
  if (!checks.length) {
    for (const window of rule.subject) {
      checks.push({ key: hashedKey(rule.name, 'unknown', 'unknown'), window });
    }
  }

  const usageStore = activeStore();
  const hits = await Promise.all(
    checks.map(async ({ key, window }) => ({
      window,
      hit: await usageStore.hit(key, window.windowMs, now),
    }))
  );
  const exceeded = hits.filter(({ window, hit }) => hit.count > window.limit);
  if (!exceeded.length) return { allowed: true };

  const retryAfterMs = Math.max(...exceeded.map(({ hit }) => hit.resetAt - now));
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1_000)),
    message: rule.message,
  };
}

export function usageLimitResponse(
  decision: Extract<UsageDecision, { allowed: false }>
): NextResponse {
  return NextResponse.json(
    { error: decision.message, retryAfterSeconds: decision.retryAfterSeconds },
    {
      status: 429,
      headers: {
        ...corsHeaders(),
        'Cache-Control': 'no-store',
        'Retry-After': String(decision.retryAfterSeconds),
      },
    }
  );
}

/** Returns a 429 response when the caller is over a limit, otherwise null. */
export async function enforceAiUsage(
  rule: UsageRule,
  caller: UsageCaller,
  request: Request
): Promise<NextResponse | null> {
  const decision = await consumeAiUsage(rule, caller, request.headers);
  return decision.allowed ? null : usageLimitResponse(decision);
}
