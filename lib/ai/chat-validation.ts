import { z } from 'zod';

const boundedText = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max);

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: boundedText(4_000),
}).strict();

const userContextSchema = z.object({
  recentMoods: z.array(z.object({
    emoji: boundedText(16),
    created_at: boundedText(64),
  }).strict()).max(14).optional(),
  moodNotes: z.array(z.object({
    emoji: boundedText(16),
    note: boundedText(1_000),
    created_at: boundedText(64),
  }).strict()).max(7).optional(),
  assessments: z.array(z.object({
    type: boundedText(32),
    score: z.number().finite().min(0).max(10_000),
    max_score: z.number().finite().positive().max(10_000),
    created_at: boundedText(64),
  }).strict()).max(10).optional(),
  goals: z.array(z.object({
    content: boundedText(1_000),
    status: boundedText(32),
    reflection: optionalText(2_000).optional(),
    date: boundedText(64),
  }).strict()).max(15).optional(),
  habits: z.array(z.object({
    name: boundedText(200),
    streak_count: z.number().int().min(0).max(100_000),
  }).strict()).max(20).optional(),
  journalEntries: z.array(z.object({
    title: boundedText(200),
    content: boundedText(4_000),
    entry_kind: boundedText(32),
    created_at: boundedText(64),
  }).strict()).max(3).optional(),
  libraryNotes: z.array(z.object({
    content_id: boundedText(120),
    title: boundedText(240),
    media_type: z.enum(['book', 'video', 'story']),
    custom_notes: boundedText(2_000),
    updated_at: boundedText(64),
  }).strict()).max(5).optional(),
  lifePlan: z.array(z.object({
    item_type: boundedText(32),
    horizon: boundedText(32),
    title: boundedText(200),
    reflection: optionalText(2_000),
    next_step: optionalText(500),
    target_date: optionalText(64).optional(),
    status: boundedText(32),
  }).strict()).max(12).optional(),
  focusSessions: z.array(z.object({
    task_label: boundedText(240),
    focus_minutes: z.number().int().min(5).max(120),
    planned_cycles: z.number().int().min(1).max(12),
    completed_cycles: z.number().int().min(0).max(12),
    status: boundedText(32),
    completed_at: optionalText(64).optional(),
  }).strict()).max(10).optional(),
}).strict();

export const chatRequestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(40),
  userContext: userContextSchema.optional(),
}).strict().superRefine(({ messages, userContext }, context) => {
  const totalCharacters = messages.reduce((sum, message) => sum + message.content.length, 0);
  if (totalCharacters > 24_000) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Conversation is too large', path: ['messages'] });
  }
  if (userContext && JSON.stringify(userContext).length > 30_000) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Selected context is too large',
      path: ['userContext'],
    });
  }
  if (messages.at(-1)?.role !== 'user') {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Last message must be from the user', path: ['messages'] });
  }
  if (messages[0]?.role !== 'user') {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'First message must be from the user', path: ['messages', 0, 'role'] });
  }
  for (let index = 1; index < messages.length; index += 1) {
    if (messages[index].role === messages[index - 1].role) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Message roles must alternate',
        path: ['messages', index, 'role'],
      });
      break;
    }
  }
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
