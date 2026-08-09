export interface GoalIdentity {
  id: string;
  content: string;
  framework: string;
  priority: string | null;
  eisenhower_quadrant: string | null;
}

export interface CollapsedGoals<T extends GoalIdentity> {
  goals: T[];
  idsByKey: Map<string, string[]>;
}

export type GoalCompletionStatus = 'pending' | 'completed';

export function nextGoalCompletionStatus(
  status: GoalCompletionStatus
): GoalCompletionStatus {
  return status === 'completed' ? 'pending' : 'completed';
}

export function goalCompletionFeedback(status: GoalCompletionStatus): string {
  return status === 'completed' ? 'Goal completed.' : 'Goal moved back to pending.';
}

function normalizeContent(content: string): string {
  return content.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function goalIdentityKey(
  goal: Pick<GoalIdentity, 'content' | 'framework' | 'priority' | 'eisenhower_quadrant'>
): string {
  return [
    goal.framework,
    goal.priority ?? '',
    goal.eisenhower_quadrant ?? '',
    normalizeContent(goal.content),
  ].join('\u001f');
}

export function collapseDuplicateGoals<T extends GoalIdentity>(items: T[]): CollapsedGoals<T> {
  const goals: T[] = [];
  const idsByKey = new Map<string, string[]>();

  for (const item of items) {
    const key = goalIdentityKey(item);
    const ids = idsByKey.get(key);
    if (ids) {
      ids.push(item.id);
      continue;
    }

    idsByKey.set(key, [item.id]);
    goals.push(item);
  }

  return { goals, idsByKey };
}

export function appendUniqueGoal<T extends GoalIdentity>(items: T[], item: T): T[] {
  const key = goalIdentityKey(item);
  if (items.some((current) => current.id === item.id || goalIdentityKey(current) === key)) {
    return items;
  }
  return [...items, item];
}

export function createSingleFlight() {
  let active = false;

  return async function runOnce<T>(operation: () => Promise<T>): Promise<T | undefined> {
    if (active) return undefined;
    active = true;
    try {
      return await operation();
    } finally {
      active = false;
    }
  };
}
