import { NextRequest, NextResponse } from 'next/server';
import { chat } from '@/lib/ai/model-router';
import { verifyAuth, unauthorizedResponse, corsHeaders } from '@/lib/api/auth';
import { chatRequestSchema } from '@/lib/ai/chat-validation';
import { createReportTokenIfConfigured, subjectForAuth } from '@/lib/ai/report-token';
import { readBoundedJson, RequestBodyError } from '@/lib/ai/request-body';
import { isHealthAiEnabled } from '@/lib/ai/health-ai-gate';

const MAX_REQUEST_BYTES = 64 * 1024;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.valid) return unauthorizedResponse();

    const parsed = chatRequestSchema.safeParse(await readBoundedJson(request, MAX_REQUEST_BYTES));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid chat request', issues: parsed.error.issues.map(({ path, message }) => ({ path, message })) },
        { status: 400, headers: corsHeaders() }
      );
    }

    const { messages, userContext } = parsed.data;
    if (userContext?.appleHealthSummary && !isHealthAiEnabled()) {
      return NextResponse.json(
        { error: 'Apple Health AI context is not enabled' },
        { status: 503, headers: corsHeaders() }
      );
    }
    const { response, model } = await chat(messages, userContext);
    const report = createReportTokenIfConfigured({
      subject: subjectForAuth(auth),
      response,
      model,
    });
    if (!report) {
      console.warn('AI response reporting is disabled because its signing secret is not configured.');
    }

    return NextResponse.json({ response, model, ...(report ?? {}) }, { headers: corsHeaders() });
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: corsHeaders() });
    }
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
