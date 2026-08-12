import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { USER_DATA_REGISTRY } from '../../lib/data/user-data-registry';

const exportRoute = readFileSync(
  resolve(process.cwd(), 'app/api/data/export/route.ts'),
  'utf8'
);
const lifecycleMigration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260811081540_expand_goal_details.sql'
  ),
  'utf8'
);

describe('user-data lifecycle registry', () => {
  it('requires every classified table in complete export and deletion paths', () => {
    for (const [table, classification] of Object.entries(USER_DATA_REGISTRY)) {
      if (classification.export) expect(exportRoute).toContain(`'${table}'`);
      if (classification.delete && table !== 'habit_logs') {
        expect(lifecycleMigration).toContain(`DELETE FROM public.${table}`);
      }
    }
  });

  it('keeps new sensitive planning records out of partner and AI paths', () => {
    for (const table of [
      'activity_plans',
      'activity_plan_steps',
      'safety_plans',
      'safety_plan_items',
      'staying_well_plans',
      'staying_well_plan_items',
      'sleep_diary_entries',
      'partner_support_preferences',
      'privacy_events',
      'operational_events',
    ] as const) {
      expect(USER_DATA_REGISTRY[table].partner).toBe('none');
      expect(USER_DATA_REGISTRY[table].ai).toBe('never');
    }
  });

  it('classifies internal anonymous-owner mappings for deletion but not export', () => {
    expect(USER_DATA_REGISTRY.anonymous_sessions).toMatchObject({
      export: false,
      delete: true,
      partner: 'none',
      ai: 'never',
    });
    expect(USER_DATA_REGISTRY.user_data_migration).toMatchObject({
      export: false,
      delete: true,
      partner: 'none',
      ai: 'never',
    });
  });
});
