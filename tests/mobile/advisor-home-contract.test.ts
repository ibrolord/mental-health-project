import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

const read = (file: string) => readFileSync(path.resolve(process.cwd(), file), 'utf8');
const home = read('mobile/app/(tabs)/index.tsx');
const card = read('mobile/components/AdvisorHomeCard.tsx');
const tabs = read('mobile/app/(tabs)/_layout.tsx');
const advisor = read('mobile/app/(tabs)/advisor.tsx');
const dashboardLayout = read('mobile/lib/dashboard-layout.ts');
const todayAdvisor = read('mobile/lib/today-advisor.ts');
const settings = read('mobile/app/settings.tsx');

function todayRefreshHarness() {
  const source = ts.createSourceFile('index.tsx', home, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let effect: ts.Expression | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect' &&
      node.arguments[0]?.getText(source).includes('refreshToolCompletions')) effect = node.arguments[0];
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!effect) throw new Error('Today refresh effect is missing');
  const loaded = { action: null, recommendation: { id: 'next-step' } };
  const deps = {
    ownerKey: 'user_id:a', ownerKeyRef: { current: 'user_id:a' }, profileReady: true,
    queryColumn: 'user_id', queryValue: 'a', user: { id: 'a' },
    setTodayAdvisor: vi.fn(), setToolCompletion: vi.fn(), setAdvisorOwnerKey: vi.fn(),
    setAdvisorError: vi.fn(), setAdvisorLoading: vi.fn(),
    refreshToolCompletions: vi.fn<() => Promise<{ completion: { kind: string } | null }>>()
      .mockResolvedValue({ completion: { kind: 'grounding' } }),
    loadTodayAdvisor: vi.fn().mockResolvedValue(loaded),
  };
  const compiled = ts.transpileModule(`const effect = ${effect.getText(source)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const run = new Function(...Object.keys(deps), `${compiled}; return effect;`)(...Object.values(deps)) as () => (() => void);
  return { ...deps, loaded, run };
}

const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

describe('mobile Advisor Home contracts', () => {
  it('keeps Today to greeting, mood, one Advisor doorway, and a compact customizable day', () => {
    expect(home.match(/<AdvisorHomeCard\b/g)).toHaveLength(1);
    expect(home).toContain('<BotanicalHero');
    expect(home).toContain('style={styles.hero}');
    expect(home).not.toContain('<LeafMark');
    expect(home).toContain('<MoodPicker');
    expect(home).toContain('<RowGroup>');
    expect(home).toContain('Customize your Today page');
    expect(dashboardLayout).toMatch(/mixed:[\s\S]*?'accountability'/);

    const greeting = home.indexOf('{todayGreeting(now.getHours(), advisorProfile.preferredName)}');
    const mood = home.indexOf('styles.moodSection');
    const advisor = home.indexOf('<AdvisorHomeCard');
    const yourDay = home.indexOf('title="Your day"');
    expect(greeting).toBeGreaterThan(-1);
    expect(mood).toBeGreaterThan(greeting);
    expect(advisor).toBeGreaterThan(mood);
    expect(yourDay).toBeGreaterThan(advisor);
  });

  it('uses the shared recommendation engine and lifecycle without a new model request on Today', () => {
    expect(card).toContain('YOUR ADVISOR');
    expect(card).toContain('Open Advisor');
    expect(home).toContain('loadTodayAdvisor({');
    expect(home).toContain('startAdvisorStep(expectedOwner');
    expect(todayAdvisor).toContain('selectAdvisorRecommendation(context, outcomes, selectionOptions)');
    expect(todayAdvisor).toContain('advisorLoopSelectionOptions(outcomes, context.nowIso)');
    expect(todayAdvisor).not.toContain('requestModelAdvisorRecommendation');
    expect(todayAdvisor).not.toMatch(/completeAdvisorLifecycle|reconcileAdvisorLifecycle|recordAdvisorOffered|cancelAdvisorReminder/);
    expect(home).toContain('!visibleAdvisor.targetCompleted');
    expect(home).toContain('refreshToolCompletions(expectedOwnerKey)');
    expect(home).toContain('completionLabel={visibleToolCompletion');
    expect(home).toContain('currentAction={visibleAdvisorActionText}');
    expect(home).toContain('actionStatus={visibleAdvisorAction?.status ?? null}');
    expect(card).toContain("actionStatus === 'accepted'");
    expect(card).toContain("actionStatus === 'needs_recovery'");
    expect(home).toContain("router.navigate('/advisor')");
    expect(home).not.toMatch(/selectAdvisorRecommendation|recordAdvisorOffered|markAdvisorStarted/);
    expect(home).not.toMatch(/answerAdvisorHelpfulness|advisor-observation-ledger/);
    expect(card).not.toContain('AdvisorRecommendation');
    expect(card).not.toContain('Try something else');
    expect(card).not.toContain('Why this?');
    expect(card).not.toContain('Was this suggestion useful?');
  });

  it('gives Advisor a first-class tab and keeps chat available from Advisor only', () => {
    expect(tabs).toContain('name="advisor"');
    expect(tabs).toContain("title: 'Advisor'");
    expect(tabs).toContain('<Feather name="compass"');
    expect(tabs).toMatch(/name="chat"[\s\S]*?href: null/);
    expect(advisor).toContain('export default function AdvisorScreen()');
    expect(advisor).toContain('<BotanicalHero style={styles.hero}>');
    expect(advisor).not.toContain('<LeafMark');
  });

  it('keeps low-energy mode calm and owner-bound', () => {
    expect(home).toContain('lowEnergyOwnerKey === ownerKey && lowEnergyMode');
    expect(home).toContain('lowEnergy={visibleLowEnergyMode}');
    expect(home).toContain("? 'Ask someone you trust to check in.'");
    expect(home).toContain('setLowEnergyOwnerKey(expectedOwnerKey)');
  });

  it('surfaces safety support without duplicating the recommendation ledger', () => {
    expect(todayAdvisor).toContain("recommendation.kind === 'safety'");
    expect(home).toContain('visibleAdvisorSafety');
    expect(home).toContain('may need support beyond Advisor');
    expect(home).toContain('Find immediate and local support');
    expect(home).toContain('ownerKey && advisorOwnerKey === ownerKey ? todayAdvisor : null');
    expect(home).toContain('visibleAdvisor && !visibleAdvisorSafety && !visibleAdvisorAction');
    expect(home).toContain("visibleModuleIds.includes('advisor') && !visibleAdvisorSafety");
    expect(home).not.toMatch(/recordAdvisorOffered|markAdvisorStarted/);
  });

  it('preserves owner isolation and safe mood saving', () => {
    expect(home).toContain('const ownerKeyRef = useRef(ownerKey)');
    expect(home).toContain('moodOwnerKey === ownerKey ? todayMood : null');
    expect(home).toContain('ownerKeyRef.current !== expectedOwnerKey');
    expect(home).toContain('saveCheckInWithAttribution(expectedUserId, {');
  });

  it('adapts decorative art at large text sizes and labels every custom control', () => {
    expect(card).toContain('fontScale < LARGE_TEXT_SCALE');
    expect(card).toContain('accessible={false}');
    expect(card).toContain('style={styles.artwork}');
    expect(card).toContain('minHeight: 44');
    expect(card).toContain("'Continue my step' : 'Start my step'");
    expect(home).toContain('accessibilityLabel="Add context to this check-in"');
  });

  it('offers optional setup without changing saved layouts or requesting permissions', () => {
    expect(home).toContain('shouldOfferAdvisorSetup(advisorProfile, ownerKey)');
    expect(home).toContain("mode: 'welcome', returnTo: 'today'");
    expect(home).toContain('!visibleAdvisor || visibleAdvisorSafety');
    expect(card).toContain('Explore for now');
    expect(home).not.toMatch(/requestPermissions|ensureAiDataSharingConsent|dashboardLayoutStorage.write/);
  });

  it('never takes the Advisor interaction lock while skipping setup', () => {
    const skip = home.slice(home.indexOf('const skipSetup ='), home.indexOf('\n  return (', home.indexOf('const skipSetup =')));
    expect(skip).toContain('dismissAdvisorWelcomeForSession(ownerKey)');
    expect(skip).toContain('void saveProfile(');
    expect(skip).not.toContain('await');
    expect(skip).not.toContain('setAdvisorBusy(');
    expect(skip).not.toContain('advisorBusyRef.current =');
  });

  it('retains both local export datasets and rechecks the owner before writing or sharing', () => {
    const exportBody = settings.slice(settings.indexOf('const handleExport ='), settings.indexOf('const handleDeleteAll ='));
    expect(exportBody).toContain('localAdvisorProfile: advisorProfile');
    expect(exportBody).toContain('local_tool_completions: localToolCompletions');
    expect(exportBody).toMatch(/loadToolCompletions[\s\S]*await captureOwnerSession\(expectedOwnerId\)[\s\S]*FileSystem.writeAsStringAsync/);
    expect(exportBody).toMatch(/await captureOwnerSession\(expectedOwnerId\);\s*await Sharing.shareAsync/);
    expect(settings).toContain('withToolCompletionDataDeletion(`user_id:${expectedOwnerId}`');
    expect(settings).toContain('advisorProfileStorage.clear(consentSubjectId)');
  });

  it('refreshes completion and pending sync before reading the next personal step', async () => {
    const harness = todayRefreshHarness();
    let finish!: (value: { completion: { kind: string } }) => void;
    harness.refreshToolCompletions.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    harness.run();
    expect(harness.refreshToolCompletions).toHaveBeenCalledWith('user_id:a');
    expect(harness.loadTodayAdvisor).not.toHaveBeenCalled();
    finish({ completion: { kind: 'grounding' } });
    await settle();
    expect(harness.loadTodayAdvisor).toHaveBeenCalledWith({
      ownerKey: 'user_id:a', queryColumn: 'user_id', queryValue: 'a', userId: 'a',
    });
    expect(harness.setTodayAdvisor).toHaveBeenLastCalledWith(harness.loaded);
    expect(harness.setToolCompletion).toHaveBeenLastCalledWith({ kind: 'grounding' });
    expect(harness.setAdvisorOwnerKey).toHaveBeenLastCalledWith('user_id:a');
    expect(harness.setAdvisorLoading).toHaveBeenLastCalledWith(false);
  });

  it('still reads the personal step if completion refresh fails and settles if both reads fail', async () => {
    const harness = todayRefreshHarness();
    harness.refreshToolCompletions.mockRejectedValue(new Error('offline'));
    harness.run();
    await settle();
    expect(harness.setTodayAdvisor).toHaveBeenLastCalledWith(harness.loaded);
    expect(harness.setToolCompletion).toHaveBeenLastCalledWith(null);
    harness.loadTodayAdvisor.mockRejectedValue(new Error('unavailable'));
    harness.run();
    await settle();
    expect(harness.setAdvisorOwnerKey).toHaveBeenLastCalledWith(null);
    expect(harness.setAdvisorError).toHaveBeenLastCalledWith(expect.stringContaining('could not load'));
    expect(harness.setAdvisorLoading).toHaveBeenLastCalledWith(false);
  });

  it.each(['owner-change', 'cleanup'] as const)('ignores stale completion refresh after %s', async (reason) => {
    const harness = todayRefreshHarness();
    let finish!: (value: { completion: { kind: string } }) => void;
    harness.refreshToolCompletions.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const cleanup = harness.run();
    if (reason === 'owner-change') harness.ownerKeyRef.current = 'user_id:b';
    else cleanup();
    finish({ completion: { kind: 'grounding' } });
    await settle();
    expect(harness.loadTodayAdvisor).not.toHaveBeenCalled();
    expect(harness.setToolCompletion).toHaveBeenCalledExactlyOnceWith(null);
    expect(harness.setAdvisorOwnerKey).toHaveBeenCalledExactlyOnceWith(null);
  });

  it('ignores the personal read when the owner changes after completion refresh', async () => {
    const harness = todayRefreshHarness();
    let finish!: (value: unknown) => void;
    harness.loadTodayAdvisor.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    harness.run();
    await settle();
    harness.ownerKeyRef.current = 'user_id:b';
    finish(harness.loaded);
    await settle();
    expect(harness.setTodayAdvisor).toHaveBeenCalledExactlyOnceWith(null);
    expect(harness.setToolCompletion).toHaveBeenCalledExactlyOnceWith(null);
    expect(harness.setAdvisorOwnerKey).toHaveBeenCalledExactlyOnceWith(null);
  });
});
