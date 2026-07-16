import { describe, expect, it } from 'vitest';
import { chatRequestSchema } from '../../lib/ai/chat-validation';

describe('chatRequestSchema', () => {
  it('accepts the actual assessment and habit column names', () => {
    const result = chatRequestSchema.safeParse({
      messages: [{ role: 'user', content: 'Help me reflect.' }],
      userContext: {
        assessments: [{ type: 'PHQ9', score: 4, max_score: 27, created_at: '2026-07-16' }],
        habits: [{ name: 'Walk', streak_count: 3 }],
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects obsolete context fields', () => {
    expect(chatRequestSchema.safeParse({
      messages: [{ role: 'user', content: 'Hello' }],
      userContext: {
        assessments: [{ type: 'PHQ9', score: 4, interpretation: 'low', created_at: '2026-07-16' }],
        habits: [{ name: 'Walk', current_streak: 3 }],
      },
    }).success).toBe(false);
  });

  it('rejects oversized, non-alternating, and assistant-final conversations', () => {
    expect(chatRequestSchema.safeParse({ messages: [{ role: 'user', content: 'x'.repeat(4_001) }] }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ messages: [
      { role: 'user', content: 'one' },
      { role: 'user', content: 'two' },
    ] }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ messages: [
      { role: 'user', content: 'one' },
      { role: 'assistant', content: 'two' },
    ] }).success).toBe(false);
  });
});
