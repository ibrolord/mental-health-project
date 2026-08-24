import { describe, expect, it } from 'vitest';
import {
  ALL_GOALS_VIEW,
  TODAY_GOALS_VIEW,
  collectGoalProjects,
  filterGoalsByProject,
  goalProjectView,
  normalizeGoalTags,
} from '../../mobile/lib/goals/organization';

const goals = [
  { id: 'a', date: '2026-08-24', due_at: null, tags: ['School'] },
  { id: 'b', date: '2026-08-20', due_at: new Date(2026, 7, 24, 19).toISOString(), tags: ['Work'] },
  { id: 'c', date: '2026-08-20', due_at: null, tags: ['school', 'Health'] },
];

describe('mobile goal organization', () => {
  it('normalizes, deduplicates, and caps project tags', () => {
    expect(normalizeGoalTags([' School ', 'school', 'Health  Plan'])).toEqual([
      'School',
      'Health Plan',
    ]);
    expect(normalizeGoalTags(Array.from({ length: 10 }, (_, index) => `P${index}`))).toHaveLength(8);
  });

  it('uses the device-local due date for Today', () => {
    const localEvening = new Date(2026, 7, 24, 23, 30).toISOString();
    const localNextDay = new Date(2026, 7, 25, 0, 30).toISOString();
    expect(filterGoalsByProject([
      { id: 'evening', date: '2026-08-20', due_at: localEvening, tags: [] },
      { id: 'next', date: '2026-08-20', due_at: localNextDay, tags: [] },
    ], TODAY_GOALS_VIEW, '2026-08-24').map((goal) => goal.id)).toEqual(['evening']);
  });

  it('collects projects and filters built-in and custom views', () => {
    expect(collectGoalProjects(goals)).toEqual(['School', 'Work', 'Health']);
    expect(filterGoalsByProject(goals, ALL_GOALS_VIEW, '2026-08-24')).toHaveLength(3);
    expect(filterGoalsByProject(goals, TODAY_GOALS_VIEW, '2026-08-24').map((goal) => goal.id)).toEqual(['a', 'b']);
    expect(filterGoalsByProject(goals, goalProjectView('school'), '2026-08-24').map((goal) => goal.id)).toEqual(['a', 'c']);
  });
});
