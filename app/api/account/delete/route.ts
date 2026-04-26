import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, corsHeaders } from '@/lib/api/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

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

    const { error } = await supabaseAdmin.auth.admin.deleteUser(auth.userId);
    if (error) {
      console.error('Account deletion error:', error);
      return NextResponse.json(
        { error: 'Failed to delete account.' },
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
