export const ALL_GOALS_VIEW = 'all';
export const TODAY_GOALS_VIEW = 'today';
export const GOAL_PROJECT_PREFIX = 'project:';

export type GoalProjectView =
  | typeof ALL_GOALS_VIEW
  | typeof TODAY_GOALS_VIEW
  | `${typeof GOAL_PROJECT_PREFIX}${string}`;

export type ProjectGoal = {
  date: string;
  due_at: string | null;
  tags?: string[] | null;
};

export function normalizeGoalProject(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, 32);
}

export function normalizeGoalTags(values: readonly string[]): string[] {
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = normalizeGoalProject(value);
    const key = normalized.toLocaleLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    tags.push(normalized);
    if (tags.length >= 8) break;
  }
  return tags;
}

export function collectGoalProjects(goals: readonly ProjectGoal[]): string[] {
  return normalizeGoalTags(goals.flatMap((goal) => goal.tags ?? []));
}

export function goalProjectFromView(view: GoalProjectView): string | null {
  return view.startsWith(GOAL_PROJECT_PREFIX)
    ? normalizeGoalProject(view.slice(GOAL_PROJECT_PREFIX.length)) || null
    : null;
}

export function goalProjectView(project: string): GoalProjectView {
  return `${GOAL_PROJECT_PREFIX}${normalizeGoalProject(project)}`;
}

export function filterGoalsByProject<T extends ProjectGoal>(
  goals: readonly T[],
  view: GoalProjectView,
  today: string
): T[] {
  if (view === ALL_GOALS_VIEW) return [...goals];
  if (view === TODAY_GOALS_VIEW) {
    return goals.filter((goal) =>
      goal.date === today || localDateForGoalDueAt(goal.due_at) === today
    );
  }
  const project = goalProjectFromView(view)?.toLocaleLowerCase();
  if (!project) return [...goals];
  return goals.filter((goal) =>
    (goal.tags ?? []).some((tag) => tag.toLocaleLowerCase() === project)
  );
}

function localDateForGoalDueAt(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
