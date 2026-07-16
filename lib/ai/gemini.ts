import { GoogleGenerativeAI } from '@google/generative-ai';
import { UserContext, Message } from './claude';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

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
- 988 Suicide & Crisis Lifeline (call or text)
- Crisis Text Line: Text "HOME" to 741741
- Encourage speaking with a mental health professional immediately

TONE:
- Warm, non-judgmental, and supportive
- Use "you" language (not "one should")
- Keep responses conversational, not clinical
- Acknowledge difficulty without minimizing
- Celebrate small wins

Keep responses focused and actionable. Ask one question at a time. Match the user's emotional energy.`;

function buildContextualPrompt(userContext?: UserContext): string {
  if (!userContext) return BASE_SYSTEM_PROMPT;

  const parts: string[] = [];
  
  // Moods
  if (userContext.recentMoods?.length) {
    parts.push('Recent Mood Patterns (last 7 days):');
    userContext.recentMoods.forEach(m => {
      const date = new Date(m.created_at).toLocaleDateString();
      parts.push(`- ${date}: ${m.emoji}${m.note ? ' - "' + m.note + '"' : ''}`);
    });
  }
  
  // Assessments
  if (userContext.assessments?.length) {
    parts.push('');
    parts.push('Assessment Results:');
    userContext.assessments.forEach(a => {
      const date = new Date(a.created_at).toLocaleDateString();
      const percentage = a.max_score > 0 ? Math.round((a.score / a.max_score) * 100) : null;
      parts.push(`- ${a.type.toUpperCase()} (${date}): Score ${a.score}/${a.max_score}${percentage === null ? '' : ` (${percentage}%)`}`);
    });
  }
  
  // Goals & Reflections
  if (userContext.goals?.length) {
    parts.push('');
    parts.push('Recent Goals & Reflections:');
    
    const byDate: Record<string, typeof userContext.goals> = {};
    userContext.goals.forEach(g => {
      if (!byDate[g.date]) byDate[g.date] = [];
      byDate[g.date].push(g);
    });
    
    Object.entries(byDate).forEach(([date, goals]) => {
      parts.push(`  ${date}:`);
      goals.forEach(g => {
        parts.push(`    - [${g.status === 'completed' ? '✓' : ' '}] ${g.content}`);
      });
      const reflection = goals.find(g => g.reflection)?.reflection;
      if (reflection) {
        parts.push(`    Reflection: "${reflection}"`);
      }
    });
  }
  
  // Habits
  if (userContext.habits?.length) {
    parts.push('');
    parts.push('Habit Tracking:');
    userContext.habits.forEach(h => {
      parts.push(`- ${h.name}: ${h.streak_count} day streak`);
    });
  }

  if (parts.length > 0) {
    return BASE_SYSTEM_PROMPT + '\n\n---\n\nUSER CONTEXT (use this to personalize responses):\n' + parts.join('\n');
  }
  
  return BASE_SYSTEM_PROMPT;
}

export async function chat(messages: Message[], userContext?: UserContext): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      systemInstruction: buildContextualPrompt(userContext)
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
