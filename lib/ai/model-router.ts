import * as gemini from './gemini';
import * as claude from './claude';
import { Message, UserContext } from './claude';

/**
 * Detects if a conversation requires the more sophisticated Claude model
 * vs the faster/free Gemini model
 */
function requiresClaudeModel(messages: Message[]): boolean {
  const lastMessage = messages[messages.length - 1]?.content.toLowerCase() || '';
  const recentMessages = messages.slice(-3).map(m => m.content.toLowerCase()).join(' ');
  
  // Crisis keywords - always use Claude for safety
  const crisisKeywords = [
    'suicide', 'suicidal', 'kill myself', 'end my life', 'want to die',
    'self harm', 'self-harm', 'cutting', 'hurt myself',
    'overdose', 'end it all', 'no point living',
  ];
  
  if (crisisKeywords.some(keyword => recentMessages.includes(keyword))) {
    console.log('[Model Router] Crisis detected → Using Claude');
    return true;
  }
  
  // Complex trauma/abuse keywords
  const traumaKeywords = [
    'trauma', 'ptsd', 'abuse', 'assault', 'rape',
    'molest', 'domestic violence', 'flashback',
  ];
  
  if (traumaKeywords.some(keyword => recentMessages.includes(keyword))) {
    console.log('[Model Router] Trauma topic detected → Using Claude');
    return true;
  }
  
  // User explicitly requests deeper help
  const deepHelpPhrases = [
    'i need more help', 'this is serious', 'i\'m really struggling',
    'deeper conversation', 'more thorough', 'i\'m in crisis',
  ];
  
  if (deepHelpPhrases.some(phrase => lastMessage.includes(phrase))) {
    console.log('[Model Router] Deep help requested → Using Claude');
    return true;
  }
  
  // Long conversation (>10 messages) - use Claude for better context handling
  if (messages.length > 10) {
    console.log('[Model Router] Long conversation → Using Claude');
    return true;
  }
  
  // Default to Gemini (free)
  console.log('[Model Router] Standard conversation → Using Gemini (free)');
  return false;
}

/**
 * Routes chat requests to the appropriate AI model based on conversation complexity
 */
export async function chat(messages: Message[], userContext?: UserContext): Promise<{ response: string; model: 'gemini' | 'claude' }> {
  const useClaude = requiresClaudeModel(messages);
  
  try {
    if (useClaude) {
      const response = await claude.chat(messages, userContext);
      return { response, model: 'claude' };
    } else {
      const response = await gemini.chat(messages, userContext);
      return { response, model: 'gemini' };
    }
  } catch (error) {
    console.error(`[Model Router] ${useClaude ? 'Claude' : 'Gemini'} failed, falling back to alternative:`, error);
    
    // Fallback: if one model fails, try the other
    try {
      if (useClaude) {
        console.log('[Model Router] Falling back to Gemini');
        const response = await gemini.chat(messages, userContext);
        return { response, model: 'gemini' };
      } else {
        console.log('[Model Router] Falling back to Claude');
        const response = await claude.chat(messages, userContext);
        return { response, model: 'claude' };
      }
    } catch (fallbackError) {
      console.error('[Model Router] Both models failed:', fallbackError);
      throw new Error('AI service temporarily unavailable');
    }
  }
}
