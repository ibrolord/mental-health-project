import type { AccountabilityNudgeKind } from '@/lib/accountability';

export type AccountabilityAccessState = 'loading' | 'signed-out' | 'anonymous' | 'ready';
export type CommitmentTab = 'mine' | 'theirs';

export const NUDGE_TEMPLATES = [
  { id: 'encouragement', label: 'Thinking of you', message: 'Thinking of you today. No need to reply.' },
  { id: 'gentle_reminder', label: 'One small step', message: 'A small step still counts. I am cheering you on.' },
  { id: 'celebrate_progress', label: 'Celebrate progress', message: 'I noticed you showing up. That deserves celebrating.' },
] as const;

export type NudgeTemplateId = AccountabilityNudgeKind;

interface AccessInput {
  loading: boolean;
  userPresent: boolean;
  isAnonymous: boolean;
}

export function getAccessState(input: AccessInput): AccountabilityAccessState {
  if (input.loading) return 'loading';
  if (!input.userPresent) return 'signed-out';
  if (input.isAnonymous) return 'anonymous';
  return 'ready';
}

export function canManageCommitment(viewerId: string, ownerId: string): boolean {
  return viewerId === ownerId;
}

export function sanitizeCheckIn(
  input: { commitmentId: string; note: string; date: string; shareNote: boolean } & Record<string, unknown>
): { commitmentId: string; note: string; date: string; shareNote: boolean } {
  return {
    commitmentId: input.commitmentId,
    note: input.note.trim(),
    date: input.date,
    shareNote: input.shareNote,
  };
}

export function buildNudgeRequest(templateId: string): { templateId: NudgeTemplateId } {
  const template = NUDGE_TEMPLATES.find((item) => item.id === templateId);
  if (!template) throw new Error('Choose a supported nudge');
  return { templateId: template.id };
}

export function getNextTab(current: CommitmentTab, key: string): CommitmentTab {
  if (key === 'Home') return 'mine';
  if (key === 'End') return 'theirs';
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    return current === 'mine' ? 'theirs' : 'mine';
  }
  return current;
}

export function getDaysShownUpLabel(daysShownUp: number): string {
  return `${daysShownUp} of 14 days shown up`;
}

export function formatAccountabilityDate(value: string | null, locale?: string): string {
  if (!value) return 'No check-in yet';
  const calendarDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = calendarDate
    ? new Date(
        Number(calendarDate[1]),
        Number(calendarDate[2]) - 1,
        Number(calendarDate[3])
      )
    : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(date);
}
