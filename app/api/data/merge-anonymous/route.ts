import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { corsHeaders, unauthorizedResponse, verifyAuth } from '@/lib/api/auth';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
  try {
    const targetAuth = await verifyAuth(request);
    if (!targetAuth.valid || !targetAuth.userId || targetAuth.isAnonymous) {
      return unauthorizedResponse();
    }

    const body = await request.json().catch(() => ({}));
    const sourceUserId =
      typeof body?.sourceAnonymousUserId === 'string'
        ? body.sourceAnonymousUserId
        : '';
    const sourceAccessToken =
      typeof body?.sourceAccessToken === 'string' ? body.sourceAccessToken : '';
    if (!sourceUserId || !sourceAccessToken || sourceAccessToken.length > 10000) {
      return NextResponse.json(
        { error: 'The anonymous profile could not be verified.' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const sourceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const {
      data: { user: sourceUser },
      error: sourceError,
    } = await sourceClient.auth.getUser(sourceAccessToken);
    if (
      sourceError ||
      !sourceUser ||
      sourceUser.id !== sourceUserId ||
      sourceUser.is_anonymous !== true
    ) {
      return NextResponse.json(
        { error: 'The anonymous profile could not be verified.' },
        { status: 409, headers: corsHeaders() }
      );
    }

    const { data, error } = await getSupabaseAdmin().rpc(
      'merge_anonymous_user_data',
      {
        p_source_user_id: sourceUserId,
        p_target_user_id: targetAuth.userId,
      }
    );
    if (error || data?.merged !== true) {
      console.error('Anonymous profile merge failed:', error ?? data);
      return NextResponse.json(
        {
          error:
            'Your anonymous data could not be merged safely. Nothing was deleted; please retry or contact support.',
        },
        { status: 409, headers: corsHeaders() }
      );
    }

    const { error: deleteError } = await getSupabaseAdmin().auth.admin.deleteUser(
      sourceUserId
    );
    if (deleteError) {
      console.error('Merged anonymous auth user cleanup failed:', deleteError);
      return NextResponse.json(
        {
          merged: true,
          cleanupPending: true,
          error: 'Your data was merged, but the temporary profile cleanup is pending.',
        },
        { headers: corsHeaders() }
      );
    }

    return NextResponse.json(
      { merged: true, rowsMoved: data.rowsMoved ?? 0 },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Anonymous profile merge API error:', error);
    return NextResponse.json(
      { error: 'Your anonymous data could not be merged safely.' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
