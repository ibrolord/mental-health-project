import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, corsHeaders } from '@/lib/api/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { removeGoalAttachmentObjectsForUser } from '@/lib/goals/attachment-cleanup';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.valid) return unauthorizedResponse();

    if (!auth.userId) {
      return NextResponse.json(
        { error: 'Anonymous sessions do not have an account to delete.' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const body = await request.json().catch(() => ({}));
    const expectedUserId =
      typeof body?.expectedUserId === 'string' ? body.expectedUserId : null;
    if (!expectedUserId || expectedUserId !== auth.userId) {
      return NextResponse.json(
        { error: 'The account changed before deletion. No account was deleted.' },
        { status: 409, headers: corsHeaders() }
      );
    }

    const { data: deletionResult, error: deletionError } = await supabaseAdmin.rpc(
      'delete_owned_data',
      { p_user_id: auth.userId, p_session_id: null }
    );
    if (deletionError || deletionResult?.deleted !== true) {
      console.error('Account data deletion error:', deletionError ?? deletionResult);
      return NextResponse.json(
        { error: 'Account data could not be deleted. The account was kept.' },
        { status: 500, headers: corsHeaders() }
      );
    }

    const attachmentCleanup = await removeGoalAttachmentObjectsForUser(auth.userId);
    if (attachmentCleanup.error) {
      console.error('Goal attachment cleanup failed:', attachmentCleanup.error);
      return NextResponse.json(
        {
          cleanupPending: true,
          error: 'Account records were deleted, but attached file cleanup is still pending. The sign-in account was kept so you can retry.',
        },
        { status: 500, headers: corsHeaders() }
      );
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(auth.userId);
    if (error) {
      console.error('Account deletion error:', error);
      return NextResponse.json(
        { error: 'Your app data was deleted, but the sign-in account could not be removed. Please retry.' },
        { status: 500, headers: corsHeaders() }
      );
    }

    return NextResponse.json({ deleted: true }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Account deletion API error:', error);
    return NextResponse.json(
      { error: 'Failed to delete account.' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
