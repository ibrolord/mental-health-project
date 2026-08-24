import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const advisor = readFileSync(
  path.resolve(process.cwd(), 'mobile/app/(tabs)/advisor.tsx'),
  'utf8'
);
const advisorContext = readFileSync(
  path.resolve(process.cwd(), 'mobile/lib/advisor-context.ts'),
  'utf8'
);
const advisorTrend = readFileSync(
  path.resolve(process.cwd(), 'mobile/components/AdvisorTrendCard.tsx'),
  'utf8'
);

describe('mobile Advisor detail and context contracts', () => {
  it('keeps Advisor as a dedicated guidance and local-history surface', () => {
    expect(advisor).toContain('title="Advisor"');
    expect(advisor).toContain('One clear brief. One current step. Support that follows through.');
    expect(advisor).not.toContain('WHAT I’M SEEING');
    expect(advisor).not.toContain('ONE THING TO DO');
    expect(advisor).toContain('activeObservations.slice(0, 3)');
    expect(advisor).toContain('activeObservations.length ? (');
    expect(advisor).toContain('Start');
    expect(advisor).toContain('Continue');
    expect(advisor).toContain("? 'PLANNED STEP'");
    expect(advisor).toContain("currentAdvisorAction?.status === 'accepted'");
    expect(advisor).toContain("currentAdvisorAction?.status === 'in_progress'");
    const startFlow = advisor.slice(
      advisor.indexOf('const startRecommendation'),
      advisor.indexOf('const generateAnotherRecommendation')
    );
    expect(startFlow).toContain("advisorFollowUpState(actionToStart, new Date()) === 'planned_due'");
    expect(startFlow).toContain('setAdvisorActionFollowUp(');
    expect(advisor).toContain("label: 'Done'");
    expect(advisor).toContain("label: 'Remind me'");
    expect(advisor).toContain('Make it smaller');
    expect(advisor).toContain('Try something else');
    expect(advisor).toContain('Share with Together');
    expect(advisor).toContain('Talk this through');
    expect(advisor).toContain('Did your last step help?');
    expect(advisor).toContain('answerAdvisorHelpfulness');
    expect(advisor).toContain('const pendingFeedback = outcomes');
    expect(advisor).toContain('.filter((outcome) => outcome.completedAt && !outcome.feedbackAt)');
    expect(advisor).toContain('title="Recent steps"');
    expect(advisor).toContain('const [detailsOpen, setDetailsOpen] = useState(false);');
    expect(advisor).toContain('const [historyOpen, setHistoryOpen] = useState(false);');
    expect(advisor).toContain('loadAdvisorOutcomes');
    expect(advisor).toContain('loadAdvisorAction(expectedOwner)');
    expect(advisor).toContain('acceptAdvisorAction(expectedOwner');
    expect(advisor).toContain('reconcileAdvisorLifecycle(expectedOwner)');
    expect(advisor).toContain('startAdvisorLifecycle(expectedOwner, actionToStart)');
    expect(advisor).toContain('completeAdvisorLifecycle(expectedOwner, completed)');
    expect(advisor).toContain('recoverAdvisorLifecycle(');
    expect(advisor).toContain('replaceAdvisorLifecycle(expectedOwner, actionToReplace)');
    expect(advisor).toContain('pendingFeedback.actionId ?? pendingFeedback.recommendationId');
    expect(advisor).toContain('recordAdvisorOffered(expectedOwner, currentRecommendation)');
    expect(advisor).toContain('stateOwnerKey === ownerKey');
    expect(advisor).toContain('stateOwnerKey !== ownerKey');
    expect(advisor).toContain('createAdvisorTrendSummary(context)');
    expect(advisor).toContain('<AdvisorTrendCard');
    expect(advisor).toContain("params: { from: 'advisor' }");
  });

  it('makes action progress visibly gamified, explainable, and non-clinical', () => {
    expect(advisorTrend).toContain('YOUR MOMENTUM');
    expect(advisorTrend).toContain('TOTAL XP');
    expect(advisorTrend).toContain('Progress to Level');
    expect(advisorTrend).toContain('XP unlocked');
    expect(advisorTrend).toContain('Latest complete week');
    expect(advisorTrend).toContain('Actions and reflection, kept separate');
    expect(advisorTrend).toContain('Body signals');
    expect(advisorTrend).toContain('Compared with your personal baseline');
    expect(advisorTrend).toContain('CONTEXT');
    expect(advisorTrend).toContain('accessibilityState={{ expanded: detailsOpen }}');
    expect(advisorTrend).toContain('Saved habit check-offs earn XP.');
    expect(advisorTrend).toContain('Check-ins, feelings, sleep, and movement never raise or lower your level.');
    expect(advisorTrend).toContain("trend.momentum.availability === 'available'");
    expect(advisorTrend).toContain('Your saved activity is unchanged. Try again later.');
    expect(advisorTrend).toContain("return 'trending-down'");
    expect(advisorTrend).toContain('MILESTONE_SIZE / SEGMENT_SIZE');
    expect(advisorTrend).not.toContain('FASTEST NEXT MOVE');
    expect(advisorTrend).not.toContain('onOpenCheckIn');
    expect(advisorTrend).not.toContain('onOpenHabits');
    expect(advisorTrend).toContain('Open AI support');
    expect(advisorTrend).toContain('Ask Advisor about these signals');
    expect(advisorTrend).toContain('baselineState(area)');
    expect(advisorTrend).toContain("if (area.level === 'similar') return 'Typical for you';");
    expect(advisorTrend).toContain('styles.baselineMark');
    expect(advisorTrend).toContain('styles.currentMark');
    expect(advisorTrend).toContain('accessibilityValue={{');
    expect(advisorTrend).not.toContain('of 3 sources');
    expect(advisorTrend).not.toContain('Worth a reset');
    expect(advisorTrend).not.toMatch(/diagnos|treatment|risk score|mental health score|wellbeing score/i);
    expect(advisor.indexOf('<AdvisorTrendCard')).toBeGreaterThan(
      advisor.indexOf('<AppCard style={styles.currentCard}')
    );
    expect(advisor.match(/FASTEST NEXT MOVE/g)).toBeNull();
  });

  it('uses one filled action and demotes fallbacks into text actions', () => {
    expect(advisor.match(/<AppButton\b/g)).toHaveLength(2);
    expect(advisor).toContain('!loading && error ? (');
    expect(advisor).toContain('<ActionRow');
    expect(advisor).toContain('styles.smallerStep');
    expect(advisor).toContain('recommendation.smallerAction');
    expect(advisor).not.toContain('variant="secondary"');
    expect(advisor).not.toContain('variant="quiet"');
  });

  it('shows provenance and a calm no-history state', () => {
    expect(advisor).toContain("`Based on ${Array.from(");
    expect(advisor).toContain('This step is general guidance');
    expect(advisor).toContain('This step uses your Advisor preferences');
    expect(advisor).toContain('No personal pattern was used for this suggestion.');
    expect(advisor).toContain('Start a step and it will show up here.');
    expect(advisor).not.toContain('Personal guidance, not a clinical assessment.');
    expect(advisor).toContain('visibleOutcomes');
  });

  it('rotates cached safe candidates without another paid model call', () => {
    const tryAnother = advisor.slice(
      advisor.indexOf('const generateAnotherRecommendation'),
      advisor.indexOf('const answerHelpfulness')
    );
    expect(tryAnother).toContain('selectAdvisorRecommendation(');
    expect(tryAnother).toContain('brief: deterministicBrief(context, selected, null)');
    expect(tryAnother).toContain('const nextBrief = generated.brief;');
    expect(tryAnother).toContain('setAdvisorModel(null);');
    expect(tryAnother).toContain(
      "candidateFamily: currentRecommendation.id.split(':')[0]"
    );
    expect(tryAnother).toContain('preserveToday: false');
    expect(tryAnother).not.toContain('selectModelBackedRecommendation(');
    expect(advisor).toContain("from '@/lib/advisor-observation-ledger'");
    expect(advisor).toContain('evaluateAdvisorChangeSignals(');
    expect(tryAnother).toContain('Change your current step?');
    expect(tryAnother).toContain(
      'Your current step stays until the replacement is ready.'
    );
    expect(tryAnother).toContain('replaceAdvisorLifecycle(expectedOwner, actionToReplace)');
    expect(tryAnother.indexOf('const nextRecommendation')).toBeLessThan(
      tryAnother.indexOf('replaceAdvisorLifecycle(expectedOwner, actionToReplace)')
    );
  });

  it('uses a consented model request and shares Apple Health only after confirmation', () => {
    expect(advisor).toContain('ensureAiDataSharingConsent(ownerKey)');
    expect(advisor).toContain(': { ...context, health: null };');
    expect(advisor).toContain(
      "process.env.EXPO_PUBLIC_HEALTH_AI_ENABLED === 'true'"
    );
    expect(advisor).toContain('!APPLE_HEALTH_AI_ENABLED ||');
    expect(advisor).toContain('confirmAppleHealthAiShare(summary)');
    expect(advisor).toContain('appleHealthSummary\n    );');
    expect(advisor).toContain('createAdvisorCandidateSet(');
    expect(advisor).toContain('requestModelAdvisorRecommendation(');
    expect(advisor).toContain("advisorModel === 'gemini' ? 'Gemini-guided · '");
    expect(advisor).toContain("advisorModel === 'claude' ? 'Claude-guided · '");
    const healthRefresh = advisor.slice(
      advisor.indexOf('const refreshWithAppleHealth'),
      advisor.indexOf('\n  return (', advisor.indexOf('const refreshWithAppleHealth'))
    );
    expect(healthRefresh).toContain('activeAdvisorAction ||');
    expect(advisor).toContain(
      'APPLE_HEALTH_AI_ENABLED &&\n              context?.profile?.completedAt &&\n              !activeAdvisorAction &&'
    );
    expect(healthRefresh.indexOf('ensureAiDataSharingConsent(expectedOwner)')).toBeLessThan(
      healthRefresh.indexOf('confirmAppleHealthAiShare(summary)')
    );
    expect(healthRefresh.indexOf('confirmAppleHealthAiShare(summary)')).toBeLessThan(
      healthRefresh.indexOf('selectModelBackedRecommendation(')
    );
    expect(advisor).toContain(
      'weeklyReview.started + weeklyReview.completed + weeklyReview.partial + weeklyReview.skipped > 0'
    );
  });

  it('finishes personalization before consent, model calls, or brief caching', () => {
    const start = advisor.indexOf('const localDate =');
    const loadFlow = advisor.slice(start, advisor.indexOf('.catch(() => {', start));
    expect(loadFlow).toContain('if (!context.profile?.completedAt) {');
    expect(loadFlow).toContain("router.push('/advisor-setup' as never)");
    expect(loadFlow.indexOf('if (!context.profile?.completedAt) {')).toBeLessThan(
      loadFlow.indexOf('const fingerprint =')
    );
    expect(loadFlow.indexOf('if (!context.profile?.completedAt) {')).toBeLessThan(
      loadFlow.indexOf('selectModelBackedRecommendation(')
    );
    expect(loadFlow.indexOf("router.push('/advisor-setup' as never)")).toBeLessThan(
      loadFlow.indexOf('selectModelBackedRecommendation(')
    );
  });

  it('caches a generated brief against the post-offer context and reuses cached briefs', () => {
    const start = advisor.indexOf('const fingerprint =');
    const loadFlow = advisor.slice(start, advisor.indexOf('.catch(() => {', start));
    expect(loadFlow).toContain('if (!cached) {');
    expect(loadFlow.indexOf('recordAdvisorOffered(expectedOwner')).toBeLessThan(
      loadFlow.indexOf('updatedOutcomes = await loadAdvisorOutcomes(expectedOwner)')
    );
    expect(
      loadFlow.indexOf('updatedOutcomes = await loadAdvisorOutcomes(expectedOwner)')
    ).toBeLessThan(
      loadFlow.indexOf('fingerprint: createAdvisorBriefFingerprint(')
    );
    expect(loadFlow.indexOf('if (!cached) {')).toBeLessThan(
      loadFlow.indexOf('recordAdvisorOffered(expectedOwner')
    );
  });

  it('shares exactly the selected action with Together and no observations', () => {
    const start = advisor.indexOf('const shareWithTogether');
    const share = advisor.slice(
      start,
      advisor.indexOf('\n  return (', start)
    );
    expect(share).toContain("pathname: '/accountability/create'");
    expect(share).toContain(
      "params: { title: activeAction, source: 'advisor' }"
    );
    expect(share).not.toMatch(/observations?|changeSignal|smallerAction/);
    expect(share.match(/params:\s*\{[^}]+\}/g)).toEqual([
      "params: { title: activeAction, source: 'advisor' }",
      "params: { returnTo: '/accountability' }",
    ]);
  });

  it('announces action changes for VoiceOver', () => {
    expect(advisor).toContain('AccessibilityInfo.announceForAccessibility');
    expect(advisor).toContain('previous.action !== activeAction');
    expect(advisor).toContain('Advisor action changed.');
  });

  it('keeps reminders explicit and user-controlled', () => {
    expect(advisor).not.toContain('<Switch');
    expect(advisor).not.toContain("type Phase = 'choose' | 'preview' | 'result'");
    expect(advisor).not.toContain('Review my context');
    expect(advisor).not.toContain('Review what Advisor will use');
    expect(advisor).not.toContain('Remind me in 2 hours');
    expect(advisor).toContain('createAdvisorReminderChoices(new Date())');
    expect(advisor).toContain('scheduleAdvisorActionReminder({');
    expect(advisor).toContain('date: choice.date');
    expect(advisor).toContain('Enable notifications and Advisor check-ins in Settings first.');
    expect(advisor).toContain('How did it go?');
    expect(advisor).toContain("recordIncompleteAction('partial')");
    expect(advisor).toContain('What got in the way?');
    expect(advisor).toContain('RESET, DON’T RESTART');
  });

  it('keeps safety actions available for safety recommendations', () => {
    expect(advisor).toContain("recommendation.kind === 'safety'");
    expect(advisor).toContain('Find support');
    expect(advisor).toContain("router.push('/resources')");
    expect(advisor).toContain('Talk this through');
  });

  it('loads only the allowed ambient context fields', () => {
    expect(advisorContext).toContain("select('emoji, local_date, created_at')");
    expect(advisorContext).toContain("select('id, content, due_at')");
    expect(advisorContext).toContain(
      "select('id, name, tiny_step, routine_slot, streak_count')"
    );
    expect(advisorContext).toContain("select('local_date, created_at')");
    expect(advisorContext).toContain("select('id, created_at, frequency')");
    expect(advisorContext).toContain("select('habit_id, log_date, completed')");
    expect(advisorContext).toContain(".from('advisor_momentum_events')");
    expect(advisorContext).toContain(".select('id', { count: 'exact', head: true })");
    expect(advisorContext).toContain(".select('earned_on')");
    expect(advisorContext).toContain(".eq('user_id', owner.userId)");
    expect(advisorContext).toContain("ledgerError.code === 'PGRST205'");
    expect(advisorContext).toContain(".from('habit_logs')");
    expect(advisorContext).toContain(".eq('completed', true)");
    expect(advisorContext).toContain('fallbackTotal.count');
    expect(advisorContext).toContain('appleHealthPreference.read');
    expect(advisorContext).toContain('loadAppleHealthSnapshot');
    expect(advisorContext).not.toMatch(/journal|assessment|questionnaire|mood_notes|chat_history/i);
  });

  it('fails each ambient source independently and returns a generic context', () => {
    expect(advisorContext).toContain('Promise.allSettled');
    expect(advisorContext).toContain('mood: moodResult.status ===');
    expect(advisorContext).toContain('goals: goalResult.status ===');
    expect(advisorContext).toContain('habits: habitResult.status ===');
    expect(advisorContext).toContain('health: healthResult.status ===');
    expect(advisorContext).toContain('habitTrendResult.status ===');
    expect(advisorContext).toContain('checkInTrendResult.status ===');
    expect(advisorContext).toContain('momentumResult.status ===');
    expect(advisorContext).toContain('momentumProgress:');
    expect(advisorContext).toContain('createAdvisorContextSnapshot');
  });
});
