import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const home = readFileSync(
  path.resolve(process.cwd(), 'mobile/app/(tabs)/index.tsx'),
  'utf8'
);
const card = readFileSync(
  path.resolve(process.cwd(), 'mobile/components/AdvisorHomeCard.tsx'),
  'utf8'
);

describe('mobile Advisor Home contracts', () => {
  it('renders exactly one contextual recommendation card and preserves Home anchors', () => {
    expect(home.match(/<AdvisorHomeCard\b/g)).toHaveLength(1);
    expect(home).toContain('<LeafMark size={34} />');
    expect(home).toContain('title="Together"');
    expect(home).toContain('<MoodPicker');
    expect(card).toContain("require('../assets/today-botanical.png')");
    expect(home).not.toContain('advisorStrip');
    expect(home).not.toContain("eyebrow: 'ADVISOR'");
  });

  it('orders Home as greeting, Advisor, mood, then the Day list led by Together', () => {
    const greeting = home.indexOf('{greetingForHour(now.getHours())}');
    const advisor = home.indexOf('<AdvisorHomeCard');
    const mood = home.indexOf('<View style={s.moodSection}>');
    const day = home.indexOf('<Text style={s.sectionLabel}>YOUR DAY</Text>');
    const together = home.indexOf('title="Together"', day);

    expect(greeting).toBeGreaterThan(-1);
    expect(advisor).toBeGreaterThan(greeting);
    expect(mood).toBeGreaterThan(advisor);
    expect(day).toBeGreaterThan(mood);
    expect(together).toBeGreaterThan(day);
  });

  it('uses compact copy and transparent provenance', () => {
    expect(card).toContain('FOR RIGHT NOW');
    expect(card).toContain('recommendation.resourceLabel');
    expect(card).toContain('Try something else');
    expect(card).toContain('Why this?');
    expect(card).toContain("`Based on ${Array.from(new Set(sourceLabels)).join(' · ')}`");
    expect(card).toContain('General guidance · no personal context used');
    expect(card).toContain('recommendation.observations.slice(0, 3)');
  });

  it('keeps Together prominent without a competing card and hides empty placeholders', () => {
    expect(home).toContain('icon="users"');
    expect(home).toContain('title="Together"');
    expect(home).not.toContain('s.togetherCard');
    expect(home).not.toContain('togetherCard:');
    expect(home).toContain('{visibleResumeProgress ? (');
    expect(home).toContain('{visibleSavedItem ? (');
    expect(home).toContain('{checkInDays > 0 ? (');
    expect(home).not.toContain('Morning reset');
    expect(home).not.toContain('Choose today’s priority');
    expect(home).not.toContain('ACCOUNTABILITY PARTNER');
  });

  it('renders at most one ledger-approved notable change line', () => {
    expect(card).toContain('showChangeSignal && recommendation.changeSignal?.severity');
    expect(card).toContain("=== 'notable'");
    expect(card.match(/recommendation\.changeSignal\.line/g)).toHaveLength(1);
    expect(home).toContain("from '@/lib/advisor-observation-ledger'");
    expect(home.match(/evaluateAdvisorChangeSignals\(/g)).toHaveLength(1);
    expect(home).toContain('getAdvisorChangeSignals(context, outcomes)');
    expect(home).toContain('nextRecommendation.changeSignal?.id ?? null');
    expect(home).toContain('context.nowIso');
  });

  it('records start before navigation and refreshes on focus and mood save', () => {
    const start = home.slice(
      home.indexOf('const startAdvisorRecommendation'),
      home.indexOf('const answerAdvisorPrompt')
    );
    expect(start.indexOf('await markAdvisorStarted')).toBeGreaterThan(-1);
    expect(start.indexOf('router.push')).toBeGreaterThan(start.indexOf('await markAdvisorStarted'));
    expect(home).toContain('useFocusEffect');
    expect(home).toContain('advisorRequestRef');
    expect(home).toContain('ownerKeyRef.current !== expectedOwnerKey');
    expect(home).toContain('setAdvisorRefreshKey');
  });

  it('never renders or acts on Advisor state loaded for another owner', () => {
    expect(home).toContain('advisorStateOwnerKey === ownerKey');
    expect(home).toContain('visibleAdvisorRecommendation');
    expect(home).toContain('advisorStateOwnerKey !== expectedOwnerKey');
    expect(home).toContain('advisorChangeSignalVisibility?.ownerKey === ownerKey');
    expect(home).toContain(
      'advisorChangeSignalVisibility.signalId === recommendation.changeSignal?.id'
    );
    expect(home).toContain(
      'advisorChangeSignalVisibility.recommendationId === recommendation.id'
    );
  });

  it('keeps a ledger-approved signal visible across same-day focus reloads', () => {
    expect(home).toContain('keepAdvisorChangeSignalVisible(');
    expect(home).toContain('current?.ownerKey === expectedOwnerKey && current.visible');
    expect(home).toContain('current?.ownerKey === expectedOwnerKey ? current.signalId : null');
  });

  it('restores the newest pending prompt and refreshes after explicit feedback', () => {
    expect(card).toContain('Was this suggestion useful?');
    expect(card).toContain('Yes');
    expect(card).toContain('Not for me');
    expect(card).toContain('Skip');
    expect(home).toContain('answerAdvisorHelpfulness');
    expect(home).toContain('outcome.startedAt && !outcome.feedbackAt');
    expect(home).toContain('pendingFeedback?.recommendationId');
    expect(home).toContain('pendingFeedback?.shownSignalId');
    expect(home).toContain('{ ...pendingFeedback, offeredAt: context.nowIso }');
    expect(home).toContain('feedbackRecommendationId');
    expect(home).toContain('advisorReselectionRef.current = {');
    expect(home).toContain('preserveToday: false');
    expect(home).toContain(
      'forcedReselection.recommendationId'
    );
    expect(home).toContain('setPendingCompletion(null)');
    expect(home).toContain('if (shouldRefresh) setAdvisorRefreshKey');
  });

  it('suppresses the displayed signal after Not for me and announces feedback', () => {
    expect(home).toContain('const displayedSignalId = pendingFeedbackSignalId');
    expect(home).toContain('helpful === false && displayedSignalId');
    expect(home).toContain(
      'suppressAdvisorChangeSignal(expectedOwnerKey, displayedSignalId)'
    );
    expect(home).toContain('AccessibilityInfo.announceForAccessibility');
    expect(home).toContain('Feedback saved. Advisor is refreshing your action.');
  });

  it('keeps Home to one action and preserves observations when trying another', () => {
    const start = home.indexOf('const tryAnotherAdvisorRecommendation');
    const tryAnother = home.slice(
      start,
      home.indexOf('\n  return (', start)
    );
    expect(card).not.toContain('Share with Together');
    expect(card).not.toContain('onShare');
    expect(tryAnother).toContain('observations: recommendation.observations');
    expect(tryAnother).toContain('changeSignal: recommendation.changeSignal');
    expect(tryAnother).toContain("candidateFamily: recommendation.id.split(':')[0]");
    expect(tryAnother).toContain('...recommendation.sourceLabels');
    expect(tryAnother).toContain('...selectedRecommendation.sourceLabels');
    expect(tryAnother).not.toContain('evaluateAdvisorChangeSignals');
  });

  it('keeps every custom control at least 44pt and labelled for VoiceOver', () => {
    expect(card.match(/minHeight: 44/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(card).toContain('accessibilityLabel');
    expect(card).toContain('accessibilityState');
    expect(card).toContain('flexWrap');
    expect(home).toContain('previous.action !== recommendation.action');
    expect(home).toContain('Advisor action changed.');
    expect(home).toContain('Advisor noticed.');
    expect(home).toContain('Advisor is asking whether the last suggestion was useful.');
    expect(home).toContain('shownSignalId');
  });
});
