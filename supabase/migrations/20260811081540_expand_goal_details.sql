ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_at TIMESTAMPTZ;

ALTER TABLE public.goals
  DROP CONSTRAINT IF EXISTS goals_notes_length_check,
  DROP CONSTRAINT IF EXISTS goals_reminder_requires_due_date_check,
  DROP CONSTRAINT IF EXISTS goals_reminder_before_due_date_check;

ALTER TABLE public.goals
  ADD CONSTRAINT goals_notes_length_check
    CHECK (notes IS NULL OR char_length(notes) <= 5000),
  ADD CONSTRAINT goals_reminder_requires_due_date_check
    CHECK (reminder_at IS NULL OR due_at IS NOT NULL),
  ADD CONSTRAINT goals_reminder_before_due_date_check
    CHECK (reminder_at IS NULL OR reminder_at <= due_at);

CREATE INDEX IF NOT EXISTS goals_user_pending_due_idx
  ON public.goals (user_id, due_at)
  WHERE status = 'pending' AND user_id IS NOT NULL;

CREATE TABLE public.goal_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT goal_milestones_content_length_check
    CHECK (char_length(btrim(content)) BETWEEN 1 AND 500),
  CONSTRAINT goal_milestones_position_check CHECK (position >= 0),
  CONSTRAINT goal_milestones_goal_position_unique UNIQUE (goal_id, position)
);

CREATE INDEX goal_milestones_user_goal_position_idx
  ON public.goal_milestones (user_id, goal_id, position);

CREATE UNIQUE INDEX goal_milestones_goal_content_unique_idx
  ON public.goal_milestones (goal_id, lower(btrim(content)));

ALTER TABLE public.goal_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read goal milestones"
  ON public.goal_milestones FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.goals
      WHERE goals.id = goal_milestones.goal_id
        AND goals.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Owners can create goal milestones"
  ON public.goal_milestones FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.goals
      WHERE goals.id = goal_milestones.goal_id
        AND goals.user_id = (SELECT auth.uid())
        AND goals.session_id IS NULL
    )
  );

CREATE POLICY "Owners can update goal milestones"
  ON public.goal_milestones FOR UPDATE TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.goals
      WHERE goals.id = goal_milestones.goal_id
        AND goals.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.goals
      WHERE goals.id = goal_milestones.goal_id
        AND goals.user_id = (SELECT auth.uid())
        AND goals.session_id IS NULL
    )
  );

CREATE POLICY "Owners can delete goal milestones"
  ON public.goal_milestones FOR DELETE TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.goals
      WHERE goals.id = goal_milestones.goal_id
        AND goals.user_id = (SELECT auth.uid())
    )
  );

CREATE TABLE public.goal_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT goal_attachments_file_name_length_check
    CHECK (char_length(btrim(file_name)) BETWEEN 1 AND 255),
  CONSTRAINT goal_attachments_storage_path_check
    CHECK (storage_path LIKE user_id::TEXT || '/%'),
  CONSTRAINT goal_attachments_size_check
    CHECK (size_bytes BETWEEN 1 AND 6291456)
);

CREATE INDEX goal_attachments_user_goal_idx
  ON public.goal_attachments (user_id, goal_id, created_at);

ALTER TABLE public.goal_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read goal attachments"
  ON public.goal_attachments FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.goals
      WHERE goals.id = goal_attachments.goal_id
        AND goals.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Owners can create goal attachments"
  ON public.goal_attachments FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND storage_path LIKE (SELECT auth.uid())::TEXT || '/%'
    AND EXISTS (
      SELECT 1 FROM public.goals
      WHERE goals.id = goal_attachments.goal_id
        AND goals.user_id = (SELECT auth.uid())
        AND goals.session_id IS NULL
    )
  );

CREATE POLICY "Owners can delete goal attachments"
  ON public.goal_attachments FOR DELETE TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.goals
      WHERE goals.id = goal_attachments.goal_id
        AND goals.user_id = (SELECT auth.uid())
    )
  );

REVOKE ALL ON public.goal_milestones FROM PUBLIC, anon;
REVOKE ALL ON public.goal_attachments FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goal_milestones TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.goal_attachments TO authenticated;

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'goal-attachments',
  'goal-attachments',
  FALSE,
  6291456,
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'text/plain'
  ]::TEXT[]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Owners can upload goal attachment objects"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'goal-attachments'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
  );

CREATE POLICY "Owners can read goal attachment objects"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'goal-attachments'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
  );

CREATE POLICY "Owners can delete goal attachment objects"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'goal-attachments'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
  );

COMMENT ON COLUMN public.goals.notes IS
  'Private owner notes. Never exposed through partner snapshot functions.';
COMMENT ON TABLE public.goal_milestones IS
  'Private ordered steps for a goal. Owner-only RLS; partners receive counts only.';
COMMENT ON TABLE public.goal_attachments IS
  'Private metadata for goal files stored in the goal-attachments bucket.';

-- Keep the lifecycle inventory explicit even though goal children also cascade.
CREATE OR REPLACE FUNCTION public.delete_owned_data(
  p_user_id UUID,
  p_session_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_migrated_session_ids TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF (p_user_id IS NULL) = (p_session_id IS NULL) THEN
    RAISE EXCEPTION 'Exactly one owner identifier is required';
  END IF;

  IF p_user_id IS NOT NULL THEN
    SELECT COALESCE(array_agg(session_id), ARRAY[]::TEXT[])
      INTO v_migrated_session_ids
      FROM public.user_data_migration
      WHERE user_id = p_user_id;

    DELETE FROM public.operational_events WHERE user_id = p_user_id;
    DELETE FROM public.practice_progress WHERE user_id = p_user_id;
    DELETE FROM public.privacy_events WHERE user_id = p_user_id;
    DELETE FROM public.partner_support_preferences WHERE user_id = p_user_id;
    DELETE FROM public.sleep_diary_entries WHERE user_id = p_user_id;
    DELETE FROM public.safety_plan_items WHERE user_id = p_user_id;
    DELETE FROM public.safety_plans WHERE user_id = p_user_id;
    DELETE FROM public.staying_well_plan_items WHERE user_id = p_user_id;
    DELETE FROM public.staying_well_plans WHERE user_id = p_user_id;
    DELETE FROM public.activity_plan_steps WHERE user_id = p_user_id;
    DELETE FROM public.activity_plans WHERE user_id = p_user_id;
    DELETE FROM public.partner_celebrations
      WHERE owner_id = p_user_id OR partner_id = p_user_id;
    DELETE FROM public.partner_links
      WHERE owner_id = p_user_id OR partner_id = p_user_id;
    DELETE FROM public.partner_invites WHERE owner_id = p_user_id;
    DELETE FROM public.reminder_deliveries WHERE user_id = p_user_id;
    DELETE FROM public.wellbeing_reminders WHERE user_id = p_user_id;
    DELETE FROM public.push_subscriptions WHERE user_id = p_user_id;
    DELETE FROM public.dismissed_notices WHERE user_id = p_user_id;
    DELETE FROM public.focus_sessions WHERE user_id = p_user_id;
    DELETE FROM public.life_plan_items WHERE user_id = p_user_id;
    DELETE FROM public.acquisition_attribution WHERE user_id = p_user_id;
    DELETE FROM public.ai_response_reports WHERE user_id = p_user_id;
    DELETE FROM public.user_library_items WHERE user_id = p_user_id;
    DELETE FROM public.journal_entries WHERE user_id = p_user_id;
    DELETE FROM public.user_affirmation_history WHERE user_id = p_user_id;
    DELETE FROM public.user_book_favorites WHERE user_id = p_user_id;
    DELETE FROM public.chat_history WHERE user_id = p_user_id;
    DELETE FROM public.habits WHERE user_id = p_user_id;
    DELETE FROM public.goal_attachments WHERE user_id = p_user_id;
    DELETE FROM public.goal_milestones WHERE user_id = p_user_id;
    DELETE FROM public.goals WHERE user_id = p_user_id;
    DELETE FROM public.assessments WHERE user_id = p_user_id;
    DELETE FROM public.moods WHERE user_id = p_user_id;
    DELETE FROM public.user_data_migration WHERE user_id = p_user_id;
    DELETE FROM public.anonymous_sessions AS session
      WHERE session.session_id = ANY(v_migrated_session_ids)
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_data_migration AS migration
        WHERE migration.session_id = session.session_id
      );
  ELSE
    DELETE FROM public.user_affirmation_history WHERE session_id = p_session_id;
    DELETE FROM public.user_book_favorites WHERE session_id = p_session_id;
    DELETE FROM public.chat_history WHERE session_id = p_session_id;
    DELETE FROM public.habits WHERE session_id = p_session_id;
    DELETE FROM public.goals WHERE session_id = p_session_id;
    DELETE FROM public.assessments WHERE session_id = p_session_id;
    DELETE FROM public.moods WHERE session_id = p_session_id;
    DELETE FROM public.user_data_migration WHERE session_id = p_session_id;
    DELETE FROM public.anonymous_sessions WHERE session_id = p_session_id;
  END IF;

  RETURN jsonb_build_object('deleted', true);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_owned_data(UUID, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_owned_data(UUID, TEXT)
  TO service_role;
