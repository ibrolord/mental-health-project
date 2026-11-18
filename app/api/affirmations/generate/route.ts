import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { DEFAULT_CLAUDE_MODEL } from '@/lib/ai/claude';
import { CRISIS_RESPONSE } from '@/lib/ai/crisis';
import {
  AFFIRMATION_MAX_REQUEST_BYTES,
  affirmationRequestHasCrisis,
  affirmationRequestSchema,
  buildAffirmationPrompt,
} from '@/lib/ai/affirmation-request';
import { readBoundedJson, RequestBodyError } from '@/lib/ai/request-body';
import { AI_USAGE_RULES, enforceAiUsage } from '@/lib/ai/usage-limit';
import { verifyAuth, unauthorizedResponse, corsHeaders } from '@/lib/api/auth';

let anthropic: Anthropic | null = null;

function anthropicClient(): Anthropic {
  anthropic ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  return anthropic;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.valid) return unauthorizedResponse();

    const parsed = affirmationRequestSchema.safeParse(
      await readBoundedJson(request, AFFIRMATION_MAX_REQUEST_BYTES)
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid affirmation request' },
        { status: 400, headers: corsHeaders() }
      );
    }

    // Safety runs before the usage limit and never calls a model. Older
    // clients render `affirmation`, so it carries the same crisis text.
    if (affirmationRequestHasCrisis(parsed.data)) {
      return NextResponse.json(
        { response: CRISIS_RESPONSE, model: 'safety', affirmation: CRISIS_RESPONSE },
        { headers: { ...corsHeaders(), 'Cache-Control': 'no-store' } }
      );
    }

    const limited = await enforceAiUsage(AI_USAGE_RULES.affirmations, auth, request);
    if (limited) return limited;

    const response = await anthropicClient().messages.create({
      model: process.env.CLAUDE_MODEL?.trim() || DEFAULT_CLAUDE_MODEL,
      max_tokens: 150,
      messages: [
        {
          role: 'user',
          content: buildAffirmationPrompt(parsed.data),
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    const affirmation =
      textContent && 'text' in textContent
        ? textContent.text.replace(/^["']|["']$/g, '')
        : 'You are doing your best, and that is enough.';

    return NextResponse.json({ affirmation }, { headers: corsHeaders() });
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: corsHeaders() }
      );
    }
    console.error('Affirmation generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate affirmation' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
