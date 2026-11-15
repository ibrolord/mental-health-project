/**
 * Pure helpers that keep chat history sent to /api/chat valid for the
 * server's request schema (lib/ai/chat-validation.ts and the older schema
 * still live in production):
 * - first and last message from the user
 * - roles alternate
 * - per-message, message-count and total character limits
 * - a UTF-8 byte budget for the serialized `messages` array (the live server
 *   rejects request bodies over 64 KiB with 413)
 * - contents are only cut on code point boundaries (no lone surrogates)
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
 * UTF-8 byte budget for `JSON.stringify(messages)`. The live server rejects
 * bodies over 64 KiB; this leaves room for `userContext` (capped at 30,000
 * chars) and the JSON envelope. 24,000 chars of CJK text is ~72 KB, so the
 * character limit alone is not enough.
 */
export const CHAT_MESSAGES_MAX_BYTES = 32_000;

/**
 * UTF-8 byte length of a string. Works in Hermes (no Buffer/TextEncoder
 * needed). A lone surrogate counts as 3 bytes (U+FFFD).
 */
export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else {
        bytes += 3;
      }
    } else bytes += 3;
  }
  return bytes;
}

/** Bytes a message adds to `JSON.stringify(messages)` (without the comma). */
function serializedBytes(message: ChatHistoryMessage): number {
  return utf8ByteLength(
    JSON.stringify({ role: message.role, content: message.content })
  );
}

/**
 * Cuts `text` to at most `maxUnits` UTF-16 code units without splitting a
 * surrogate pair.
 */
export function sliceCodePoints(text: string, maxUnits: number): string {
  if (text.length <= maxUnits) return text;
  const cut = text.slice(0, Math.max(0, maxUnits));
  const last = cut.charCodeAt(cut.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut;
}

/**
 * Cuts a message's content (on code point boundaries) until the message alone
 * fits in a serialized array of at most `maxBytes`.
 */
function fitMessageBytes<T extends ChatHistoryMessage>(
  message: T,
  maxBytes: number
): T {
  // An array holding one message: `[` + message + `]`.
  const fits = (content: string) =>
    2 + serializedBytes({ role: message.role, content }) <= maxBytes;
  if (fits(message.content)) return message;
  let low = 0;
  let high = message.content.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (fits(sliceCodePoints(message.content, mid))) low = mid;
    else high = mid - 1;
  }
  return { ...message, content: sliceCodePoints(message.content, low) };
}

/**
 * Keeps the newest messages that fit `maxMessages`, `maxTotalChars` and
 * `maxJsonBytes` (UTF-8 size of `JSON.stringify` of the window), then drops
 * any leading assistant messages so the window starts on a user turn. The
 * newest message is always kept, even if it alone exceeds a budget.
 */
export function windowFromUserTurn<T extends ChatHistoryMessage>(
  messages: readonly T[],
  maxMessages: number,
  maxTotalChars = Number.POSITIVE_INFINITY,
  maxJsonBytes = Number.POSITIVE_INFINITY
): T[] {
  const limit = Math.max(1, Math.floor(maxMessages));
  let start = messages.length;
  let used = 0;
  // `[]` plus one comma between messages.
  let bytes = 1;
  while (start > 0 && messages.length - start < limit) {
    const message = messages[start - 1];
    const next = used + message.content.length;
    const nextBytes =
      bytes +
      1 +
      (Number.isFinite(maxJsonBytes) ? serializedBytes(message) : 0);
    if (
      start < messages.length &&
      (next > maxTotalChars || nextBytes > maxJsonBytes)
    ) {
      break;
    }
    used = next;
    bytes = nextBytes;
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
 * - Contents are cut to the server's per-message limits on code point
 *   boundaries.
 * - The result starts on a user turn and is capped at `maxMessages`, the
 *   server's total character limit and `maxJsonBytes` (UTF-8 bytes of
 *   `JSON.stringify(result)`), dropping the oldest turns first. The newest
 *   user turn is always kept; if it alone exceeds `maxJsonBytes` it is cut.
 *
 * Returns `[]` when there is nothing valid to send (empty, blank-only or
 * assistant-only input). The server rejects an empty `messages` array, so
 * callers must not send the request in that case.
 */
export function buildChatRequestMessages(
  messages: readonly ChatHistoryMessage[],
  maxMessages = CHAT_MAX_MESSAGES,
  maxJsonBytes = CHAT_MESSAGES_MAX_BYTES
): ChatHistoryMessage[] {
  const alternating: ChatHistoryMessage[] = [];
  for (const message of messages) {
    const content = message.content.trim();
    if (!content) continue;
    const limit =
      message.role === 'user'
        ? CHAT_USER_MESSAGE_MAX_CHARS
        : CHAT_ASSISTANT_MESSAGE_MAX_CHARS;
    const next = { role: message.role, content: sliceCodePoints(content, limit) };
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
  const byteLimit = Math.min(maxJsonBytes, CHAT_MESSAGES_MAX_BYTES);
  if (alternating.length > 0) {
    const newest = fitMessageBytes(alternating[alternating.length - 1], byteLimit);
    if (!newest.content.trim()) return [];
    alternating[alternating.length - 1] = newest;
  }
  return windowFromUserTurn(
    alternating,
    Math.min(maxMessages, CHAT_MAX_MESSAGES),
    CHAT_TOTAL_MAX_CHARS,
    byteLimit
  );
}
