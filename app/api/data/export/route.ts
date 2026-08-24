import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { open, unlink, type FileHandle } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { verifyAuth, unauthorizedResponse, corsHeaders } from '@/lib/api/auth';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import {
  privacyPlatformFromRequest,
  recordServerPrivacyEvent,
} from '@/lib/privacy-events/server';
import { GOAL_ATTACHMENT_BUCKET } from '@/lib/goals/details';

type QueryResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

function requireQuery(name: string, result: QueryResult): unknown[] {
  if (result.error) {
    throw new Error(`${name} export failed: ${result.error.message}`);
  }
  return result.data ?? [];
}

type GoalAttachmentExportRow = Record<string, unknown> & {
  storage_path: string;
};

const ATTACHMENT_PAGE_SIZE = 1000;

async function loadGoalAttachmentRows(userId: string): Promise<QueryResult> {
  const supabaseAdmin = getSupabaseAdmin();
  const rows: unknown[] = [];
  for (let from = 0; ; from += ATTACHMENT_PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('goal_attachments')
      .select('*')
      .eq('user_id', userId)
      .order('storage_path', { ascending: true })
      .range(from, from + ATTACHMENT_PAGE_SIZE - 1);
    if (error) return { data: null, error };
    rows.push(...(data ?? []));
    if ((data ?? []).length < ATTACHMENT_PAGE_SIZE) break;
  }
  return { data: rows, error: null };
}

async function appendStoredRows<T extends Record<string, unknown> & { storage_path: string }>(
  file: FileHandle,
  bucket: string,
  rows: T[]
): Promise<void> {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const { data, error } = await getSupabaseAdmin().storage
      .from(bucket)
      .download(row.storage_path);
    if (error || !data) {
      throw new Error(
        `${bucket} export failed for ${row.storage_path}: ${error?.message ?? 'file missing'}`
      );
    }
    const exportedRow = {
      ...row,
      content_encoding: 'base64' as const,
      content_base64: Buffer.from(await data.arrayBuffer()).toString('base64'),
    };
    await file.write(`${index === 0 ? '' : ','}${JSON.stringify(exportedRow)}`);
  }
}

async function createExportResponse(
  exportPayload: Record<string, unknown>,
  goalAttachments: GoalAttachmentExportRow[]
): Promise<Response> {
  const path = join(tmpdir(), `mhtoolkit-export-${randomUUID()}.json`);
  let writeHandle: FileHandle | null = null;
  try {
    writeHandle = await open(path, 'wx', 0o600);
    const basePayload = JSON.stringify(exportPayload);
    await writeHandle.write(basePayload.slice(0, -1));
    await writeHandle.write(',"goal_attachments":[');
    await appendStoredRows(writeHandle, GOAL_ATTACHMENT_BUCKET, goalAttachments);
    await writeHandle.write(']}');
    await writeHandle.sync();
    await writeHandle.close();
    writeHandle = null;

    const readHandle = await open(path, 'r');
    const { size } = await readHandle.stat();
    await unlink(path);
    const stream = Readable.toWeb(
      readHandle.createReadStream({ autoClose: true })
    ) as ReadableStream<Uint8Array>;
    return new Response(stream, {
      headers: {
        ...corsHeaders(),
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': String(size),
        'Content-Disposition': 'attachment; filename="mhtoolkit-data-export.json"',
      },
    });
  } catch (error) {
    if (writeHandle) await writeHandle.close().catch(() => {});
    await unlink(path).catch(() => {});
    throw error;
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.valid) return unauthorizedResponse();
    if (!auth.userId && !auth.sessionId) return unauthorizedResponse();

    const body = await request.json().catch(() => ({}));
    const expectedUserId =
      typeof body?.expectedUserId === 'string' ? body.expectedUserId : null;
    if (auth.userId && !expectedUserId) {
      return NextResponse.json(
        { error: 'The profile could not be verified. No data was exported.' },
        { status: 409, headers: corsHeaders() }
      );
    }
    if (expectedUserId && auth.userId !== expectedUserId) {
      return NextResponse.json(
        { error: 'The profile changed before export. No data was exported.' },
        { status: 409, headers: corsHeaders() }
      );
    }

    const ownerColumn = auth.userId ? 'user_id' : 'session_id';
    const ownerValue = auth.userId ?? auth.sessionId!;
    const supabaseAdmin = getSupabaseAdmin();

    if (auth.userId) {
      await recordServerPrivacyEvent({
        userId: auth.userId,
        eventType: 'export_requested',
        platform: privacyPlatformFromRequest(request),
        metadata: { method: 'account_settings' },
      });
    }

    const [
      moodsResult,
      assessmentsResult,
      goalsResult,
      goalMilestonesResult,
      goalAttachmentsResult,
      habitsResult,
      journalEntriesResult,
      chatHistoryResult,
      affirmationHistoryResult,
      bookFavoritesResult,
      libraryItemsResult,
      practiceProgressResult,
      partnerInvitesResult,
      partnerLinksResult,
      partnerCelebrationsResult,
      togetherConnectionsResult,
      togetherMembershipsResult,
      togetherScopesResult,
      togetherCommitmentsResult,
      togetherCheckInsResult,
      togetherCommitmentNotesResult,
      togetherCheckInNotesResult,
      togetherCommentsResult,
      togetherNudgesResult,
      togetherSuggestionsResult,
      togetherRewardsResult,
      togetherBlocksResult,
      lifePlanItemsResult,
      focusSessionsResult,
      wellbeingRemindersResult,
      pushSubscriptionsResult,
      reminderDeliveriesResult,
      dismissedNoticesResult,
      activityPlansResult,
      activityPlanStepsResult,
      safetyPlansResult,
      safetyPlanItemsResult,
      stayingWellPlansResult,
      stayingWellPlanItemsResult,
      sleepDiaryEntriesResult,
      partnerSupportPreferencesResult,
      privacyEventsResult,
      operationalEventsResult,
    ] = await Promise.all([
      supabaseAdmin.from('moods').select('*').eq(ownerColumn, ownerValue),
      supabaseAdmin.from('assessments').select('*').eq(ownerColumn, ownerValue),
      supabaseAdmin.from('goals').select('*').eq(ownerColumn, ownerValue),
      auth.userId
        ? supabaseAdmin.from('goal_milestones').select('*').eq('user_id', auth.userId)
        : Promise.resolve({ data: [], error: null }),
      auth.userId
        ? loadGoalAttachmentRows(auth.userId)
        : Promise.resolve({ data: [], error: null }),
      supabaseAdmin.from('habits').select('*').eq(ownerColumn, ownerValue),
      auth.userId
        ? supabaseAdmin
            .from('journal_entries')
            .select('*')
            .eq('user_id', auth.userId)
        : Promise.resolve({ data: [], error: null }),
      supabaseAdmin.from('chat_history').select('*').eq(ownerColumn, ownerValue),
      supabaseAdmin
        .from('user_affirmation_history')
        .select('*')
        .eq(ownerColumn, ownerValue),
      supabaseAdmin
        .from('user_book_favorites')
        .select('*')
        .eq(ownerColumn, ownerValue),
      auth.userId
        ? supabaseAdmin
            .from('user_library_items')
            .select('*')
            .eq('user_id', auth.userId)
        : Promise.resolve({ data: [], error: null }),
      auth.userId
        ? supabaseAdmin
            .from('practice_progress')
            .select('*')
            .eq('user_id', auth.userId)
        : Promise.resolve({ data: [], error: null }),
      auth.userId
        ? supabaseAdmin
            .from('partner_invites')
            .select(
              'id, owner_id, invitee_label, status, share_goals, share_habits, share_checkins, share_mood_trend, share_streaks, allow_celebrations, share_journal_activity, share_assessment_activity, share_planner_progress, share_focus_progress, share_library_activity, expires_at, created_at, accepted_at'
            )
            .eq('owner_id', auth.userId)
        : Promise.resolve({ data: [], error: null }),
      auth.userId
        ? supabaseAdmin
            .from('partner_links')
            .select('*')
            .or(`owner_id.eq.${auth.userId},partner_id.eq.${auth.userId}`)
        : Promise.resolve({ data: [], error: null }),
      auth.userId
        ? supabaseAdmin
            .from('partner_celebrations')
            .select('*')
            .or(`owner_id.eq.${auth.userId},partner_id.eq.${auth.userId}`)
        : Promise.resolve({ data: [], error: null }),
      auth.userId
        ? supabaseAdmin
            .from('accountability_connections')
            .select('id,owner_id,partner_id,status,expires_at,used_at,accepted_at,ended_at,ended_by,created_at')
            .or(`owner_id.eq.${auth.userId},partner_id.eq.${auth.userId}`)
        : Promise.resolve({ data: [], error: null }),
      auth.userId
        ? supabaseAdmin.from('accountability_memberships').select('*').eq('user_id', auth.userId)
        : Promise.resolve({ data: [], error: null }),
      auth.userId
        ? supabaseAdmin.from('accountability_scope_controls').select('*').eq('owner_id', auth.userId)
        : Promise.resolve({ data: [], error: null }),
      auth.userId
        ? supabaseAdmin.from('accountability_commitments').select('*').eq('owner_id', auth.userId)
        : Promise.resolve({ data: [], error: null }),
      auth.userId
        ? supabaseAdmin.from('accountability_check_ins').select('*').eq('owner_id', auth.userId)
        : Promise.resolve({ data: [], error: null }),
      auth.userId
        ? supabaseAdmin.from('accountability_commitment_notes').select('*').eq('owner_id', auth.userId)
        : Promise.resolve({ data: [], error: null }),
      auth.userId
        ? supabaseAdmin.from('accountability_check_in_notes').select('*').eq('owner_id', auth.userId)
        : Promise.resolve({ data: [], error: null }),
      auth.userId
        ? supabaseAdmin.from('accountability_comments').select('*').eq('author_id', auth.userId)
        : Promise.resolve({ data: [], error: null }),
      auth.userId
        ? supabaseAdmin
            .from('accountability_nudges')
            .select('*')
            .or(`sender_id.eq.${auth.userId},recipient_id.eq.${auth.userId}`)
        : Promise.resolve({ data: [], error: null }),
      auth.userId
        ? supabaseAdmin.from('accountability_priority_suggestions').select('*').eq('suggested_by', auth.userId)
        : Promise.resolve({ data: [], error: null }),
      auth.userId
        ? supabaseAdmin.from('accountability_rewards').select('*').eq('owner_id', auth.userId)
        : Promise.resolve({ data: [], error: null }),
      auth.userId
        ? supabaseAdmin.from('accountability_blocks').select('*').eq('blocker_id', auth.userId)
        : Promise.resolve({ data: [], error: null }),
      auth.userId
        ? supabaseAdmin
            .from('life_plan_items')
            .select('*')
            .eq('user_id', auth.userId)
        : Promise.resolve({ data: [], error: null }),
      auth.userId
        ? supabaseAdmin
            .from('focus_sessions')
            .select('*')
            .eq('user_id', auth.userId)
        : Promise.resolve({ data: [], error: null }),
      auth.userId
        ? supabaseAdmin
            .from('wellbeing_reminders')
            .select('*')
            .eq('user_id', auth.userId)
        : Promise.resolve({ data: [], error: null }),
      auth.userId
        ? supabaseAdmin
            .from('push_subscriptions')
            .select('id, endpoint, user_agent, failed_count, created_at, updated_at')
            .eq('user_id', auth.userId)
        : Promise.resolve({ data: [], error: null }),
      auth.userId
        ? supabaseAdmin
            .from('reminder_deliveries')
            .select('*')
            .eq('user_id', auth.userId)
        : Promise.resolve({ data: [], error: null }),
      auth.userId
        ? supabaseAdmin
            .from('dismissed_notices')
            .select('*')
            .eq('user_id', auth.userId)
        : Promise.resolve({ data: [], error: null }),
      auth.userId ? supabaseAdmin.from('activity_plans').select('*').eq('user_id', auth.userId) : Promise.resolve({ data: [], error: null }),
      auth.userId ? supabaseAdmin.from('activity_plan_steps').select('*').eq('user_id', auth.userId) : Promise.resolve({ data: [], error: null }),
      auth.userId ? supabaseAdmin.from('safety_plans').select('*').eq('user_id', auth.userId) : Promise.resolve({ data: [], error: null }),
      auth.userId ? supabaseAdmin.from('safety_plan_items').select('*').eq('user_id', auth.userId) : Promise.resolve({ data: [], error: null }),
      auth.userId ? supabaseAdmin.from('staying_well_plans').select('*').eq('user_id', auth.userId) : Promise.resolve({ data: [], error: null }),
      auth.userId ? supabaseAdmin.from('staying_well_plan_items').select('*').eq('user_id', auth.userId) : Promise.resolve({ data: [], error: null }),
      auth.userId ? supabaseAdmin.from('sleep_diary_entries').select('*').eq('user_id', auth.userId) : Promise.resolve({ data: [], error: null }),
      auth.userId ? supabaseAdmin.from('partner_support_preferences').select('*').eq('user_id', auth.userId) : Promise.resolve({ data: [], error: null }),
      auth.userId ? supabaseAdmin.from('privacy_events').select('*').eq('user_id', auth.userId) : Promise.resolve({ data: [], error: null }),
      auth.userId ? supabaseAdmin.from('operational_events').select('*').eq('user_id', auth.userId) : Promise.resolve({ data: [], error: null }),
    ]);

    const habits = requireQuery('habits', habitsResult);
    const habitIds = habits
      .map((habit) => (habit as { id?: unknown }).id)
      .filter((id): id is string => typeof id === 'string');
    const habitLogsResult: QueryResult =
      habitIds.length === 0
        ? { data: [], error: null }
        : await supabaseAdmin.from('habit_logs').select('*').in('habit_id', habitIds);

    const [
      accountResult,
      profileResult,
      migrationResult,
      attributionResult,
      aiReportsResult,
      legacySessionResult,
    ] = auth.userId
      ? await Promise.all([
          supabaseAdmin.auth.admin.getUserById(auth.userId),
          supabaseAdmin.from('user_profiles').select('*').eq('id', auth.userId),
          supabaseAdmin
            .from('user_data_migration')
            .select('*')
            .eq('user_id', auth.userId),
          supabaseAdmin
            .from('acquisition_attribution')
            .select('source, medium, campaign, content, platform, captured_at')
            .eq('user_id', auth.userId),
          supabaseAdmin
            .from('ai_response_reports')
            .select('*')
            .eq('user_id', auth.userId),
          Promise.resolve({ data: [], error: null }),
        ])
      : await Promise.all([
          Promise.resolve({ data: { user: null }, error: null }),
          Promise.resolve({ data: [], error: null }),
          supabaseAdmin
            .from('user_data_migration')
            .select('*')
            .eq('session_id', auth.sessionId!),
          Promise.resolve({ data: [], error: null }),
          Promise.resolve({ data: [], error: null }),
          supabaseAdmin
            .from('anonymous_sessions')
            .select('*')
            .eq('session_id', auth.sessionId!),
        ]);

    if (accountResult.error) {
      throw new Error(`account export failed: ${accountResult.error.message}`);
    }

    const account = accountResult.data.user
      ? {
          id: accountResult.data.user.id,
          email: accountResult.data.user.email ?? null,
          phone: accountResult.data.user.phone ?? null,
          is_anonymous: accountResult.data.user.is_anonymous ?? false,
          created_at: accountResult.data.user.created_at,
          updated_at: accountResult.data.user.updated_at,
          last_sign_in_at: accountResult.data.user.last_sign_in_at ?? null,
          user_metadata: accountResult.data.user.user_metadata,
        }
      : null;

    const goalAttachments = (
      requireQuery('goal attachments', goalAttachmentsResult) as GoalAttachmentExportRow[]
    );
    const exportPayload = {
        exported_at: new Date().toISOString(),
        user_type: account?.is_anonymous
          ? 'anonymous'
          : auth.userId
            ? 'authenticated'
            : 'legacy_anonymous',
        account,
        profile: requireQuery('profile', profileResult),
        moods: requireQuery('moods', moodsResult),
        assessments: requireQuery('assessments', assessmentsResult),
        goals: requireQuery('goals', goalsResult),
        goal_milestones: requireQuery('goal milestones', goalMilestonesResult),
        habits,
        habit_logs: requireQuery('habit logs', habitLogsResult),
        journal_entries: requireQuery('journal entries', journalEntriesResult),
        chat_history: requireQuery('chat history', chatHistoryResult),
        affirmation_history: requireQuery(
          'affirmation history',
          affirmationHistoryResult
        ),
        book_favorites: requireQuery('book favorites', bookFavoritesResult),
        library_items: requireQuery('library items', libraryItemsResult),
        practice_progress: requireQuery(
          'practice progress',
          practiceProgressResult
        ),
        partner_invites: requireQuery('partner invites', partnerInvitesResult),
        partner_links: requireQuery('partner links', partnerLinksResult),
        partner_celebrations: requireQuery(
          'partner celebrations',
          partnerCelebrationsResult
        ),
        together: {
          connections: requireQuery('Together connections', togetherConnectionsResult),
          memberships: requireQuery('Together memberships', togetherMembershipsResult),
          sharing_controls: requireQuery('Together sharing controls', togetherScopesResult),
          commitments: requireQuery('Together commitments', togetherCommitmentsResult),
          check_ins: requireQuery('Together check-ins', togetherCheckInsResult),
          commitment_notes: requireQuery('Together commitment notes', togetherCommitmentNotesResult),
          check_in_notes: requireQuery('Together check-in notes', togetherCheckInNotesResult),
          comments_authored: requireQuery('Together comments', togetherCommentsResult),
          nudges_sent_or_received: requireQuery('Together nudges', togetherNudgesResult),
          suggestions_authored: requireQuery('Together suggestions', togetherSuggestionsResult),
          rewards: requireQuery('Together rewards', togetherRewardsResult),
          blocks_created: requireQuery('Together blocks', togetherBlocksResult),
        },
        life_plan_items: requireQuery('life plan items', lifePlanItemsResult),
        focus_sessions: requireQuery('focus sessions', focusSessionsResult),
        wellbeing_reminders: requireQuery(
          'wellbeing reminders',
          wellbeingRemindersResult
        ),
        push_subscriptions: requireQuery(
          'push subscriptions',
          pushSubscriptionsResult
        ),
        reminder_deliveries: requireQuery(
          'reminder deliveries',
          reminderDeliveriesResult
        ),
        dismissed_notices: requireQuery(
          'dismissed notices',
          dismissedNoticesResult
        ),
        activity_plans: requireQuery('activity plans', activityPlansResult),
        activity_plan_steps: requireQuery('activity plan steps', activityPlanStepsResult),
        safety_plans: requireQuery('safety plans', safetyPlansResult),
        safety_plan_items: requireQuery('safety plan items', safetyPlanItemsResult),
        staying_well_plans: requireQuery('staying-well plans', stayingWellPlansResult),
        staying_well_plan_items: requireQuery('staying-well plan items', stayingWellPlanItemsResult),
        sleep_diary_entries: requireQuery('sleep diary entries', sleepDiaryEntriesResult),
        partner_support_preferences: requireQuery('partner support preferences', partnerSupportPreferencesResult),
        privacy_events: requireQuery('privacy events', privacyEventsResult),
        operational_events: requireQuery(
          'operational events',
          operationalEventsResult
        ),
        acquisition_attribution: requireQuery(
          'acquisition attribution',
          attributionResult
        ),
        ai_response_reports: requireQuery('AI response reports', aiReportsResult),
        migration_history: requireQuery('migration history', migrationResult),
        legacy_anonymous_session: requireQuery(
          'legacy anonymous session',
          legacySessionResult
        ),
      };
    return await createExportResponse(exportPayload, goalAttachments);
  } catch (error) {
    console.error(
      'Data export API error:',
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      {
        error:
          'A complete export could not be generated. No partial file was created.',
      },
      { status: 500, headers: corsHeaders() }
    );
  }
}
