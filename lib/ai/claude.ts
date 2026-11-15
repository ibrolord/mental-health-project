import Anthropic from '@anthropic-ai/sdk';
import { CHAT_SYSTEM_PROMPT } from './chat-prompt';
import { buildContextualPrompt, type UserContext } from './context';

export type { UserContext } from './context';

/**
 * Per-call cutoff. Kept well under the mobile client's 45s request timeout so
 * the router still has time to try the other provider.
 */
export const CLAUDE_TIMEOUT_MS = 20_000;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  timeout: CLAUDE_TIMEOUT_MS,
  // Retries would multiply the wait; the router falls back to Gemini instead.
  maxRetries: 0,
});

export const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-5';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export type ProviderCallOptions = {
  signal?: AbortSignal;
};

export async function chat(
  messages: Message[],
  userContext?: UserContext,
  options: ProviderCallOptions = {}
): Promise<string> {
  try {
    const systemPrompt = buildContextualPrompt(CHAT_SYSTEM_PROMPT, userContext);

    const response = await anthropic.messages.create(
      {
        model: process.env.CLAUDE_MODEL?.trim() || DEFAULT_CLAUDE_MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
      },
      { signal: options.signal, timeout: CLAUDE_TIMEOUT_MS, maxRetries: 0 }
    );

    const textContent = response.content.find((c) => c.type === 'text');
    const text = textContent && 'text' in textContent ? textContent.text.trim() : '';
    if (!text) throw new Error('Claude returned an empty response');
    return text;
  } catch (error) {
    console.error(
      'Claude API error:',
      error instanceof Error ? error.name : 'UnknownError'
    );
    throw new Error('Failed to get AI response');
  }
}
