import * as gemini from './gemini';
import * as claude from './claude';
import type { Message } from './claude';
import type { UserContext } from './context';
import { containsExplicitCrisis, CRISIS_RESPONSE } from './crisis';

export type ChatModel = 'gemini' | 'claude' | 'safety';
type ModelProvider = Exclude<ChatModel, 'safety'>;

function hasProviderCredential(provider: ModelProvider): boolean {
  const value =
    provider === 'gemini'
      ? process.env.GOOGLE_API_KEY
      : process.env.ANTHROPIC_API_KEY;
  return Boolean(value?.trim());
}

function configuredPrimaryProvider(): ModelProvider {
  const configured = process.env.AI_PRIMARY_PROVIDER?.trim().toLowerCase();
  if (configured === 'gemini' || configured === 'claude') {
    if (hasProviderCredential(configured)) return configured;
  }

  if (hasProviderCredential('claude')) return 'claude';
  if (hasProviderCredential('gemini')) return 'gemini';
  throw new Error('No AI provider is configured');
}

async function callProvider(
  provider: ModelProvider,
  messages: Message[],
  userContext?: UserContext
): Promise<string> {
  return provider === 'gemini'
    ? gemini.chat(messages, userContext)
    : claude.chat(messages, userContext);
}

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
  
  console.log('[Model Router] Standard conversation');
  return false;
}

/**
 * Routes chat requests to the appropriate AI model based on conversation complexity
 */
export async function chat(messages: Message[], userContext?: UserContext): Promise<{ response: string; model: ChatModel }> {
  if (containsExplicitCrisis(messages)) {
    console.warn('[Model Router] Explicit crisis detected; returning deterministic safety response');
    return { response: CRISIS_RESPONSE, model: 'safety' };
  }

  const prefersClaude = requiresClaudeModel(messages);
  const primary: ModelProvider =
    prefersClaude && hasProviderCredential('claude')
      ? 'claude'
      : configuredPrimaryProvider();
  const fallback: ModelProvider = primary === 'claude' ? 'gemini' : 'claude';
  
  try {
    console.log(`[Model Router] Using ${primary}`);
    const response = await callProvider(primary, messages, userContext);
    return { response, model: primary };
  } catch (error) {
    console.error(`[Model Router] ${primary} failed:`, error);

    if (!hasProviderCredential(fallback)) {
      throw new Error('AI service temporarily unavailable');
    }

    try {
      console.log(`[Model Router] Falling back to ${fallback}`);
      const response = await callProvider(fallback, messages, userContext);
      return { response, model: fallback };
    } catch (fallbackError) {
      console.error('[Model Router] Both models failed:', fallbackError);
      throw new Error('AI service temporarily unavailable');
    }
  }
}
