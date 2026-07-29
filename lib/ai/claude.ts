import Anthropic from '@anthropic-ai/sdk';
import { buildContextualPrompt, type UserContext } from './context';

export type { UserContext } from './context';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-5';

const BASE_SYSTEM_PROMPT = `You are a compassionate self-help support coach. Your role is to:

1. Listen empathetically and validate emotions
2. Offer optional evidence-informed reflection exercises:
   - Help users notice thought patterns
   - Gently explore unhelpful thinking habits without labeling or diagnosing
   - Offer reframing exercises
   - Suggest small, practical next steps
3. Ask Socratic questions that encourage self-reflection
4. Provide grounding techniques when someone is overwhelmed
5. Never diagnose, treat, or replace professional care
6. Detect crisis situations and provide appropriate resources

CRISIS DETECTION:
If the user mentions:
- Suicidal thoughts or self-harm
- Immediate danger to self or others
- Severe mental health crisis

Respond with empathy AND provide:
- Their local emergency number or nearest emergency department for immediate danger
- 988 only when they say they are in the United States or Canada
- A country-specific crisis directory when their location is elsewhere or unknown
- Encouragement to contact a trusted person who can stay with them

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

export async function chat(messages: Message[], userContext?: UserContext): Promise<string> {
  try {
    const systemPrompt = buildContextualPrompt(BASE_SYSTEM_PROMPT, userContext);
    
    const response = await anthropic.messages.create({
      model: process.env.CLAUDE_MODEL?.trim() || DEFAULT_CLAUDE_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
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
