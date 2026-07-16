import { NextRequest, NextResponse } from 'next/server';
import { corsHeaders, unauthorizedResponse, verifyAuth } from '@/lib/api/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

const LEGACY_SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.valid || !auth.userId) return unauthorizedResponse();

    const body = await request.json().catch(() => null);
    const legacySessionId = body?.legacySessionId;
    if (typeof legacySessionId !== 'string' || !LEGACY_SESSION_ID.test(legacySessionId)) {
      return NextResponse.json(
        { error: 'A valid legacy session ID is required.' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const { data, error } = await supabaseAdmin.rpc('migrate_legacy_anonymous_data', {
      p_legacy_session_id: legacySessionId,
      p_user_id: auth.userId,
    });

    if (error) {
      console.error('Legacy session migration error:', error);
      return NextResponse.json(
        { error: 'Legacy data migration failed.' },
        { status: 500, headers: corsHeaders() }
      );
    }

    const { data: remainingSession, error: verificationError } = await supabaseAdmin
      .from('anonymous_sessions')
      .select('session_id')
      .eq('session_id', legacySessionId)
      .maybeSingle();

    if (verificationError || remainingSession) {
      console.error('Legacy session migration verification failed:', verificationError);
      return NextResponse.json(
        { error: 'Legacy data migration could not be verified.' },
        { status: 500, headers: corsHeaders() }
      );
    }

    const result = data && typeof data === 'object' ? data : {};
    return NextResponse.json(
      { ...result, verified: true },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Legacy session migration API error:', error);
    return NextResponse.json(
      { error: 'Legacy data migration failed.' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
