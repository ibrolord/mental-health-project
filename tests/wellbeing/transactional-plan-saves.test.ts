import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260805130000_transactional_wellbeing_plan_saves.sql'
  ),
  'utf8'
);

const rpcNames = [
  'save_activity_plan',
  'save_safety_plan',
  'save_staying_well_plan',
] as const;

function functionDefinition(name: (typeof rpcNames)[number]): string {
  const start = migration.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  const end = migration.indexOf('\n$$;', start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return migration.slice(start, end);
}

describe('transactional wellbeing plan save RPCs', () => {
  it('exposes only authenticated SECURITY DEFINER entry points', () => {
    for (const name of rpcNames) {
      const definition = functionDefinition(name);
      expect(definition).toContain('SECURITY DEFINER');
      expect(definition).toContain("SET search_path = ''");
      expect(definition).toContain('v_user_id UUID := (SELECT auth.uid());');
      expect(definition).toContain('IF v_user_id IS NULL THEN');
      expect(migration).toContain(`REVOKE ALL ON FUNCTION public.${name}(`);
      expect(migration).toContain(`GRANT EXECUTE ON FUNCTION public.${name}(`);
    }

    expect(
      migration.match(/FROM PUBLIC, anon, authenticated, service_role;/g)?.length
    ).toBe(3);
    expect(migration.match(/\)\s+TO authenticated;/g)?.length).toBe(3);
  });

  it('bounds arrays and rejects child fields outside each explicit allowlist', () => {
    expect(migration).toContain('jsonb_array_length(p_steps) > 3');
    expect(migration.match(/jsonb_array_length\(p_items\) > 6/g)?.length).toBe(
      2
    );
    expect(migration).toContain(
      "v_step - ARRAY[\n         'id',\n         'action',\n         'timing',\n         'estimated_minutes',\n         'position'"
    );
    expect(
      migration.match(
        /v_item - ARRAY\[\n         'id',\n         'item_kind',\n         'label',\n         'details',\n         'position'/g
      )?.length
    ).toBe(2);
    expect(migration).toContain("p_activity_kind NOT IN (");
    expect(migration).toContain("v_item_kind NOT IN (\n         'warning_sign'");
    expect(migration).toContain("v_item_kind NOT IN (\n         'protective_routine'");

    const activity = functionDefinition('save_activity_plan');
    expect(activity).toContain('char_length(p_details) > 1000');
    expect(activity).toContain('v_step_position NOT BETWEEN 1 AND 3');

    const safety = functionDefinition('save_safety_plan');
    expect(safety).toContain('char_length(v_item_details) > 1000');
    expect(safety).toContain('v_item_position NOT BETWEEN 0 AND 5');

    const stayingWell = functionDefinition('save_staying_well_plan');
    expect(stayingWell).toContain('char_length(v_item_details) > 2000');
    expect(stayingWell).toContain('v_item_position NOT BETWEEN 0 AND 5');
  });

  it('owner-scopes existing rows and mutates parent and children in one function', () => {
    const activity = functionDefinition('save_activity_plan');
    expect(activity).toContain('FROM public.activity_plans');
    expect(activity).toContain("AND status IN ('planned', 'in_progress')");
    expect(activity).toContain('FROM public.activity_plan_steps');
    expect(activity).toContain('DELETE FROM public.activity_plan_steps');
    expect(activity).toContain('INSERT INTO public.activity_plan_steps');

    const safety = functionDefinition('save_safety_plan');
    expect(safety).toContain('FROM public.safety_plans');
    expect(safety).toContain("AND status IN ('draft', 'active')");
    expect(safety).toContain('FROM public.safety_plan_items');
    expect(safety).toContain('DELETE FROM public.safety_plan_items');
    expect(safety).toContain('INSERT INTO public.safety_plan_items');

    const stayingWell = functionDefinition('save_staying_well_plan');
    expect(stayingWell).toContain('FROM public.staying_well_plans');
    expect(stayingWell).toContain("AND status IN ('draft', 'active')");
    expect(stayingWell).toContain('FROM public.staying_well_plan_items');
    expect(stayingWell).toContain('DELETE FROM public.staying_well_plan_items');
    expect(stayingWell).toContain('INSERT INTO public.staying_well_plan_items');

    for (const definition of [activity, safety, stayingWell]) {
      expect(definition).not.toContain('p_user_id');
      expect(definition).not.toContain('p_status');
      expect(definition).not.toContain('p_updated_at');
      expect(definition.match(/AND user_id = v_user_id/g)?.length).toBeGreaterThanOrEqual(
        4
      );
      expect(definition).toContain('FOR UPDATE;');
      expect(definition).toContain('RETURN v_plan_id;');
    }

    const activitySignature = activity.slice(0, activity.indexOf('RETURNS UUID'));
    expect(activitySignature).not.toContain('p_completed');
    expect(activitySignature).not.toContain('p_location');
    expect(activity).toContain('v_step_locations[v_index]');
  });
});
