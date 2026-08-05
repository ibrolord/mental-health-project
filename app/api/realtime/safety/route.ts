import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { containsExplicitCrisis, CRISIS_RESPONSE } from '@/lib/ai/crisis';
import { readBoundedJson, RequestBodyError } from '@/lib/ai/request-body';
import { corsHeaders, unauthorizedResponse, verifyAuth } from '@/lib/api/auth';

const MAX_REQUEST_BYTES = 8 * 1024;
const safetyRequestSchema = z.object({
  transcript: z.string().trim().min(1).max(4_000),
});

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.valid) return unauthorizedResponse();

    const parsed = safetyRequestSchema.safeParse(
      await readBoundedJson(request, MAX_REQUEST_BYTES)
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid transcript' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const crisis = containsExplicitCrisis([
      { role: 'user', content: parsed.data.transcript },
    ]);
    return NextResponse.json(
      crisis
        ? { action: 'crisis', response: CRISIS_RESPONSE }
        : { action: 'respond' },
      {
        headers: {
          ...corsHeaders(),
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: corsHeaders() }
      );
    }
    console.error('Realtime safety check error:', error);
    return NextResponse.json(
      { error: 'Safety check unavailable' },
      { status: 503, headers: corsHeaders() }
    );
  }
}
