import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeGoalIdParam } from '../../mobile/lib/wellbeing/focus';

describe('mobile goal-to-focus handoff', () => {
  it('accepts only opaque UUID goal identifiers from navigation', () => {
    expect(
      normalizeGoalIdParam(['  85F42F98-DF9E-4F5A-9A99-4BE7B957CA45  '])
    ).toBe(
      '85f42f98-df9e-4f5a-9a99-4be7b957ca45'
    );
    expect(normalizeGoalIdParam('Finish the outline')).toBe('');
    expect(normalizeGoalIdParam(undefined)).toBe('');
  });

  it('links a pending goal to focus without starting a session', () => {
    const goals = readFileSync(resolve('mobile/app/goals.tsx'), 'utf8');
    const focus = readFileSync(resolve('mobile/app/focus.tsx'), 'utf8');

    expect(goals).toContain("pathname: '/focus'");
    expect(goals).toContain("params: { source: 'goals', goalId }");
    expect(goals).not.toContain("task: g.content");
    expect(focus).toContain(".eq('id', goalId)");
    expect(focus).toContain(".eq('user_id', ownerId)");
    expect(focus).toContain(
      'router.setParams({ source: undefined, goalId: undefined })'
    );
    expect(focus).toContain('setTask(requestedTask)');
    expect(focus).toContain(
      'if (prefilledFromGoals) setPrefilledFromGoals(false);'
    );
    expect(goals).toContain("selectedGoal?.status === 'pending' ? () => {");
    expect(focus).not.toContain('void start(); // goal handoff');
  });
});
