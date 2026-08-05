import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const plansPage = readFileSync(
  resolve(process.cwd(), 'app/plans/page.tsx'),
  'utf8'
);

describe('web My Plans screen', () => {
  it('provides every bounded plan segment and explicit save states', () => {
    expect(plansPage).toContain(
      "type Segment = 'overview' | 'activity' | 'safety' | 'staying-well';"
    );
    expect(plansPage).toContain('const MAX_ACTIVITY_STEPS = 3;');
    expect(plansPage).toContain('const MAX_PLAN_ITEM_POSITION = 5;');
    expect(plansPage).toContain('planDate: localCalendarDate()');
    expect(plansPage).not.toContain("planDate: new Date().toISOString().slice(0, 10)");
    expect(plansPage).toContain('const MAX_ACTIVITY_DETAILS = 1_000;');
    expect(plansPage).toContain('const MAX_SAFETY_ITEM_DETAILS = 1_000;');
    expect(plansPage).toContain(
      'const MAX_STAYING_WELL_ITEM_DETAILS = 2_000;'
    );
    expect(plansPage).toContain("{ kind: 'distraction'");
    expect(plansPage).toContain('function blankSafetyItems()');
    expect(plansPage).toContain("type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';");
    expect(plansPage).not.toMatch(/streak|guilt/i);
    expect(plansPage).not.toMatch(/\.slice\(0, MAX_(?:ACTIVITY_STEPS|PLAN_ITEMS)\)/);
    expect(plansPage).toContain('activitySteps.length > MAX_ACTIVITY_STEPS');
  });

  it('keeps safety guidance and urgent help available without auto-contact', () => {
    expect(plansPage.match(/Make this plan with a qualified clinician\./g)?.length).toBeGreaterThanOrEqual(2);
    expect(plansPage).toContain('href="/resources"');
    expect(plansPage).toContain('never contacts anyone for you');
  });

  it('owner-scopes reads and uses transactional RPCs for every save', () => {
    expect(plansPage.match(/\.eq\('user_id', ownerId\)/g)?.length).toBeGreaterThanOrEqual(6);
    expect(plansPage).toContain("supabase.rpc('save_activity_plan'");
    expect(plansPage).toContain("supabase.rpc('save_safety_plan'");
    expect(plansPage).toContain("supabase.rpc('save_staying_well_plan'");
    expect(plansPage).toContain('ownerGenerationRef.current === ownerGeneration');
    expect(plansPage).toContain('await reconcileAfterSave(ownerId, ownerGeneration)');

    for (const table of [
      'activity_plans',
      'activity_plan_steps',
      'safety_plans',
      'safety_plan_items',
      'staying_well_plans',
      'staying_well_plan_items',
    ]) {
      expect(plansPage).not.toMatch(
        new RegExp(
          `\\.from\\('${table}'\\)[\\s\\S]{0,500}\\.(insert|update|delete)\\(`
        )
      );
    }
  });

  it('selects active safety plans before newer drafts', () => {
    for (const table of ['safety_plans', 'staying_well_plans']) {
      const queryStart = plansPage.indexOf(`.from('${table}')`);
      const queryEnd = plansPage.indexOf('.maybeSingle()', queryStart);
      const query = plansPage.slice(queryStart, queryEnd);

      expect(queryStart).toBeGreaterThanOrEqual(0);
      expect(query).toContain(".in('status', ['draft', 'active'])");
      expect(query.indexOf(".order('status', { ascending: true })")).toBeLessThan(
        query.indexOf(".order('updated_at', { ascending: false })")
      );
    }
  });

  it('passes the storage bounds into both plan-item editors', () => {
    expect(plansPage).toContain(
      'maxDetailsLength={MAX_SAFETY_ITEM_DETAILS}'
    );
    expect(plansPage).toContain(
      'maxDetailsLength={MAX_STAYING_WELL_ITEM_DETAILS}'
    );
    expect(plansPage).toContain(
      'item.position > MAX_PLAN_ITEM_POSITION'
    );
  });

  it('does not connect plan content to AI or partner data paths', () => {
    expect(plansPage).not.toContain("from('partner_links')");
    expect(plansPage).not.toContain("from('chat_history')");
    expect(plansPage).not.toContain("fetch('/api");
  });
});
