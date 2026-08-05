import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local', quiet: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error('Missing Supabase variables in .env.local');
}

const clientOptions = {
  auth: { autoRefreshToken: false, persistSession: false },
};
const owner = createClient(supabaseUrl, anonKey, clientOptions);
const partner = createClient(supabaseUrl, anonKey, clientOptions);
const admin = createClient(supabaseUrl, serviceRoleKey, clientOptions);

const runId = randomUUID();
const ownerEmail = `auth-test-${runId}@mhtoolkit.vercel.app`;
const partnerEmail = `mhtoolkit-partner-${runId}@example.invalid`;
const ownerPassword = `Owner-${randomBytes(18).toString('base64url')}!`;
const partnerPassword = `Partner-${randomBytes(18).toString('base64url')}!`;
const localDate = new Date().toISOString().slice(0, 10);
const createdUserIds = [];
let verificationError = null;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

try {
  const { data: anonymous, error: anonymousError } =
    await owner.auth.signInAnonymously();
  if (anonymousError) throw anonymousError;
  assert(anonymous.user && anonymous.session, 'Owner anonymous session was not created');
  const ownerId = anonymous.user.id;
  createdUserIds.push(ownerId);

  const { error: goalError } = await owner.from('goals').insert({
    user_id: ownerId,
    content: 'Temporary account-upgrade verification goal',
    status: 'completed',
    date: localDate,
  });
  if (goalError) throw goalError;

  const { error: journalError } = await owner.from('journal_entries').insert({
    user_id: ownerId,
    title: 'Temporary private entry',
    content: 'This content must never be visible to an accountability partner.',
  });
  if (journalError) throw journalError;

  const { data: upgradeStarted, error: upgradeStartError } =
    await owner.auth.updateUser(
      {
        email: ownerEmail,
        data: {
          mobile_account_upgrade_started: true,
          mobile_account_upgrade_email: ownerEmail,
        },
      },
      {
        emailRedirectTo:
          `https://mhtoolkit.vercel.app/auth/mobile-confirmed?source=mobile&upgrade_user_id=${ownerId}`,
      }
    );
  if (upgradeStartError) throw upgradeStartError;
  assert(
    upgradeStarted.user.id === ownerId &&
      upgradeStarted.user.user_metadata.mobile_account_upgrade_started === true,
    'Email upgrade did not begin on the existing anonymous owner'
  );

  const { error: upgradeError } = await admin.auth.admin.updateUserById(ownerId, {
    email: ownerEmail,
    email_confirm: true,
    user_metadata: {
      mobile_account_upgrade_started: true,
      mobile_account_upgrade_email: ownerEmail,
    },
  });
  if (upgradeError) throw upgradeError;

  const { data: refreshed, error: refreshError } = await owner.auth.refreshSession();
  if (refreshError) throw refreshError;
  assert(
    refreshed.user?.id === ownerId &&
      refreshed.user.is_anonymous === false &&
      Boolean(refreshed.user.email_confirmed_at),
    'Confirmed account upgrade was not visible to the original mobile session'
  );

  const { data: completed, error: passwordError } = await owner.auth.updateUser({
    password: ownerPassword,
    data: {
      mobile_password_configured: true,
      mobile_account_upgrade_started: false,
      mobile_account_upgrade_email: null,
    },
  });
  if (passwordError) throw passwordError;
  assert(
    completed.user.id === ownerId &&
      completed.user.user_metadata.mobile_password_configured === true,
    'Password completion did not preserve the anonymous owner ID'
  );

  await owner.auth.signOut();
  const { data: signedBackIn, error: signInError } =
    await owner.auth.signInWithPassword({
      email: ownerEmail,
      password: ownerPassword,
    });
  if (signInError) throw signInError;
  assert(signedBackIn.user?.id === ownerId, 'Owner could not sign back into the upgraded account');

  const { data: preservedGoals, error: preservedGoalError } = await owner
    .from('goals')
    .select('id')
    .eq('user_id', ownerId);
  if (preservedGoalError) throw preservedGoalError;
  assert(preservedGoals.length === 1, 'Anonymous data was not preserved through account upgrade');

  const privateFixtures = [
    owner.from('moods').insert({
      user_id: ownerId,
      emoji: '😐',
      note: 'Temporary private mood note',
    }),
    owner.from('assessments').insert({
      user_id: ownerId,
      type: 'GAD7',
      score: 7,
      max_score: 21,
      responses: { private: 'Temporary assessment responses' },
    }),
    owner.from('habits').insert({
      user_id: ownerId,
      name: 'Temporary private habit name',
      description: 'Temporary private habit description',
    }),
    owner.from('chat_history').insert({
      user_id: ownerId,
      title: 'Temporary private chat',
      messages: [{ role: 'user', content: 'Temporary private chat content' }],
      saved: true,
    }),
    owner.from('user_library_items').insert({
      user_id: ownerId,
      content_id: `temporary-private-library-${runId}`,
      media_type: 'book',
      is_saved: true,
      custom_notes: 'Temporary private library notes',
    }),
    owner.from('life_plan_items').insert({
      user_id: ownerId,
      item_type: 'dream',
      horizon: '30_days',
      title: 'Temporary private life plan',
      reflection: 'Temporary private life plan reflection',
      next_step: 'Temporary private life plan next step',
    }),
    owner.from('focus_sessions').insert({
      user_id: ownerId,
      task_label: 'Temporary private focus task',
      status: 'planned',
    }),
  ];
  const privateFixtureResults = await Promise.all(privateFixtures);
  const privateFixtureError = privateFixtureResults.find((result) => result.error)?.error;
  if (privateFixtureError) throw privateFixtureError;

  const { data: privateActivity, error: privateActivityError } = await owner
    .from('activity_plans')
    .insert({
      user_id: ownerId,
      plan_date: localDate,
      activity_kind: 'movement',
      title: 'Temporary private activity plan',
      details: 'Temporary private activity details',
      planned_minutes: 10,
    })
    .select('id')
    .single();
  if (privateActivityError) throw privateActivityError;
  const { error: privateActivityStepError } = await owner
    .from('activity_plan_steps')
    .insert({
      plan_id: privateActivity.id,
      user_id: ownerId,
      action: 'Temporary private activity step',
      position: 1,
    });
  if (privateActivityStepError) throw privateActivityStepError;

  const { data: privateSafety, error: privateSafetyError } = await owner
    .from('safety_plans')
    .insert({ user_id: ownerId, title: 'Temporary private safety plan', status: 'active' })
    .select('id')
    .single();
  if (privateSafetyError) throw privateSafetyError;
  const { error: privateSafetyItemError } = await owner
    .from('safety_plan_items')
    .insert({
      plan_id: privateSafety.id,
      user_id: ownerId,
      item_kind: 'warning_sign',
      label: 'Temporary private warning sign',
      details: 'Temporary private safety details',
      position: 0,
    });
  if (privateSafetyItemError) throw privateSafetyItemError;

  const { data: privateStayingWell, error: privateStayingWellError } = await owner
    .from('staying_well_plans')
    .insert({
      user_id: ownerId,
      title: 'Temporary private staying-well plan',
      status: 'active',
    })
    .select('id')
    .single();
  if (privateStayingWellError) throw privateStayingWellError;
  const { error: privateStayingWellItemError } = await owner
    .from('staying_well_plan_items')
    .insert({
      plan_id: privateStayingWell.id,
      user_id: ownerId,
      item_kind: 'protective_routine',
      label: 'Temporary private helpful routine',
      details: 'Temporary private staying-well details',
      position: 0,
    });
  if (privateStayingWellItemError) throw privateStayingWellItemError;

  const wake = new Date();
  const { error: privateSleepError } = await owner.from('sleep_diary_entries').insert({
    user_id: ownerId,
    entry_date: localDate,
    woke_up_at: wake.toISOString(),
    notes: 'Temporary private sleep note',
  });
  if (privateSleepError) throw privateSleepError;
  const { error: privatePreferencesError } = await owner
    .from('partner_support_preferences')
    .insert({ user_id: ownerId, support_style: 'listening' });
  if (privatePreferencesError) throw privatePreferencesError;
  const { error: privateEventError } = await owner.rpc('record_privacy_event', {
    p_event_type: 'privacy_notice_viewed',
    p_platform: 'ios',
    p_metadata: {},
  });
  if (privateEventError) throw privateEventError;

  const { data: partnerAccount, error: partnerAccountError } =
    await admin.auth.admin.createUser({
      email: partnerEmail,
      password: partnerPassword,
      email_confirm: true,
    });
  if (partnerAccountError) throw partnerAccountError;
  assert(partnerAccount.user, 'Partner account was not created');
  const partnerId = partnerAccount.user.id;
  createdUserIds.push(partnerId);

  const { error: partnerSignInError } = await partner.auth.signInWithPassword({
    email: partnerEmail,
    password: partnerPassword,
  });
  if (partnerSignInError) throw partnerSignInError;

  const rawToken = randomBytes(32).toString('base64url');
  const firstHash = sha256(rawToken);
  const { data: invite, error: inviteError } = await owner
    .from('partner_invites')
    .insert({
      owner_id: ownerId,
      token_hash: firstHash,
      invitee_label: 'Live verification partner',
      share_goals: true,
      share_habits: true,
      share_checkins: true,
      share_mood_trend: false,
      share_streaks: true,
      allow_celebrations: true,
      share_journal_activity: true,
      share_assessment_activity: false,
      share_planner_progress: false,
      share_focus_progress: false,
      share_library_activity: false,
    })
    .select('id, status')
    .single();
  if (inviteError) throw inviteError;
  assert(invite.status === 'pending', 'Invite was not created as pending');

  const { data: linkId, error: acceptError } = await partner.rpc(
    'accept_partner_invite',
    { p_token_hash: firstHash }
  );
  if (acceptError) throw acceptError;
  assert(typeof linkId === 'string', 'Partner invite did not return a relationship ID');

  const { data: ownerLinks, error: ownerLinksError } = await owner
    .from('partner_links')
    .select('id, partner_id, status')
    .eq('id', linkId);
  if (ownerLinksError) throw ownerLinksError;
  assert(
    ownerLinks.length === 1 &&
      ownerLinks[0].partner_id === partnerId &&
      ownerLinks[0].status === 'active',
    'Owner could not see the accepted partner relationship'
  );

  const { data: partnerLinks, error: partnerLinksError } = await partner
    .from('partner_links')
    .select('id, owner_id, status')
    .eq('id', linkId);
  if (partnerLinksError) throw partnerLinksError;
  assert(
    partnerLinks.length === 1 &&
      partnerLinks[0].owner_id === ownerId &&
      partnerLinks[0].status === 'active',
    'Partner could not see the accepted relationship'
  );

  const { data: snapshot, error: snapshotError } = await partner.rpc(
    'partner_snapshot',
    { p_owner_id: ownerId }
  );
  if (snapshotError) throw snapshotError;
  assert(snapshot.goals?.completed === 1, 'Partner did not receive the enabled goal count');
  assert(snapshot.journal?.entries === 1, 'Partner did not receive the enabled journal count');
  const serializedSnapshot = JSON.stringify(snapshot);
  for (const secret of [
    'Temporary account-upgrade verification goal',
    'Temporary private entry',
    'Temporary private mood note',
    'Temporary assessment responses',
    'Temporary private habit name',
    'Temporary private chat content',
    'Temporary private library notes',
    'Temporary private life plan reflection',
    'Temporary private life plan next step',
    'Temporary private focus task',
    'Temporary private activity details',
    'Temporary private activity step',
    'Temporary private safety details',
    'Temporary private staying-well details',
    'Temporary private sleep note',
  ]) {
    assert(!serializedSnapshot.includes(secret), `Partner snapshot leaked private value: ${secret}`);
  }

  const privateReads = await Promise.all([
    partner.from('journal_entries').select('id, title, content').eq('user_id', ownerId),
    partner.from('moods').select('id, note').eq('user_id', ownerId),
    partner.from('goals').select('id, content').eq('user_id', ownerId),
    partner.from('habits').select('id, name, description').eq('user_id', ownerId),
    partner.from('assessments').select('id, score, responses').eq('user_id', ownerId),
    partner.from('chat_history').select('id, title, messages').eq('user_id', ownerId),
    partner.from('user_library_items').select('id, custom_notes').eq('user_id', ownerId),
    partner
      .from('life_plan_items')
      .select('id, title, reflection, next_step')
      .eq('user_id', ownerId),
    partner.from('focus_sessions').select('id, task_label').eq('user_id', ownerId),
    partner.from('activity_plans').select('id, title, details').eq('user_id', ownerId),
    partner.from('activity_plan_steps').select('id, action').eq('user_id', ownerId),
    partner.from('safety_plans').select('id, title').eq('user_id', ownerId),
    partner.from('safety_plan_items').select('id, label, details').eq('user_id', ownerId),
    partner.from('staying_well_plans').select('id, title').eq('user_id', ownerId),
    partner.from('staying_well_plan_items').select('id, label, details').eq('user_id', ownerId),
    partner.from('sleep_diary_entries').select('id, notes').eq('user_id', ownerId),
    partner.from('partner_support_preferences').select('*').eq('user_id', ownerId),
    partner.from('privacy_events').select('id, event_type').eq('user_id', ownerId),
  ]);
  for (const result of privateReads) {
    if (result.error) throw result.error;
    assert(result.data.length === 0, 'Partner could read a private owner row');
  }

  const { error: disableError } = await owner
    .from('partner_links')
    .update({ share_journal_activity: false })
    .eq('id', linkId);
  if (disableError) throw disableError;

  const { data: reducedSnapshot, error: reducedSnapshotError } = await partner.rpc(
    'partner_snapshot',
    { p_owner_id: ownerId }
  );
  if (reducedSnapshotError) throw reducedSnapshotError;
  assert(!('journal' in reducedSnapshot), 'Disabled journal activity remained in the snapshot');

  const { error: revokeError } = await owner
    .from('partner_links')
    .update({ status: 'revoked' })
    .eq('id', linkId);
  if (revokeError) throw revokeError;

  const { error: revokedSnapshotError } = await partner.rpc(
    'partner_snapshot',
    { p_owner_id: ownerId }
  );
  assert(revokedSnapshotError, 'Revoked partner could still request an owner snapshot');

  console.log(
    'PASS live account state + partner: anonymous data preserved, password sign-in works, invite accepted, aggregate toggles enforced, raw private content tables denied, revoke enforced'
  );
  console.log(
    'NOTE confirmation delivery and the user clicking the emailed redirect require an external mailbox test; this verifier uses admin confirmation after validating the real updateUser request.'
  );
} catch (error) {
  verificationError = error;
} finally {
  const cleanupResults = await Promise.allSettled(
    createdUserIds.map((id) => admin.auth.admin.deleteUser(id))
  );
  const cleanupFailures = cleanupResults.filter(
    (result) => result.status === 'rejected' || result.value.error
  );
  if (cleanupFailures.length > 0) {
    const cleanupErrors = cleanupFailures.map((result) =>
      result.status === 'rejected' ? result.reason : result.value.error
    );
    throw new AggregateError(
      verificationError ? [verificationError, ...cleanupErrors] : cleanupErrors,
      verificationError
        ? 'Live verification failed and temporary-user cleanup was incomplete'
        : 'Live verifier could not clean up every temporary user'
    );
  }
}

if (verificationError) throw verificationError;
