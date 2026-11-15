/**
 * Pure helpers that keep chat history sent to /api/chat valid for the
 * server's request schema (lib/ai/chat-validation.ts):
 * - first and last message from the user
 * - roles alternate
 * - per-message character limits
 */

export type ChatHistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

/** Mirrors the per-message user limit in lib/ai/chat-validation.ts. */
export const CHAT_USER_MESSAGE_MAX_CHARS = 4_000;
/** Mirrors the per-message assistant limit in lib/ai/chat-validation.ts. */
export const CHAT_ASSISTANT_MESSAGE_MAX_CHARS = 8_000;

/**
 * Keeps at most `maxMessages` of the newest messages and drops any leading
 * assistant messages, so the window always starts on a user turn.
 */
export function windowFromUserTurn<T extends ChatHistoryMessage>(
  messages: readonly T[],
  maxMessages: number
): T[] {
  const limit = Math.max(1, Math.floor(maxMessages));
  const recent = messages.slice(-limit);
  const firstUser = recent.findIndex((message) => message.role === 'user');
  return firstUser === -1 ? [] : recent.slice(firstUser);
}

/**
 * Builds the `messages` array for a chat request.
 * - Empty messages are dropped.
 * - When two user messages are adjacent (an earlier turn failed and got no
 *   reply), only the newer one is kept; adjacent assistant messages keep the
 *   newer one too.
 * - Contents are cut to the server's per-message limits.
 * - The result starts on a user turn and is capped at `maxMessages`.
 */
export function buildChatRequestMessages(
  messages: readonly ChatHistoryMessage[],
  maxMessages = 200
): ChatHistoryMessage[] {
  const alternating: ChatHistoryMessage[] = [];
  for (const message of messages) {
    const content = message.content.trim();
    if (!content) continue;
    const limit =
      message.role === 'user'
        ? CHAT_USER_MESSAGE_MAX_CHARS
        : CHAT_ASSISTANT_MESSAGE_MAX_CHARS;
    const next = { role: message.role, content: content.slice(0, limit) };
    if (alternating.at(-1)?.role === next.role) {
      alternating[alternating.length - 1] = next;
    } else {
      alternating.push(next);
    }
  }
  return windowFromUserTurn(alternating, maxMessages);
}
