import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, corsHeaders } from '@/lib/api/auth';
import { ADVISOR_DEADLINE_MS, createModelAdvisorRecommendation } from '@/lib/ai/advisor-model';
import { ChatCancelledError } from '@/lib/ai/model-router';
import { remainingMs, serverDeadlineMs } from '@/lib/ai/request-deadline';
import { advisorModelRequestSchema } from '@/lib/ai/advisor-validation';
import { readBoundedJson, RequestBodyError } from '@/lib/ai/request-body';
import { isHealthAiEnabled } from '@/lib/ai/health-ai-gate';
import { enforceAiUsage } from '@/lib/ai/usage-limit';

const MAX_REQUEST_BYTES = 24 * 1024;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
  const deadlineAt = Date.now() + serverDeadlineMs(request.headers, ADVISOR_DEADLINE_MS);
  try {
    const auth = await verifyAuth(request);
    if (!auth.valid) return unauthorizedResponse();

    const parsed = advisorModelRequestSchema.safeParse(
      await readBoundedJson(request, MAX_REQUEST_BYTES)
    );
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid Advisor request',
          issues: parsed.error.issues.map(({ path, message }) => ({ path, message })),
        },
        { status: 400, headers: corsHeaders() }
      );
    }

    const limited = await enforceAiUsage(auth, request);
    if (limited) return limited;

    if (parsed.data.appleHealthSummary && !isHealthAiEnabled()) {
      return NextResponse.json(
        { error: 'Apple Health AI summaries are not enabled' },
        { status: 503, headers: corsHeaders() }
      );
    }

    const result = await createModelAdvisorRecommendation(parsed.data, {
      // Client disconnects cancel the model call and skip fallback.
      signal: request.signal,
      // Auth and parsing already used part of the client's 6s budget.
      deadlineMs: remainingMs(deadlineAt),
    });
    return NextResponse.json(result, { headers: corsHeaders() });
  } catch (error) {
    if (error instanceof ChatCancelledError) {
      // 499: client closed the request. Nobody is waiting for the body.
      return new NextResponse(null, { status: 499, headers: corsHeaders() });
    }
    if (error instanceof RequestBodyError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: corsHeaders() }
      );
    }
    console.error('Advisor API error:', error);
    return NextResponse.json(
      { error: 'Advisor could not generate a recommendation' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
