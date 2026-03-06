import { NextRequest, NextResponse } from 'next/server';
import { chat } from '@/lib/ai/model-router';
import { Message, UserContext } from '@/lib/ai/claude';
import { verifyAuth, unauthorizedResponse, corsHeaders } from '@/lib/api/auth';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.valid) return unauthorizedResponse();

    const body = await request.json();
    const { messages, userContext } = body as {
      messages: Message[];
      userContext?: UserContext;
    };

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Invalid request: messages array required' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const { response, model } = await chat(messages, userContext);

    return NextResponse.json({ response, model }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

