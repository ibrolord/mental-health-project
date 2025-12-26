export type MoodEmoji = '😄' | '🙂' | '😐' | '😞' | '😢';
export type AssessmentType = 'GAD7' | 'PHQ9' | 'CBI' | 'PSS4';
export type GoalStatus = 'pending' | 'completed' | 'cancelled';
export type GoalPriority = 'big' | 'medium' | 'small' | 'A' | 'B' | 'C' | 'D' | 'E';
export type FrameworkType = 'eisenhower' | 'ivy_lee' | '1-3-5' | 'abcde' | 'simple';
export type AffirmationCategory = 'self-compassion' | 'capability' | 'growth' | 'rest' | 'boundaries';

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
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          session_id?: string | null;
          emoji: MoodEmoji;
          note?: string | null;
          tags?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          session_id?: string | null;
          emoji?: MoodEmoji;
          note?: string | null;
          tags?: string[];
          created_at?: string;
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
      affirmations: {
        Row: {
          id: string;
          content: string;
          mood_tags: MoodEmoji[];
          category: AffirmationCategory;
          created_at: string;
        };
        Insert: {
          id?: string;
          content: string;
          mood_tags?: MoodEmoji[];
          category: AffirmationCategory;
          created_at?: string;
        };
        Update: {
          id?: string;
          content?: string;
          mood_tags?: MoodEmoji[];
          category?: AffirmationCategory;
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

