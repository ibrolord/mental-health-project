import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  createWeeklyInsight,
  getWeeklyInsightWeekStart,
  loadWeeklyOwnerSummary,
  parseWeeklyOwnerSummary,
  type WeeklyOwnerSummary,
} from '../../mobile/lib/weekly-insights';

function summary(
  overrides: Partial<WeeklyOwnerSummary> = {}
): WeeklyOwnerSummary {
  return {
    weekStart: '2026-08-03',
    weekEnd: '2026-08-09',
    timeZone: 'America/Toronto',
    checkInDays: 0,
    completedHabitDays: 0,
    completedFocusSessions: 0,
    journalEntries: 0,
    ...overrides,
  };
}

const rpcSummary = {
  week_start: '2026-08-03',
  week_end: '2026-08-09',
  timezone: 'America/Toronto',
  check_in_days: 1,
  completed_habit_days: 1,
  completed_focus_sessions: 1,
  journal_entries: 0,
};

describe('mobile weekly insights', () => {
  it('uses the device timezone calendar across a DST week boundary', () => {
    expect(
      getWeeklyInsightWeekStart(
        'America/Toronto',
        new Date('2026-03-09T03:30:00.000Z')
      )
    ).toBe('2026-03-02');
    expect(
      getWeeklyInsightWeekStart(
        'America/Toronto',
        new Date('2026-03-09T04:30:00.000Z')
      )
    ).toBe('2026-03-09');
  });

  it('narrows the RPC result to count-only fields', () => {
    const parsed = parseWeeklyOwnerSummary({
      ...rpcSummary,
      score: 20,
      mood_value: 'private',
      journal_text: 'private',
      goal_name: 'private',
      chat: 'private',
      row_id: 'private',
    });
    expect(parsed).toEqual(
      summary({
        checkInDays: 1,
        completedHabitDays: 1,
        completedFocusSessions: 1,
      })
    );
    expect(parsed).not.toHaveProperty('score');
    expect(parsed).not.toHaveProperty('journal_text');
    expect(parsed).not.toHaveProperty('row_id');
  });

  it('enforces the cross-feature privacy threshold exactly', () => {
    expect(
      createWeeklyInsight(
        summary({ checkInDays: 1, completedHabitDays: 1 })
      ).question
    ).toBeNull();
    expect(
      createWeeklyInsight(
        summary({ checkInDays: 2, completedHabitDays: 1 })
      ).question
    ).toBe(
      'What did you notice about check-ins and habit completions this week?'
    );
    expect(
      createWeeklyInsight(summary({ completedFocusSessions: 3 })).question
    ).toBeNull();
  });

  it('loads the exact week through an injected RPC without raw table access', async () => {
    const calls: unknown[] = [];
    const loaded = await loadWeeklyOwnerSummary(
      async (args) => {
        calls.push(args);
        return { data: rpcSummary, error: null };
      },
      'America/Toronto',
      new Date('2026-08-06T12:00:00.000Z')
    );
    expect(calls).toEqual([
      {
        p_week_start: '2026-08-03',
        p_timezone: 'America/Toronto',
      },
    ]);
    expect(loaded.completedFocusSessions).toBe(1);
  });

  it('keeps the component presentational and free of sensitive source fields', () => {
    const component = readFileSync(
      new URL('../../mobile/components/weekly-insight.tsx', import.meta.url),
      'utf8'
    );
    expect(component).not.toContain('supabase');
    expect(component).not.toMatch(
      /assessment_score|mood_value|journal_text|habit_name|goal_name|notes|chat|row_id/i
    );
    expect(component).toContain(
      'Your content stays private. Partners only see enabled activity totals.'
    );
    expect(component).toContain('Reflect on this week');
    expect(component).toContain("mode: 'weekly-patterns'");
  });
});
