import { formatStoredSleepClock } from './sleep-entry';

export const VISIT_BRIEF_SECTION_ORDER = [
  'activityPlans',
  'stayingWellPlan',
  'sleepDiary',
  'supportPreferences',
  'safetyPlan',
] as const;

export type VisitBriefSectionId = (typeof VISIT_BRIEF_SECTION_ORDER)[number];
export type VisitBriefSelection = Record<VisitBriefSectionId, boolean>;

type UserEnteredSection<T> = {
  provenance: 'user-entered';
  value: T;
};

type ActivityStep = {
  action: string;
  when?: string;
  where?: string;
  estimatedMinutes?: number;
  order: number;
};

type ActivityPlan = {
  id: string;
  title: string;
  scheduledDate?: string;
  steps: ActivityStep[];
  notes?: string;
};

type Contact = { name: string; details?: string };

type SafetyPlan = {
  warningSigns: string[];
  internalCopingStrategies: string[];
  peopleAndPlacesForDistraction: string[];
  peopleToAskForHelp: Contact[];
  professionalAndAgencyContacts: Contact[];
  waysToMakeEnvironmentSafer: string[];
};

type StayingWellPlan = {
  dailyActions: string[];
  situationsToPrepareFor: string[];
  changesIWantToNotice: string[];
  responsesIChoose: string[];
  peopleIWantInvolved: Contact[];
};

type SleepEntry = {
  id: string;
  date: string;
  wentToBedAt?: string;
  triedToSleepAt?: string;
  estimatedMinutesToFallAsleep?: number;
  recordedAwakeningCount?: number;
  recordedMinutesAwake?: number;
  recordedNapMinutes?: number;
  finalWakeAt?: string;
  gotOutOfBedAt?: string;
  notes?: string;
};

type SupportPreferences = {
  communicationNeeds: string[];
  helpfulSupport: string[];
};

export type VisitBriefSource = {
  activityPlans?: UserEnteredSection<ActivityPlan[]>;
  stayingWellPlan?: UserEnteredSection<StayingWellPlan>;
  sleepDiary?: UserEnteredSection<SleepEntry[]>;
  supportPreferences?: UserEnteredSection<SupportPreferences>;
  safetyPlan?: UserEnteredSection<SafetyPlan>;
};

export type ActivityPlanRow = {
  id: string;
  plan_date: string;
  title: string;
  details: string;
};

export type ActivityStepRow = {
  plan_id: string;
  action: string;
  timing: string;
  location: string;
  estimated_minutes: number | null;
  position: number;
};

export type PlanRow = { id: string };

export type PlanItemRow = {
  plan_id: string;
  item_kind: string;
  label: string;
  details: string;
  position: number;
};

export type SleepDiaryRow = {
  id: string;
  entry_date: string;
  went_to_bed_at: string | null;
  tried_to_sleep_at: string | null;
  fell_asleep_at: string | null;
  woke_up_at: string | null;
  got_out_of_bed_at: string | null;
  awakenings: number | null;
  awake_minutes: number | null;
  nap_minutes: number | null;
  timezone_offset_minutes: number | null;
  timezone_name: string | null;
  notes: string;
};

export type SupportPreferencesRow = {
  support_style: string;
  check_in_frequency: string;
  advice_mode: string;
  celebrate_progress: boolean;
  gentle_reminders: boolean;
  acknowledge_setbacks: boolean;
};

export type VisitBriefDatabaseSnapshot = {
  activityPlans?: ActivityPlanRow[];
  activitySteps?: ActivityStepRow[];
  safetyPlan?: PlanRow | null;
  safetyItems?: PlanItemRow[];
  stayingWellPlan?: PlanRow | null;
  stayingWellItems?: PlanItemRow[];
  sleepEntries?: SleepDiaryRow[];
  supportPreferences?: SupportPreferencesRow | null;
};

export type VisitBrief = {
  preview: string;
  sectionCount: number;
};

export type VisitBriefTransfer = {
  previewText: string;
  sharedText: string;
};

const SUPPORT_STYLE_LABELS: Record<string, string> = {
  not_set: 'Not selected',
  encouragement: 'Encouragement',
  listening: 'Listen first',
  accountability: 'Accountability',
  practical_help: 'Practical help',
  mixed: 'A mix',
};

const FREQUENCY_LABELS: Record<string, string> = {
  never: 'Only when I ask',
  daily: 'Daily',
  few_times_week: 'A few times a week',
  weekly: 'Weekly',
  as_needed: 'As needed',
};

const ADVICE_LABELS: Record<string, string> = {
  ask_first: 'Ask before advice',
  when_requested: 'Only when requested',
  welcome: 'Advice is welcome',
};

export function createVisitBriefSelection(): VisitBriefSelection {
  return {
    activityPlans: false,
    stayingWellPlan: false,
    sleepDiary: false,
    supportPreferences: false,
    safetyPlan: false,
  };
}

function normalizeSpace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function concise(value: string, maxLength: number): string {
  const normalized = normalizeSpace(value);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(1, maxLength - 3)).trimEnd()}...`;
}

function summarize(label: string, details: string, maxLength = 160): string {
  const normalizedLabel = normalizeSpace(label);
  const normalizedDetails = normalizeSpace(details);
  return concise(
    normalizedDetails ? `${normalizedLabel}: ${normalizedDetails}` : normalizedLabel,
    maxLength
  );
}

function elapsedMinutes(from: string, to: string): number | null {
  const start = Date.parse(from);
  const end = Date.parse(to);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  const minutes = Math.round((end - start) / 60_000);
  return minutes <= 1_440 ? minutes : null;
}

function orderedItems(items: PlanItemRow[], kinds: string[]): PlanItemRow[] {
  return items
    .filter((item) => kinds.includes(item.item_kind))
    .sort((left, right) => left.position - right.position);
}

function listsForKinds(items: PlanItemRow[], kinds: string[]): string[] {
  return orderedItems(items, kinds).map((item) => summarize(item.label, item.details, 2_200));
}

function contactsForKind(items: PlanItemRow[], kind: string): Contact[] {
  return orderedItems(items, [kind]).map((item) => ({
    name: concise(item.label, 120),
    details: normalizeSpace(item.details) || undefined,
  }));
}

export function adaptVisitBriefRows(snapshot: VisitBriefDatabaseSnapshot): VisitBriefSource {
  const source: VisitBriefSource = {};
  const activityPlans = (snapshot.activityPlans ?? [])
    .flatMap((plan): ActivityPlan[] => {
      const steps = (snapshot.activitySteps ?? [])
        .filter((step) => step.plan_id === plan.id)
        .sort((left, right) => left.position - right.position);
      if (steps.length === 0 || !normalizeSpace(plan.title)) return [];
      return [
        {
          id: plan.id,
          title: concise(plan.title, 120),
          scheduledDate: plan.plan_date,
          steps: steps.map((step, index) => ({
            action: concise(step.action, 160),
            when: normalizeSpace(step.timing) || undefined,
            where: normalizeSpace(step.location) || undefined,
            estimatedMinutes:
              step.estimated_minutes &&
              step.estimated_minutes >= 1 &&
              step.estimated_minutes <= 180
                ? step.estimated_minutes
                : undefined,
            order: index + 1,
          })),
          notes: normalizeSpace(plan.details) ? concise(plan.details, 2_000) : undefined,
        },
      ];
    })
    .sort((left, right) =>
      (left.scheduledDate ?? '9999-12-31').localeCompare(
        right.scheduledDate ?? '9999-12-31'
      ) || left.title.localeCompare(right.title) || left.id.localeCompare(right.id)
    );
  if (activityPlans.length > 0) {
    source.activityPlans = { provenance: 'user-entered', value: activityPlans };
  }

  if (snapshot.safetyPlan) {
    const items = (snapshot.safetyItems ?? []).filter(
      (item) => item.plan_id === snapshot.safetyPlan?.id
    );
    const value: SafetyPlan = {
      warningSigns: listsForKinds(items, ['warning_sign']),
      internalCopingStrategies: listsForKinds(items, ['coping_strategy']),
      peopleAndPlacesForDistraction: listsForKinds(items, ['distraction']),
      peopleToAskForHelp: contactsForKind(items, 'support_contact'),
      professionalAndAgencyContacts: contactsForKind(items, 'professional_support'),
      waysToMakeEnvironmentSafer: listsForKinds(items, ['safe_environment']),
    };
    if (Object.values(value).some((itemsForField) => itemsForField.length > 0)) {
      source.safetyPlan = { provenance: 'user-entered', value };
    }
  }

  if (snapshot.stayingWellPlan) {
    const items = (snapshot.stayingWellItems ?? []).filter(
      (item) => item.plan_id === snapshot.stayingWellPlan?.id
    );
    const value: StayingWellPlan = {
      dailyActions: listsForKinds(items, ['protective_routine']),
      situationsToPrepareFor: listsForKinds(items, ['trigger']),
      changesIWantToNotice: listsForKinds(items, ['early_warning_sign']),
      responsesIChoose: listsForKinds(items, ['coping_strategy', 'clinical_step']),
      peopleIWantInvolved: contactsForKind(items, 'support_step'),
    };
    if (Object.values(value).some((itemsForField) => itemsForField.length > 0)) {
      source.stayingWellPlan = { provenance: 'user-entered', value };
    }
  }

  const sleepEntries = (snapshot.sleepEntries ?? [])
    .flatMap((entry): SleepEntry[] => {
      const wentToBedAt = entry.went_to_bed_at
        ? formatStoredSleepClock(entry.went_to_bed_at, entry.timezone_name, entry.timezone_offset_minutes) ?? undefined
        : undefined;
      const triedToSleepAt = entry.tried_to_sleep_at
        ? formatStoredSleepClock(entry.tried_to_sleep_at, entry.timezone_name, entry.timezone_offset_minutes) ?? undefined
        : undefined;
      const finalWakeAt = entry.woke_up_at
        ? formatStoredSleepClock(entry.woke_up_at, entry.timezone_name, entry.timezone_offset_minutes) ?? undefined
        : undefined;
      const gotOutOfBedAt = entry.got_out_of_bed_at
        ? formatStoredSleepClock(entry.got_out_of_bed_at, entry.timezone_name, entry.timezone_offset_minutes) ?? undefined
        : undefined;
      const minutesToSleep = entry.tried_to_sleep_at && entry.fell_asleep_at
        ? elapsedMinutes(entry.tried_to_sleep_at, entry.fell_asleep_at)
        : null;
      return [
        {
          id: entry.id,
          date: entry.entry_date,
          wentToBedAt,
          triedToSleepAt,
          estimatedMinutesToFallAsleep: minutesToSleep ?? undefined,
          recordedAwakeningCount: entry.awakenings ?? undefined,
          recordedMinutesAwake: entry.awake_minutes ?? undefined,
          recordedNapMinutes: entry.nap_minutes ?? undefined,
          finalWakeAt,
          gotOutOfBedAt,
          notes: normalizeSpace(entry.notes) || undefined,
        },
      ];
    })
    .sort((left, right) => right.date.localeCompare(left.date) || left.id.localeCompare(right.id));
  if (sleepEntries.length > 0) {
    source.sleepDiary = { provenance: 'user-entered', value: sleepEntries };
  }

  if (snapshot.supportPreferences) {
    const preferences = snapshot.supportPreferences;
    source.supportPreferences = {
      provenance: 'user-entered',
      value: {
        communicationNeeds: [
          `Support style: ${SUPPORT_STYLE_LABELS[preferences.support_style] ?? preferences.support_style}`,
          `Check-ins: ${FREQUENCY_LABELS[preferences.check_in_frequency] ?? preferences.check_in_frequency}`,
          `Advice: ${ADVICE_LABELS[preferences.advice_mode] ?? preferences.advice_mode}`,
        ],
        helpfulSupport: [
          preferences.celebrate_progress ? 'Celebrate progress' : '',
          preferences.gentle_reminders ? 'Gentle reminders' : '',
          preferences.acknowledge_setbacks
            ? 'Acknowledge setbacks without judgment'
            : '',
        ].filter(Boolean),
      },
    };
  }

  return source;
}

function addList(lines: string[], label: string, values: string[]): void {
  if (values.length > 0) lines.push(`${label}: ${values.join('; ')}`);
}

function requireSource<T>(
  selected: boolean,
  section: UserEnteredSection<T> | undefined,
  label: string
): UserEnteredSection<T> | null {
  if (!selected) return null;
  if (!section || section.provenance !== 'user-entered') {
    throw new Error(`${label} has no saved user-entered content.`);
  }
  return section;
}

function formatContact(contact: Contact): string {
  return contact.details ? `${contact.name} (details: ${contact.details})` : contact.name;
}

export function generateVisitBrief(
  selection: VisitBriefSelection,
  source: VisitBriefSource
): VisitBrief {
  const blocks: string[] = [];

  const activity = requireSource(
    selection.activityPlans,
    source.activityPlans,
    'Activity plans'
  );
  if (activity) {
    const lines: string[] = [];
    for (const plan of activity.value) {
      lines.push(
        plan.scheduledDate
          ? `Plan: ${plan.title} | date: ${plan.scheduledDate}`
          : `Plan: ${plan.title}`
      );
      for (const step of [...plan.steps].sort((a, b) => a.order - b.order)) {
        const details = [
          step.when ? `when: ${step.when}` : '',
          step.where ? `where: ${step.where}` : '',
          step.estimatedMinutes ? `estimated minutes: ${step.estimatedMinutes}` : '',
        ].filter(Boolean);
        lines.push(
          `Step ${step.order}: ${step.action}${details.length > 0 ? ` | ${details.join(' | ')}` : ''}`
        );
      }
      if (plan.notes) lines.push(`User note: ${plan.notes}`);
    }
    blocks.push(`[Activity plans]\n${lines.join('\n')}`);
  }

  const stayingWell = requireSource(
    selection.stayingWellPlan,
    source.stayingWellPlan,
    'Staying-well plan'
  );
  if (stayingWell) {
    const lines: string[] = [];
    addList(lines, 'Daily actions', stayingWell.value.dailyActions);
    addList(lines, 'Situations to prepare for', stayingWell.value.situationsToPrepareFor);
    addList(lines, 'Changes I want to notice', stayingWell.value.changesIWantToNotice);
    addList(lines, 'Responses I choose', stayingWell.value.responsesIChoose);
    addList(
      lines,
      'People I want involved',
      stayingWell.value.peopleIWantInvolved.map(formatContact)
    );
    blocks.push(`[Staying well plan]\n${lines.join('\n')}`);
  }

  const sleep = requireSource(selection.sleepDiary, source.sleepDiary, 'Sleep diary');
  if (sleep) {
    const lines: string[] = [];
    for (const entry of sleep.value) {
      lines.push(
        `${entry.date}: went to bed ${entry.wentToBedAt ?? 'not entered'}; ` +
          `tried to sleep ${entry.triedToSleepAt ?? 'not entered'}; ` +
          `estimated minutes to fall asleep ${entry.estimatedMinutesToFallAsleep ?? 'not entered'}; ` +
          `final wake ${entry.finalWakeAt ?? 'not entered'}; ` +
          `got out of bed ${entry.gotOutOfBedAt ?? 'not entered'}`
      );
      const recorded = [
        entry.recordedAwakeningCount !== undefined ? `awakenings ${entry.recordedAwakeningCount}` : '',
        entry.recordedMinutesAwake !== undefined ? `minutes awake ${entry.recordedMinutesAwake}` : '',
        entry.recordedNapMinutes !== undefined ? `nap minutes ${entry.recordedNapMinutes}` : '',
      ].filter(Boolean);
      if (recorded.length > 0) lines.push(`Recorded totals: ${recorded.join('; ')}`);
      if (entry.notes) lines.push(`User note: ${entry.notes}`);
    }
    blocks.push(`[Sleep diary]\n${lines.join('\n')}`);
  }

  const support = requireSource(
    selection.supportPreferences,
    source.supportPreferences,
    'Support preferences'
  );
  if (support) {
    const lines: string[] = [];
    addList(lines, 'Communication needs', support.value.communicationNeeds);
    addList(lines, 'Helpful support', support.value.helpfulSupport);
    blocks.push(`[Support preferences]\n${lines.join('\n')}`);
  }

  const safety = requireSource(selection.safetyPlan, source.safetyPlan, 'Safety plan');
  if (safety) {
    const lines: string[] = [];
    addList(lines, '1. Warning signs', safety.value.warningSigns);
    addList(lines, '2. Internal coping strategies', safety.value.internalCopingStrategies);
    addList(
      lines,
      '3. People and places for distraction',
      safety.value.peopleAndPlacesForDistraction
    );
    addList(lines, '4. People to ask for help', safety.value.peopleToAskForHelp.map(formatContact));
    addList(
      lines,
      '5. Professional and agency contacts',
      safety.value.professionalAndAgencyContacts.map(formatContact)
    );
    addList(
      lines,
      '6. Ways to make the environment safer',
      safety.value.waysToMakeEnvironmentSafer
    );
    blocks.push(`[Safety plan]\n${lines.join('\n')}`);
  }

  return Object.freeze({
    preview: ['Visit brief', ...blocks].join('\n\n'),
    sectionCount: blocks.length,
  });
}

export function createVisitBriefTransfer(brief: VisitBrief): VisitBriefTransfer {
  return Object.freeze({
    previewText: brief.preview,
    sharedText: brief.preview,
  });
}
