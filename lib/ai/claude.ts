import Anthropic from '@anthropic-ai/sdk';

let anthropicClient: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (anthropicClient) return anthropicClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Claude is not configured');
  anthropicClient = new Anthropic({ apiKey });
  return anthropicClient;
}

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

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface UserContext {
  recentMoods?: Array<{ emoji: string; note: string; created_at: string }>;
  assessments?: Array<{ type: string; score: number; max_score: number; created_at: string }>;
  goals?: Array<{ content: string; status: string; reflection?: string; date: string }>;
  habits?: Array<{ name: string; streak_count: number }>;
}

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
    
    // Group by date
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
      // Find any reflection for this date
      const reflection = goals.find(g => g.reflection)?.reflection;
      if (reflection) {
        parts.push(`    Reflection: "${reflection}"`);
      }
    });
  }
  
  // Habits
  if (userContext.habits?.length) {
    parts.push('');
    parts.push('Active Habits:');
    userContext.habits.forEach(h => {
      parts.push(`- ${h.name} (streak: ${h.streak_count} days)`);
    });
  }
  
  if (parts.length === 0) return BASE_SYSTEM_PROMPT;
  
  const contextSection = `

--- USER CONTEXT (shared with consent) ---

${parts.join('\n')}

--- END USER CONTEXT ---

Use this context to provide personalized support. Reference their patterns, progress, reflections, and challenges when appropriate. Be encouraging about positive trends and gently curious about difficult patterns.`;
  
  return BASE_SYSTEM_PROMPT + contextSection;
}

export async function chat(messages: Message[], userContext?: UserContext): Promise<string> {
  try {
    const systemPrompt = buildContextualPrompt(userContext);
    
    const response = await getAnthropic().messages.create({
      model: 'claude-sonnet-4-20250514',
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
