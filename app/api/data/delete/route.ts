import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, corsHeaders } from '@/lib/api/auth';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.valid) return unauthorizedResponse();

    if (!auth.userId && !auth.sessionId) return unauthorizedResponse();

    const { data, error } = await getSupabaseAdmin().rpc('delete_owned_data', {
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

    return NextResponse.json({ deleted: true }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Data deletion API error:', error);
    return NextResponse.json(
      { error: 'Failed to delete data.' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
