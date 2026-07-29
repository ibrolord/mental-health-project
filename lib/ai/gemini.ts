import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Message } from './claude';
import { buildContextualPrompt, type UserContext } from './context';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash';

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

export async function chat(messages: Message[], userContext?: UserContext): Promise<string> {
  try {
    const modelName = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
    const model = genAI.getGenerativeModel({ 
      model: modelName,
      systemInstruction: buildContextualPrompt(BASE_SYSTEM_PROMPT, userContext)
    });

    // Convert messages to Gemini format
    const history = messages.slice(0, -1).map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    const chat = model.startChat({ history });
    const lastMessage = messages[messages.length - 1];
    const result = await chat.sendMessage(lastMessage.content);
    
    return result.response.text();
  } catch (error) {
    console.error('Gemini API error:', error);
    throw new Error('Failed to get AI response from Gemini');
  }
}
