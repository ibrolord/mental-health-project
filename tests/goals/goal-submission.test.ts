import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import * as mobileGoals from '../../mobile/lib/goals/deduplication';
import * as webGoals from '../../lib/goals/deduplication';

const implementations = [
  ['web', webGoals],
  ['mobile', mobileGoals],
] as const;

describe.each(implementations)('%s goal deduplication', (_name, goals) => {
  const baseGoal = {
    id: 'goal-1',
    date: '2026-08-10',
    content: '  Take   a short walk  ',
    framework: 'simple',
    priority: null,
    eisenhower_quadrant: null,
  };

  it('normalizes equivalent content within the same planning slot', () => {
    expect(
      goals.goalIdentityKey({
        ...baseGoal,
        content: 'take a SHORT walk',
      })
    ).toBe(goals.goalIdentityKey(baseGoal));
  });

  it('keeps the same text unique when the planning slot changes', () => {
    expect(
      goals.goalIdentityKey({
        ...baseGoal,
        priority: 'A',
      })
    ).not.toBe(goals.goalIdentityKey(baseGoal));
  });

  it('keeps identical goals from different dates separate', () => {
    const previousDay = { ...baseGoal, id: 'goal-previous', date: '2026-08-09' };

    expect(goals.goalIdentityKey(previousDay)).not.toBe(goals.goalIdentityKey(baseGoal));
    expect(goals.collapseDuplicateGoals([previousDay, baseGoal]).goals).toEqual([
      previousDay,
      baseGoal,
    ]);
  });

  it('collapses accidental duplicates while retaining every backing row id', () => {
    const duplicate = {
      ...baseGoal,
      id: 'goal-2',
      content: 'take a short walk',
    };
    const distinct = {
      ...baseGoal,
      id: 'goal-3',
      content: 'Call a friend',
    };

    const collapsed = goals.collapseDuplicateGoals([baseGoal, duplicate, distinct]);

    expect(collapsed.goals).toEqual([baseGoal, distinct]);
    expect(collapsed.idsByKey.get(goals.goalIdentityKey(baseGoal))).toEqual([
      'goal-1',
      'goal-2',
    ]);
  });

  it('runs only one concurrent insert and unlocks after completion', async () => {
    let releaseFirst!: () => void;
    const firstPending = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const operation = vi.fn(async () => {
      await firstPending;
      return true;
    });
    const runOnce = goals.createSingleFlight();

    const first = runOnce(operation);
    const second = runOnce(operation);

    expect(await second).toBeUndefined();
    expect(operation).toHaveBeenCalledTimes(1);

    releaseFirst();
    expect(await first).toBe(true);

    const third = runOnce(async () => 'next');
    expect(await third).toBe('next');
  });

});

describe('mobile goal completion feedback', () => {
  it('moves between pending and complete with matching feedback', () => {
    expect(mobileGoals.nextGoalCompletionStatus('pending')).toBe('completed');
    expect(mobileGoals.goalCompletionFeedback('completed')).toBe('Goal completed.');
    expect(mobileGoals.nextGoalCompletionStatus('completed')).toBe('pending');
    expect(mobileGoals.goalCompletionFeedback('pending')).toBe(
      'Goal moved back to pending.'
    );
  });

  it('clears stale undo feedback before reloading an owner', () => {
    const goalsScreen = readFileSync(resolve('mobile/app/goals.tsx'), 'utf8');

    expect(goalsScreen).toMatch(
      /const loadGoals = useCallback\(async \(\) => \{\s+setGoalStatusChange\(null\);/
    );
  });

  it('preserves the original completion timestamp when undo restores completion', () => {
    const goalsScreen = readFileSync(resolve('mobile/app/goals.tsx'), 'utf8');

    expect(goalsScreen).toContain('fromCompletedAt: goal.completed_at');
    expect(goalsScreen).toContain(
      'updateGoalStatus(goal, change.from, change.fromCompletedAt)'
    );
  });

  it('submits the latest native input value instead of a stale render value', () => {
    const goalsScreen = readFileSync(resolve('mobile/app/goals.tsx'), 'utf8');

    expect(goalsScreen).toContain("const inputRef = useRef('');");
    expect(goalsScreen).toContain('inputRef.current = value;');
    expect(goalsScreen).toContain('onEndEditing={(event) => updateInput(event.nativeEvent.text)}');
    expect(goalsScreen).toContain('onSubmit(event.nativeEvent.text)');
    expect(goalsScreen).toContain('setTimeout(() => submit(inputRef.current), 0);');
    expect(goalsScreen).not.toContain('void addGoal(input);');
  });
});
