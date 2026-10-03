import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('mobile/app/(tabs)/advisor.tsx', 'utf8');

describe('Advisor loop screen wiring', () => {
  it('uses the focus-owned gate for the full context and completion refresh', () => {
    const flow = source.slice(source.indexOf('const loop = createAdvisorLoopRefresh'), source.indexOf('const currentAdvisorAction ='));
    expect(flow).toContain('loadAmbientAdvisorContext(');
    expect(flow).toContain('loadAdvisorOutcomes(expectedOwner)');
    expect(flow).toContain('refreshToolCompletions(expectedOwner)');
    expect(flow).toContain('let storedAction = completionState.action');
    expect(flow).toContain('checkAdvisorTargetCompletion(');
    expect(flow).toContain("loop.setAppActive(state === 'active')");
    expect(flow).toContain('loop.dispose()');
    expect(flow).not.toContain('setInterval');
  });

  it('keeps foreground AI consent passive and Health summary sharing explicit', () => {
    expect(source).toContain(': await hasAiDataSharingConsent(ownerKey)');
    expect(source).toContain('isCurrent,\n                  allowConsent');
    expect(source).toContain('confirmAppleHealthAiShare(summary)');
    expect(source).toContain(': { ...context, health: null };');
  });

  it('keeps local deferral independent of native scheduling and permissions', () => {
    const defer = source.slice(source.indexOf('const deferInAppCheckIn'), source.indexOf('const answerHelpfulness'));
    expect(defer).toContain('deferAdvisorActionFollowUp(expectedOwner, current.id, choice.date.toISOString())');
    expect(defer).not.toContain('scheduleAdvisorActionReminder');
    expect(defer).not.toContain('requestPermissions');
    expect(source.match(/onPress: deferInAppCheckIn/g)).toHaveLength(2);
    expect(source).toContain("currentAdvisorAction.reminderAt ? 'Reminder' : 'Check back here'");
  });

  it('guards mutations and consumes feedback before regenerating guidance', () => {
    expect(source).toContain('useSmallerStep, operation.isCurrent');
    expect(source).toContain('if (!operation.isCurrent()) return;');
    expect(source).toContain('operation.finish();');
    expect(source).toContain('advisorLoopSelectionOptions(reconciledOutcomes, context.nowIso)');
    expect(source).toContain('if (helpful !== null) void loopRef.current?.refresh(false, true);');
  });
});
