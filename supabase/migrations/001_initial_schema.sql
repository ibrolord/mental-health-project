-- Create custom types
CREATE TYPE mood_emoji AS ENUM ('😄', '🙂', '😐', '😞', '😢');
CREATE TYPE assessment_type AS ENUM ('GAD7', 'PHQ9', 'CBI', 'PSS4');
CREATE TYPE goal_status AS ENUM ('pending', 'completed', 'cancelled');
CREATE TYPE goal_priority AS ENUM ('big', 'medium', 'small', 'A', 'B', 'C', 'D', 'E');
CREATE TYPE framework_type AS ENUM ('eisenhower', 'ivy_lee', '1-3-5', 'abcde', 'simple');
CREATE TYPE affirmation_category AS ENUM ('self-compassion', 'capability', 'growth', 'rest', 'boundaries');

-- Anonymous Sessions table
CREATE TABLE anonymous_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL,
  device_fingerprint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Extend users table (Supabase auth.users)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Moods table
CREATE TABLE moods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES anonymous_sessions(session_id) ON DELETE CASCADE,
  emoji mood_emoji NOT NULL,
  note TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_or_session_check CHECK (
    (user_id IS NOT NULL AND session_id IS NULL) OR 
    (user_id IS NULL AND session_id IS NOT NULL)
  )
);

-- Assessments table
CREATE TABLE assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES anonymous_sessions(session_id) ON DELETE CASCADE,
  type assessment_type NOT NULL,
  score INTEGER NOT NULL,
  max_score INTEGER NOT NULL,
  responses JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_or_session_check CHECK (
    (user_id IS NOT NULL AND session_id IS NULL) OR 
    (user_id IS NULL AND session_id IS NOT NULL)
  )
);

-- Goals table
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES anonymous_sessions(session_id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  status goal_status NOT NULL DEFAULT 'pending',
  framework framework_type DEFAULT 'simple',
  priority goal_priority,
  eisenhower_quadrant TEXT,
  tags TEXT[] DEFAULT '{}',
  reflection TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_or_session_check CHECK (
    (user_id IS NOT NULL AND session_id IS NULL) OR 
    (user_id IS NULL AND session_id IS NOT NULL)
  )
);

-- Habits table
CREATE TABLE habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES anonymous_sessions(session_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  frequency TEXT DEFAULT 'daily',
  streak_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_or_session_check CHECK (
    (user_id IS NOT NULL AND session_id IS NULL) OR 
    (user_id IS NULL AND session_id IS NOT NULL)
  )
);

-- Habit logs table
CREATE TABLE habit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT false,
  note TEXT,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(habit_id, log_date)
);

-- Chat history table
CREATE TABLE chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES anonymous_sessions(session_id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]',
  saved BOOLEAN DEFAULT false,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_or_session_check CHECK (
    (user_id IS NOT NULL AND session_id IS NULL) OR 
    (user_id IS NULL AND session_id IS NOT NULL)
  )
);

-- Affirmations table (seed data)
CREATE TABLE affirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  mood_tags mood_emoji[] DEFAULT '{}',
  category affirmation_category NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User affirmation history
CREATE TABLE user_affirmation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES anonymous_sessions(session_id) ON DELETE CASCADE,
  affirmation_id UUID REFERENCES affirmations(id) ON DELETE CASCADE,
  shown_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_or_session_check CHECK (
    (user_id IS NOT NULL AND session_id IS NULL) OR 
    (user_id IS NULL AND session_id IS NOT NULL)
  )
);

-- Books table
CREATE TABLE books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  summary TEXT NOT NULL,
  takeaways JSONB NOT NULL,
  quote TEXT,
  action_step TEXT,
  tags TEXT[] DEFAULT '{}',
  read_time_minutes INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User book favorites
CREATE TABLE user_book_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES anonymous_sessions(session_id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_or_session_check CHECK (
    (user_id IS NOT NULL AND session_id IS NULL) OR 
    (user_id IS NULL AND session_id IS NOT NULL)
  ),
  UNIQUE(user_id, book_id),
  UNIQUE(session_id, book_id)
);

-- User data migration tracking (anonymous to authenticated)
CREATE TABLE user_data_migration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES anonymous_sessions(session_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  migrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, user_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_moods_user_id ON moods(user_id);
CREATE INDEX idx_moods_session_id ON moods(session_id);
CREATE INDEX idx_moods_created_at ON moods(created_at DESC);

CREATE INDEX idx_assessments_user_id ON assessments(user_id);
CREATE INDEX idx_assessments_session_id ON assessments(session_id);
CREATE INDEX idx_assessments_type ON assessments(type);
CREATE INDEX idx_assessments_created_at ON assessments(created_at DESC);

CREATE INDEX idx_goals_user_id ON goals(user_id);
CREATE INDEX idx_goals_session_id ON goals(session_id);
CREATE INDEX idx_goals_date ON goals(date DESC);
CREATE INDEX idx_goals_status ON goals(status);

CREATE INDEX idx_habits_user_id ON habits(user_id);
CREATE INDEX idx_habits_session_id ON habits(session_id);
CREATE INDEX idx_habits_is_active ON habits(is_active);

CREATE INDEX idx_habit_logs_habit_id ON habit_logs(habit_id);
CREATE INDEX idx_habit_logs_date ON habit_logs(log_date DESC);

CREATE INDEX idx_chat_history_user_id ON chat_history(user_id);
CREATE INDEX idx_chat_history_session_id ON chat_history(session_id);
CREATE INDEX idx_chat_history_created_at ON chat_history(created_at DESC);

CREATE INDEX idx_books_tags ON books USING GIN(tags);
CREATE INDEX idx_affirmations_category ON affirmations(category);

CREATE INDEX idx_anonymous_sessions_session_id ON anonymous_sessions(session_id);
CREATE INDEX idx_anonymous_sessions_last_active ON anonymous_sessions(last_active_at DESC);

