export const GOAL_ATTACHMENT_BUCKET = 'goal-attachments';
export const MAX_GOAL_ATTACHMENT_BYTES = 6 * 1024 * 1024;

export const ALLOWED_GOAL_ATTACHMENT_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'text/plain',
]);

export type GoalReminderPreset = 'off' | 'day-before' | 'hour-before' | 'at-time';

export function reminderForPreset(
  dueAt: string | null,
  preset: GoalReminderPreset
): string | null {
  if (!dueAt || preset === 'off') return null;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return null;
  if (preset === 'day-before') {
    due.setDate(due.getDate() - 1);
    return due.toISOString();
  }
  if (preset === 'hour-before') {
    return new Date(due.getTime() - 60 * 60 * 1000).toISOString();
  }
  return due.toISOString();
}

export function inferReminderPreset(
  dueAt: string | null,
  reminderAt: string | null
): GoalReminderPreset {
  if (!dueAt || !reminderAt) return 'off';
  const dueTime = new Date(dueAt).getTime();
  const reminderTime = new Date(reminderAt).getTime();
  if (Number.isNaN(dueTime) || Number.isNaN(reminderTime)) return 'off';
  if (new Date(reminderForPreset(dueAt, 'day-before')!).getTime() === reminderTime) {
    return 'day-before';
  }
  const difference = dueTime - reminderTime;
  if (difference === 60 * 60 * 1000) return 'hour-before';
  return difference === 0 ? 'at-time' : 'off';
}

export function toDateTimeLocalValue(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function fromDateTimeLocalValue(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function safeAttachmentName(fileName: string): string {
  const normalized = fileName
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/-\./g, '.')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 120);
  return normalized || 'attachment';
}

export function goalAttachmentPath(
  userId: string,
  goalId: string,
  fileName: string,
  id: string
): string {
  return `${userId}/${goalId}/${id}-${safeAttachmentName(fileName)}`;
}

export function validateGoalAttachment(input: {
  name: string;
  type: string;
  size: number;
}): string | null {
  if (!input.size || input.size > MAX_GOAL_ATTACHMENT_BYTES) {
    return 'Choose a file smaller than 6 MB.';
  }
  if (!ALLOWED_GOAL_ATTACHMENT_TYPES.has(input.type)) {
    return 'Use a PDF, DOCX, JPG, PNG, or text file.';
  }
  if (!input.name.trim()) return 'That file needs a name.';
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
