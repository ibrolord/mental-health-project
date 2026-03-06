import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Verify that the request has a valid Supabase session.
 * Accepts either:
 * - Authorization: Bearer <jwt> header (mobile app)
 * - Supabase session cookie (web app)
 * - X-Session-Id header for anonymous users (validated against DB)
 */
export async function verifyAuth(request: NextRequest): Promise<{ valid: boolean; userId?: string; sessionId?: string }> {
  const authHeader = request.headers.get('authorization');
  const sessionIdHeader = request.headers.get('x-session-id');

  // 1. Check JWT token (authenticated users)
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (!error && user) {
      return { valid: true, userId: user.id };
    }
  }

  // 2. Check anonymous session ID (validated against DB)
  if (sessionIdHeader) {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await supabase
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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-Id',
  };
}
