import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const screen = readFileSync(
  resolve(process.cwd(), 'mobile/app/plans.tsx'),
  'utf8'
);
const cache = readFileSync(
  resolve(process.cwd(), 'mobile/lib/offline-safety-plan.ts'),
  'utf8'
);
const cacheService = readFileSync(
  resolve(process.cwd(), 'mobile/lib/offline-safety-plan-cache.ts'),
  'utf8'
);
const authContext = readFileSync(
  resolve(process.cwd(), 'mobile/lib/auth-context.tsx'),
  'utf8'
);
const settings = readFileSync(
  resolve(process.cwd(), 'mobile/app/settings.tsx'),
  'utf8'
);
const appUi = readFileSync(
  resolve(process.cwd(), 'mobile/components/AppUI.tsx'),
  'utf8'
);
const transactionalPlans = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260805130000_transactional_wellbeing_plan_saves.sql'
  ),
  'utf8'
);

function sourceBetween(start: string, end: string): string {
  const startIndex = screen.indexOf(start);
  const endIndex = screen.indexOf(end, startIndex);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return screen.slice(startIndex, endIndex);
}

describe('My Plans mobile screen invariants', () => {
  it('uses AppUI and exposes the three requested segments', () => {
    for (const component of [
      'AppButton',
      'AppCard',
      'AppInput',
      'AppScreen',
      'ChoiceChip',
      'EmptyState',
      'PageHeader',
      'SectionHeader',
    ]) {
      expect(screen).toContain(component);
    }
    expect(screen).toContain("label: 'Activity'");
    expect(screen).toContain("label: 'Safety'");
    expect(screen).toContain("label: 'Staying well'");
    expect(screen).toContain("id: 'distraction'");
  });

  it('reads and writes only the owner-scoped plan tables', () => {
    for (const table of [
      'activity_plans',
      'activity_plan_steps',
      'safety_plans',
      'safety_plan_items',
      'staying_well_plans',
      'staying_well_plan_items',
    ]) {
      expect(screen).toContain(`.from('${table}')`);
    }
    expect(
      screen.match(/\.eq\('user_id', ownerId\)/g)?.length
    ).toBeGreaterThanOrEqual(9);
    expect(screen).not.toMatch(/\.from\(['"](?:partner|ai)[^'"]*/i);
    expect(screen).not.toMatch(/@\/lib\/(?:partner|ai)[/'"]/i);
  });

  it('caps activity plans at three ordered steps without streak language', () => {
    expect(screen).toContain('const MAX_ACTIVITY_STEPS = 3');
    expect(screen).not.toContain('.slice(0, MAX_ACTIVITY_STEPS)');
    expect(screen).toContain('activity.steps.length > MAX_ACTIVITY_STEPS');
    expect(screen).toContain('const position = index + 1');
    expect(screen).toContain("useState(['', '', ''])");
    expect(screen).not.toMatch(/streak|guilt/i);
  });

  it('keeps urgent resources reachable during the safety flow', () => {
    expect(screen).toContain('Need urgent help?');
    expect(screen).toContain("router.push('/resources')");
    expect(screen).toContain('Open urgent resources');
    expect(screen).toContain('Build this with a clinician.');
  });

  it('surfaces rejected network saves instead of leaving an unhandled promise', () => {
    expect(screen.match(/Check your connection and try again\./g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('preserves uncertain item-save errors through reconciliation refreshes', () => {
    expect(screen).toContain("const pendingMutationErrorRef = useRef('')");
    expect(screen).toContain(
      "if (!pendingMutationErrorRef.current) setError('')"
    );
    expect(screen).toContain(
      'const pendingMutationError = pendingMutationErrorRef.current'
    );
    expect(screen.match(/pendingMutationErrorRef\.current = message/g)).toHaveLength(2);
  });

  it('uses a read-only secure fallback without unencrypted storage', () => {
    expect(screen).toContain('offlineSafetyPlanCache.read(ownerId)');
    expect(screen).toContain('offlineSafetyPlanCache.write(ownerId, safetyResult.value)');
    expect(screen).toContain(
      'safetyOffline || saving || (!safetyEditor && safetyAtLimit)'
    );
    expect(screen).toContain('Read only. Reconnect before making changes.');
    expect(cacheService).toContain("from 'expo-secure-store'");
    expect(cacheService).toContain('secureStore: SecureStore');
    expect(cache).toContain('offlineSafetyPlanCacheKey(ownerId)');
    expect(cache).not.toMatch(/async-storage|AsyncStorage/);
  });

  it('clears the secure fallback outside the Plans screen on logout and deletion', () => {
    expect(authContext).toContain('offlineSafetyPlanCache.clear(user.id)');
    expect(settings).toContain('offlineSafetyPlanCache.clear(expectedOwnerId)');
  });

  it('clears AI consent, context choices, and reminders after server deletion', () => {
    for (const cleanup of [
      'resetAiDataSharingConsent(consentSubjectId)',
      'clearFullContextPreference(consentSubjectId)',
      'clearContextSelections(consentSubjectId)',
      'setRemindersEnabled(false)',
    ]) {
      expect(settings).toContain(cleanup);
    }
    expect(authContext).toContain('clearFullContextPreference(deletedOwnerKey)');
    expect(authContext).toContain('clearContextSelections(deletedOwnerKey)');
  });

  it('fails closed when sign-out privacy cleanup is incomplete', () => {
    const start = authContext.indexOf('const signOut = async () =>');
    const end = authContext.indexOf('const deleteAccount = async () =>', start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const signOut = authContext.slice(start, end);
    expect(signOut).toContain(
      'const localCleanupComplete = await runDeletedAccountLocalCleanup('
    );
    expect(signOut).toContain('if (!localCleanupComplete)');
    expect(signOut).toContain('await supabase.auth.signOut()');
    expect(signOut).not.toContain('await Promise.all([');
  });

  it('remounts privacy-derived settings after Delete All succeeds', () => {
    expect(settings).toContain('setDataGeneration((current) => current + 1)');
    expect(settings).toContain(
      'key={`visit-brief-${user?.id ?? \'signed-out\'}-${dataGeneration}`}'
    );
    expect(settings).toContain(
      'key={`privacy-activity-${user?.id ?? \'signed-out\'}-${dataGeneration}`}'
    );
  });

  it('deletes the server account before best-effort local cleanup and session clearing', () => {
    const serverDelete = authContext.indexOf(
      "'/api/account/delete'"
    );
    const localCleanup = authContext.indexOf(
      'runDeletedAccountLocalCleanup(',
      serverDelete
    );
    const sessionCleanup = authContext.indexOf(
      'clearDeletedAccountSession('
    );
    expect(serverDelete).toBeGreaterThanOrEqual(0);
    expect(authContext).toContain('{ expectedUserId: deletedOwnerId }');
    expect(authContext).toContain('{ accessToken: current.session.access_token }');
    expect(localCleanup).toBeGreaterThan(serverDelete);
    expect(sessionCleanup).toBeGreaterThan(localCleanup);
  });

  it('keeps active-first then newest selection for safety and staying-well plans', () => {
    expect(
      screen.match(/\.order\('status', \{ ascending: true \}\)/g)
    ).toHaveLength(2);
    expect(
      screen.match(/\.order\('updated_at', \{ ascending: false \}\)/g)
    ).toHaveLength(2);
  });

  it('creates safety and staying-well plans transactionally as drafts', () => {
    expect(screen).not.toContain(".insert({ user_id: ownerId, status: 'draft' })");
    expect(transactionalPlans).toContain(
      "VALUES (v_user_id, btrim(p_title), 'draft')"
    );
  });

  it('saves activity parent and steps through the owner-derived transactional RPC', () => {
    const activitySave = sourceBetween(
      'const saveActivity = async () =>',
      'const updateActivityStatus = async'
    );
    expect(activitySave).toContain("supabase.rpc(\n        'save_activity_plan'");
    expect(activitySave).toContain('p_plan_id: activity?.id ?? null');
    expect(activitySave).toContain('p_steps: steps');
    expect(activitySave).toContain('activity.user_id !== ownerId');
    expect(activitySave).not.toContain(".from('activity_plans')");
    expect(activitySave).not.toContain(".from('activity_plan_steps')");
    expect(transactionalPlans).toContain(
      'CREATE OR REPLACE FUNCTION public.save_activity_plan('
    );
    expect(transactionalPlans).toContain(
      'v_user_id UUID := (SELECT auth.uid())'
    );
    expect(transactionalPlans).toContain(
      'GRANT EXECUTE ON FUNCTION public.save_activity_plan('
    );
  });

  it('owner-scopes activity status changes, step completion, and deletes', () => {
    const statusUpdate = sourceBetween(
      'const updateActivityStatus = async',
      'const toggleActivityStep = async'
    );
    const stepUpdate = sourceBetween(
      'const toggleActivityStep = async',
      'const deleteActivity = async'
    );
    const activityDelete = sourceBetween(
      'const deleteActivity = async',
      'const confirmDeleteActivity ='
    );

    for (const mutation of [statusUpdate, stepUpdate, activityDelete]) {
      expect(mutation).toContain(".eq('user_id', ownerId)");
      expect(mutation).toContain(".select('id')");
      expect(mutation).toContain('.maybeSingle()');
    }
    expect(statusUpdate).toContain(
      "completed_at: status === 'completed' ? new Date().toISOString() : null"
    );
    expect(stepUpdate).toContain('completed: !step.completed');
  });

  it('saves complete item sets through owner-derived transactional RPCs', () => {
    for (const [start, end] of [
      ['const saveSafetyItem = async', 'const deleteSafetyItem = async'],
      ['const saveStayingWellItem = async', 'const deleteStayingWellItem = async'],
    ]) {
      const mutation = sourceBetween(start, end);
      expect(mutation).toContain('p_plan_id: planId');
      expect(mutation).toContain('p_items: nextItems.map');
      expect(mutation).not.toContain(".from('safety_plans')");
      expect(mutation).not.toContain(".from('staying_well_plans')");
    }
    expect(screen).toContain("supabase.rpc('save_safety_plan'");
    expect(screen).toContain("supabase.rpc('save_staying_well_plan'");
  });

  it('owner-scopes item deletes and checks affected rows', () => {
    for (const [start, end] of [
      ['const deleteSafetyItem = async', 'const confirmDeleteSafetyItem ='],
      ['const deleteStayingWellItem = async', 'const confirmDeleteStayingWellItem ='],
    ]) {
      const mutation = sourceBetween(start, end);
      expect(mutation).toContain(".eq('user_id', ownerId)");
      expect(mutation).toContain(".eq('plan_id', planId)");
      expect(mutation).toContain(".select('id')");
      expect(mutation).toContain('.maybeSingle()');
      expect(mutation).toContain('Check your connection and try again.');
    }
  });

  it('requires native destructive confirmation for every delete control', () => {
    expect(screen.match(/Alert\.alert\(/g)).toHaveLength(3);
    expect(screen.match(/style: 'destructive'/g)).toHaveLength(3);
    expect(screen).toContain('onPress={() => confirmDeleteActivity(activity)}');
    expect(screen).toContain('onDelete={confirmDeleteSafetyItem}');
    expect(screen).toContain('onDelete={confirmDeleteStayingWellItem}');
  });

  it('keeps every offline safety-plan mutation path read-only', () => {
    expect(screen).toContain('readOnly={safetyOffline}');
    expect(screen).toContain('if (safetyOffline || saving) return;');
    expect(screen).toContain('saveRef.current || safetyOffline');
    expect(screen.match(/safetyOffline \|\|/g)?.length).toBeGreaterThanOrEqual(3);
    expect(screen).toContain('if (safetyOffline) return;');
  });

  it('surfaces secure offline-copy update failures', () => {
    expect(screen).toContain('offlineCopyUpdateFailed = true');
    expect(screen).toContain(
      'Your safety plan is available online, but its offline copy could not be updated.'
    );
  });

  it('matches native item bounds to the base schema', () => {
    expect(screen).toContain('const MAX_ACTIVITY_DETAILS = 1000');
    expect(screen).toContain('const MAX_PLAN_ITEMS = 6');
    expect(screen).toContain('const MAX_PLAN_ITEM_POSITION = 5');
    expect(screen).toContain('const MAX_SAFETY_ITEM_DETAILS = 1000');
    expect(screen).toContain('position <= MAX_PLAN_ITEM_POSITION');
    expect(screen.match(/nextPlanItemPosition\(/g)).toHaveLength(3);
    expect(screen).toContain('maxLength={MAX_ACTIVITY_DETAILS}');
    expect(screen).toContain('maxLength={MAX_SAFETY_ITEM_DETAILS}');
    expect(screen).toContain('if (items.length >= MAX_PLAN_ITEMS) return null;');
    expect(screen).toContain('(!safetyEditor && safetyAtLimit)');
    expect(screen).toContain('(!wellEditor && stayingWellAtLimit)');
    expect(screen).not.toMatch(/nextPosition > 99/);
  });

  it('uses labelled AppUI controls with 44pt button targets', () => {
    for (const label of [
      'Edit activity:',
      'Delete activity:',
      'Mark complete',
      'Edit ${itemName}:',
      'Delete ${itemName}:',
    ]) {
      expect(screen).toContain(label);
    }
    expect(appUi).toMatch(/button:\s*\{\s*minHeight: 44,/);
  });
});
