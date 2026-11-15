import type { Message } from './claude';

/**
 * Characters of conversation history sent to a model per request. Older turns
 * beyond this are dropped instead of rejecting the request.
 */
export const MODEL_HISTORY_CHAR_BUDGET = 24_000;

/**
 * Keeps the newest messages that fit in `budgetChars`.
 * - The latest message is always kept, even if it alone exceeds the budget.
 * - The result always starts on a user message.
 * - Input order and roles are preserved, so an alternating, user-final
 *   conversation stays alternating and user-final.
 */
export function trimConversationForModel(
  messages: readonly Message[],
  budgetChars = MODEL_HISTORY_CHAR_BUDGET
): Message[] {
  if (messages.length === 0) return [];
  let start = messages.length - 1;
  let used = messages[start].content.length;
  while (start > 0) {
    const next = used + messages[start - 1].content.length;
    if (next > budgetChars) break;
    used = next;
    start -= 1;
  }
  while (start < messages.length - 1 && messages[start].role !== 'user') {
    start += 1;
  }
  return messages.slice(start);
}
