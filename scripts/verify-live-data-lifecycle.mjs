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

  const { error: moodError } = await client.from('moods').insert({
    user_id: testUserId,
    session_id: null,
    emoji: '😐',
    local_date: localDate,
    utc_offset_minutes: -now.getTimezoneOffset(),
  });
  if (moodError) throw moodError;

  const { error: journalError } = await client.from('journal_entries').insert({
    user_id: testUserId,
    title: 'Lifecycle test entry',
    content: 'This temporary entry verifies export and deletion.',
    entry_kind: 'guided',
    prompt: 'What should be removed?',
    tags: ['lifecycle-test'],
  });
  if (journalError) throw journalError;

  const { error: attributionError } = await client
    .from('acquisition_attribution')
    .insert({
      user_id: testUserId,
      source: 'founder',
      medium: 'organic',
      campaign: 'closed_test',
      content: 'founder_note',
      platform: 'web',
    });
  if (attributionError) throw attributionError;

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

  const deleted = await post('/api/data/delete');
  assert(deleted.deleted === true, 'Delete endpoint did not confirm deletion');

  const [moodsAfter, journalAfter, attributionAfter] = await Promise.all([
    client.from('moods').select('id'),
    client.from('journal_entries').select('id'),
    client.from('acquisition_attribution').select('user_id'),
  ]);
  if (moodsAfter.error) throw moodsAfter.error;
  if (journalAfter.error) throw journalAfter.error;
  if (attributionAfter.error) throw attributionAfter.error;
  assert(moodsAfter.data.length === 0, 'Mood rows remained after deletion');
  assert(
    journalAfter.data.length === 0,
    'Journal rows remained after deletion'
  );
  assert(
    attributionAfter.data.length === 0,
    'Attribution remained after deletion'
  );

  const accountResult = await post('/api/account/delete');
  assert(accountResult.deleted === true, 'Account endpoint did not confirm deletion');
  accountDeleted = true;

  console.log(
    'PASS live data lifecycle: complete export, journal deletion, attribution deletion, and account deletion'
  );
} finally {
  if (testUserId && !accountDeleted) {
    await admin.auth.admin.deleteUser(testUserId).catch(() => {});
  }
}
