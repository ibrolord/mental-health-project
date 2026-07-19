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
    exported.acquisition_attribution.length === 1,
    'Export did not contain acquisition attribution'
  );

  const deleted = await post('/api/data/delete');
  assert(deleted.deleted === true, 'Delete endpoint did not confirm deletion');

  const [moodsAfter, attributionAfter] = await Promise.all([
    client.from('moods').select('id'),
    client.from('acquisition_attribution').select('user_id'),
  ]);
  if (moodsAfter.error) throw moodsAfter.error;
  if (attributionAfter.error) throw attributionAfter.error;
  assert(moodsAfter.data.length === 0, 'Mood rows remained after deletion');
  assert(
    attributionAfter.data.length === 0,
    'Attribution remained after deletion'
  );

  const accountResult = await post('/api/account/delete');
  assert(accountResult.deleted === true, 'Account endpoint did not confirm deletion');
  accountDeleted = true;

  console.log(
    'PASS live data lifecycle: complete export, transactional data deletion, attribution deletion, and account deletion'
  );
} finally {
  if (testUserId && !accountDeleted) {
    await admin.auth.admin.deleteUser(testUserId).catch(() => {});
  }
}
