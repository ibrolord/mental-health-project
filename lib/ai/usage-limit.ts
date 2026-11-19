import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { corsHeaders } from '@/lib/api/auth';
import { getSupabaseAdmin } from '@/lib/supabase/server';

/**
 * One shared AI usage limit per client.
 *
 * Every request that calls an AI model (chat, Advisor, voice, affirmations)
 * counts against the same bucket for the caller: signed-in or anonymous
 * Supabase user id, else legacy X-Session-Id, else client IP. Two windows:
 *
 *   AI_USAGE_DAILY_LIMIT       requests per UTC day     (default 200)
 *   AI_USAGE_BURST_PER_MINUTE  requests per minute      (default 20, stops bots)
 *
 * Both are optional env vars; unset or invalid values use the defaults.
 * Crisis messages are checked by the routes before this limit, so a person
 * in crisis always gets the safety response instead of a 429.
 *
 * STORE: the default store is in memory. On Vercel every function instance
 * has its own memory, so these limits are per instance and reset on cold
 * start: they blunt a burst but are not a hard global cap. For a global cap,
 * apply supabase/migrations/20261118120000_add_ai_usage_limits.sql and set
 * AI_USAGE_LIMIT_STORE=supabase (no new secret; it uses the existing service
 * role). If that store errors, requests fall back to the in-memory store
 * rather than failing or being let through uncounted.
 */

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

export const DEFAULT_AI_USAGE_DAILY_LIMIT = 200;
export const DEFAULT_AI_USAGE_BURST_PER_MINUTE = 20;

// Shown to the person. Clients display the server's `error` text.
export const AI_USAGE_DAILY_MESSAGE =
  "You have reached today's limit for AI messages. It resets tomorrow. If you need to talk to someone now, please contact a local helpline or emergency services.";
export const AI_USAGE_BURST_MESSAGE =
  'You are sending messages very quickly. Please wait a moment and try again. If you need to talk to someone now, please contact a local helpline or emergency services.';

function positiveIntFromEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw || !/^\d+$/.test(raw)) return fallback;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export type AiUsageLimits = { daily: number; burstPerMinute: number };

/** Read on every request so an env change applies without a code change. */
export function aiUsageLimits(): AiUsageLimits {
  return {
    daily: positiveIntFromEnv('AI_USAGE_DAILY_LIMIT', DEFAULT_AI_USAGE_DAILY_LIMIT),
    burstPerMinute: positiveIntFromEnv('AI_USAGE_BURST_PER_MINUTE', DEFAULT_AI_USAGE_BURST_PER_MINUTE),
  };
}

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

function clientKey(caller: UsageCaller, headers: Headers): string {
  const ip = clientIp(headers);
  const client = caller.userId
    ? `user:${caller.userId}`
    : caller.sessionId
      ? `session:${caller.sessionId}`
      : ip
        ? `ip:${ip}`
        : 'unknown';
  // Counter keys never hold a raw user id or IP address.
  const digest = createHash('sha256').update(`ai-usage:${client}`, 'utf8').digest('base64url');
  return `ai:${digest}`;
}

export type UsageDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number; message: string };

export async function consumeAiUsage(
  caller: UsageCaller,
  headers: Headers,
  now = Date.now()
): Promise<UsageDecision> {
  const limits = aiUsageLimits();
  const key = clientKey(caller, headers);
  const usageStore = activeStore();
  const [burst, daily] = await Promise.all([
    usageStore.hit(key, MINUTE, now),
    usageStore.hit(key, DAY, now),
  ]);
  const overDaily = daily.count > limits.daily;
  const overBurst = burst.count > limits.burstPerMinute;
  if (!overDaily && !overBurst) return { allowed: true };

  // The daily cap is the one that matters to the person, so it wins when both hit.
  const retryAfterMs = overDaily ? daily.resetAt - now : burst.resetAt - now;
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1_000)),
    message: overDaily ? AI_USAGE_DAILY_MESSAGE : AI_USAGE_BURST_MESSAGE,
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
  caller: UsageCaller,
  request: Request
): Promise<NextResponse | null> {
  const decision = await consumeAiUsage(caller, request.headers);
  return decision.allowed ? null : usageLimitResponse(decision);
}
