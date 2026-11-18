import { NextRequest, NextResponse } from 'next/server';
import { chat, ChatCancelledError, CHAT_DEADLINE_MS } from '@/lib/ai/model-router';
import { remainingMs, serverDeadlineMs } from '@/lib/ai/request-deadline';
import { verifyAuth, unauthorizedResponse, corsHeaders } from '@/lib/api/auth';
import { chatRequestSchema } from '@/lib/ai/chat-validation';
import { createReportTokenIfConfigured, subjectForAuth } from '@/lib/ai/report-token';
import { readBoundedJson, RequestBodyError } from '@/lib/ai/request-body';
import { isHealthAiEnabled } from '@/lib/ai/health-ai-gate';
import { containsExplicitCrisis } from '@/lib/ai/crisis';
import { AI_USAGE_RULES, enforceAiUsage } from '@/lib/ai/usage-limit';

// Fits CHAT_LIMITS.totalChars of non-Latin text (up to 3 UTF-8 bytes per
// character) plus selected context. History is trimmed before the model call.
const MAX_REQUEST_BYTES = 512 * 1024;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
  const deadlineAt = Date.now() + serverDeadlineMs(request.headers, CHAT_DEADLINE_MS);
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
    // A person in crisis always gets the safety response, even when over the
    // usage limit. chat() repeats this check and answers without a model.
    if (!containsExplicitCrisis(messages)) {
      const limited = await enforceAiUsage(AI_USAGE_RULES.chat, auth, request);
      if (limited) return limited;
    }
    if (userContext?.appleHealthSummary && !isHealthAiEnabled()) {
      return NextResponse.json(
        { error: 'Apple Health AI context is not enabled' },
        { status: 503, headers: corsHeaders() }
      );
    }
    const { response, model } = await chat(messages, userContext, {
      // Client disconnects cancel the model call and skip fallback.
      signal: request.signal,
      // Voice waits 20-30s and text chat 45s; budget both attempts inside it.
      // Measured from arrival, so auth and parsing count against it.
      deadlineMs: remainingMs(deadlineAt),
    });
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
    if (error instanceof ChatCancelledError) {
      // 499: client closed the request. Nobody is waiting for the body.
      return new NextResponse(null, { status: 499, headers: corsHeaders() });
    }
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
