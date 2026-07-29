-- Cover nullable foreign keys used during goal and habit deletion.
CREATE INDEX focus_sessions_goal_id_idx
  ON public.focus_sessions (goal_id);

CREATE INDEX wellbeing_reminders_habit_id_idx
  ON public.wellbeing_reminders (habit_id);
