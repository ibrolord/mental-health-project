import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260728205733_add_wellbeing_planning_tools.sql'
  ),
  'utf8'
);
const indexMigration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260728211526_add_wellbeing_fk_indexes.sql'
  ),
  'utf8'
);

describe('wellbeing planning migration', () => {
  it('creates owner-only tables with explicit grants and RLS', () => {
    for (const table of [
      'life_plan_items',
      'focus_sessions',
      'wellbeing_reminders',
      'push_subscriptions',
      'reminder_deliveries',
      'dismissed_notices',
    ]) {
      expect(migration).toContain(`CREATE TABLE public.${table}`);
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
    }
    expect(migration).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON');
    expect(migration).toContain('TO authenticated');
    expect(migration).not.toContain('TO anon');
    expect(migration.match(/\(SELECT auth\.uid\(\)\) = user_id/g)?.length).toBeGreaterThanOrEqual(
      6
    );
  });

  it('prevents active plan, habit, and reminder duplicates at the database', () => {
    expect(migration).toContain('life_plan_items_user_active_identity_unique');
    expect(migration).toContain('habits_user_active_dedupe_unique');
    expect(migration).toContain('wellbeing_reminders_user_habit_unique');
    expect(migration).toContain('wellbeing_reminders_user_kind_route_unique');
  });

  it('indexes foreign keys used by goal and habit deletion', () => {
    expect(indexMigration).toContain('focus_sessions_goal_id_idx');
    expect(indexMigration).toContain('ON public.focus_sessions (goal_id)');
    expect(indexMigration).toContain('wellbeing_reminders_habit_id_idx');
    expect(indexMigration).toContain('ON public.wellbeing_reminders (habit_id)');
  });

  it('keeps notification content generic and constrained to safe routes', () => {
    expect(migration).toContain("route ~ '^/[a-z0-9/_-]*$'");
    expect(migration).toContain('wellbeing_reminder_label_length_check');
    expect(migration).toContain('push_subscription_lengths_check');
  });

  it('includes every new owner table in transactional deletion', () => {
    for (const table of [
      'dismissed_notices',
      'reminder_deliveries',
      'push_subscriptions',
      'wellbeing_reminders',
      'focus_sessions',
      'life_plan_items',
    ]) {
      expect(migration).toContain(`DELETE FROM public.${table} WHERE user_id = p_user_id`);
    }
  });

  it('does not schedule anonymous account purging', () => {
    expect(migration).not.toMatch(/cron\.schedule\s*\(/);
    expect(migration).toContain('intentionally does not schedule');
    expect(migration).toContain(
      "RAISE EXCEPTION 'Anonymous account purging is disabled for this project'"
    );
    expect(migration).toContain(
      "RAISE EXCEPTION 'Anonymous session purging is disabled for this project'"
    );
    expect(migration).not.toContain('DELETE FROM auth.users u');
    expect(migration).not.toContain('DELETE FROM public.anonymous_sessions');
  });
});
