import { GoogleGenAI } from '@google/genai';
import type { Message, ProviderCallOptions } from './claude';
import { CHAT_SYSTEM_PROMPT } from './chat-prompt';
import { buildContextualPrompt, type UserContext } from './context';

const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash';
const DEFAULT_GEMINI_HEALTH_MODEL = 'gemini-3.5-flash-lite';

export async function chat(
  messages: Message[],
  userContext?: UserContext,
  options: ProviderCallOptions = {}
): Promise<string> {
  try {
    const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });
    const modelName = userContext?.appleHealthSummary
      ? process.env.GEMINI_HEALTH_MODEL?.trim() || DEFAULT_GEMINI_HEALTH_MODEL
      : process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
    const conversation = genAI.chats.create({
      model: modelName,
      config: {
        systemInstruction: buildContextualPrompt(CHAT_SYSTEM_PROMPT, userContext),
        // Chat-level config applies to sendMessage below. The router also
        // enforces its own deadline in case the SDK ignores the signal.
        abortSignal: options.signal,
      },
      history: messages.slice(0, -1).map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      })),
    });

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) throw new Error('At least one message is required');
    const result = await conversation.sendMessage({ message: lastMessage.content });
    const response = result.text?.trim();
    if (!response) throw new Error('Gemini returned an empty response');
    return response;
  } catch (error) {
    console.error(
      'Gemini API error:',
      error instanceof Error ? error.name : 'UnknownError'
    );
    throw new Error('Failed to get AI response from Gemini');
  }
}
