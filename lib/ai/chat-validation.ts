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
    note: optionalText(1_000),
    created_at: boundedText(64),
  }).strict()).max(14).optional(),
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
  }).strict()).max(30).optional(),
  habits: z.array(z.object({
    name: boundedText(200),
    streak_count: z.number().int().min(0).max(100_000),
  }).strict()).max(30).optional(),
}).strict();

export const chatRequestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(40),
  userContext: userContextSchema.optional(),
}).strict().superRefine(({ messages }, context) => {
  const totalCharacters = messages.reduce((sum, message) => sum + message.content.length, 0);
  if (totalCharacters > 24_000) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Conversation is too large', path: ['messages'] });
  }
  if (messages.at(-1)?.role !== 'user') {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Last message must be from the user', path: ['messages'] });
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
