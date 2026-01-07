import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { moods, assessments, goals } = body;

    // Build context from user data
    let context = 'Generate a personalized affirmation based on this user data:\n\n';

    if (moods && moods.length > 0) {
      context += `Recent moods (last 7 days): ${moods.map((m: any) => m.emoji).join(' ')}\n`;
      const notes = moods.filter((m: any) => m.note).map((m: any) => m.note);
      if (notes.length > 0) {
        context += `Mood notes: ${notes.join('; ')}\n`;
      }
    }

    if (assessments && assessments.length > 0) {
      context += `\nRecent assessments:\n`;
      assessments.forEach((a: any) => {
        const percentage = Math.round((a.score / a.max_score) * 100);
        context += `- ${a.type}: ${percentage}% severity\n`;
      });
    }

    if (goals && goals.length > 0) {
      const completed = goals.filter((g: any) => g.status === 'completed').length;
      context += `\nGoals: ${completed} of ${goals.length} completed recently\n`;
    }

    context += `\nCreate ONE short, personalized affirmation (1-2 sentences max) that:
- Speaks directly to where this person is right now
- Is compassionate and validating
- Offers a gentle reframe or encouragement
- Feels authentic, not generic

Return ONLY the affirmation text, no explanation or formatting.`;

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 150,
      messages: [
        {
          role: 'user',
          content: context,
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    const affirmation =
      textContent && 'text' in textContent
        ? textContent.text.replace(/^["']|["']$/g, '')
        : 'You are doing your best, and that is enough.';

    return NextResponse.json({ affirmation });
  } catch (error) {
    console.error('Affirmation generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate affirmation' },
      { status: 500 }
    );
  }
}


