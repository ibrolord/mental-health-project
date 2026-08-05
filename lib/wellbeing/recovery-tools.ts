import { z } from 'zod';

const MAX_LIST_ITEMS = 30;

function conciseText(maxLength: number) {
  return z
    .string()
    .max(maxLength)
    .transform((value) => value.trim().replace(/\s+/g, ' '))
    .refine((value) => value.length > 0, 'Enter a value.');
}

const optionalConciseText = (maxLength: number) =>
  conciseText(maxLength).optional();

const identifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, 'Use a stable identifier.');

const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.')
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, 'Enter a valid calendar date.');

const localTimeSchema = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour HH:mm time.');

const shortItemSchema = conciseText(2_200);
const shortListSchema = z.array(shortItemSchema).max(MAX_LIST_ITEMS).default([]);

export const supportContactSchema = z
  .object({
    name: conciseText(120),
    relationship: optionalConciseText(80),
    phone: z
      .string()
      .trim()
      .min(3)
      .max(40)
      .regex(/^(?=.*\d)[0-9+().\- x]*$/, 'Enter a phone number.')
      .optional(),
    email: z.string().trim().email().max(254).optional(),
    details: z.string().trim().max(2_000).optional(),
  })
  .strict();

export type SupportContactDraft = z.input<typeof supportContactSchema>;
export type SupportContact = z.infer<typeof supportContactSchema>;

export const activityStepDraftSchema = z
  .object({
    action: conciseText(160),
    when: optionalConciseText(100),
    where: optionalConciseText(100),
    estimatedMinutes: z.number().int().min(1).max(180).optional(),
    completed: z.boolean().default(false),
  })
  .strict();

export const activityStepSchema = activityStepDraftSchema.extend({
  order: z.number().int().min(1).max(7),
});

export const activityPlanDraftSchema = z
  .object({
    id: identifierSchema,
    title: conciseText(120),
    scheduledDate: calendarDateSchema.optional(),
    steps: z.array(activityStepDraftSchema).min(1).max(7),
    notes: optionalConciseText(2_000),
  })
  .strict();

export const activityPlanSchema = activityPlanDraftSchema.extend({
  steps: z.array(activityStepSchema).min(1).max(7),
}).superRefine((plan, context) => {
  plan.steps.forEach((step, index) => {
    if (step.order !== index + 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['steps', index, 'order'],
        message: 'Step order must be contiguous and start at 1.',
      });
    }
  });
});

export type ActivityStepDraft = z.input<typeof activityStepDraftSchema>;
export type ActivityStep = z.infer<typeof activityStepSchema>;
export type ActivityPlanDraft = z.input<typeof activityPlanDraftSchema>;
export type ActivityPlan = z.infer<typeof activityPlanSchema>;

export function createActivityPlan(input: unknown): ActivityPlan {
  const draft = activityPlanDraftSchema.parse(input);
  return activityPlanSchema.parse({
    ...draft,
    steps: draft.steps.map((step, index) => ({
      ...step,
      order: index + 1,
    })),
  });
}

export function orderActivityPlans(input: unknown): ActivityPlan[] {
  return z
    .array(activityPlanSchema)
    .max(12)
    .parse(input)
    .sort((left, right) => {
      const leftDate = left.scheduledDate ?? '9999-12-31';
      const rightDate = right.scheduledDate ?? '9999-12-31';
      return (
        compareText(leftDate, rightDate) ||
        compareText(left.title, right.title) ||
        compareText(left.id, right.id)
      );
    });
}

function compareText(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export const safetyPlanSchema = z
  .object({
    warningSigns: shortListSchema,
    internalCopingStrategies: shortListSchema,
    peopleAndPlacesForDistraction: shortListSchema,
    peopleToAskForHelp: z
      .array(supportContactSchema)
      .max(MAX_LIST_ITEMS)
      .default([]),
    professionalAndAgencyContacts: z
      .array(supportContactSchema)
      .max(MAX_LIST_ITEMS)
      .default([]),
    waysToMakeEnvironmentSafer: shortListSchema,
  })
  .strict();

export type SafetyPlanDraft = z.input<typeof safetyPlanSchema>;
export type SafetyPlan = z.infer<typeof safetyPlanSchema>;

export function createSafetyPlan(input: unknown = {}): SafetyPlan {
  return safetyPlanSchema.parse(input);
}

export const stayingWellPlanSchema = z
  .object({
    dailyActions: shortListSchema,
    situationsToPrepareFor: shortListSchema,
    changesIWantToNotice: shortListSchema,
    responsesIChoose: shortListSchema,
    peopleIWantInvolved: z
      .array(supportContactSchema)
      .max(MAX_LIST_ITEMS)
      .default([]),
  })
  .strict();

export type StayingWellPlanDraft = z.input<typeof stayingWellPlanSchema>;
export type StayingWellPlan = z.infer<typeof stayingWellPlanSchema>;

export function createStayingWellPlan(input: unknown = {}): StayingWellPlan {
  return stayingWellPlanSchema.parse(input);
}

export const sleepAwakeningSchema = z
  .object({
    awakeAt: localTimeSchema.optional(),
    estimatedMinutesAwake: z.number().int().min(0).max(720),
  })
  .strict();

export type SleepAwakening = z.infer<typeof sleepAwakeningSchema>;

export const sleepNapSchema = z
  .object({
    startedAt: localTimeSchema,
    durationMinutes: z.number().int().min(1).max(720),
  })
  .strict();

export type SleepNap = z.infer<typeof sleepNapSchema>;

export const sleepDiaryEntrySchema = z
  .object({
    id: identifierSchema,
    date: calendarDateSchema,
    wentToBedAt: localTimeSchema.optional(),
    triedToSleepAt: localTimeSchema.optional(),
    estimatedMinutesToFallAsleep: z.number().int().min(0).max(1_440).optional(),
    awakenings: z.array(sleepAwakeningSchema).max(20).default([]),
    recordedAwakeningCount: z.number().int().min(0).max(50).optional(),
    recordedMinutesAwake: z.number().int().min(0).max(1_440).optional(),
    finalWakeAt: localTimeSchema.optional(),
    gotOutOfBedAt: localTimeSchema.optional(),
    naps: z.array(sleepNapSchema).max(8).default([]),
    recordedNapMinutes: z.number().int().min(0).max(1_440).optional(),
    notes: optionalConciseText(2_000),
  })
  .strict();

export type SleepDiaryEntryDraft = z.input<typeof sleepDiaryEntrySchema>;
export type SleepDiaryEntry = z.infer<typeof sleepDiaryEntrySchema>;

export function createSleepDiaryEntry(input: unknown): SleepDiaryEntry {
  return sleepDiaryEntrySchema.parse(input);
}

export function orderSleepDiaryEntries(input: unknown): SleepDiaryEntry[] {
  return z
    .array(sleepDiaryEntrySchema)
    .max(31)
    .parse(input)
    .sort(
      (left, right) =>
        compareText(right.date, left.date) || compareText(left.id, right.id)
    );
}

export const contactMethodSchema = z.enum([
  'in-person',
  'phone',
  'text',
  'email',
  'video',
]);

export type ContactMethod = z.infer<typeof contactMethodSchema>;

export const supportPreferencesSchema = z
  .object({
    preferredContactMethods: z.array(contactMethodSchema).max(5).default([]),
    preferredTimes: shortListSchema,
    communicationNeeds: shortListSchema,
    helpfulSupport: shortListSchema,
    unhelpfulSupport: shortListSchema,
    practicalNeeds: shortListSchema,
    peopleToInclude: z
      .array(supportContactSchema)
      .max(MAX_LIST_ITEMS)
      .default([]),
  })
  .strict();

export type SupportPreferencesDraft = z.input<typeof supportPreferencesSchema>;
export type SupportPreferences = z.infer<typeof supportPreferencesSchema>;

export function createSupportPreferences(
  input: unknown = {}
): SupportPreferences {
  return supportPreferencesSchema.parse(input);
}
