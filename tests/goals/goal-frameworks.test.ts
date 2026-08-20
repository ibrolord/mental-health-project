import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ABCDE_PRIORITIES,
  EISENHOWER_QUADRANTS,
  GOAL_FRAMEWORKS,
  PRIORITIES_135,
  frameworkMomentumCopy,
  frameworkProgress,
} from '../../mobile/lib/goals/frameworks';

describe('mobile goal frameworks', () => {
  it('keeps every framework and planning slot distinct', () => {
    expect(GOAL_FRAMEWORKS.map((item) => item.id)).toEqual([
      'simple',
      'eisenhower',
      'ivy_lee',
      '1-3-5',
      'abcde',
    ]);
    expect(new Set(EISENHOWER_QUADRANTS.map((item) => item.id)).size).toBe(4);
    expect(PRIORITIES_135.reduce((total, item) => total + item.limit, 0)).toBe(9);
    expect(ABCDE_PRIORITIES.map((item) => item.id)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('uses bounded, non-punitive progress feedback', () => {
    expect(frameworkProgress(2, 4)).toBe(0.5);
    expect(frameworkProgress(5, 2)).toBe(1);
    expect(frameworkProgress(0, 0)).toBe(0);
    expect(frameworkMomentumCopy('eisenhower', 2, 4)).toBe('2 cleared across the matrix');
    expect(frameworkMomentumCopy('simple', 0, 3)).toBe('');
  });

  it('preserves undo across view changes and exposes progress to assistive technology', () => {
    const source = readFileSync('mobile/app/goals.tsx', 'utf8');
    const frameworkSwitch = source.slice(
      source.indexOf('onPress={() => {\n                  setFramework(fw.id);'),
      source.indexOf('AccessibilityInfo.announceForAccessibility(`Switched to ${fw.label} view.`);')
    );

    expect(frameworkSwitch).not.toContain('setGoalStatusChange(null)');
    expect(source).toContain('accessibilityRole="progressbar"');
    expect(source).toContain('accessibilityValue={{ min: 0, max: frameworkGoals.length, now: completed }}');
    expect(source).toContain('accessibilityLabel={`${q.label} quadrant, ${list.length}');
    expect(source).toContain("format(new Date(), 'EEEE, MMM d, yyyy')");
    expect(source).toContain("format(new Date(g.due_at), 'MMM d, yyyy · h:mm a')");
  });
});
