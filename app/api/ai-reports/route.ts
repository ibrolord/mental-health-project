import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, corsHeaders } from '@/lib/api/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import {
  getReportSigningSecret,
  hashResponse,
  hashSubject,
  subjectForAuth,
  verifyReportToken,
} from '@/lib/ai/report-token';
import { readBoundedJson, RequestBodyError } from '@/lib/ai/request-body';
import { BurstRateLimiter, reportSchema } from '@/lib/ai/report-validation';

const MAX_REQUEST_BYTES = 16 * 1024;
const MAX_REPORTS_PER_HOUR = 10;
const burstLimiter = new BurstRateLimiter(3, 60_000);

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.valid) return unauthorizedResponse();
    if (!auth.userId) {
      return NextResponse.json(
        { error: 'A signed-in user is required to report a response' },
        { status: 403, headers: corsHeaders() }
      );
    }

    const parsed = reportSchema.safeParse(await readBoundedJson(request, MAX_REQUEST_BYTES));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid report' }, { status: 400, headers: corsHeaders() });
    }

    const secret = getReportSigningSecret();
    const subject = subjectForAuth(auth);
    let token;
    try {
      token = verifyReportToken({
        token: parsed.data.reportToken,
        subject,
        responseId: parsed.data.responseId,
        response: parsed.data.response,
        secret,
      });
    } catch {
      return NextResponse.json({ error: 'Invalid or expired report token' }, { status: 400, headers: corsHeaders() });
    }

    const subjectHash = hashSubject(subject, secret);
    const now = Date.now();
    if (!burstLimiter.consume(subjectHash, now)) {
      return NextResponse.json({ error: 'Too many reports' }, { status: 429, headers: corsHeaders() });
    }

    const { data: result, error: insertError } = await supabaseAdmin.rpc('submit_ai_response_report', {
      p_max_reports_per_hour: MAX_REPORTS_PER_HOUR,
      p_response_id: parsed.data.responseId,
      p_user_id: auth.userId,
      p_subject_hash: subjectHash,
      p_response_hash: hashResponse(parsed.data.response),
      p_reported_response: parsed.data.response,
      p_model: token.model,
      p_reason: parsed.data.reason,
      p_details: parsed.data.details || null,
      p_platform: parsed.data.platform,
      p_app_version: parsed.data.appVersion,
    });

    if (insertError) {
      console.error('AI report insert failed:', insertError);
      return NextResponse.json({ error: 'Unable to submit report' }, { status: 503, headers: corsHeaders() });
    }
    if (result === 'rate_limited') {
      return NextResponse.json({ error: 'Too many reports' }, { status: 429, headers: corsHeaders() });
    }
    if (result !== 'inserted' && result !== 'already_inserted') {
      console.error('AI report RPC returned an unexpected result:', result);
      return NextResponse.json({ error: 'Unable to submit report' }, { status: 503, headers: corsHeaders() });
    }

    return NextResponse.json({ reported: true }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: corsHeaders() });
    }
    console.error('AI report API error:', error);
    return NextResponse.json({ error: 'Unable to submit report' }, { status: 500, headers: corsHeaders() });
  }
}
