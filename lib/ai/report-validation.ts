import { z } from 'zod';

export const reportSchema = z.object({
  reportToken: z.string().min(40).max(2_000),
  responseId: z.string().uuid(),
  response: z.string().min(1).max(8_000),
  reason: z.enum(['harmful', 'dangerous', 'incorrect', 'offensive', 'other']),
  details: z.string().trim().max(1_000).optional(),
  platform: z.enum(['ios', 'android', 'web']),
  appVersion: z.string().trim().min(1).max(50),
}).strict();

export class BurstRateLimiter {
  private readonly recentRequests = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number
  ) {}

  consume(key: string, now = Date.now()): boolean {
    const active = (this.recentRequests.get(key) || []).filter(
      (time) => now - time < this.windowMs
    );
    if (active.length >= this.limit) {
      this.recentRequests.set(key, active);
      return false;
    }
    active.push(now);
    this.recentRequests.set(key, active);
    return true;
  }
}
