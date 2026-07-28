import { describe, expect, it } from 'vitest';
import {
  createReportToken,
  createReportTokenIfConfigured,
  hashSubject,
  subjectForAuth,
  verifyReportToken,
} from '../../lib/ai/report-token';

const secret = 'test-secret-with-at-least-thirty-two-characters';
const subject = 'user:11111111-1111-4111-8111-111111111111';
const response = 'A bounded response';

describe('report tokens', () => {
  it('verifies an unmodified token', () => {
    const issued = createReportToken({ subject, response, model: 'gemini', secret, now: 100 });
    const payload = verifyReportToken({ ...issued, subject, response, secret, token: issued.reportToken, now: 200 });
    expect(payload.rid).toBe(issued.responseId);
    expect(payload.model).toBe('gemini');
  });

  it('rejects token tampering, a different subject, response, ID, or expiry', () => {
    const issued = createReportToken({ subject, response, model: 'safety', secret, now: 100 });
    const base = { token: issued.reportToken, responseId: issued.responseId, subject, response, secret };
    expect(() => verifyReportToken({ ...base, token: `${issued.reportToken}x`, now: 200 })).toThrow();
    expect(() => verifyReportToken({ ...base, subject: 'user:other', now: 200 })).toThrow();
    expect(() => verifyReportToken({ ...base, response: 'changed', now: 200 })).toThrow();
    expect(() => verifyReportToken({ ...base, responseId: '22222222-2222-4222-8222-222222222222', now: 200 })).toThrow();
    expect(() => verifyReportToken({ ...base, now: 86_500 })).toThrow();
  });

  it('remains valid for a visible response until the 24-hour boundary', () => {
    const issued = createReportToken({ subject, response, model: 'claude', secret, now: 100 });
    const base = { token: issued.reportToken, responseId: issued.responseId, subject, response, secret };

    expect(() => verifyReportToken({ ...base, now: 86_499 })).not.toThrow();
    expect(() => verifyReportToken({ ...base, now: 86_500 })).toThrow('Invalid or expired report token');
  });

  it('separates user and legacy-session subjects without exposing them in hashes', () => {
    expect(subjectForAuth({ userId: 'abc' })).toBe('user:abc');
    expect(subjectForAuth({ sessionId: 'abc' })).toBe('session:abc');
    expect(hashSubject('user:abc', secret)).not.toContain('abc');
  });

  it('omits reporting credentials instead of failing chat when the secret is absent', () => {
    const originalSecret = process.env.AI_REPORT_SIGNING_SECRET;
    delete process.env.AI_REPORT_SIGNING_SECRET;
    try {
      expect(createReportTokenIfConfigured({
        subject,
        response,
        model: 'claude',
      })).toBeNull();
    } finally {
      if (originalSecret === undefined) delete process.env.AI_REPORT_SIGNING_SECRET;
      else process.env.AI_REPORT_SIGNING_SECRET = originalSecret;
    }
  });
});
