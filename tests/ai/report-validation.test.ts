import { describe, expect, it } from 'vitest';
import { BurstRateLimiter, reportSchema } from '../../lib/ai/report-validation';

const validReport = {
  reportToken: 'x'.repeat(40),
  responseId: '11111111-1111-4111-8111-111111111111',
  response: 'response',
  reason: 'harmful',
  platform: 'android',
  appVersion: '1.0.0',
};

describe('report validation', () => {
  it('accepts only the documented enums and bounds', () => {
    expect(reportSchema.safeParse(validReport).success).toBe(true);
    expect(reportSchema.safeParse({ ...validReport, reason: 'spam' }).success).toBe(false);
    expect(reportSchema.safeParse({ ...validReport, platform: 'desktop' }).success).toBe(false);
    expect(reportSchema.safeParse({ ...validReport, response: 'x'.repeat(8_001) }).success).toBe(false);
    expect(reportSchema.safeParse({ ...validReport, details: 'x'.repeat(1_001) }).success).toBe(false);
    expect(reportSchema.safeParse({ ...validReport, unexpected: true }).success).toBe(false);
  });

  it('enforces the local burst limit and resets after the window', () => {
    const limiter = new BurstRateLimiter(2, 1_000);
    expect(limiter.consume('subject', 0)).toBe(true);
    expect(limiter.consume('subject', 1)).toBe(true);
    expect(limiter.consume('subject', 2)).toBe(false);
    expect(limiter.consume('other', 2)).toBe(true);
    expect(limiter.consume('subject', 1_001)).toBe(true);
  });
});
