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
export type PracticeType = 'meditation';
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
export type ActivityKind =
  | 'movement'
  | 'social'
  | 'creative'
  | 'outdoors'
  | 'self_care'
  | 'learning'
  | 'rest'
  | 'other';
export type ActivityPlanStatus = 'planned' | 'in_progress' | 'completed' | 'skipped';
export type WellbeingPlanStatus = 'draft' | 'active' | 'archived';
export type SafetyPlanItemKind =
  | 'warning_sign'
  | 'coping_strategy'
  | 'distraction'
  | 'safe_environment'
  | 'support_contact'
  | 'professional_support'
  | 'reason_to_live'
  | 'other';
export type StayingWellItemKind =
  | 'protective_routine'
  | 'trigger'
  | 'early_warning_sign'
  | 'coping_strategy'
  | 'support_step'
  | 'clinical_step'
  | 'other';
export type PartnerSupportStyle =
  | 'not_set'
  | 'encouragement'
  | 'listening'
  | 'accountability'
  | 'practical_help'
  | 'mixed';
export type PartnerCheckInFrequency =
  | 'never'
  | 'daily'
  | 'few_times_week'
  | 'weekly'
  | 'as_needed';
export type PartnerAdviceMode = 'ask_first' | 'when_requested' | 'welcome';
export type PrivacyEventType =
  | 'privacy_notice_viewed'
  | 'consent_granted'
  | 'consent_withdrawn'
  | 'sharing_enabled'
  | 'sharing_disabled'
  | 'export_requested'
  | 'deletion_requested';
export type OperationalEventType =
  | 'route_error'
  | 'global_error'
  | 'render_error'
  | 'notification_permission_granted'
  | 'notification_permission_denied'
  | 'notification_registration_succeeded'
  | 'notification_registration_failed'
  | 'notification_scheduling_succeeded'
  | 'notification_scheduling_failed'
  | 'notification_response_received'
  | 'notification_response_failed';

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
          notes: string | null;
          due_at: string | null;
          reminder_at: string | null;
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
          notes?: string | null;
          due_at?: string | null;
          reminder_at?: string | null;
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
          notes?: string | null;
          due_at?: string | null;
          reminder_at?: string | null;
          date?: string;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      goal_milestones: {
        Row: {
          id: string;
          goal_id: string;
          user_id: string;
          content: string;
          position: number;
          due_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          goal_id: string;
          user_id: string;
          content: string;
          position?: number;
          due_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          goal_id?: string;
          user_id?: string;
          content?: string;
          position?: number;
          due_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      goal_attachments: {
        Row: {
          id: string;
          goal_id: string;
          user_id: string;
          storage_path: string;
          file_name: string;
          mime_type: string;
          size_bytes: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          goal_id: string;
          user_id: string;
          storage_path: string;
          file_name: string;
          mime_type: string;
          size_bytes: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          goal_id?: string;
          user_id?: string;
          storage_path?: string;
          file_name?: string;
          mime_type?: string;
          size_bytes?: number;
          created_at?: string;
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
      practice_progress: {
        Row: {
          user_id: string;
          practice_type: PracticeType;
          practice_id: string;
          route: '/meditate';
          step_index: number;
          step_elapsed_seconds: number;
          version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          practice_type: PracticeType;
          practice_id: string;
          route: '/meditate';
          step_index: number;
          step_elapsed_seconds: number;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          practice_id?: string;
          route?: '/meditate';
          step_index?: number;
          step_elapsed_seconds?: number;
          version?: number;
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
      activity_plans: {
        Row: {
          id: string; user_id: string; plan_date: string; activity_kind: ActivityKind;
          title: string; details: string; time_of_day: RoutineSlot;
          planned_minutes: number; status: ActivityPlanStatus; completed_at: string | null;
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; user_id: string; plan_date: string; activity_kind: ActivityKind;
          title: string; details?: string; time_of_day?: RoutineSlot;
          planned_minutes?: number; status?: ActivityPlanStatus; completed_at?: string | null;
          created_at?: string; updated_at?: string;
        };
        Update: {
          plan_date?: string; activity_kind?: ActivityKind; title?: string; details?: string;
          time_of_day?: RoutineSlot; planned_minutes?: number; status?: ActivityPlanStatus;
          completed_at?: string | null; updated_at?: string;
        };
      };
      activity_plan_steps: {
        Row: {
          id: string; plan_id: string; user_id: string; action: string; timing: string;
          location: string; estimated_minutes: number | null; position: number;
          completed: boolean; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; plan_id: string; user_id: string; action: string; timing?: string;
          location?: string; estimated_minutes?: number | null; position: number;
          completed?: boolean; created_at?: string; updated_at?: string;
        };
        Update: {
          action?: string; timing?: string; location?: string; estimated_minutes?: number | null;
          position?: number; completed?: boolean; updated_at?: string;
        };
      };
      safety_plans: {
        Row: {
          id: string; user_id: string; title: string; status: WellbeingPlanStatus;
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; user_id: string; title?: string; status?: WellbeingPlanStatus;
          created_at?: string; updated_at?: string;
        };
        Update: { title?: string; status?: WellbeingPlanStatus; updated_at?: string };
      };
      safety_plan_items: {
        Row: {
          id: string; plan_id: string; user_id: string; item_kind: SafetyPlanItemKind;
          label: string; details: string; position: number; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; plan_id: string; user_id: string; item_kind: SafetyPlanItemKind;
          label: string; details?: string; position: number; created_at?: string; updated_at?: string;
        };
        Update: {
          item_kind?: SafetyPlanItemKind; label?: string; details?: string;
          position?: number; updated_at?: string;
        };
      };
      staying_well_plans: {
        Row: {
          id: string; user_id: string; title: string; status: WellbeingPlanStatus;
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; user_id: string; title?: string; status?: WellbeingPlanStatus;
          created_at?: string; updated_at?: string;
        };
        Update: { title?: string; status?: WellbeingPlanStatus; updated_at?: string };
      };
      staying_well_plan_items: {
        Row: {
          id: string; plan_id: string; user_id: string; item_kind: StayingWellItemKind;
          label: string; details: string; position: number; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; plan_id: string; user_id: string; item_kind: StayingWellItemKind;
          label: string; details?: string; position: number; created_at?: string; updated_at?: string;
        };
        Update: {
          item_kind?: StayingWellItemKind; label?: string; details?: string;
          position?: number; updated_at?: string;
        };
      };
      sleep_diary_entries: {
        Row: {
          id: string; user_id: string; entry_date: string; went_to_bed_at: string | null;
          tried_to_sleep_at: string | null; fell_asleep_at: string | null; woke_up_at: string | null;
          got_out_of_bed_at: string | null; awakenings: number | null; awake_minutes: number | null;
          nap_minutes: number | null; timezone_offset_minutes: number | null; timezone_name: string | null;
          sleep_quality: number | null; restedness: number | null;
          notes: string; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; user_id: string; entry_date: string; went_to_bed_at?: string | null;
          tried_to_sleep_at?: string | null; fell_asleep_at?: string | null; woke_up_at?: string | null;
          got_out_of_bed_at?: string | null; awakenings?: number | null; awake_minutes?: number | null;
          nap_minutes?: number | null; timezone_offset_minutes?: number | null; timezone_name?: string | null;
          sleep_quality?: number | null; restedness?: number | null;
          notes?: string; created_at?: string; updated_at?: string;
        };
        Update: {
          went_to_bed_at?: string | null; tried_to_sleep_at?: string | null;
          fell_asleep_at?: string | null; woke_up_at?: string | null;
          got_out_of_bed_at?: string | null; awakenings?: number | null; awake_minutes?: number | null;
          nap_minutes?: number | null; timezone_offset_minutes?: number | null; timezone_name?: string | null;
          sleep_quality?: number | null; restedness?: number | null;
          notes?: string; updated_at?: string;
        };
      };
      partner_support_preferences: {
        Row: {
          user_id: string; support_style: PartnerSupportStyle;
          check_in_frequency: PartnerCheckInFrequency; advice_mode: PartnerAdviceMode;
          celebrate_progress: boolean; gentle_reminders: boolean;
          acknowledge_setbacks: boolean; created_at: string; updated_at: string;
        };
        Insert: {
          user_id: string; support_style?: PartnerSupportStyle;
          check_in_frequency?: PartnerCheckInFrequency; advice_mode?: PartnerAdviceMode;
          celebrate_progress?: boolean; gentle_reminders?: boolean;
          acknowledge_setbacks?: boolean; created_at?: string; updated_at?: string;
        };
        Update: {
          support_style?: PartnerSupportStyle; check_in_frequency?: PartnerCheckInFrequency;
          advice_mode?: PartnerAdviceMode; celebrate_progress?: boolean;
          gentle_reminders?: boolean; acknowledge_setbacks?: boolean; updated_at?: string;
        };
      };
      privacy_events: {
        Row: {
          id: string; user_id: string; event_type: PrivacyEventType;
          platform: 'web' | 'ios' | 'android'; metadata: Record<string, string>;
          occurred_at: string;
        };
        Insert: {
          id?: string; user_id: string; event_type: PrivacyEventType;
          platform: 'web' | 'ios' | 'android'; metadata?: Record<string, string>;
          occurred_at?: string;
        };
        Update: never;
      };
      operational_events: {
        Row: {
          user_id: string;
          event_type: OperationalEventType;
          source: 'web' | 'ios';
          occurred_at: string;
        };
        Insert: never;
        Update: never;
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
    Functions: {
      patch_daily_mood_check_in: {
        Args: {
          p_expected_user_id: string;
          p_emoji: MoodEmoji;
          p_note: string | null;
          p_update_note: boolean;
          p_tags: string[];
          p_update_tags: boolean;
          p_local_date: string;
          p_utc_offset_minutes: number;
          p_source: string;
          p_medium: string;
          p_campaign: string;
          p_content: string;
          p_platform: string;
        };
        Returns: string;
      };
      save_check_in_with_attribution: {
        Args: {
          p_expected_user_id: string;
          p_emoji: MoodEmoji;
          p_note: string | null;
          p_tags: string[];
          p_local_date: string;
          p_utc_offset_minutes: number;
          p_source: string;
          p_medium: string;
          p_campaign: string;
          p_content: string;
          p_platform: string;
        };
        Returns: string;
      };
      weekly_owner_summary: {
        Args: {
          p_week_start: string;
          p_timezone: string;
        };
        Returns: {
          week_start: string;
          week_end: string;
          timezone: string;
          check_in_days: number;
          completed_habit_days: number;
          completed_focus_sessions: number;
          journal_entries: number;
        };
      };
      record_operational_event: {
        Args: {
          p_event_type: OperationalEventType;
          p_source: 'web' | 'ios';
        };
        Returns: undefined;
      };
      save_practice_progress: {
        Args: {
          p_expected_user_id: string;
          p_practice_type: PracticeType;
          p_practice_id: string;
          p_route: '/meditate';
          p_step_index: number;
          p_step_elapsed_seconds: number;
          p_expected_version: number;
        };
        Returns: Database['public']['Tables']['practice_progress']['Row'];
      };
      clear_practice_progress: {
        Args: {
          p_expected_user_id: string;
          p_practice_type: PracticeType;
          p_practice_id: string;
          p_route: '/meditate';
          p_expected_version: number;
        };
        Returns: boolean;
      };
    };
  };
}
