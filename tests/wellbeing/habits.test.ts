import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createHabitDedupeKey,
  habitMomentum,
  isRewardUnlocked,
} from '../../lib/wellbeing/habits';

const habitsPage = readFileSync(
  resolve(process.cwd(), 'app/habits/page.tsx'),
  'utf8'
);

describe('habit identity and progress', () => {
  it('normalizes case, spacing, punctuation, and accents for semantic identity', () => {
    expect(createHabitDedupeKey('  Café walk!  ', 'morning')).toBe(
      'morning:cafe-walk'
    );
    expect(createHabitDedupeKey('CAFE   WALK', 'morning')).toBe(
      'morning:cafe-walk'
    );
  });

  it('keeps the same habit in separate routine slots distinct', () => {
    expect(createHabitDedupeKey('Stretch', 'morning')).not.toBe(
      createHabitDedupeKey('Stretch', 'evening')
    );
  });

  it('never creates negative momentum and advances levels monotonically', () => {
    expect(habitMomentum(-2, -1, -5)).toMatchObject({
      xp: 0,
      level: 1,
      levelProgress: 0,
    });
    const early = habitMomentum(3, 2, 2);
    const later = habitMomentum(20, 8, 10);
    expect(later.xp).toBeGreaterThan(early.xp);
    expect(later.level).toBeGreaterThanOrEqual(early.level);
    expect(later.levelProgress).toBeGreaterThanOrEqual(0);
    expect(later.levelProgress).toBeLessThanOrEqual(100);
  });

  it('unlocks a named reward only when the target is reached', () => {
    expect(isRewardUnlocked(6, 7, 'Watch a movie')).toBe(false);
    expect(isRewardUnlocked(7, 7, 'Watch a movie')).toBe(true);
    expect(isRewardUnlocked(20, 7, '   ')).toBe(false);
  });

  it('renders newly inserted habits from the returned database row', () => {
    const addHabitSource = habitsPage.slice(
      habitsPage.indexOf('const addHabit = async'),
      habitsPage.indexOf('const installRoutine = async')
    );

    expect(addHabitSource).toContain('.select(HABIT_SELECT_COLUMNS)');
    expect(addHabitSource).toContain('setHabits((current)');
    expect(addHabitSource).toContain('setLogs((current)');
    expect(addHabitSource).not.toContain('await loadHabits()');
  });
});
