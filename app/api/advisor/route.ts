import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, corsHeaders } from '@/lib/api/auth';
import { createModelAdvisorRecommendation } from '@/lib/ai/advisor-model';
import { advisorModelRequestSchema } from '@/lib/ai/advisor-validation';
import { readBoundedJson, RequestBodyError } from '@/lib/ai/request-body';
import { isHealthAiEnabled } from '@/lib/ai/health-ai-gate';

const MAX_REQUEST_BYTES = 24 * 1024;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
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

    if (parsed.data.appleHealthSummary && !isHealthAiEnabled()) {
      return NextResponse.json(
        { error: 'Apple Health AI summaries are not enabled' },
        { status: 503, headers: corsHeaders() }
      );
    }

    const result = await createModelAdvisorRecommendation(parsed.data);
    return NextResponse.json(result, { headers: corsHeaders() });
  } catch (error) {
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
