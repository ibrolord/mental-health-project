import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, corsHeaders } from '@/lib/api/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

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

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.valid) return unauthorizedResponse();
    if (!auth.userId && !auth.sessionId) return unauthorizedResponse();

    const ownerColumn = auth.userId ? 'user_id' : 'session_id';
    const ownerValue = auth.userId ?? auth.sessionId!;

    const [
      moodsResult,
      assessmentsResult,
      goalsResult,
      habitsResult,
      chatHistoryResult,
      affirmationHistoryResult,
      bookFavoritesResult,
    ] = await Promise.all([
      supabaseAdmin.from('moods').select('*').eq(ownerColumn, ownerValue),
      supabaseAdmin.from('assessments').select('*').eq(ownerColumn, ownerValue),
      supabaseAdmin.from('goals').select('*').eq(ownerColumn, ownerValue),
      supabaseAdmin.from('habits').select('*').eq(ownerColumn, ownerValue),
      supabaseAdmin.from('chat_history').select('*').eq(ownerColumn, ownerValue),
      supabaseAdmin
        .from('user_affirmation_history')
        .select('*')
        .eq(ownerColumn, ownerValue),
      supabaseAdmin
        .from('user_book_favorites')
        .select('*')
        .eq(ownerColumn, ownerValue),
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

    return NextResponse.json(
      {
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
        habits,
        habit_logs: requireQuery('habit logs', habitLogsResult),
        chat_history: requireQuery('chat history', chatHistoryResult),
        affirmation_history: requireQuery(
          'affirmation history',
          affirmationHistoryResult
        ),
        book_favorites: requireQuery('book favorites', bookFavoritesResult),
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
      },
      { headers: corsHeaders() }
    );
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
