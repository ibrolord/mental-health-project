import { NextRequest, NextResponse } from 'next/server';
import { chat } from '@/lib/ai/model-router';
import { Message, UserContext } from '@/lib/ai/claude';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, userContext } = body as { 
      messages: Message[]; 
      userContext?: UserContext;
    };

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Invalid request: messages array required' },
        { status: 400 }
      );
    }

    const { response, model } = await chat(messages, userContext);

    return NextResponse.json({ response, model });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    );
  }
}
