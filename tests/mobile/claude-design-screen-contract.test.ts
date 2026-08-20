import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readScreen = (name: string) =>
  readFileSync(resolve(process.cwd(), `mobile/app/${name}.tsx`), 'utf8');

const goals = readScreen('goals');
const habits = readScreen('habits');
const library = readScreen('library');
const goalDetails = readFileSync(
  resolve(process.cwd(), 'mobile/components/GoalDetailModal.tsx'),
  'utf8'
);

describe('mobile Claude Design screen contracts', () => {
  it('keeps goals flat with one contextual add action and complete detail wiring', () => {
    expect(goals).toContain("label={composerOpen ? 'Close' : 'Add goal'}");
    expect(goals).toContain('{renderAddInput(submitComposer)}');
    expect(goals).not.toContain('+ Add task');
    expect(goals).not.toContain('<AppCard');
    expect(goals).toContain('<GoalDetailModal');
    expect(goals).toContain('onDelete={() => deleteGoal');
    expect(goals).toContain('onUpdated={(updated) =>');
    expect(goalDetails).toContain('>Reminder</Text>');
    expect(goalDetails).toContain('>Milestones</Text>');
    expect(goalDetails).toContain("'Add milestone due date'");
    expect(goalDetails).toContain('accessibilityLabel="Add file"');
  });

  it('keeps habits compact with horizontal filters and behavior-rich text rows', () => {
    expect(habits).toContain('title="Habits"');
    expect(habits).toContain('contentContainerStyle={styles.slotFilters}');
    expect(habits).toContain('style={[styles.habitRow, done && styles.habitDone]}');
    expect(habits).not.toContain('<AppCard');
    expect(habits).toContain('void toggleHabit(habit)');
    expect(habits).toContain('void updateAccountability(habit');
    expect(habits).toContain('void installTemplate(template)');
    expect(habits).toContain('rewardUnlocked');
  });

  it('keeps resources and templates distinct while flattening controls and rows', () => {
    expect(library).toContain('Resources');
    expect(library).toContain('Templates');
    expect(library).toContain('contentContainerStyle={styles.filterChips}');
    expect(library).toContain('styles.libraryRow');
    expect(library).not.toContain('<AppCard');
    expect(library).toContain('void persistState(selected');
    expect(library).toContain('router.push(integrationRoute');
    expect(library).toContain('effectiveItemStates[item.id]?.custom_notes');
  });
});
