export interface OwnedDataSource {
  table: string;
  ownerColumns: readonly string[];
  blocksAccountSwitch: boolean;
}

const ownedByUser = (
  table: string,
  blocksAccountSwitch = true
): OwnedDataSource => ({
  table,
  ownerColumns: ['user_id'],
  blocksAccountSwitch,
});

/**
 * User-owned rows removed by the current delete_owned_data database function.
 * Keep this inventory aligned with that function so account switching cannot
 * silently strand a newer data domain under an anonymous identity.
 */
export const OWNED_DATA_SOURCES: readonly OwnedDataSource[] = [
  ownedByUser('operational_events', false),
  ownedByUser('privacy_events'),
  ownedByUser('partner_support_preferences'),
  ownedByUser('sleep_diary_entries'),
  ownedByUser('safety_plan_items'),
  ownedByUser('safety_plans'),
  ownedByUser('staying_well_plan_items'),
  ownedByUser('staying_well_plans'),
  ownedByUser('activity_plan_steps'),
  ownedByUser('activity_plans'),
  {
    table: 'partner_celebrations',
    ownerColumns: ['owner_id', 'partner_id'],
    blocksAccountSwitch: true,
  },
  {
    table: 'partner_links',
    ownerColumns: ['owner_id', 'partner_id'],
    blocksAccountSwitch: true,
  },
  {
    table: 'partner_invites',
    ownerColumns: ['owner_id'],
    blocksAccountSwitch: true,
  },
  ownedByUser('reminder_deliveries'),
  ownedByUser('wellbeing_reminders'),
  ownedByUser('push_subscriptions'),
  ownedByUser('dismissed_notices'),
  ownedByUser('focus_sessions'),
  ownedByUser('life_plan_items'),
  ownedByUser('acquisition_attribution'),
  ownedByUser('ai_response_reports'),
  ownedByUser('practice_progress'),
  ownedByUser('user_library_items'),
  ownedByUser('journal_entries'),
  ownedByUser('user_affirmation_history'),
  ownedByUser('user_book_favorites'),
  ownedByUser('chat_history'),
  ownedByUser('habits'),
  ownedByUser('goal_attachments'),
  ownedByUser('goal_milestones'),
  ownedByUser('goals'),
  ownedByUser('assessments'),
  ownedByUser('moods'),
  ownedByUser('user_data_migration'),
];
