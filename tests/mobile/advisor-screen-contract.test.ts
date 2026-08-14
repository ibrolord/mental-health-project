import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const advisor = readFileSync(
  path.resolve(process.cwd(), 'mobile/app/advisor.tsx'),
  'utf8'
);
const advisorContext = readFileSync(
  path.resolve(process.cwd(), 'mobile/lib/advisor-context.ts'),
  'utf8'
);

describe('mobile Advisor detail and context contracts', () => {
  it('keeps Advisor as a detail and local-history surface', () => {
    expect(advisor).toContain('One step for right now');
    expect(advisor).not.toContain('Your Advisor');
    expect(advisor).not.toContain('WHAT I’M SEEING');
    expect(advisor).not.toContain('ONE THING TO DO');
    expect(advisor).toContain('recommendation.observations.slice(0, 3)');
    expect(advisor).toContain('recommendation.observations.length ? (');
    expect(advisor).toContain('Start');
    expect(advisor).toContain('If that feels like too much');
    expect(advisor).toContain('Try something else');
    expect(advisor).toContain('Share with Together');
    expect(advisor).toContain('Talk this through');
    expect(advisor).toContain('Recent outcomes');
    expect(advisor).toContain('loadAdvisorOutcomes');
    expect(advisor).toContain('recordAdvisorOffered(expectedOwner, currentRecommendation)');
    expect(advisor).toContain('stateOwnerKey === ownerKey');
    expect(advisor).toContain('stateOwnerKey !== ownerKey');
  });

  it('uses one filled action and demotes fallbacks into text actions', () => {
    expect(advisor.match(/<AppButton\b/g)).toHaveLength(1);
    expect(advisor).toContain('<ActionRow');
    expect(advisor).toContain('styles.smallerStep');
    expect(advisor).toContain('recommendation.smallerAction');
    expect(advisor).not.toContain('variant="secondary"');
    expect(advisor).not.toContain('variant="quiet"');
  });

  it('shows provenance and a calm no-history state', () => {
    expect(advisor).toContain("`Based on ${Array.from(");
    expect(advisor).toContain('General guidance · no personal context used');
    expect(advisor).toContain('No personal pattern was used for this suggestion.');
    expect(advisor).toContain('Nothing to review yet. Start today’s step and it will appear here.');
  });

  it('keeps observations stable when trying another without touching the Home ledger', () => {
    const tryAnother = advisor.slice(
      advisor.indexOf('const tryAnotherRecommendation'),
      advisor.indexOf('const shareWithTogether')
    );
    expect(tryAnother).toContain('observations: currentRecommendation.observations');
    expect(tryAnother).toContain('changeSignal: currentRecommendation.changeSignal');
    expect(tryAnother).toContain(
      "candidateFamily: currentRecommendation.id.split(':')[0]"
    );
    expect(tryAnother).toContain('...currentRecommendation.sourceLabels');
    expect(tryAnother).toContain('...selectedRecommendation.sourceLabels');
    expect(tryAnother).toContain('preserveToday: false');
    expect(tryAnother).not.toContain('evaluateAdvisorChangeSignal');
    expect(advisor).not.toContain("from '@/lib/advisor-observation-ledger'");
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

  it('removes the source-review and fixed-reminder flow', () => {
    expect(advisor).not.toContain('<Switch');
    expect(advisor).not.toContain("type Phase = 'choose' | 'preview' | 'result'");
    expect(advisor).not.toContain('Review my context');
    expect(advisor).not.toContain('Review what Advisor will use');
    expect(advisor).not.toContain('Remind me in 2 hours');
    expect(advisor).not.toContain('scheduleAdvisorReminder');
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
    expect(advisorContext).toContain("select('id, name, tiny_step')");
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
    expect(advisorContext).toContain('createAdvisorContextSnapshot');
  });
});
