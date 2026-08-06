import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createHabitDedupeKey,
  habitMomentum,
  isRewardUnlocked,
} from '../../lib/wellbeing/habits';
import { isUnexpectedHabitInsertError } from '../../mobile/lib/wellbeing/habits';

const habitsPage = readFileSync(
  resolve(process.cwd(), 'app/habits/page.tsx'),
  'utf8'
);
const mobileHabitsPage = readFileSync(
  resolve(process.cwd(), 'mobile/app/habits.tsx'),
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

  it('only treats genuine routine insert errors as failures', () => {
    expect(isUnexpectedHabitInsertError(null)).toBe(false);
    expect(isUnexpectedHabitInsertError(undefined)).toBe(false);
    expect(isUnexpectedHabitInsertError({ code: '23505' })).toBe(false);
    expect(isUnexpectedHabitInsertError({ code: '42501' })).toBe(true);
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

  it('clears library routine attribution before opening a blank habit editor', () => {
    const webBlankEditor = habitsPage.slice(
      habitsPage.indexOf('const openBlankHabitEditor = () =>'),
      habitsPage.indexOf('const loadHabits = async')
    );
    expect(webBlankEditor).toContain('setDraft(EMPTY_DRAFT)');
    expect(webBlankEditor).toContain("setLibrarySourceTitle('')");
    expect(webBlankEditor).toContain("setSelectedRoutineId('')");

    const mobileBlankEditor = mobileHabitsPage.slice(
      mobileHabitsPage.indexOf('const openBlankHabitEditor = () =>'),
      mobileHabitsPage.indexOf('return (', mobileHabitsPage.indexOf('const openBlankHabitEditor = () =>'))
    );
    expect(mobileBlankEditor).toContain("setSourceTitle('')");
    expect(mobileBlankEditor).toContain("setSelectedRoutineId('')");
    expect(mobileBlankEditor).toContain('setTemplatesOpen(false)');
    expect(mobileHabitsPage).toContain('onPress={openBlankHabitEditor}');
  });
});
