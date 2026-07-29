export type MoodEmoji = '😄' | '🙂' | '😐' | '😞' | '😢';
export type AssessmentType = 'GAD7' | 'PHQ9' | 'CBI' | 'PSS4';
export type GoalStatus = 'pending' | 'completed' | 'cancelled';
export type GoalPriority = 'big' | 'medium' | 'small' | 'A' | 'B' | 'C' | 'D' | 'E';
export type FrameworkType = 'eisenhower' | 'ivy_lee' | '1-3-5' | 'abcde' | 'simple';
export type AffirmationCategory = 'self-compassion' | 'capability' | 'growth' | 'rest' | 'boundaries';
export type AffirmationKind = 'affirmation' | 'quote';
export type JournalEntryKind =
  | 'freeform'
  | 'guided'
  | 'book_note'
  | 'video_note'
  | 'story_note';
export type LibraryMediaType = 'book' | 'video' | 'story';
export type LibraryPriority = 'none' | 'next';
export type PartnerInviteStatus = 'pending' | 'accepted' | 'revoked';
export type PartnerLinkStatus = 'active' | 'revoked';
export type PartnerCelebrationKind = 'cheer' | 'reward';
export type PartnerCelebrationSource =
  | 'habit_streak'
  | 'goal_progress'
  | 'general';
export type PartnerRewardKey =
  | 'favorite_snack'
  | 'quiet_evening'
  | 'walk_together'
  | 'music_break'
  | 'celebration_call';
export type HabitType = 'build' | 'reduce';
export type HabitCategory =
  | 'wellbeing'
  | 'movement'
  | 'mindfulness'
  | 'nourishment'
  | 'sleep'
  | 'study'
  | 'home'
  | 'social'
  | 'substance'
  | 'custom';
export type RoutineSlot = 'morning' | 'afternoon' | 'evening' | 'anytime';
export type LifePlanItemType = 'dream' | 'motivation' | 'fear' | 'milestone';
export type LifePlanHorizon =
  | '30_days'
  | '90_days'
  | '1_year'
  | '3_years'
  | 'someday';
export type LifePlanStatus = 'active' | 'complete' | 'paused';
export type FocusSoundMode = 'none' | 'rain' | 'ocean' | 'brown_noise';
export type FocusSessionStatus =
  | 'planned'
  | 'running'
  | 'paused'
  | 'complete'
  | 'abandoned';
export type ReminderKind = 'habit' | 'routine' | 'focus' | 'planner';

export interface Database {
  public: {
    Tables: {
      anonymous_sessions: {
        Row: {
          id: string;
          session_id: string;
          device_fingerprint: string | null;
          created_at: string;
          last_active_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          device_fingerprint?: string | null;
          created_at?: string;
          last_active_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          device_fingerprint?: string | null;
          created_at?: string;
          last_active_at?: string;
        };
      };
      user_profiles: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      moods: {
        Row: {
          id: string;
          user_id: string | null;
          session_id: string | null;
          emoji: MoodEmoji;
          note: string | null;
          tags: string[];
          created_at: string;
          local_date: string;
          utc_offset_minutes: number;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          session_id?: string | null;
          emoji: MoodEmoji;
          note?: string | null;
          tags?: string[];
          created_at?: string;
          local_date?: string;
          utc_offset_minutes?: number;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          session_id?: string | null;
          emoji?: MoodEmoji;
          note?: string | null;
          tags?: string[];
          created_at?: string;
          local_date?: string;
          utc_offset_minutes?: number;
        };
      };
      assessments: {
        Row: {
          id: string;
          user_id: string | null;
          session_id: string | null;
          type: AssessmentType;
          score: number;
          max_score: number;
          responses: Record<string, any>;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          session_id?: string | null;
          type: AssessmentType;
          score: number;
          max_score: number;
          responses: Record<string, any>;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          session_id?: string | null;
          type?: AssessmentType;
          score?: number;
          max_score?: number;
          responses?: Record<string, any>;
          created_at?: string;
        };
      };
      goals: {
        Row: {
          id: string;
          user_id: string | null;
          session_id: string | null;
          content: string;
          status: GoalStatus;
          framework: FrameworkType;
          priority: GoalPriority | null;
          eisenhower_quadrant: string | null;
          dedupe_key: string | null;
          tags: string[];
          reflection: string | null;
          date: string;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          session_id?: string | null;
          content: string;
          status?: GoalStatus;
          framework?: FrameworkType;
          priority?: GoalPriority | null;
          eisenhower_quadrant?: string | null;
          dedupe_key?: string | null;
          tags?: string[];
          reflection?: string | null;
          date?: string;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          session_id?: string | null;
          content?: string;
          status?: GoalStatus;
          framework?: FrameworkType;
          priority?: GoalPriority | null;
          eisenhower_quadrant?: string | null;
          dedupe_key?: string | null;
          tags?: string[];
          reflection?: string | null;
          date?: string;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      habits: {
        Row: {
          id: string;
          user_id: string | null;
          session_id: string | null;
          name: string;
          description: string | null;
          frequency: string;
          streak_count: number;
          habit_type: HabitType;
          category: HabitCategory;
          icon: string;
          cue: string;
          tiny_step: string;
          routine_slot: RoutineSlot;
          reward: string;
          reward_target: number;
          best_streak: number;
          total_completions: number;
          dedupe_key: string | null;
          accountability_enabled: boolean;
          accountability_days: number[];
          accountability_timezone: string;
          accountability_share_streak: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          session_id?: string | null;
          name: string;
          description?: string | null;
          frequency?: string;
          streak_count?: number;
          habit_type?: HabitType;
          category?: HabitCategory;
          icon?: string;
          cue?: string;
          tiny_step?: string;
          routine_slot?: RoutineSlot;
          reward?: string;
          reward_target?: number;
          best_streak?: number;
          total_completions?: number;
          dedupe_key?: string | null;
          accountability_enabled?: boolean;
          accountability_days?: number[];
          accountability_timezone?: string;
          accountability_share_streak?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          session_id?: string | null;
          name?: string;
          description?: string | null;
          frequency?: string;
          streak_count?: number;
          habit_type?: HabitType;
          category?: HabitCategory;
          icon?: string;
          cue?: string;
          tiny_step?: string;
          routine_slot?: RoutineSlot;
          reward?: string;
          reward_target?: number;
          best_streak?: number;
          total_completions?: number;
          dedupe_key?: string | null;
          accountability_enabled?: boolean;
          accountability_days?: number[];
          accountability_timezone?: string;
          accountability_share_streak?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      habit_logs: {
        Row: {
          id: string;
          habit_id: string;
          completed: boolean;
          note: string | null;
          log_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          habit_id: string;
          completed?: boolean;
          note?: string | null;
          log_date?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          habit_id?: string;
          completed?: boolean;
          note?: string | null;
          log_date?: string;
          created_at?: string;
        };
      };
      chat_history: {
        Row: {
          id: string;
          user_id: string | null;
          session_id: string | null;
          messages: Array<{role: string; content: string}>;
          saved: boolean;
          title: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          session_id?: string | null;
          messages?: Array<{role: string; content: string}>;
          saved?: boolean;
          title?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          session_id?: string | null;
          messages?: Array<{role: string; content: string}>;
          saved?: boolean;
          title?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      journal_entries: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          content: string;
          prompt: string | null;
          entry_kind: JournalEntryKind;
          linked_book_id: string | null;
          linked_book_title: string | null;
          linked_media_type: LibraryMediaType | null;
          tags: string[];
          is_favorite: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          content: string;
          prompt?: string | null;
          entry_kind?: JournalEntryKind;
          linked_book_id?: string | null;
          linked_book_title?: string | null;
          linked_media_type?: LibraryMediaType | null;
          tags?: string[];
          is_favorite?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          content?: string;
          prompt?: string | null;
          entry_kind?: JournalEntryKind;
          linked_book_id?: string | null;
          linked_book_title?: string | null;
          linked_media_type?: LibraryMediaType | null;
          tags?: string[];
          is_favorite?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      affirmations: {
        Row: {
          id: string;
          content: string;
          mood_tags: MoodEmoji[];
          category: AffirmationCategory;
          kind: AffirmationKind;
          attribution_name: string | null;
          source_title: string | null;
          source_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          content: string;
          mood_tags?: MoodEmoji[];
          category: AffirmationCategory;
          kind?: AffirmationKind;
          attribution_name?: string | null;
          source_title?: string | null;
          source_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          content?: string;
          mood_tags?: MoodEmoji[];
          category?: AffirmationCategory;
          kind?: AffirmationKind;
          attribution_name?: string | null;
          source_title?: string | null;
          source_url?: string | null;
          created_at?: string;
        };
      };
      user_affirmation_history: {
        Row: {
          id: string;
          user_id: string | null;
          session_id: string | null;
          affirmation_id: string;
          shown_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          session_id?: string | null;
          affirmation_id: string;
          shown_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          session_id?: string | null;
          affirmation_id?: string;
          shown_at?: string;
        };
      };
      books: {
        Row: {
          id: string;
          title: string;
          author: string;
          summary: string;
          takeaways: string[];
          quote: string | null;
          action_step: string | null;
          tags: string[];
          read_time_minutes: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          author: string;
          summary: string;
          takeaways: string[];
          quote?: string | null;
          action_step?: string | null;
          tags?: string[];
          read_time_minutes?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          author?: string;
          summary?: string;
          takeaways?: string[];
          quote?: string | null;
          action_step?: string | null;
          tags?: string[];
          read_time_minutes?: number;
          created_at?: string;
        };
      };
      user_book_favorites: {
        Row: {
          id: string;
          user_id: string | null;
          session_id: string | null;
          book_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          session_id?: string | null;
          book_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          session_id?: string | null;
          book_id?: string;
          created_at?: string;
        };
      };
      user_library_items: {
        Row: {
          id: string;
          user_id: string;
          content_id: string;
          media_type: LibraryMediaType;
          is_saved: boolean;
          priority: LibraryPriority;
          custom_notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          content_id: string;
          media_type: LibraryMediaType;
          is_saved?: boolean;
          priority?: LibraryPriority;
          custom_notes?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          content_id?: string;
          media_type?: LibraryMediaType;
          is_saved?: boolean;
          priority?: LibraryPriority;
          custom_notes?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      life_plan_items: {
        Row: {
          id: string;
          user_id: string;
          item_type: LifePlanItemType;
          horizon: LifePlanHorizon;
          title: string;
          reflection: string;
          next_step: string;
          target_date: string | null;
          status: LifePlanStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          item_type: LifePlanItemType;
          horizon: LifePlanHorizon;
          title: string;
          reflection?: string;
          next_step?: string;
          target_date?: string | null;
          status?: LifePlanStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          item_type?: LifePlanItemType;
          horizon?: LifePlanHorizon;
          title?: string;
          reflection?: string;
          next_step?: string;
          target_date?: string | null;
          status?: LifePlanStatus;
          created_at?: string;
          updated_at?: string;
        };
      };
      focus_sessions: {
        Row: {
          id: string;
          user_id: string;
          goal_id: string | null;
          task_label: string;
          focus_minutes: number;
          break_minutes: number;
          planned_cycles: number;
          completed_cycles: number;
          sound_mode: FocusSoundMode;
          status: FocusSessionStatus;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          goal_id?: string | null;
          task_label: string;
          focus_minutes?: number;
          break_minutes?: number;
          planned_cycles?: number;
          completed_cycles?: number;
          sound_mode?: FocusSoundMode;
          status?: FocusSessionStatus;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          goal_id?: string | null;
          task_label?: string;
          focus_minutes?: number;
          break_minutes?: number;
          planned_cycles?: number;
          completed_cycles?: number;
          sound_mode?: FocusSoundMode;
          status?: FocusSessionStatus;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      wellbeing_reminders: {
        Row: {
          id: string;
          user_id: string;
          habit_id: string | null;
          kind: ReminderKind;
          label: string;
          route: string;
          enabled: boolean;
          timezone: string;
          days_of_week: number[];
          local_time: string | null;
          scheduled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          habit_id?: string | null;
          kind: ReminderKind;
          label: string;
          route: string;
          enabled?: boolean;
          timezone: string;
          days_of_week?: number[];
          local_time?: string | null;
          scheduled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          habit_id?: string | null;
          kind?: ReminderKind;
          label?: string;
          route?: string;
          enabled?: boolean;
          timezone?: string;
          days_of_week?: number[];
          local_time?: string | null;
          scheduled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth_key: string;
          user_agent: string;
          failed_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth_key: string;
          user_agent?: string;
          failed_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth_key?: string;
          user_agent?: string;
          failed_count?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      reminder_deliveries: {
        Row: {
          id: string;
          reminder_id: string;
          user_id: string;
          delivery_key: string;
          status: 'claimed' | 'delivered' | 'failed' | 'no_subscription';
          error_code: string | null;
          created_at: string;
          delivered_at: string | null;
        };
        Insert: {
          id?: string;
          reminder_id: string;
          user_id: string;
          delivery_key: string;
          status?: 'claimed' | 'delivered' | 'failed' | 'no_subscription';
          error_code?: string | null;
          created_at?: string;
          delivered_at?: string | null;
        };
        Update: {
          status?: 'claimed' | 'delivered' | 'failed' | 'no_subscription';
          error_code?: string | null;
          delivered_at?: string | null;
        };
      };
      dismissed_notices: {
        Row: {
          id: string;
          user_id: string;
          notice_key: string;
          dismissed_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          notice_key: string;
          dismissed_at?: string;
        };
        Update: {
          notice_key?: string;
          dismissed_at?: string;
        };
      };
      partner_invites: {
        Row: {
          id: string;
          owner_id: string;
          token_hash: string;
          invitee_label: string | null;
          status: PartnerInviteStatus;
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
          expires_at: string;
          created_at: string;
          accepted_at: string | null;
        };
        Insert: {
          id?: string;
          owner_id: string;
          token_hash: string;
          invitee_label?: string | null;
          status?: PartnerInviteStatus;
          share_goals?: boolean;
          share_habits?: boolean;
          share_checkins?: boolean;
          share_mood_trend?: boolean;
          share_streaks?: boolean;
          allow_celebrations?: boolean;
          share_journal_activity?: boolean;
          share_assessment_activity?: boolean;
          share_planner_progress?: boolean;
          share_focus_progress?: boolean;
          share_library_activity?: boolean;
          expires_at?: string;
          created_at?: string;
          accepted_at?: string | null;
        };
        Update: {
          invitee_label?: string | null;
          status?: PartnerInviteStatus;
          share_goals?: boolean;
          share_habits?: boolean;
          share_checkins?: boolean;
          share_mood_trend?: boolean;
          share_streaks?: boolean;
          allow_celebrations?: boolean;
          share_journal_activity?: boolean;
          share_assessment_activity?: boolean;
          share_planner_progress?: boolean;
          share_focus_progress?: boolean;
          share_library_activity?: boolean;
        };
      };
      partner_links: {
        Row: {
          id: string;
          owner_id: string;
          partner_id: string;
          partner_label: string | null;
          status: PartnerLinkStatus;
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
          created_at: string;
          revoked_at: string | null;
        };
        Insert: {
          id?: string;
          owner_id: string;
          partner_id: string;
          partner_label?: string | null;
          status?: PartnerLinkStatus;
          share_goals?: boolean;
          share_habits?: boolean;
          share_checkins?: boolean;
          share_mood_trend?: boolean;
          share_streaks?: boolean;
          allow_celebrations?: boolean;
          share_journal_activity?: boolean;
          share_assessment_activity?: boolean;
          share_planner_progress?: boolean;
          share_focus_progress?: boolean;
          share_library_activity?: boolean;
          created_at?: string;
          revoked_at?: string | null;
        };
        Update: {
          partner_label?: string | null;
          status?: PartnerLinkStatus;
          share_goals?: boolean;
          share_habits?: boolean;
          share_checkins?: boolean;
          share_mood_trend?: boolean;
          share_streaks?: boolean;
          allow_celebrations?: boolean;
          share_journal_activity?: boolean;
          share_assessment_activity?: boolean;
          share_planner_progress?: boolean;
          share_focus_progress?: boolean;
          share_library_activity?: boolean;
        };
      };
      partner_celebrations: {
        Row: {
          id: string;
          link_id: string;
          owner_id: string;
          partner_id: string;
          kind: PartnerCelebrationKind;
          source: PartnerCelebrationSource;
          milestone_count: number;
          reward_key: PartnerRewardKey | null;
          dedupe_key: string;
          seen_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          link_id: string;
          owner_id: string;
          partner_id: string;
          kind: PartnerCelebrationKind;
          source: PartnerCelebrationSource;
          milestone_count: number;
          reward_key?: PartnerRewardKey | null;
          dedupe_key: string;
          seen_at?: string | null;
          created_at?: string;
        };
        Update: {
          seen_at?: string | null;
        };
      };
      user_data_migration: {
        Row: {
          id: string;
          session_id: string;
          user_id: string;
          migrated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_id: string;
          migrated_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          user_id?: string;
          migrated_at?: string;
        };
      };
    };
  };
}
