import { z } from 'zod';
import {
  activityPlanSchema,
  orderActivityPlans,
  orderSleepDiaryEntries,
  safetyPlanSchema,
  sleepDiaryEntrySchema,
  stayingWellPlanSchema,
  supportPreferencesSchema,
  type ActivityPlan,
  type SafetyPlan,
  type SleepDiaryEntry,
  type StayingWellPlan,
  type SupportContact,
  type SupportPreferences,
} from './recovery-tools';

export const VISIT_BRIEF_SECTION_ORDER = [
  'activityPlans',
  'stayingWellPlan',
  'sleepDiary',
  'supportPreferences',
  'safetyPlan',
] as const;

export type VisitBriefSectionId = (typeof VISIT_BRIEF_SECTION_ORDER)[number];

export const visitBriefSelectionSchema = z
  .object({
    activityPlans: z.boolean().default(false),
    stayingWellPlan: z.boolean().default(false),
    sleepDiary: z.boolean().default(false),
    supportPreferences: z.boolean().default(false),
    safetyPlan: z.boolean().default(false),
  })
  .strict();

export type VisitBriefSelection = z.infer<typeof visitBriefSelectionSchema>;

export type UserEnteredSection<T> = {
  provenance: 'user-entered';
  value: T;
};

export type VisitBriefSource = {
  activityPlans?: UserEnteredSection<ActivityPlan[]>;
  stayingWellPlan?: UserEnteredSection<StayingWellPlan>;
  sleepDiary?: UserEnteredSection<SleepDiaryEntry[]>;
  supportPreferences?: UserEnteredSection<SupportPreferences>;
  safetyPlan?: UserEnteredSection<SafetyPlan>;
};

export type VisitBriefRequest = {
  selection?: Partial<VisitBriefSelection>;
  source?: VisitBriefSource;
};

export type VisitBriefSection = {
  readonly id: VisitBriefSectionId;
  readonly title: string;
  readonly lines: readonly string[];
};

export type VisitBrief = {
  readonly title: 'Visit brief';
  readonly sections: readonly VisitBriefSection[];
  readonly preview: string;
};

const sourceEnvelopeSchema = z
  .object({
    activityPlans: z.unknown().optional(),
    stayingWellPlan: z.unknown().optional(),
    sleepDiary: z.unknown().optional(),
    supportPreferences: z.unknown().optional(),
    safetyPlan: z.unknown().optional(),
  })
  .strict();

const requestEnvelopeSchema = z
  .object({
    selection: z.unknown().optional(),
    source: z.unknown().optional(),
  })
  .strict();

function userEnteredSectionSchema<T extends z.ZodTypeAny>(valueSchema: T) {
  return z
    .object({
      provenance: z.literal('user-entered'),
      value: valueSchema,
    })
    .strict();
}

const activityPlansSourceSchema = userEnteredSectionSchema(
  z.array(activityPlanSchema).min(1).max(12)
);
const sleepDiarySourceSchema = userEnteredSectionSchema(
  z.array(sleepDiaryEntrySchema).min(1).max(31)
);
const stayingWellSourceSchema = userEnteredSectionSchema(stayingWellPlanSchema);
const supportPreferencesSourceSchema = userEnteredSectionSchema(
  supportPreferencesSchema
);
const safetyPlanSourceSchema = userEnteredSectionSchema(safetyPlanSchema);

function hasStayingWellContent(plan: StayingWellPlan): boolean {
  return (
    plan.dailyActions.length > 0 ||
    plan.situationsToPrepareFor.length > 0 ||
    plan.changesIWantToNotice.length > 0 ||
    plan.responsesIChoose.length > 0 ||
    plan.peopleIWantInvolved.length > 0
  );
}

function hasSupportPreferencesContent(
  preferences: SupportPreferences
): boolean {
  return (
    preferences.preferredContactMethods.length > 0 ||
    preferences.preferredTimes.length > 0 ||
    preferences.communicationNeeds.length > 0 ||
    preferences.helpfulSupport.length > 0 ||
    preferences.unhelpfulSupport.length > 0 ||
    preferences.practicalNeeds.length > 0 ||
    preferences.peopleToInclude.length > 0
  );
}

function hasSafetyPlanContent(plan: SafetyPlan): boolean {
  return (
    plan.warningSigns.length > 0 ||
    plan.internalCopingStrategies.length > 0 ||
    plan.peopleAndPlacesForDistraction.length > 0 ||
    plan.peopleToAskForHelp.length > 0 ||
    plan.professionalAndAgencyContacts.length > 0 ||
    plan.waysToMakeEnvironmentSafer.length > 0
  );
}

function requireContent(hasContent: boolean, section: VisitBriefSectionId): void {
  if (!hasContent) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: ['source', section, 'value'],
        message: 'Selected sections need user-entered content.',
      },
    ]);
  }
}

function formatContact(contact: SupportContact): string {
  const details = [
    contact.relationship ? `relationship: ${contact.relationship}` : undefined,
    contact.phone ? `phone: ${contact.phone}` : undefined,
    contact.email ? `email: ${contact.email}` : undefined,
    contact.details ? `details: ${contact.details}` : undefined,
  ].filter((value): value is string => Boolean(value));
  return details.length > 0 ? `${contact.name} (${details.join('; ')})` : contact.name;
}

function addListLine(lines: string[], label: string, values: string[]): void {
  if (values.length > 0) lines.push(`${label}: ${values.join('; ')}`);
}

function addContactLine(
  lines: string[],
  label: string,
  contacts: SupportContact[]
): void {
  if (contacts.length > 0) {
    lines.push(`${label}: ${contacts.map(formatContact).join('; ')}`);
  }
}

function activityPlansSection(plans: ActivityPlan[]): VisitBriefSection {
  const lines: string[] = [];
  for (const plan of orderActivityPlans(plans)) {
    lines.push(
      plan.scheduledDate
        ? `Plan: ${plan.title} | date: ${plan.scheduledDate}`
        : `Plan: ${plan.title}`
    );
    for (const step of [...plan.steps].sort((a, b) => a.order - b.order)) {
      const details = [
        step.when ? `when: ${step.when}` : undefined,
        step.where ? `where: ${step.where}` : undefined,
        step.estimatedMinutes !== undefined
          ? `estimated minutes: ${step.estimatedMinutes}`
          : undefined,
      ].filter((value): value is string => Boolean(value));
      lines.push(
        `Step ${step.order}: ${step.action}${
          details.length > 0 ? ` | ${details.join(' | ')}` : ''
        }`
      );
    }
    if (plan.notes) lines.push(`User note: ${plan.notes}`);
  }
  return { id: 'activityPlans', title: 'Activity plans', lines };
}

function stayingWellSection(plan: StayingWellPlan): VisitBriefSection {
  const lines: string[] = [];
  addListLine(lines, 'Daily actions', plan.dailyActions);
  addListLine(lines, 'Situations to prepare for', plan.situationsToPrepareFor);
  addListLine(lines, 'Changes I want to notice', plan.changesIWantToNotice);
  addListLine(lines, 'Responses I choose', plan.responsesIChoose);
  addContactLine(lines, 'People I want involved', plan.peopleIWantInvolved);
  return { id: 'stayingWellPlan', title: 'Staying well plan', lines };
}

function sleepDiarySection(entries: SleepDiaryEntry[]): VisitBriefSection {
  const lines: string[] = [];
  for (const entry of orderSleepDiaryEntries(entries)) {
    lines.push(
      `${entry.date}: went to bed ${entry.wentToBedAt ?? 'not entered'}; ` +
        `tried to sleep ${entry.triedToSleepAt ?? 'not entered'}; ` +
        `estimated minutes to fall asleep ${entry.estimatedMinutesToFallAsleep ?? 'not entered'}; ` +
        `final wake ${entry.finalWakeAt ?? 'not entered'}; ` +
        `got out of bed ${entry.gotOutOfBedAt ?? 'not entered'}`
    );
    if (entry.awakenings.length > 0) {
      lines.push(
        `Awakenings: ${entry.awakenings
          .map((awakening) =>
            awakening.awakeAt
              ? `${awakening.awakeAt}, estimated minutes awake ${awakening.estimatedMinutesAwake}`
              : `time not entered, estimated minutes awake ${awakening.estimatedMinutesAwake}`
          )
          .join('; ')}`
      );
    }
    const recorded = [
      entry.recordedAwakeningCount !== undefined
        ? `awakenings ${entry.recordedAwakeningCount}`
        : undefined,
      entry.recordedMinutesAwake !== undefined
        ? `minutes awake ${entry.recordedMinutesAwake}`
        : undefined,
      entry.recordedNapMinutes !== undefined
        ? `nap minutes ${entry.recordedNapMinutes}`
        : undefined,
    ].filter((value): value is string => Boolean(value));
    if (recorded.length > 0) lines.push(`Recorded totals: ${recorded.join('; ')}`);
    if (entry.naps.length > 0) {
      lines.push(
        `Naps: ${entry.naps
          .map(
            (nap) =>
              `${nap.startedAt}, duration minutes ${nap.durationMinutes}`
          )
          .join('; ')}`
      );
    }
    if (entry.notes) lines.push(`User note: ${entry.notes}`);
  }
  return { id: 'sleepDiary', title: 'Sleep diary', lines };
}

function supportPreferencesSection(
  preferences: SupportPreferences
): VisitBriefSection {
  const lines: string[] = [];
  addListLine(
    lines,
    'Preferred contact methods',
    preferences.preferredContactMethods
  );
  addListLine(lines, 'Preferred times', preferences.preferredTimes);
  addListLine(lines, 'Communication needs', preferences.communicationNeeds);
  addListLine(lines, 'Helpful support', preferences.helpfulSupport);
  addListLine(lines, 'Unhelpful support', preferences.unhelpfulSupport);
  addListLine(lines, 'Practical needs', preferences.practicalNeeds);
  addContactLine(lines, 'People to include', preferences.peopleToInclude);
  return {
    id: 'supportPreferences',
    title: 'Support preferences',
    lines,
  };
}

function safetyPlanSection(plan: SafetyPlan): VisitBriefSection {
  const lines: string[] = [];
  addListLine(lines, '1. Warning signs', plan.warningSigns);
  addListLine(
    lines,
    '2. Internal coping strategies',
    plan.internalCopingStrategies
  );
  addListLine(
    lines,
    '3. People and places for distraction',
    plan.peopleAndPlacesForDistraction
  );
  addContactLine(lines, '4. People to ask for help', plan.peopleToAskForHelp);
  addContactLine(
    lines,
    '5. Professional and agency contacts',
    plan.professionalAndAgencyContacts
  );
  addListLine(
    lines,
    '6. Ways to make the environment safer',
    plan.waysToMakeEnvironmentSafer
  );
  return { id: 'safetyPlan', title: 'Safety plan', lines };
}

function renderPreview(sections: readonly VisitBriefSection[]): string {
  const blocks = sections.map(
    (section) => `[${section.title}]\n${section.lines.join('\n')}`
  );
  return ['Visit brief', ...blocks].join('\n\n');
}

function freezeSection(section: VisitBriefSection): VisitBriefSection {
  return Object.freeze({
    ...section,
    lines: Object.freeze([...section.lines]),
  });
}

export function createVisitBriefSelection(
  input: unknown = {}
): VisitBriefSelection {
  return visitBriefSelectionSchema.parse(input);
}

export function generateVisitBrief(input: unknown): VisitBrief {
  const envelope = requestEnvelopeSchema.parse(input);
  const selection = createVisitBriefSelection(envelope.selection);
  const source = sourceEnvelopeSchema.parse(envelope.source ?? {});
  const sections: VisitBriefSection[] = [];

  // Only explicitly selected payloads are validated or transformed.
  if (selection.activityPlans) {
    const selected = activityPlansSourceSchema.parse(source.activityPlans);
    sections.push(activityPlansSection(selected.value));
  }

  if (selection.stayingWellPlan) {
    const selected = stayingWellSourceSchema.parse(source.stayingWellPlan);
    requireContent(hasStayingWellContent(selected.value), 'stayingWellPlan');
    sections.push(stayingWellSection(selected.value));
  }

  if (selection.sleepDiary) {
    const selected = sleepDiarySourceSchema.parse(source.sleepDiary);
    sections.push(sleepDiarySection(selected.value));
  }

  if (selection.supportPreferences) {
    const selected = supportPreferencesSourceSchema.parse(
      source.supportPreferences
    );
    requireContent(
      hasSupportPreferencesContent(selected.value),
      'supportPreferences'
    );
    sections.push(supportPreferencesSection(selected.value));
  }

  if (selection.safetyPlan) {
    const selected = safetyPlanSourceSchema.parse(source.safetyPlan);
    requireContent(hasSafetyPlanContent(selected.value), 'safetyPlan');
    sections.push(safetyPlanSection(selected.value));
  }

  const frozenSections = Object.freeze(sections.map(freezeSection));
  return Object.freeze({
    title: 'Visit brief' as const,
    sections: frozenSections,
    preview: renderPreview(frozenSections),
  });
}

export function getVisitBriefExportText(brief: VisitBrief): string {
  return brief.preview;
}
