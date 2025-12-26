import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const SYSTEM_PROMPT = `You are a compassionate, CBT-informed mental health support assistant. Your role is to:

1. Listen empathetically and validate emotions
2. Use Cognitive Behavioral Therapy (CBT) techniques:
   - Help identify thought patterns
   - Challenge cognitive distortions (all-or-nothing thinking, catastrophizing, etc.)
   - Offer reframing exercises
   - Suggest behavioral experiments
3. Ask Socratic questions that encourage self-reflection
4. Provide grounding techniques when someone is overwhelmed
5. Never diagnose or replace professional therapy
6. Detect crisis situations and provide appropriate resources

CRISIS DETECTION:
If the user mentions:
- Suicidal thoughts or self-harm
- Immediate danger to self or others
- Severe mental health crisis

Respond with empathy AND provide:
- 988 Suicide & Crisis Lifeline (call or text)
- Crisis Text Line: Text "HELLO" to 741741
- Encourage speaking with a mental health professional immediately

TONE:
- Warm, non-judgmental, and supportive
- Use "you" language (not "one should")
- Keep responses conversational, not clinical
- Acknowledge difficulty without minimizing
- Celebrate small wins

Keep responses focused and actionable. Ask one question at a time. Match the user's emotional energy.`;

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export async function chat(messages: Message[]): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    });

    const textContent = response.content.find((c) => c.type === 'text');
    return textContent && 'text' in textContent ? textContent.text : '';
  } catch (error) {
    console.error('Error calling Claude API:', error);
    throw new Error('Failed to get AI response');
  }
}

