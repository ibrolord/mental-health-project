import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, corsHeaders } from '@/lib/api/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import {
  privacyPlatformFromRequest,
  recordServerPrivacyEvent,
} from '@/lib/privacy-events/server';
import { removeGoalAttachmentObjectsForUser } from '@/lib/goals/attachment-cleanup';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.valid) return unauthorizedResponse();

    if (!auth.userId && !auth.sessionId) return unauthorizedResponse();

    const body = await request.json().catch(() => ({}));
    const expectedAnonymousUserId =
      typeof body?.expectedAnonymousUserId === 'string'
        ? body.expectedAnonymousUserId
        : null;
    const expectedUserId =
      typeof body?.expectedUserId === 'string' ? body.expectedUserId : null;
    if (auth.userId && !expectedUserId && !expectedAnonymousUserId) {
      return NextResponse.json(
        { error: 'The profile could not be verified. No data was deleted.' },
        { status: 409, headers: corsHeaders() }
      );
    }
    if (expectedUserId && auth.userId !== expectedUserId) {
      return NextResponse.json(
        { error: 'The profile changed before deletion. No data was deleted.' },
        { status: 409, headers: corsHeaders() }
      );
    }
    if (
      expectedAnonymousUserId &&
      (auth.userId !== expectedAnonymousUserId || auth.isAnonymous !== true)
    ) {
      return NextResponse.json(
        { error: 'The anonymous profile changed before deletion. No data was deleted.' },
        { status: 409, headers: corsHeaders() }
      );
    }

    if (auth.userId) {
      try {
        await recordServerPrivacyEvent({
          userId: auth.userId,
          eventType: 'deletion_requested',
          platform: privacyPlatformFromRequest(request),
          metadata: { method: 'account_settings' },
        });
      } catch (error) {
        // Deletion must not depend on an audit row removed by the same request.
        console.error('Deletion privacy event could not be recorded:', error);
      }
    }

    const { data, error } = await supabaseAdmin.rpc('delete_owned_data', {
      p_user_id: auth.userId ?? null,
      p_session_id: auth.sessionId ?? null,
    });

    if (error || data?.deleted !== true) {
      console.error('Transactional data deletion failed:', error ?? data);
      return NextResponse.json(
        { error: 'Data could not be deleted. Please try again or contact support.' },
        { status: 500, headers: corsHeaders() }
      );
    }

    if (auth.userId) {
      const attachmentCleanup = await removeGoalAttachmentObjectsForUser(auth.userId);
      if (attachmentCleanup.error) {
        console.error('Goal attachment cleanup failed:', attachmentCleanup.error);
        return NextResponse.json(
          {
            deleted: true,
            cleanupPending: true,
            error: 'Your records were deleted, but attached file cleanup is still pending. Please retry.',
          },
          { status: 500, headers: corsHeaders() }
        );
      }
    }

    return NextResponse.json({ deleted: true }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Data deletion API error:', error);
    return NextResponse.json(
      { error: 'Failed to delete data.' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
