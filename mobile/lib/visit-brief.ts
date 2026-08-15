import {
  formatHealthMinutes,
  type AppleHealthAiSummary,
} from './apple-health-core';
import { formatStoredSleepClock } from './sleep-entry';

export const VISIT_BRIEF_SECTION_ORDER = [
  'moodHistory',
  'moodNotes',
  'assessmentScores',
  'goals',
  'habits',
  'activityPlans',
  'stayingWellPlan',
  'sleepDiary',
  'appleHealth',
  'supportPreferences',
  'journalEntries',
  'savedAiConversations',
  'safetyPlan',
] as const;

export type VisitBriefSectionId = (typeof VISIT_BRIEF_SECTION_ORDER)[number];
export type VisitBriefSelection = Record<VisitBriefSectionId, boolean>;

type VisitBriefSection<T> = {
  provenance: 'user-entered' | 'device-summary';
  value: T;
};

type MoodEntry = {
  id: string;
  date: string;
  emoji: string;
  tags: string[];
};

type MoodNote = MoodEntry & { note: string };

type AssessmentScore = {
  id: string;
  type: string;
  score: number;
  maxScore: number;
  date: string;
};

type GoalMilestone = {
  content: string;
  dueAt?: string;
  completedAt?: string;
  order: number;
};

type Goal = {
  id: string;
  content: string;
  status: string;
  priority?: string;
  dueAt?: string;
  notes?: string;
  reflection?: string;
  milestones: GoalMilestone[];
  attachmentNames: string[];
};

type HabitLog = { date: string; completed: boolean; note?: string };

type Habit = {
  id: string;
  name: string;
  description?: string;
  frequency: string;
  streakCount: number;
  bestStreak: number;
  totalCompletions: number;
  cue?: string;
  tinyStep?: string;
  reward?: string;
  active: boolean;
  recentLogs: HabitLog[];
};

type JournalEntry = {
  id: string;
  title: string;
  content: string;
  prompt?: string;
  tags: string[];
  createdAt: string;
};

type ConversationMessage = { role: 'You' | 'Advisor'; content: string };

type SavedAiConversation = {
  id: string;
  title: string;
  createdAt: string;
  messages: ConversationMessage[];
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
  moodHistory?: VisitBriefSection<MoodEntry[]>;
  moodNotes?: VisitBriefSection<MoodNote[]>;
  assessmentScores?: VisitBriefSection<AssessmentScore[]>;
  goals?: VisitBriefSection<Goal[]>;
  habits?: VisitBriefSection<Habit[]>;
  activityPlans?: VisitBriefSection<ActivityPlan[]>;
  stayingWellPlan?: VisitBriefSection<StayingWellPlan>;
  sleepDiary?: VisitBriefSection<SleepEntry[]>;
  appleHealth?: VisitBriefSection<AppleHealthAiSummary>;
  supportPreferences?: VisitBriefSection<SupportPreferences>;
  journalEntries?: VisitBriefSection<JournalEntry[]>;
  savedAiConversations?: VisitBriefSection<SavedAiConversation[]>;
  safetyPlan?: VisitBriefSection<SafetyPlan>;
};

export type MoodRow = {
  id: string;
  emoji: string;
  note: string | null;
  tags: string[];
  local_date: string | null;
  created_at: string;
};

export type AssessmentRow = {
  id: string;
  type: string;
  score: number;
  max_score: number;
  created_at: string;
};

export type GoalRow = {
  id: string;
  content: string;
  status: string;
  priority: string | null;
  notes: string | null;
  reflection: string | null;
  due_at: string | null;
  updated_at: string;
};

export type GoalMilestoneRow = {
  goal_id: string;
  content: string;
  position: number;
  due_at: string | null;
  completed_at: string | null;
};

export type GoalAttachmentRow = { goal_id: string; file_name: string };

export type HabitRow = {
  id: string;
  name: string;
  description: string | null;
  frequency: string;
  streak_count: number;
  best_streak: number;
  total_completions: number;
  cue: string;
  tiny_step: string;
  reward: string;
  is_active: boolean;
  updated_at: string;
};

export type HabitLogRow = {
  habit_id: string;
  completed: boolean;
  note: string | null;
  log_date: string;
};

export type JournalEntryRow = {
  id: string;
  title: string;
  content: string;
  prompt: string | null;
  tags: string[];
  created_at: string;
};

export type SavedAiConversationRow = {
  id: string;
  title: string | null;
  messages: unknown;
  created_at: string;
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
  moods?: MoodRow[];
  assessments?: AssessmentRow[];
  goals?: GoalRow[];
  goalMilestones?: GoalMilestoneRow[];
  goalAttachments?: GoalAttachmentRow[];
  habits?: HabitRow[];
  habitLogs?: HabitLogRow[];
  activityPlans?: ActivityPlanRow[];
  activitySteps?: ActivityStepRow[];
  safetyPlan?: PlanRow | null;
  safetyItems?: PlanItemRow[];
  stayingWellPlan?: PlanRow | null;
  stayingWellItems?: PlanItemRow[];
  sleepEntries?: SleepDiaryRow[];
  supportPreferences?: SupportPreferencesRow | null;
  journalEntries?: JournalEntryRow[];
  savedAiConversations?: SavedAiConversationRow[];
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

const ASSESSMENT_LABELS: Record<string, string> = {
  GAD7: 'GAD-7',
  PHQ9: 'PHQ-9',
  CBI: 'Copenhagen Burnout Inventory',
  PSS4: 'PSS-4',
};

export function createVisitBriefSelection(): VisitBriefSelection {
  return {
    moodHistory: false,
    moodNotes: false,
    assessmentScores: false,
    goals: false,
    habits: false,
    activityPlans: false,
    stayingWellPlan: false,
    sleepDiary: false,
    appleHealth: false,
    supportPreferences: false,
    journalEntries: false,
    savedAiConversations: false,
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

function datePart(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : undefined;
}

function cleanStrings(values: readonly unknown[] | null | undefined): string[] {
  return (values ?? [])
    .filter((value): value is string => typeof value === 'string')
    .map((value) => normalizeSpace(value))
    .filter(Boolean);
}

function conversationMessages(value: unknown): ConversationMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((message): ConversationMessage[] => {
      if (typeof message !== 'object' || message === null) return [];
      const role = (message as Record<string, unknown>).role;
      const content = (message as Record<string, unknown>).content;
      if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') {
        return [];
      }
      const normalized = concise(content, 4_000);
      if (!normalized) return [];
      return [{ role: role === 'user' ? 'You' : 'Advisor', content: normalized }];
    })
    .slice(-40);
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

  const moods = (snapshot.moods ?? [])
    .flatMap((mood): MoodEntry[] => {
      const date = mood.local_date ?? datePart(mood.created_at);
      if (!date || !normalizeSpace(mood.emoji)) return [];
      return [{
        id: mood.id,
        date,
        emoji: normalizeSpace(mood.emoji),
        tags: cleanStrings(mood.tags),
      }];
    })
    .sort((left, right) => right.date.localeCompare(left.date) || left.id.localeCompare(right.id));
  if (moods.length > 0) {
    source.moodHistory = { provenance: 'user-entered', value: moods };
  }

  const moodNotes = (snapshot.moods ?? [])
    .flatMap((mood): MoodNote[] => {
      const date = mood.local_date ?? datePart(mood.created_at);
      const note = mood.note ? concise(mood.note, 2_000) : '';
      if (!date || !note || !normalizeSpace(mood.emoji)) return [];
      return [{
        id: mood.id,
        date,
        emoji: normalizeSpace(mood.emoji),
        tags: cleanStrings(mood.tags),
        note,
      }];
    })
    .sort((left, right) => right.date.localeCompare(left.date) || left.id.localeCompare(right.id));
  if (moodNotes.length > 0) {
    source.moodNotes = { provenance: 'user-entered', value: moodNotes };
  }

  const assessments = (snapshot.assessments ?? [])
    .flatMap((assessment): AssessmentScore[] => {
      const date = datePart(assessment.created_at);
      if (
        !date ||
        !normalizeSpace(assessment.type) ||
        !Number.isFinite(assessment.score) ||
        !Number.isFinite(assessment.max_score) ||
        assessment.max_score <= 0
      ) return [];
      return [{
        id: assessment.id,
        type: normalizeSpace(assessment.type),
        score: assessment.score,
        maxScore: assessment.max_score,
        date,
      }];
    })
    .sort((left, right) => right.date.localeCompare(left.date) || left.id.localeCompare(right.id));
  if (assessments.length > 0) {
    source.assessmentScores = { provenance: 'user-entered', value: assessments };
  }

  const goals = (snapshot.goals ?? [])
    .flatMap((goal): Goal[] => {
      const content = concise(goal.content, 500);
      if (!content) return [];
      const milestones = (snapshot.goalMilestones ?? [])
        .filter((milestone) => milestone.goal_id === goal.id)
        .sort((left, right) => left.position - right.position)
        .map((milestone, index) => ({
          content: concise(milestone.content, 500),
          dueAt: datePart(milestone.due_at),
          completedAt: datePart(milestone.completed_at),
          order: index + 1,
        }))
        .filter((milestone) => Boolean(milestone.content));
      return [{
        id: goal.id,
        content,
        status: normalizeSpace(goal.status) || 'pending',
        priority: goal.priority ? normalizeSpace(goal.priority) : undefined,
        dueAt: datePart(goal.due_at),
        notes: goal.notes ? concise(goal.notes, 5_000) : undefined,
        reflection: goal.reflection ? concise(goal.reflection, 5_000) : undefined,
        milestones,
        attachmentNames: cleanStrings(
          (snapshot.goalAttachments ?? [])
            .filter((attachment) => attachment.goal_id === goal.id)
            .map((attachment) => attachment.file_name)
        ),
      }];
    });
  if (goals.length > 0) {
    source.goals = { provenance: 'user-entered', value: goals };
  }

  const habits = (snapshot.habits ?? [])
    .flatMap((habit): Habit[] => {
      const name = concise(habit.name, 160);
      if (!name) return [];
      return [{
        id: habit.id,
        name,
        description: habit.description ? concise(habit.description, 1_000) : undefined,
        frequency: normalizeSpace(habit.frequency) || 'daily',
        streakCount: Math.max(0, habit.streak_count || 0),
        bestStreak: Math.max(0, habit.best_streak || 0),
        totalCompletions: Math.max(0, habit.total_completions || 0),
        cue: normalizeSpace(habit.cue) || undefined,
        tinyStep: normalizeSpace(habit.tiny_step) || undefined,
        reward: normalizeSpace(habit.reward) || undefined,
        active: habit.is_active,
        recentLogs: (snapshot.habitLogs ?? [])
          .filter((log) => log.habit_id === habit.id)
          .sort((left, right) => right.log_date.localeCompare(left.log_date))
          .map((log) => ({
            date: log.log_date,
            completed: log.completed,
            note: log.note ? concise(log.note, 500) : undefined,
          })),
      }];
    });
  if (habits.length > 0) {
    source.habits = { provenance: 'user-entered', value: habits };
  }

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

  const journalEntries = (snapshot.journalEntries ?? [])
    .flatMap((entry): JournalEntry[] => {
      const title = concise(entry.title, 160);
      const content = concise(entry.content, 12_000);
      if (!title || !content) return [];
      return [{
        id: entry.id,
        title,
        content,
        prompt: entry.prompt ? concise(entry.prompt, 500) : undefined,
        tags: cleanStrings(entry.tags),
        createdAt: entry.created_at,
      }];
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id));
  if (journalEntries.length > 0) {
    source.journalEntries = { provenance: 'user-entered', value: journalEntries };
  }

  const savedAiConversations = (snapshot.savedAiConversations ?? [])
    .flatMap((conversation): SavedAiConversation[] => {
      const messages = conversationMessages(conversation.messages);
      if (messages.length === 0) return [];
      return [{
        id: conversation.id,
        title: conversation.title ? concise(conversation.title, 160) : 'Saved conversation',
        createdAt: conversation.created_at,
        messages,
      }];
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id));
  if (savedAiConversations.length > 0) {
    source.savedAiConversations = {
      provenance: 'user-entered',
      value: savedAiConversations,
    };
  }

  return source;
}

function addList(lines: string[], label: string, values: string[]): void {
  if (values.length > 0) lines.push(`${label}: ${values.join('; ')}`);
}

function requireSource<T>(
  selected: boolean,
  section: VisitBriefSection<T> | undefined,
  label: string
): VisitBriefSection<T> | null {
  if (!selected) return null;
  if (
    !section ||
    (section.provenance !== 'user-entered' && section.provenance !== 'device-summary')
  ) {
    throw new Error(`${label} has no available content.`);
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

  const moodHistory = requireSource(
    selection.moodHistory,
    source.moodHistory,
    'Mood history'
  );
  if (moodHistory) {
    blocks.push(
      `[Mood history]\n${moodHistory.value
        .map((entry) =>
          `${entry.date}: ${entry.emoji}${entry.tags.length > 0 ? ` | words: ${entry.tags.join(', ')}` : ''}`
        )
        .join('\n')}`
    );
  }

  const moodNotes = requireSource(selection.moodNotes, source.moodNotes, 'Mood notes');
  if (moodNotes) {
    blocks.push(
      `[Mood notes]\n${moodNotes.value
        .map((entry) => `${entry.date} ${entry.emoji}: ${entry.note}`)
        .join('\n')}`
    );
  }

  const assessments = requireSource(
    selection.assessmentScores,
    source.assessmentScores,
    'Assessment scores'
  );
  if (assessments) {
    blocks.push(
      `[Assessment scores]\n${assessments.value
        .map((entry) =>
          `${entry.date}: ${ASSESSMENT_LABELS[entry.type] ?? entry.type} ${entry.score}/${entry.maxScore}`
        )
        .join('\n')}`
    );
  }

  const goals = requireSource(selection.goals, source.goals, 'Goals');
  if (goals) {
    const lines: string[] = [];
    for (const goal of goals.value) {
      const details = [
        `status: ${goal.status}`,
        goal.priority ? `priority: ${goal.priority}` : '',
        goal.dueAt ? `due: ${goal.dueAt}` : '',
      ].filter(Boolean);
      lines.push(`Goal: ${goal.content} | ${details.join(' | ')}`);
      if (goal.notes) lines.push(`Notes: ${goal.notes}`);
      if (goal.reflection) lines.push(`Reflection: ${goal.reflection}`);
      for (const milestone of goal.milestones) {
        const milestoneState = milestone.completedAt
          ? `completed ${milestone.completedAt}`
          : milestone.dueAt
            ? `due ${milestone.dueAt}`
            : 'not completed';
        lines.push(`Milestone ${milestone.order}: ${milestone.content} | ${milestoneState}`);
      }
      addList(lines, 'Attachments', goal.attachmentNames);
    }
    blocks.push(`[Goals and milestones]\n${lines.join('\n')}`);
  }

  const habits = requireSource(selection.habits, source.habits, 'Habits');
  if (habits) {
    const lines: string[] = [];
    for (const habit of habits.value) {
      lines.push(
        `Habit: ${habit.name} | ${habit.active ? 'active' : 'inactive'} | ` +
          `frequency: ${habit.frequency} | current streak: ${habit.streakCount} | ` +
          `best streak: ${habit.bestStreak} | total completions: ${habit.totalCompletions}`
      );
      if (habit.description) lines.push(`Description: ${habit.description}`);
      if (habit.cue) lines.push(`Cue: ${habit.cue}`);
      if (habit.tinyStep) lines.push(`Small step: ${habit.tinyStep}`);
      if (habit.reward) lines.push(`Reward: ${habit.reward}`);
      const completedDates = habit.recentLogs
        .filter((log) => log.completed)
        .map((log) => log.date);
      addList(lines, 'Recent completed dates', completedDates);
      for (const log of habit.recentLogs) {
        if (log.note) lines.push(`${log.date} note: ${log.note}`);
      }
    }
    blocks.push(`[Habits]\n${lines.join('\n')}`);
  }

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

  const appleHealth = requireSource(
    selection.appleHealth,
    source.appleHealth,
    'Apple Health summary'
  );
  if (appleHealth) {
    const formatWindow = (
      label: string,
      window: AppleHealthAiSummary['sevenDay']
    ) =>
      `${label}: ${window.coverageDays} days with data; ` +
      `average steps ${window.averageSteps?.toLocaleString() ?? 'unavailable'}; ` +
      `average sleep ${formatHealthMinutes(window.averageSleepMinutes)}; ` +
      `exercise minutes ${window.exerciseMinutes}; mindful minutes ${window.mindfulMinutes}; ` +
      `workouts ${window.workoutCount}; State of Mind entries ${window.stateOfMindCount}`;
    blocks.push(
      `[Apple Health aggregate summary]\n${formatWindow('7 days', appleHealth.value.sevenDay)}\n` +
      `${formatWindow('30 days', appleHealth.value.thirtyDay)}\n` +
      `Coverage note: ${appleHealth.value.moodComparison}`
    );
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

  const journal = requireSource(
    selection.journalEntries,
    source.journalEntries,
    'Journal entries'
  );
  if (journal) {
    const lines: string[] = [];
    for (const entry of journal.value) {
      lines.push(`${datePart(entry.createdAt) ?? 'Date unavailable'} — ${entry.title}`);
      if (entry.prompt) lines.push(`Prompt: ${entry.prompt}`);
      lines.push(`Entry: ${entry.content}`);
      addList(lines, 'Tags', entry.tags);
    }
    blocks.push(`[Journal entries]\n${lines.join('\n')}`);
  }

  const conversations = requireSource(
    selection.savedAiConversations,
    source.savedAiConversations,
    'Saved AI conversations'
  );
  if (conversations) {
    const lines: string[] = [];
    for (const conversation of conversations.value) {
      lines.push(`${datePart(conversation.createdAt) ?? 'Date unavailable'} — ${conversation.title}`);
      for (const message of conversation.messages) {
        lines.push(`${message.role}: ${message.content}`);
      }
    }
    blocks.push(`[Saved AI conversations]\n${lines.join('\n')}`);
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
