import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  createWeeklyInsight,
  getWeeklyInsightWeekStart,
  loadWeeklyOwnerSummary,
  parseWeeklyOwnerSummary,
  type WeeklyOwnerSummary,
  type WeeklySummaryRpcArgs,
} from '../../lib/weekly-insights';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260809004018_add_weekly_owner_summary.sql'
  ),
  'utf8'
);

const rpcSummary = {
  week_start: '2026-08-03',
  week_end: '2026-08-09',
  timezone: 'America/Toronto',
  check_in_days: 2,
  completed_habit_days: 1,
  completed_focus_sessions: 0,
  journal_entries: 0,
};

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

describe('weekly_owner_summary migration', () => {
  it('is an authenticated owner-only SECURITY DEFINER RPC', () => {
    expect(migration).toContain(
      'CREATE OR REPLACE FUNCTION public.weekly_owner_summary('
    );
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain("SET search_path = ''");
    expect(migration).toContain('v_owner_id UUID := auth.uid()');
    expect(migration).toContain("auth.role(), '') <> 'authenticated'");
    expect(migration).toContain('WHERE m.user_id = v_owner_id');
    expect(migration).toContain('WHERE h.user_id = v_owner_id');
    expect(migration).toContain('WHERE fs.user_id = v_owner_id');
    expect(migration).toContain('WHERE je.user_id = v_owner_id');
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.weekly_owner_summary\(DATE, TEXT\)\s+TO authenticated;/
    );
    expect(migration).not.toMatch(/GRANT EXECUTE[\s\S]*TO (?:anon|service_role);/);
  });

  it('does not change direct table privileges or RLS', () => {
    expect(migration).not.toMatch(/GRANT [\s\S]* ON TABLE/i);
    expect(migration).not.toMatch(/ALTER TABLE|CREATE POLICY|DROP POLICY/i);
  });

  it('validates Monday and timezone and builds DST-safe local bounds', () => {
    expect(migration).toContain('EXTRACT(ISODOW FROM p_week_start) <> 1');
    expect(migration).toContain('FROM pg_catalog.pg_timezone_names');
    expect(migration).toContain(
      'p_week_start::TIMESTAMP AT TIME ZONE v_timezone'
    );
    expect(migration).toContain(
      '(p_week_start + 7)::TIMESTAMP AT TIME ZONE v_timezone'
    );
    expect(migration).toMatch(/created_at >= v_window_start[\s\S]*created_at < v_window_end/);
    expect(migration).toMatch(/completed_at >= v_window_start[\s\S]*completed_at < v_window_end/);
  });

  it('returns only the four allowed aggregate counts and window metadata', () => {
    const returnBlock = migration.slice(
      migration.indexOf('RETURN jsonb_build_object'),
      migration.indexOf('END;', migration.indexOf('RETURN jsonb_build_object'))
    );
    for (const key of [
      'check_in_days',
      'completed_habit_days',
      'completed_focus_sessions',
      'journal_entries',
    ]) {
      expect(returnBlock).toContain(`'${key}'`);
    }
    expect(returnBlock).not.toMatch(
      /assessment|score|emoji|mood_value|journal_text|habit_name|goal_name|note|chat|row_id/i
    );
    expect(migration).not.toMatch(/SELECT\s+\*/i);
  });
});

describe('weekly insight week boundaries', () => {
  it('uses the requested local Monday rather than the UTC date', () => {
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

  it('handles a timezone on the opposite calendar day', () => {
    expect(
      getWeeklyInsightWeekStart(
        'Pacific/Kiritimati',
        new Date('2026-08-09T12:30:00.000Z')
      )
    ).toBe('2026-08-10');
  });

  it('rejects invalid timezones and dates', () => {
    expect(() =>
      getWeeklyInsightWeekStart('Not/A_Timezone', new Date())
    ).toThrow('Invalid time zone.');
    expect(() =>
      getWeeklyInsightWeekStart('UTC', new Date('invalid'))
    ).toThrow('Invalid current date.');
  });
});

describe('weekly summary parsing and loading', () => {
  it('copies only allowlisted aggregate fields from the RPC payload', () => {
    const parsed = parseWeeklyOwnerSummary({
      ...rpcSummary,
      assessment_score: 19,
      mood_value: 'low',
      journal_text: 'private entry',
      habit_name: 'private habit',
      note: 'private note',
      row_id: 'private-id',
    });

    expect(parsed).toEqual(summary({ checkInDays: 2, completedHabitDays: 1 }));
    expect(Object.keys(parsed).sort()).toEqual(
      [
        'weekStart',
        'weekEnd',
        'timeZone',
        'checkInDays',
        'completedHabitDays',
        'completedFocusSessions',
        'journalEntries',
      ].sort()
    );
  });

  it('rejects malformed windows and counts', () => {
    expect(() =>
      parseWeeklyOwnerSummary({ ...rpcSummary, week_start: '2026-08-04' })
    ).toThrow('Invalid weekly summary window.');
    expect(() =>
      parseWeeklyOwnerSummary({ ...rpcSummary, week_end: '2026-08-10' })
    ).toThrow('Invalid weekly summary window.');
    expect(() =>
      parseWeeklyOwnerSummary({ ...rpcSummary, check_in_days: 8 })
    ).toThrow('Invalid weekly summary check_in_days.');
    expect(() =>
      parseWeeklyOwnerSummary({ ...rpcSummary, journal_entries: 1.5 })
    ).toThrow('Invalid weekly summary journal_entries.');
    expect(() =>
      parseWeeklyOwnerSummary({ ...rpcSummary, journal_entries: -1 })
    ).toThrow('Invalid weekly summary journal_entries.');
  });

  it('calls the RPC with the exact local week and timezone', async () => {
    let args: WeeklySummaryRpcArgs | null = null;
    const rpc = vi.fn(async (nextArgs: WeeklySummaryRpcArgs) => {
      args = nextArgs;
      return { data: rpcSummary, error: null };
    });

    await expect(
      loadWeeklyOwnerSummary(
        rpc,
        'America/Toronto',
        new Date('2026-08-06T12:00:00.000Z')
      )
    ).resolves.toEqual(summary({ checkInDays: 2, completedHabitDays: 1 }));
    expect(args).toEqual({
      p_week_start: '2026-08-03',
      p_timezone: 'America/Toronto',
    });
  });

  it('fails closed on RPC errors and mismatched responses', async () => {
    await expect(
      loadWeeklyOwnerSummary(
        async () => ({ data: null, error: { message: 'database detail' } }),
        'UTC'
      )
    ).rejects.toThrow('Unable to load weekly insight.');
    await expect(
      loadWeeklyOwnerSummary(
        async () => ({
          data: { ...rpcSummary, timezone: 'UTC' },
          error: null,
        }),
        'UTC',
        new Date('2026-08-12T12:00:00.000Z')
      )
    ).rejects.toThrow('Weekly summary response did not match the request.');
  });
});

describe('deterministic weekly insight copy', () => {
  it('uses fixed order and correct singular labels', () => {
    const insight = createWeeklyInsight(
      summary({
        checkInDays: 1,
        completedHabitDays: 2,
        completedFocusSessions: 1,
        journalEntries: 1,
      })
    );
    expect(insight.counts).toEqual([
      { feature: 'checkInDays', value: 1, label: 'check-in day' },
      { feature: 'completedHabitDays', value: 2, label: 'habit days' },
      {
        feature: 'completedFocusSessions',
        value: 1,
        label: 'focus session',
      },
      { feature: 'journalEntries', value: 1, label: 'journal entry' },
    ]);
    expect(insight.periodLabel).toBe(
      'Mon-Sun · 2026-08-03 to 2026-08-09'
    );
  });

  it('requires both feature and observation thresholds for a question', () => {
    expect(
      createWeeklyInsight(summary({ checkInDays: 3 })).question
    ).toBeNull();
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
  });

  it('uses noncausal wording and no generated interpretation', () => {
    const first = createWeeklyInsight(
      summary({ checkInDays: 2, journalEntries: 1 })
    );
    const second = createWeeklyInsight(
      summary({ checkInDays: 2, journalEntries: 1 })
    );
    expect(second).toEqual(first);
    expect(first.question).not.toMatch(
      /because|caused|led to|improved|worsened|means|therefore/i
    );
  });
});
