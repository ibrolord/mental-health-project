import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260814144251_persist_advisor_momentum_events.sql'
  ),
  'utf8'
);

describe('Advisor momentum event ledger migration', () => {
  it('stores fixed habit XP with owner-only read access', () => {
    expect(migration).toContain('CREATE TABLE public.advisor_momentum_events');
    expect(migration).toContain('points SMALLINT NOT NULL DEFAULT 10');
    expect(migration).toContain('CHECK (points = 10)');
    expect(migration).toContain('ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('GRANT SELECT ON TABLE public.advisor_momentum_events TO authenticated, service_role;');
    expect(migration).not.toMatch(/GRANT (?:INSERT|UPDATE|DELETE)/);
    expect(migration).toContain('USING ((SELECT auth.uid()) = user_id)');
  });

  it('creates events atomically from saved habit logs and prevents direct calls', () => {
    expect(migration).toContain('AFTER INSERT OR UPDATE OF completed, habit_id, log_date');
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain("SET search_path = ''");
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.sync_advisor_momentum_from_habit_log()');
    expect(migration).toContain('ON CONFLICT (habit_log_id)');
    expect(migration).toContain('DELETE FROM public.advisor_momentum_events');
    expect(migration).toContain('REFERENCES public.habit_logs(id) ON DELETE CASCADE');
  });

  it('backfills only completed account-owned habit logs', () => {
    const backfill = migration.slice(
      migration.indexOf('INSERT INTO public.advisor_momentum_events', migration.indexOf('-- Existing completions'))
    );
    expect(backfill).toContain('JOIN public.habits AS habit');
    expect(backfill).toContain('WHERE habit_log.completed IS TRUE');
    expect(backfill).toContain('AND habit.user_id IS NOT NULL');
    expect(backfill).not.toMatch(/moods|health|check.?ins/i);
  });
});
