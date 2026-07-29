import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260728220951_expand_partner_progress_and_habit_checkins.sql'
  ),
  'utf8'
);

const snapshotBody =
  migration
    .split('CREATE OR REPLACE FUNCTION public.partner_snapshot')[1]
    ?.split('CREATE OR REPLACE FUNCTION public.send_partner_celebration')[0] ?? '';

describe('habit accountability and partner progress migration', () => {
  it('keeps every new partner scope opt-in and aggregate-only', () => {
    for (const scope of [
      'share_journal_activity',
      'share_assessment_activity',
      'share_planner_progress',
      'share_focus_progress',
      'share_library_activity',
    ]) {
      expect(migration).toContain(
        `ADD COLUMN ${scope} BOOLEAN NOT NULL DEFAULT FALSE`
      );
      expect(migration).toContain(
        `NEW.${scope} IS DISTINCT FROM OLD.${scope}`
      );
    }

    expect(snapshotBody).not.toMatch(
      /SELECT\s+[^;]*(title|content|reflection|note|score|emoji|task_label)/i
    );
  });

  it('requires per-habit opt-in for check-ins and streaks', () => {
    expect(migration).toContain(
      'ADD COLUMN accountability_enabled BOOLEAN NOT NULL DEFAULT FALSE'
    );
    expect(snapshotBody).toContain('AND h.accountability_enabled');
    expect(snapshotBody).toContain('AND accountability_share_streak');
    expect(snapshotBody).toContain("'due_today'");
    expect(snapshotBody).toContain("'completed_today'");
  });

  it('uses the owner timezone and a bounded recurring schedule', () => {
    expect(migration).toContain('cardinality(accountability_days) BETWEEN 1 AND 7');
    expect(migration).toContain(
      'CREATE TRIGGER validate_habit_accountability_trigger'
    );
    expect(migration).toContain('FROM pg_catalog.pg_timezone_names');
    expect(migration).toContain('SELECT DISTINCT day');
    expect(snapshotBody).toContain(
      'CURRENT_TIMESTAMP AT TIME ZONE h.accountability_timezone'
    );
  });
});
