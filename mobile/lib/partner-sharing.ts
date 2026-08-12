export type PartnerScopes = {
  share_goals: boolean;
  share_habits: boolean;
  share_checkins: boolean;
  share_mood_trend: boolean;
  share_streaks: boolean;
  allow_celebrations: boolean;
  share_journal_activity: boolean;
  share_assessment_activity: boolean;
  share_planner_progress: boolean;
  share_focus_progress: boolean;
  share_library_activity: boolean;
};

export const DEFAULT_SCOPES: PartnerScopes = {
  share_goals: false,
  share_habits: false,
  share_checkins: false,
  share_mood_trend: false,
  share_streaks: false,
  allow_celebrations: false,
  share_journal_activity: false,
  share_assessment_activity: false,
  share_planner_progress: false,
  share_focus_progress: false,
  share_library_activity: false,
};

export type ScopeKey = Exclude<keyof PartnerScopes, 'share_mood_trend'>;

export const SCOPE_COPY: Record<
  ScopeKey,
  { label: string; description: string }
> = {
  share_checkins: {
    label: 'Mood check-ins',
    description: 'Days checked in this week.',
  },
  share_goals: {
    label: 'Goals',
    description: 'Goals completed this week.',
  },
  share_habits: {
    label: 'Habit check-ins',
    description: 'Today’s scheduled and completed check-ins.',
  },
  share_streaks: {
    label: 'Habit streaks',
    description: 'Your best shared streak.',
  },
  allow_celebrations: {
    label: 'Cheers',
    description: 'Let your partner celebrate progress.',
  },
  share_journal_activity: {
    label: 'Journal activity',
    description: 'Entries written this week, not their text.',
  },
  share_assessment_activity: {
    label: 'Assessment activity',
    description: 'Questionnaires completed this week, not scores.',
  },
  share_planner_progress: {
    label: 'Life planner',
    description: 'Plan items completed this week.',
  },
  share_focus_progress: {
    label: 'Focus sessions',
    description: 'Focus sessions completed this week.',
  },
  share_library_activity: {
    label: 'Library activity',
    description: 'Library items updated this week.',
  },
};

export const PRIVATE_CONTENT = [
  'Journal text',
  'AI conversations',
  'Assessment answers and scores',
  'Mood notes',
  'Goal text',
  'Habit names',
] as const;
