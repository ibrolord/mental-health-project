import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Verify that the request has a valid Supabase session.
 * Accepts either:
 * - Authorization: Bearer <jwt> header (mobile app)
 * - Supabase session cookie (web app)
 * - X-Session-Id header for anonymous users (validated against DB)
 */
export async function verifyAuth(request: NextRequest): Promise<{
  valid: boolean;
  userId?: string;
  sessionId?: string;
  isAnonymous?: boolean;
}> {
  const authHeader = request.headers.get('authorization');
  const sessionIdHeader = request.headers.get('x-session-id');

  // 1. Check JWT token (authenticated users)
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (!error && user) {
      return {
        valid: true,
        userId: user.id,
        isAnonymous: user.is_anonymous === true,
      };
    }
  }

  // 2. LEGACY COMPATIBILITY ONLY: service-role lookup avoids exposing the
  // anonymous_sessions registry through public RLS.
  if (sessionIdHeader) {
    const { data, error } = await getSupabaseAdmin()
      .from('anonymous_sessions')
      .select('session_id')
      .eq('session_id', sessionIdHeader)
      .single();

    if (!error && data) {
      return { valid: true, sessionId: sessionIdHeader };
    }
  }

  return { valid: false };
}

/**
 * Returns a 401 response with CORS headers.
 */
export function unauthorizedResponse() {
  return NextResponse.json(
    { error: 'Unauthorized. Please sign in or provide a valid session.' },
    { status: 401, headers: corsHeaders() }
  );
}

/**
 * CORS headers for mobile app access.
 */
export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-Id',
  };
}
