import type { FrameworkType } from '../types';

export const GOAL_FRAMEWORKS: readonly {
  id: FrameworkType;
  label: string;
  description: string;
}[] = [
  { id: 'simple', label: 'Simple', description: 'Three things. That is enough.' },
  { id: 'eisenhower', label: 'Eisenhower', description: 'Sort by urgent and important.' },
  { id: 'ivy_lee', label: 'Ivy Lee', description: 'Rank the day. Start with number one.' },
  { id: '1-3-5', label: '1-3-5', description: 'One big win, three medium, five small.' },
  { id: 'abcde', label: 'ABCDE', description: 'A matters most. E can wait.' },
] as const;

export const EISENHOWER_QUADRANTS = [
  { id: 'urgent-important', label: 'Do first', description: 'Urgent + important', tone: 'danger' },
  { id: 'not-urgent-important', label: 'Schedule', description: 'Important, not urgent', tone: 'primary' },
  { id: 'urgent-not-important', label: 'Delegate', description: 'Urgent, not important', tone: 'accent' },
  { id: 'not-urgent-not-important', label: 'Let go', description: 'Neither. Skip it.', tone: 'neutral' },
] as const;

export const PRIORITIES_135 = [
  { id: 'big', label: 'Big', description: 'The one thing that matters most', limit: 1 },
  { id: 'medium', label: 'Medium', description: 'Three useful steps', limit: 3 },
  { id: 'small', label: 'Small', description: 'Five quick wins', limit: 5 },
] as const;

export const ABCDE_PRIORITIES = [
  { id: 'A', label: 'Must do', description: 'Meaningful consequence if it waits' },
  { id: 'B', label: 'Should do', description: 'Important, but not first' },
  { id: 'C', label: 'Could do', description: 'Helpful if capacity allows' },
  { id: 'D', label: 'Delegate', description: 'Someone else can own this' },
  { id: 'E', label: 'Eliminate', description: 'Release it for now' },
] as const;

export function frameworkMomentumCopy(
  framework: FrameworkType,
  completed: number,
  total: number
): string {
  if (completed <= 0 || total <= 0) return '';
  if (framework === 'eisenhower') return `${completed} cleared across the matrix`;
  if (framework === '1-3-5') return `${completed} of ${total} moved forward`;
  if (framework === 'abcde') return `${completed} ${completed === 1 ? 'priority' : 'priorities'} handled`;
  return `${completed} of ${total} moved today`;
}

export function frameworkProgress(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, completed / total));
}
