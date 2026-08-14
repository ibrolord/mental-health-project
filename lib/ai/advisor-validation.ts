import { z } from 'zod';

const boundedText = (max: number) => z.string().trim().min(1).max(max);
const nonNegativeNumber = z.number().finite().nonnegative();

const appleHealthWindowSchema = z.object({
  coverageDays: z.number().int().min(0).max(31),
  averageSteps: nonNegativeNumber.nullable(),
  averageSleepMinutes: nonNegativeNumber.nullable(),
  exerciseMinutes: nonNegativeNumber,
  mindfulMinutes: nonNegativeNumber,
  workoutCount: z.number().int().min(0).max(1000),
  stateOfMindCount: z.number().int().min(0).max(1000),
}).strict();

export const advisorAppleHealthSummarySchema = z.object({
  sevenDay: appleHealthWindowSchema,
  thirtyDay: appleHealthWindowSchema,
  moodComparison: boundedText(240),
}).strict();

export const advisorSignalSchema = z.object({
  id: boundedText(160),
  kind: z.enum(['mood', 'deadline', 'routine', 'streak', 'health', 'notifications']),
  text: boundedText(240),
}).strict();

export const advisorCandidateSchema = z.object({
  id: boundedText(160),
  observation: boundedText(240),
  observations: z.array(boundedText(240)).min(1).max(3),
  action: boundedText(240),
  smallerAction: boundedText(240),
  sourceLabels: z.array(boundedText(80)).max(4),
}).strict();

export const advisorModelRequestSchema = z.object({
  nowIso: boundedText(64),
  mood: z.object({
    label: z.enum(['Great', 'Good', 'Okay', 'Low', 'Very low']),
    localDate: boundedText(32),
  }).strict().nullable(),
  candidates: z.array(advisorCandidateSchema).min(1).max(3),
  signals: z.array(advisorSignalSchema).max(10),
  appleHealthSummary: advisorAppleHealthSummarySchema.nullable(),
  recentFeedback: z.array(z.object({
    recommendationId: boundedText(160),
    helpful: z.boolean().nullable(),
  }).strict()).max(5),
}).strict().superRefine((value, context) => {
  const ids = value.candidates.map((candidate) => candidate.id);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Candidate IDs must be unique',
      path: ['candidates'],
    });
  }
  const signalIds = value.signals.map((signal) => signal.id);
  if (new Set(signalIds).size !== signalIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Signal IDs must be unique',
      path: ['signals'],
    });
  }
  if (
    value.signals.some((signal) => signal.kind === 'health') &&
    !value.appleHealthSummary
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Health signals require a confirmed Apple Health summary',
      path: ['appleHealthSummary'],
    });
  }
});

export const advisorModelOutputSchema = z.object({
  candidateId: boundedText(160),
  observations: z.array(boundedText(180)).min(1).max(3),
  signalIds: z.array(boundedText(160)).max(3),
  focus: z.enum(['steady', 'deadline', 'routine', 'baseline', 'recover']),
}).strict();

export type AdvisorModelRequest = z.infer<typeof advisorModelRequestSchema>;
export type AdvisorModelOutput = z.infer<typeof advisorModelOutputSchema>;
