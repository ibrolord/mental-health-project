import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260805115245_add_private_wellbeing_plans.sql'
  ),
  'utf8'
);

const ownerTables = [
  'activity_plans',
  'activity_plan_steps',
  'safety_plans',
  'safety_plan_items',
  'staying_well_plans',
  'staying_well_plan_items',
  'sleep_diary_entries',
  'partner_support_preferences',
  'privacy_events',
] as const;

describe('private wellbeing plans migration', () => {
  it('creates every table with direct auth ownership and RLS', () => {
    for (const table of ownerTables) {
      expect(migration).toContain(`CREATE TABLE public.${table}`);
      expect(migration).toContain(
        `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`
      );
    }

    expect(
      migration.match(/REFERENCES auth\.users\(id\) ON DELETE CASCADE/g)
        ?.length
    ).toBe(ownerTables.length);
    expect(
      migration.match(/USING \(\(SELECT auth\.uid\(\)\) = user_id\)/g)
        ?.length
    ).toBe(ownerTables.length);
  });

  it('prevents plan items from crossing owner boundaries', () => {
    expect(migration).toContain(
      'CONSTRAINT activity_plans_owner_identity_unique UNIQUE (id, user_id)'
    );
    expect(migration).toContain(
      'FOREIGN KEY (plan_id, user_id)\n    REFERENCES public.activity_plans(id, user_id)'
    );
    expect(migration).toContain(
      'CONSTRAINT safety_plans_owner_identity_unique UNIQUE (id, user_id)'
    );
    expect(migration).toContain(
      'FOREIGN KEY (plan_id, user_id)\n    REFERENCES public.safety_plans(id, user_id)'
    );
    expect(migration).toContain(
      'CONSTRAINT staying_well_plans_owner_identity_unique UNIQUE (id, user_id)'
    );
    expect(migration).toContain(
      'FOREIGN KEY (plan_id, user_id)\n    REFERENCES public.staying_well_plans(id, user_id)'
    );
    expect(migration).toContain('safety_plan_items_user_plan_idx');
    expect(migration).toContain('staying_well_plan_items_user_plan_idx');
    expect(migration).toContain('activity_plan_steps_user_plan_idx');
  });

  it('uses bounded enumerations, text, ratings, durations, and timelines', () => {
    for (const constraint of [
      'activity_plans_kind_check',
      'activity_plans_status_check',
      'activity_plans_text_lengths_check',
      'activity_plans_minutes_check',
      'activity_plan_steps_text_lengths_check',
      'activity_plan_steps_minutes_check',
      'activity_plan_steps_position_check',
      'safety_plan_items_kind_check',
      'safety_plan_items_text_lengths_check',
      'staying_well_plan_items_kind_check',
      'staying_well_plan_items_text_lengths_check',
      'sleep_diary_entries_counts_check',
      'sleep_diary_entries_timezone_check',
      'sleep_diary_entries_ratings_check',
      'sleep_diary_entries_notes_length_check',
      'sleep_diary_entries_timeline_check',
      'partner_support_preferences_style_check',
      'partner_support_preferences_frequency_check',
      'partner_support_preferences_advice_check',
    ]) {
      expect(migration).toContain(`CONSTRAINT ${constraint} CHECK`);
    }

    expect(migration).toContain(
      'CONSTRAINT sleep_diary_entries_user_date_unique UNIQUE (user_id, entry_date)'
    );
    expect(migration).toContain('safety_plans_one_active_per_user_idx');
    expect(migration).toContain('staying_well_plans_one_active_per_user_idx');
    expect(migration).toContain("'distraction'");
    expect(migration).toContain('planned_minutes BETWEEN 1 AND 180');
    expect(migration).toContain('position BETWEEN 1 AND 3');
    expect(migration.match(/position BETWEEN 0 AND 5/g)?.length).toBe(2);
  });

  it('does not manufacture sleep facts or preselect partner preferences', () => {
    expect(migration).not.toContain('awakenings SMALLINT NOT NULL DEFAULT 0');
    expect(migration).not.toContain('awake_minutes SMALLINT NOT NULL DEFAULT 0');
    expect(migration).not.toContain('nap_minutes SMALLINT NOT NULL DEFAULT 0');
    expect(migration).toContain('timezone_offset_minutes SMALLINT');
    expect(migration).toContain('timezone_name TEXT');
    expect(migration).toContain("timezone_name ~ '^(UTC|GMT|");
    expect(migration).toContain("support_style TEXT NOT NULL DEFAULT 'not_set'");
    expect(migration).toContain("check_in_frequency TEXT NOT NULL DEFAULT 'never'");
    expect(migration).toContain("advice_mode TEXT NOT NULL DEFAULT 'when_requested'");
    expect(migration).toContain('celebrate_progress BOOLEAN NOT NULL DEFAULT FALSE');
    expect(migration).toContain('gentle_reminders BOOLEAN NOT NULL DEFAULT FALSE');
  });

  it('keeps raw content and partner preferences owner-only', () => {
    const policies = migration.match(/CREATE POLICY[\s\S]*?;/g) ?? [];

    expect(policies).toHaveLength(ownerTables.length);
    expect(policies.join('\n')).not.toMatch(
      /partner_id|partner_links|partner_snapshot/
    );
    expect(migration).toContain(
      'CREATE POLICY "Users own partner support preferences"'
    );
    expect(migration).not.toMatch(/CREATE POLICY[\s\S][^;]*\bTO anon\b/);
  });

  it('allows only non-content taxonomy in privacy event metadata', () => {
    const privacyTable = migration.slice(
      migration.indexOf('CREATE TABLE public.privacy_events'),
      migration.indexOf('CREATE INDEX privacy_events_user_occurred_idx')
    );

    expect(privacyTable).toContain("jsonb_typeof(metadata) = 'object'");
    expect(privacyTable).toContain('octet_length(metadata::TEXT) <= 512');
    expect(privacyTable).toContain(
      "metadata - ARRAY[\n      'policy_version',\n      'app_version',\n      'setting',\n      'method'"
    );
    expect(privacyTable).not.toMatch(/\b(content|details|email|note|payload|url)\b/i);
    expect(privacyTable).toContain('privacy_events_policy_version_check');
    expect(privacyTable).toContain('privacy_events_app_version_check');
    expect(privacyTable).toContain('privacy_events_setting_check');
    expect(privacyTable).toContain('privacy_events_method_check');
  });

  it('uses a narrowly granted RPC to append privacy events for auth.uid()', () => {
    const rpc = migration.slice(
      migration.indexOf(
        'CREATE OR REPLACE FUNCTION public.record_privacy_event'
      ),
      migration.indexOf(
        '-- A function invocation is one transaction'
      )
    );

    expect(rpc).toContain('SECURITY DEFINER');
    expect(rpc).toContain("SET search_path = ''");
    expect(rpc).toContain('v_user_id UUID := auth.uid()');
    expect(rpc).toContain("RAISE EXCEPTION 'Authentication is required'");
    expect(rpc).toContain('INSERT INTO public.privacy_events');
    expect(rpc).toContain('FROM PUBLIC, anon, authenticated, service_role');
    expect(rpc).toContain('TO authenticated');

    expect(migration).toContain(
      'GRANT SELECT ON TABLE public.privacy_events TO authenticated'
    );
    expect(migration).not.toContain(
      'GRANT SELECT, INSERT ON TABLE public.privacy_events TO authenticated'
    );
    expect(migration).not.toMatch(
      /ON public\.privacy_events\s+FOR (INSERT|UPDATE|DELETE)/
    );
  });

  it('revokes first and gives the service role no privacy rewrite privilege', () => {
    expect(migration).toContain(
      'FROM PUBLIC, anon, authenticated, service_role'
    );
    expect(migration).toContain(
      'GRANT SELECT, INSERT ON TABLE public.privacy_events TO service_role'
    );
    expect(migration).not.toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.privacy_events'
    );
  });

  it('deletes every new owner table in the transactional clear-data RPC', () => {
    const deletionFunction = migration.slice(
      migration.indexOf(
        'CREATE OR REPLACE FUNCTION public.delete_owned_data'
      )
    );

    for (const table of ownerTables) {
      expect(deletionFunction).toContain(
        `DELETE FROM public.${table} WHERE user_id = p_user_id`
      );
    }

    expect(
      deletionFunction.indexOf(
        'DELETE FROM public.safety_plan_items WHERE user_id = p_user_id'
      )
    ).toBeLessThan(
      deletionFunction.indexOf(
        'DELETE FROM public.safety_plans WHERE user_id = p_user_id'
      )
    );
    expect(
      deletionFunction.indexOf(
        'DELETE FROM public.staying_well_plan_items WHERE user_id = p_user_id'
      )
    ).toBeLessThan(
      deletionFunction.indexOf(
        'DELETE FROM public.staying_well_plans WHERE user_id = p_user_id'
      )
    );
    expect(deletionFunction).toContain('SECURITY DEFINER');
    expect(deletionFunction).toContain("SET search_path = ''");
    expect(deletionFunction).toContain('TO service_role');
    expect(deletionFunction).toContain(
      'DELETE FROM public.user_data_migration WHERE user_id = p_user_id'
    );
    expect(deletionFunction).toContain(
      'DELETE FROM public.anonymous_sessions AS session'
    );
    expect(deletionFunction).toContain(
      'DELETE FROM public.user_data_migration WHERE session_id = p_session_id'
    );
    expect(deletionFunction).toContain(
      'DELETE FROM public.anonymous_sessions WHERE session_id = p_session_id'
    );
  });

  it('validates every entered pair in the nullable sleep timeline', () => {
    for (const comparison of [
      'fell_asleep_at >= went_to_bed_at',
      'woke_up_at >= went_to_bed_at',
      'got_out_of_bed_at >= went_to_bed_at',
      'woke_up_at >= tried_to_sleep_at',
      'got_out_of_bed_at >= tried_to_sleep_at',
      'got_out_of_bed_at >= fell_asleep_at',
    ]) {
      expect(migration).toContain(comparison);
    }
  });
});
