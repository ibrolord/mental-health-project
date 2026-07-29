export type CelebrationSource = 'habit_streak' | 'goal_progress' | 'general';
export type CelebrationKind = 'cheer' | 'reward';
export type RewardKey =
  | 'favorite_snack'
  | 'quiet_evening'
  | 'walk_together'
  | 'music_break'
  | 'celebration_call';

export const REWARD_COPY: Record<RewardKey, string> = {
  favorite_snack: 'A favorite snack',
  quiet_evening: 'A quiet evening',
  walk_together: 'A walk together',
  music_break: 'A music break',
  celebration_call: 'A celebration call',
};

export type PartnerCelebration = {
  id: string;
  link_id: string;
  owner_id: string;
  partner_id: string;
  kind: CelebrationKind;
  source: CelebrationSource;
  milestone_count: number;
  reward_key: RewardKey | null;
  seen_at: string | null;
  created_at: string;
};

export function describeCelebration(event: PartnerCelebration): string {
  const progress =
    event.source === 'habit_streak'
      ? `${event.milestone_count}-day streak`
      : event.source === 'goal_progress'
        ? `${event.milestone_count} completed ${
            event.milestone_count === 1 ? 'goal' : 'goals'
          } this week`
        : 'showing up';

  if (event.kind === 'reward' && event.reward_key) {
    return `${REWARD_COPY[event.reward_key]} was offered to celebrate your ${progress}.`;
  }
  return `Your accountability partner cheered your ${progress}.`;
}
