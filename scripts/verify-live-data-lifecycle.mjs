import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local', quiet: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiUrl =
  process.env.MHTOOLKIT_TEST_API_URL ?? 'http://127.0.0.1:3101';

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error('Missing Supabase variables in .env.local');
}

const client = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let testUserId;
let accessToken;
let accountDeleted = false;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function post(path) {
  const response = await fetch(`${apiUrl}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`${path} failed (${response.status}): ${body.error}`);
  }
  return body;
}

try {
  const { data: authData, error: authError } =
    await client.auth.signInAnonymously();
  if (authError) throw authError;
  assert(authData.user && authData.session, 'Anonymous auth did not return a session');

  testUserId = authData.user.id;
  accessToken = authData.session.access_token;

  const now = new Date();
  const localDate = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');

  const { error: moodError } = await client.rpc(
    'save_check_in_with_attribution',
    {
      p_emoji: '😐',
      p_note: 'Temporary lifecycle note',
      p_tags: ['lifecycle-test'],
      p_local_date: localDate,
      p_utc_offset_minutes: -now.getTimezoneOffset(),
      p_source: 'founder',
      p_medium: 'organic',
      p_campaign: 'closed_test',
      p_content: 'founder_note',
      p_platform: 'web',
    }
  );
  if (moodError) throw moodError;

  const { error: assessmentError } = await client.from('assessments').insert({
    user_id: testUserId,
    session_id: null,
    type: 'PHQ9',
    score: 1,
    max_score: 27,
    responses: { 0: 1 },
  });
  if (assessmentError) throw assessmentError;

  const { error: goalError } = await client.from('goals').insert({
    user_id: testUserId,
    session_id: null,
    content: 'Lifecycle test goal',
    date: localDate,
  });
  if (goalError) throw goalError;

  const { data: habit, error: habitError } = await client
    .from('habits')
    .insert({
      user_id: testUserId,
      session_id: null,
      name: 'Lifecycle test habit',
      dedupe_key: `lifecycle-test:${testUserId}`,
    })
    .select('id')
    .single();
  if (habitError) throw habitError;

  const { error: habitLogError } = await client.from('habit_logs').insert({
    habit_id: habit.id,
    completed: true,
    log_date: localDate,
  });
  if (habitLogError) throw habitLogError;

  const { error: journalError } = await client.from('journal_entries').insert({
    user_id: testUserId,
    title: 'Lifecycle test entry',
    content: 'This temporary entry verifies export and deletion.',
    entry_kind: 'guided',
    prompt: 'What should be removed?',
    tags: ['lifecycle-test'],
  });
  if (journalError) throw journalError;

  const { error: chatError } = await client.from('chat_history').insert({
    user_id: testUserId,
    session_id: null,
    messages: [
      { role: 'user', content: 'Temporary lifecycle chat' },
      { role: 'assistant', content: 'Temporary lifecycle response' },
    ],
    saved: true,
    title: 'Lifecycle test chat',
  });
  if (chatError) throw chatError;

  const { data: affirmation, error: affirmationReadError } = await client
    .from('affirmations')
    .select('id')
    .limit(1)
    .single();
  if (affirmationReadError) throw affirmationReadError;

  const { error: affirmationHistoryError } = await client
    .from('user_affirmation_history')
    .insert({
      user_id: testUserId,
      session_id: null,
      affirmation_id: affirmation.id,
    });
  if (affirmationHistoryError) throw affirmationHistoryError;

  const { error: libraryError } = await client
    .from('user_library_items')
    .insert({
      user_id: testUserId,
      content_id: 'lifecycle-test-book',
      media_type: 'book',
      is_saved: true,
      priority: 'next',
      custom_notes: 'Temporary private library note',
    });
  if (libraryError) throw libraryError;

  const { error: planError } = await client.from('life_plan_items').insert({
    user_id: testUserId,
    item_type: 'milestone',
    horizon: '30_days',
    title: 'Lifecycle test milestone',
    reflection: 'Temporary reflection',
    next_step: 'Remove this row',
  });
  if (planError) throw planError;

  const { data: activityPlan, error: activityPlanError } = await client
    .from('activity_plans')
    .insert({
      user_id: testUserId,
      plan_date: localDate,
      activity_kind: 'movement',
      title: 'Lifecycle test activity',
      details: 'Temporary activity details',
      time_of_day: 'morning',
      planned_minutes: 10,
    })
    .select('id')
    .single();
  if (activityPlanError) throw activityPlanError;

  const { error: activityStepError } = await client.from('activity_plan_steps').insert({
    plan_id: activityPlan.id,
    user_id: testUserId,
    action: 'Temporary activity step',
    timing: 'After breakfast',
    location: 'Home',
    estimated_minutes: 5,
    position: 1,
  });
  if (activityStepError) throw activityStepError;

  const { data: safetyPlan, error: safetyPlanError } = await client
    .from('safety_plans')
    .insert({ user_id: testUserId, title: 'Lifecycle safety plan', status: 'active' })
    .select('id')
    .single();
  if (safetyPlanError) throw safetyPlanError;

  const { error: safetyItemError } = await client.from('safety_plan_items').insert({
    plan_id: safetyPlan.id,
    user_id: testUserId,
    item_kind: 'warning_sign',
    label: 'Temporary warning sign',
    details: 'Temporary safety details',
    position: 0,
  });
  if (safetyItemError) throw safetyItemError;

  const { data: stayingWellPlan, error: stayingWellPlanError } = await client
    .from('staying_well_plans')
    .insert({ user_id: testUserId, title: 'Lifecycle staying-well plan', status: 'active' })
    .select('id')
    .single();
  if (stayingWellPlanError) throw stayingWellPlanError;

  const { error: stayingWellItemError } = await client
    .from('staying_well_plan_items')
    .insert({
      plan_id: stayingWellPlan.id,
      user_id: testUserId,
      item_kind: 'protective_routine',
      label: 'Temporary helpful routine',
      details: 'Temporary staying-well details',
      position: 0,
    });
  if (stayingWellItemError) throw stayingWellItemError;

  const wake = new Date(now);
  const outOfBed = new Date(wake.getTime() + 15 * 60_000);
  const fellAsleep = new Date(wake.getTime() - 8 * 60 * 60_000);
  const triedToSleep = new Date(fellAsleep.getTime() - 20 * 60_000);
  const wentToBed = new Date(triedToSleep.getTime() - 15 * 60_000);
  const { error: sleepError } = await client.from('sleep_diary_entries').insert({
    user_id: testUserId,
    entry_date: localDate,
    went_to_bed_at: wentToBed.toISOString(),
    tried_to_sleep_at: triedToSleep.toISOString(),
    fell_asleep_at: fellAsleep.toISOString(),
    woke_up_at: wake.toISOString(),
    got_out_of_bed_at: outOfBed.toISOString(),
    awakenings: 1,
    awake_minutes: 10,
    notes: 'Temporary sleep note',
  });
  if (sleepError) throw sleepError;

  const { error: preferencesError } = await client
    .from('partner_support_preferences')
    .insert({
      user_id: testUserId,
      support_style: 'listening',
      check_in_frequency: 'weekly',
      advice_mode: 'ask_first',
    });
  if (preferencesError) throw preferencesError;

  const { error: privacyEventError } = await client.rpc('record_privacy_event', {
    p_event_type: 'privacy_notice_viewed',
    p_platform: 'web',
    p_metadata: { method: 'privacy_settings' },
  });
  if (privacyEventError) throw privacyEventError;

  const { error: operationalEventError } = await client.rpc(
    'record_operational_event',
    {
      p_event_type: 'route_error',
      p_source: 'web',
    }
  );
  if (operationalEventError) throw operationalEventError;

  const { data: practiceProgress, error: practiceProgressError } =
    await client.rpc('save_practice_progress', {
      p_expected_user_id: testUserId,
      p_practice_type: 'meditation',
      p_practice_id: 'gentle-breath-reset',
      p_route: '/meditate',
      p_step_index: 0,
      p_step_elapsed_seconds: 5,
      p_expected_version: 0,
    });
  if (practiceProgressError) throw practiceProgressError;
  assert(
    practiceProgress?.user_id === testUserId && practiceProgress.version === 1,
    'Practice progress did not preserve owner and version'
  );

  const { error: focusError } = await client.from('focus_sessions').insert({
    user_id: testUserId,
    task_label: 'Lifecycle test focus',
    status: 'complete',
    completed_cycles: 1,
    completed_at: now.toISOString(),
  });
  if (focusError) throw focusError;

  const { data: reminder, error: reminderError } = await client
    .from('wellbeing_reminders')
    .insert({
      user_id: testUserId,
      kind: 'routine',
      label: 'Lifecycle test reminder',
      route: '/habits',
      timezone: 'UTC',
      local_time: '09:00:00',
    })
    .select('id')
    .single();
  if (reminderError) throw reminderError;

  const { error: pushError } = await client.from('push_subscriptions').insert({
    user_id: testUserId,
    endpoint: `https://push.example.test/${testUserId}`,
    p256dh: 'lifecycle-test-public-key',
    auth_key: 'lifecycle-auth-key',
    user_agent: 'MHtoolkit lifecycle verifier',
  });
  if (pushError) throw pushError;

  const { error: dismissedNoticeError } = await client
    .from('dismissed_notices')
    .insert({
      user_id: testUserId,
      notice_key: 'lifecycle-test-notice',
    });
  if (dismissedNoticeError) throw dismissedNoticeError;

  const { error: deliveryError } = await admin
    .from('reminder_deliveries')
    .insert({
      reminder_id: reminder.id,
      user_id: testUserId,
      delivery_key: 'lifecycle-test-delivery',
      status: 'delivered',
      delivered_at: now.toISOString(),
    });
  if (deliveryError) throw deliveryError;

  const aiResponseId = crypto.randomUUID();
  const { error: aiReportError } = await admin
    .from('ai_response_reports')
    .insert({
      response_id: aiResponseId,
      user_id: testUserId,
      subject_hash: `subject-${testUserId}`,
      response_hash: `response-${aiResponseId}`,
      reported_response: 'Temporary lifecycle AI response',
      model: 'safety',
      reason: 'incorrect',
      details: 'Temporary lifecycle report',
      platform: 'web',
      app_version: 'lifecycle-test',
    });
  if (aiReportError) throw aiReportError;

  const exported = await post('/api/data/export');
  const arraySections = [
    'profile',
    'moods',
    'assessments',
    'goals',
    'habits',
    'habit_logs',
    'journal_entries',
    'chat_history',
    'affirmation_history',
    'book_favorites',
    'library_items',
    'partner_invites',
    'partner_links',
    'partner_celebrations',
    'life_plan_items',
    'focus_sessions',
    'wellbeing_reminders',
    'push_subscriptions',
    'reminder_deliveries',
    'dismissed_notices',
    'activity_plans',
    'activity_plan_steps',
    'safety_plans',
    'safety_plan_items',
    'staying_well_plans',
    'staying_well_plan_items',
    'sleep_diary_entries',
    'partner_support_preferences',
    'privacy_events',
    'operational_events',
    'practice_progress',
    'acquisition_attribution',
    'ai_response_reports',
    'migration_history',
    'legacy_anonymous_session',
  ];

  assert(exported.account?.is_anonymous === true, 'Account metadata is incomplete');
  for (const section of arraySections) {
    assert(Array.isArray(exported[section]), `Export section ${section} is missing`);
  }
  assert(exported.moods.length === 1, 'Export did not contain the owned mood');
  assert(
    exported.journal_entries.length === 1,
    'Export did not contain the owned journal entry'
  );
  assert(
    exported.acquisition_attribution.length === 1,
    'Export did not contain acquisition attribution'
  );
  const expectedSingleRowSections = [
    'moods',
    'assessments',
    'goals',
    'habits',
    'habit_logs',
    'journal_entries',
    'chat_history',
    'affirmation_history',
    'library_items',
    'life_plan_items',
    'focus_sessions',
    'wellbeing_reminders',
    'push_subscriptions',
    'reminder_deliveries',
    'dismissed_notices',
    'activity_plans',
    'activity_plan_steps',
    'safety_plans',
    'safety_plan_items',
    'staying_well_plans',
    'staying_well_plan_items',
    'sleep_diary_entries',
    'partner_support_preferences',
    'operational_events',
    'practice_progress',
    'ai_response_reports',
  ];
  for (const section of expectedSingleRowSections) {
    assert(
      exported[section].length === 1,
      `Export section ${section} did not contain its owned row`
    );
  }
  assert(
    exported.privacy_events.length === 2,
    'Export did not contain the test privacy event and export request event'
  );
  assert(
    !('p256dh' in exported.push_subscriptions[0]) &&
      !('auth_key' in exported.push_subscriptions[0]),
    'Export exposed push encryption keys'
  );

  const deleted = await post('/api/data/delete');
  assert(deleted.deleted === true, 'Delete endpoint did not confirm deletion');

  const deletedTables = [
    'moods',
    'assessments',
    'goals',
    'habits',
    'journal_entries',
    'chat_history',
    'user_affirmation_history',
    'user_library_items',
    'life_plan_items',
    'focus_sessions',
    'wellbeing_reminders',
    'push_subscriptions',
    'reminder_deliveries',
    'dismissed_notices',
    'activity_plans',
    'activity_plan_steps',
    'safety_plans',
    'safety_plan_items',
    'staying_well_plans',
    'staying_well_plan_items',
    'sleep_diary_entries',
    'partner_support_preferences',
    'privacy_events',
    'operational_events',
    'practice_progress',
    'acquisition_attribution',
    'ai_response_reports',
  ];
  const deletionChecks = await Promise.all(
    deletedTables.map((table) =>
      admin.from(table).select('*', { count: 'exact', head: true }).eq(
        table === 'acquisition_attribution' ? 'user_id' : 'user_id',
        testUserId
      )
    )
  );
  deletionChecks.forEach((result, index) => {
    if (result.error) throw result.error;
    assert(
      result.count === 0,
      `${deletedTables[index]} rows remained after deletion`
    );
  });

  const accountResult = await post('/api/account/delete');
  assert(accountResult.deleted === true, 'Account endpoint did not confirm deletion');
  accountDeleted = true;

  console.log(
    'PASS live data lifecycle: tracker RPC, complete export, complete data deletion, and account deletion'
  );
} finally {
  if (testUserId && !accountDeleted) {
    await admin.auth.admin.deleteUser(testUserId).catch(() => {});
  }
}
