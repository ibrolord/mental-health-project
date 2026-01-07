-- Enable Row Level Security on all tables
ALTER TABLE anonymous_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE moods ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE affirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_affirmation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_book_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_data_migration ENABLE ROW LEVEL SECURITY;

-- Anonymous Sessions policies
CREATE POLICY "Users can read their own anonymous session"
  ON anonymous_sessions FOR SELECT
  USING (true); -- Public read for session validation

CREATE POLICY "Users can create anonymous sessions"
  ON anonymous_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own session"
  ON anonymous_sessions FOR UPDATE
  USING (true);

-- User Profiles policies
CREATE POLICY "Users can read their own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- Moods policies
CREATE POLICY "Users can read their own moods"
  ON moods FOR SELECT
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND session_id IS NOT NULL)
  );

CREATE POLICY "Users can insert their own moods"
  ON moods FOR INSERT
  WITH CHECK (
    (auth.uid() IS NOT NULL AND user_id = auth.uid() AND session_id IS NULL) OR
    (auth.uid() IS NULL AND session_id IS NOT NULL AND user_id IS NULL)
  );

CREATE POLICY "Users can update their own moods"
  ON moods FOR UPDATE
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND session_id IS NOT NULL)
  );

CREATE POLICY "Users can delete their own moods"
  ON moods FOR DELETE
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND session_id IS NOT NULL)
  );

-- Assessments policies
CREATE POLICY "Users can read their own assessments"
  ON assessments FOR SELECT
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND session_id IS NOT NULL)
  );

CREATE POLICY "Users can insert their own assessments"
  ON assessments FOR INSERT
  WITH CHECK (
    (auth.uid() IS NOT NULL AND user_id = auth.uid() AND session_id IS NULL) OR
    (auth.uid() IS NULL AND session_id IS NOT NULL AND user_id IS NULL)
  );

CREATE POLICY "Users can delete their own assessments"
  ON assessments FOR DELETE
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND session_id IS NOT NULL)
  );

-- Goals policies
CREATE POLICY "Users can read their own goals"
  ON goals FOR SELECT
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND session_id IS NOT NULL)
  );

CREATE POLICY "Users can insert their own goals"
  ON goals FOR INSERT
  WITH CHECK (
    (auth.uid() IS NOT NULL AND user_id = auth.uid() AND session_id IS NULL) OR
    (auth.uid() IS NULL AND session_id IS NOT NULL AND user_id IS NULL)
  );

CREATE POLICY "Users can update their own goals"
  ON goals FOR UPDATE
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND session_id IS NOT NULL)
  );

CREATE POLICY "Users can delete their own goals"
  ON goals FOR DELETE
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND session_id IS NOT NULL)
  );

-- Habits policies
CREATE POLICY "Users can read their own habits"
  ON habits FOR SELECT
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND session_id IS NOT NULL)
  );

CREATE POLICY "Users can insert their own habits"
  ON habits FOR INSERT
  WITH CHECK (
    (auth.uid() IS NOT NULL AND user_id = auth.uid() AND session_id IS NULL) OR
    (auth.uid() IS NULL AND session_id IS NOT NULL AND user_id IS NULL)
  );

CREATE POLICY "Users can update their own habits"
  ON habits FOR UPDATE
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND session_id IS NOT NULL)
  );

CREATE POLICY "Users can delete their own habits"
  ON habits FOR DELETE
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND session_id IS NOT NULL)
  );

-- Habit logs policies
CREATE POLICY "Users can read their own habit logs"
  ON habit_logs FOR SELECT
  USING (
    habit_id IN (
      SELECT id FROM habits WHERE 
        (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
        (auth.uid() IS NULL AND session_id IS NOT NULL)
    )
  );

CREATE POLICY "Users can insert their own habit logs"
  ON habit_logs FOR INSERT
  WITH CHECK (
    habit_id IN (
      SELECT id FROM habits WHERE 
        (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
        (auth.uid() IS NULL AND session_id IS NOT NULL)
    )
  );

CREATE POLICY "Users can update their own habit logs"
  ON habit_logs FOR UPDATE
  USING (
    habit_id IN (
      SELECT id FROM habits WHERE 
        (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
        (auth.uid() IS NULL AND session_id IS NOT NULL)
    )
  );

-- Chat history policies
CREATE POLICY "Users can read their own chat history"
  ON chat_history FOR SELECT
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND session_id IS NOT NULL)
  );

CREATE POLICY "Users can insert their own chat history"
  ON chat_history FOR INSERT
  WITH CHECK (
    (auth.uid() IS NOT NULL AND user_id = auth.uid() AND session_id IS NULL) OR
    (auth.uid() IS NULL AND session_id IS NOT NULL AND user_id IS NULL)
  );

CREATE POLICY "Users can update their own chat history"
  ON chat_history FOR UPDATE
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND session_id IS NOT NULL)
  );

CREATE POLICY "Users can delete their own chat history"
  ON chat_history FOR DELETE
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND session_id IS NOT NULL)
  );

-- Affirmations policies (public read)
CREATE POLICY "Anyone can read affirmations"
  ON affirmations FOR SELECT
  USING (true);

-- User affirmation history policies
CREATE POLICY "Users can read their own affirmation history"
  ON user_affirmation_history FOR SELECT
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND session_id IS NOT NULL)
  );

CREATE POLICY "Users can insert their own affirmation history"
  ON user_affirmation_history FOR INSERT
  WITH CHECK (
    (auth.uid() IS NOT NULL AND user_id = auth.uid() AND session_id IS NULL) OR
    (auth.uid() IS NULL AND session_id IS NOT NULL AND user_id IS NULL)
  );

-- Books policies (public read)
CREATE POLICY "Anyone can read books"
  ON books FOR SELECT
  USING (true);

-- User book favorites policies
CREATE POLICY "Users can read their own book favorites"
  ON user_book_favorites FOR SELECT
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND session_id IS NOT NULL)
  );

CREATE POLICY "Users can insert their own book favorites"
  ON user_book_favorites FOR INSERT
  WITH CHECK (
    (auth.uid() IS NOT NULL AND user_id = auth.uid() AND session_id IS NULL) OR
    (auth.uid() IS NULL AND session_id IS NOT NULL AND user_id IS NULL)
  );

CREATE POLICY "Users can delete their own book favorites"
  ON user_book_favorites FOR DELETE
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND session_id IS NOT NULL)
  );

-- User data migration policies
CREATE POLICY "Users can read their own migration records"
  ON user_data_migration FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own migration records"
  ON user_data_migration FOR INSERT
  WITH CHECK (auth.uid() = user_id);


