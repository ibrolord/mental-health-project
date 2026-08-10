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

  it('accepts separately selected journal and private library notes', () => {
    const result = chatRequestSchema.safeParse({
      messages: [{ role: 'user', content: 'Help me reflect on this.' }],
      userContext: {
        recentMoods: [{ emoji: '🙂', created_at: '2026-07-28' }],
        moodNotes: [
          { emoji: '🙂', note: 'A private note', created_at: '2026-07-28' },
        ],
        journalEntries: [
          {
            title: 'Today',
            content: 'A private journal entry',
            entry_kind: 'freeform',
            created_at: '2026-07-28',
          },
        ],
        libraryNotes: [
          {
            content_id: 'book-1',
            title: 'A book',
            media_type: 'book',
            custom_notes: 'A private library note',
            updated_at: '2026-07-28',
          },
        ],
        lifePlan: [
          {
            item_type: 'dream',
            horizon: '1_year',
            title: 'Build a calmer routine',
            reflection: '',
            next_step: 'Start this week',
            status: 'active',
          },
        ],
        focusSessions: [
          {
            task_label: 'Write the outline',
            focus_minutes: 25,
            planned_cycles: 2,
            completed_cycles: 1,
            status: 'paused',
          },
        ],
      },
    });

    expect(result.success).toBe(true);
  });

  it('accepts an explicitly selected private note attached to a story', () => {
    const result = chatRequestSchema.safeParse({
      messages: [{ role: 'user', content: 'Help me reflect on this story.' }],
      userContext: {
        libraryNotes: [
          {
            content_id: 'story-sangu-delle-mental-health',
            title: "There's no shame in taking care of your mental health",
            media_type: 'story',
            custom_notes: 'I want to ask for support sooner.',
            updated_at: '2026-07-29',
          },
        ],
      },
    });

    expect(result.success).toBe(true);
  });

  it('accepts only the bounded Apple Health aggregate shape', () => {
    const appleHealthSummary = {
      sevenDay: {
        coverageDays: 5,
        averageSteps: 4200,
        averageSleepMinutes: 410,
        exerciseMinutes: 90,
        mindfulMinutes: 25,
        workoutCount: 2,
        stateOfMindCount: 3,
      },
      thirtyDay: {
        coverageDays: 21,
        averageSteps: 3900,
        averageSleepMinutes: null,
        exerciseMinutes: 280,
        mindfulMinutes: 80,
        workoutCount: 7,
        stateOfMindCount: 8,
      },
      moodComparison: 'Not enough overlapping mood check-ins for a comparison.',
    };

    expect(
      chatRequestSchema.safeParse({
        messages: [{ role: 'user', content: 'Help me reflect.' }],
        userContext: { appleHealthSummary },
      }).success
    ).toBe(true);
    expect(
      chatRequestSchema.safeParse({
        messages: [{ role: 'user', content: 'Help me reflect.' }],
        userContext: {
          appleHealthSummary: { ...appleHealthSummary, rawSamples: [{ value: 1 }] },
        },
      }).success
    ).toBe(false);
  });

  it('does not allow mood notes to hide inside the pattern-only field', () => {
    expect(
      chatRequestSchema.safeParse({
        messages: [{ role: 'user', content: 'Hello' }],
        userContext: {
          recentMoods: [
            { emoji: '🙂', note: 'should be rejected', created_at: '2026-07-28' },
          ],
        },
      }).success
    ).toBe(false);
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

  it('rejects assistant-first conversation history', () => {
    expect(chatRequestSchema.safeParse({ messages: [
      { role: 'assistant', content: 'one' },
      { role: 'user', content: 'two' },
    ] }).success).toBe(false);
  });
});
