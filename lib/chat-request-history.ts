/**
 * Pure helpers that keep chat history sent to /api/chat valid for the
 * server's request schema (lib/ai/chat-validation.ts and the older schema
 * still live in production):
 * - first and last message from the user
 * - roles alternate
 * - per-message, message-count and total character limits
 *
 * KEEP IN SYNC: `mobile/lib/chat-history.ts` (mobile) and
 * `lib/chat-request-history.ts` (web) must stay byte-identical;
 * `tests/ai/chat-history.test.ts` fails if they drift.
 */

export type ChatHistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

/*
 * These are the limits of the LIVE production /api/chat (40 messages, 4,000
 * chars per message for both roles, 24,000 chars total). They are at or below
 * the newer CHAT_LIMITS in lib/ai/chat-validation.ts, so requests fit both the
 * old and new server. Raise them only after the new server is deployed.
 */
/** Per-message user limit (also the chat TextInput maxLength). */
export const CHAT_USER_MESSAGE_MAX_CHARS = 4_000;
/** Per-message assistant limit. */
export const CHAT_ASSISTANT_MESSAGE_MAX_CHARS = 4_000;
/** Message-count limit. */
export const CHAT_MAX_MESSAGES = 40;
/** Total character limit across all messages. */
export const CHAT_TOTAL_MAX_CHARS = 24_000;

/**
 * Keeps the newest messages that fit both `maxMessages` and `maxTotalChars`,
 * then drops any leading assistant messages so the window starts on a user
 * turn. The newest message is always kept.
 */
export function windowFromUserTurn<T extends ChatHistoryMessage>(
  messages: readonly T[],
  maxMessages: number,
  maxTotalChars = Number.POSITIVE_INFINITY
): T[] {
  const limit = Math.max(1, Math.floor(maxMessages));
  let start = messages.length;
  let used = 0;
  while (start > 0 && messages.length - start < limit) {
    const next = used + messages[start - 1].content.length;
    if (start < messages.length && next > maxTotalChars) break;
    used = next;
    start -= 1;
  }
  const recent = messages.slice(start);
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
 * - The result starts on a user turn and is capped at `maxMessages` and the
 *   server's total character limit, dropping the oldest turns first.
 */
export function buildChatRequestMessages(
  messages: readonly ChatHistoryMessage[],
  maxMessages = CHAT_MAX_MESSAGES
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
  // Nothing to send unless the newest turn is the user's.
  while (alternating.length > 0 && alternating.at(-1)?.role !== 'user') {
    alternating.pop();
  }
  return windowFromUserTurn(
    alternating,
    Math.min(maxMessages, CHAT_MAX_MESSAGES),
    CHAT_TOTAL_MAX_CHARS
  );
}
