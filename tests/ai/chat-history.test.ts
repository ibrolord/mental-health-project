import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MODEL_HISTORY_CHAR_BUDGET, trimConversationForModel } from '../../lib/ai/chat-history';
import { CHAT_LIMITS, chatRequestSchema } from '../../lib/ai/chat-validation';
import {
  buildChatRequestMessages,
  CHAT_ASSISTANT_MESSAGE_MAX_CHARS,
  CHAT_MAX_MESSAGES,
  CHAT_MESSAGES_MAX_BYTES,
  sliceCodePoints,
  utf8ByteLength,
  CHAT_TOTAL_MAX_CHARS,
  CHAT_USER_MESSAGE_MAX_CHARS,
  windowFromUserTurn,
  type ChatHistoryMessage,
} from '../../mobile/lib/chat-history';
import { buildChatRequestMessages as webBuildChatRequestMessages } from '../../lib/chat-request-history';

const total = (messages: readonly ChatHistoryMessage[]) =>
  messages.reduce((sum, message) => sum + message.content.length, 0);

function conversation(turns: number, userChars = 40, assistantChars = 80): ChatHistoryMessage[] {
  const messages: ChatHistoryMessage[] = [];
  for (let turn = 0; turn < turns; turn += 1) {
    messages.push({ role: 'user', content: `u${turn} `.padEnd(userChars, 'x') });
    if (turn < turns - 1) {
      messages.push({ role: 'assistant', content: `a${turn} `.padEnd(assistantChars, 'y') });
    }
  }
  return messages;
}

function expectValidShape(messages: readonly ChatHistoryMessage[]) {
  expect(messages[0]?.role).toBe('user');
  expect(messages.at(-1)?.role).toBe('user');
  messages.forEach((message, index) => {
    if (index > 0) expect(message.role).not.toBe(messages[index - 1].role);
  });
}

describe('server chat request limits', () => {
  it('accepts a normal long text chat (21+ turns) instead of rejecting it', () => {
    const messages = conversation(25);
    expect(messages.length).toBeGreaterThan(40);
    expect(chatRequestSchema.safeParse({ messages }).success).toBe(true);
  });

  it('accepts thirteen long messages that used to exceed the old total cap', () => {
    const messages = conversation(7, 1_900, 1_900);
    expect(messages).toHaveLength(13);
    expect(chatRequestSchema.safeParse({ messages }).success).toBe(true);
  });

  it('accepts a long model reply in history but keeps the user-message cap', () => {
    expect(chatRequestSchema.safeParse({ messages: [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'y'.repeat(CHAT_LIMITS.assistantMessageChars) },
      { role: 'user', content: 'thanks' },
    ] }).success).toBe(true);
    expect(chatRequestSchema.safeParse({ messages: [
      { role: 'user', content: 'x'.repeat(CHAT_LIMITS.userMessageChars + 1) },
    ] }).success).toBe(false);
  });

  it('still rejects abusive request sizes', () => {
    expect(chatRequestSchema.safeParse({
      messages: conversation(Math.ceil(CHAT_LIMITS.messages / 2) + 1),
    }).success).toBe(false);
    expect(chatRequestSchema.safeParse({
      messages: conversation(40, 4_000, 4_000),
    }).success).toBe(false);
  });
});

describe('trimConversationForModel', () => {
  it('trims to the budget, keeps the latest user turn and starts on a user message', () => {
    const messages = conversation(40, 1_000, 1_500);
    const trimmed = trimConversationForModel(messages);
    const total = trimmed.reduce((sum, message) => sum + message.content.length, 0);
    expect(total).toBeLessThanOrEqual(MODEL_HISTORY_CHAR_BUDGET);
    expect(trimmed.length).toBeLessThan(messages.length);
    expect(trimmed.at(-1)).toEqual(messages.at(-1));
    expectValidShape(trimmed);
  });

  it('returns short conversations unchanged', () => {
    const messages = conversation(3);
    expect(trimConversationForModel(messages)).toEqual(messages);
  });

  it('keeps the latest user message even when it alone exceeds the budget', () => {
    const messages = [
      { role: 'user' as const, content: 'earlier' },
      { role: 'assistant' as const, content: 'reply' },
      { role: 'user' as const, content: 'z'.repeat(50) },
    ];
    expect(trimConversationForModel(messages, 10)).toEqual([messages[2]]);
  });
});

describe('mobile chat history helpers', () => {
  it('stay within the new server per-message limits', () => {
    expect(CHAT_USER_MESSAGE_MAX_CHARS).toBe(4_000);
    expect(CHAT_USER_MESSAGE_MAX_CHARS).toBeLessThanOrEqual(CHAT_LIMITS.userMessageChars);
    expect(CHAT_ASSISTANT_MESSAGE_MAX_CHARS).toBeLessThanOrEqual(CHAT_LIMITS.assistantMessageChars);
  });

  it('starts the 12-message voice window on a user turn from the 7th turn on', () => {
    for (let turns = 1; turns <= 15; turns += 1) {
      const window = windowFromUserTurn(conversation(turns), 12);
      expect(window.length).toBeLessThanOrEqual(12);
      expectValidShape(window);
      expect(chatRequestSchema.safeParse({ messages: buildChatRequestMessages(window, 12) }).success).toBe(true);
    }
  });

  it('repairs a failed turn (two user messages in a row) before sending', () => {
    const messages: ChatHistoryMessage[] = [
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'reply' },
      { role: 'user', content: 'this one failed' },
      { role: 'user', content: 'try again' },
    ];
    const request = buildChatRequestMessages(messages);
    expect(request.map(({ content }) => content)).toEqual(['first', 'reply', 'try again']);
    expect(chatRequestSchema.safeParse({ messages: request }).success).toBe(true);
  });

  it('never sends a leading assistant message or over-long content', () => {
    const request = buildChatRequestMessages([
      { role: 'assistant', content: 'welcome' },
      { role: 'user', content: 'x'.repeat(CHAT_USER_MESSAGE_MAX_CHARS + 50) },
    ]);
    expect(request).toHaveLength(1);
    expect(request[0].content).toHaveLength(CHAT_USER_MESSAGE_MAX_CHARS);
  });

  it('keeps mobile chat input and error handling aligned with the server', () => {
    const chat = readFileSync(resolve(process.cwd(), 'mobile/app/(tabs)/chat.tsx'), 'utf8');
    expect(chat).toContain('maxLength={CHAT_USER_MESSAGE_MAX_CHARS}');
    expect(chat).not.toContain('maxLength={8_000}');
    expect(chat).toContain('const requestMessages = buildChatRequestMessages(nextMessages);');
    expect(chat).toContain('if (requestMessages.length === 0) throw');
    expect(chat).toContain('messages: requestMessages,');
    const catchBlock = chat.slice(chat.indexOf('} catch (reason) {'), chat.indexOf('} finally {', chat.indexOf('} catch (reason) {')));
    expect(catchBlock).toContain('setMessages(previousMessages)');
    expect(catchBlock).toContain('setSendError(');
    expect(catchBlock).not.toContain("role: 'assistant'");
  });

  it('builds every mobile voice request through the history helpers', () => {
    const voice = readFileSync(resolve(process.cwd(), 'mobile/app/voice.tsx'), 'utf8');
    expect(voice).not.toContain('.slice(-12)');
    expect(voice.match(/buildChatRequestMessages\(/g)?.length).toBe(2);
    // Both voice requests are skipped when there is nothing valid to send.
    expect(voice).toContain('if (chatMessages.length === 0) throw');
    expect(voice).toContain('if (fallbackMessages.length === 0) throw');
  });

  it('stay within the new server message-count and total character limits', () => {
    expect(CHAT_MAX_MESSAGES).toBeLessThanOrEqual(CHAT_LIMITS.messages);
    expect(CHAT_TOTAL_MAX_CHARS).toBeLessThanOrEqual(CHAT_LIMITS.totalChars);
  });

  // Codex review of 26f5a58: 61 alternating 2,000-character messages are
  // 122,000 characters, over the server's total limit, and were rejected.
  it('trims 61 alternating 2,000-character messages to a valid request', () => {
    const messages = conversation(31, 2_000, 2_000);
    expect(messages).toHaveLength(61);
    expect(chatRequestSchema.safeParse({ messages }).success).toBe(false);

    const request = buildChatRequestMessages(messages);
    expectValidShape(request);
    expect(request.at(-1)).toEqual(messages.at(-1));
    expect(total(request)).toBeLessThanOrEqual(CHAT_LIMITS.totalChars);
    expect(chatRequestSchema.safeParse({ messages: request }).success).toBe(true);
    // Retrying the same history is trimmed the same way, never kept oversized.
    expect(buildChatRequestMessages([...messages])).toEqual(request);
  });

  it('keeps every long conversation under all server limits', () => {
    for (const [turns, userChars, assistantChars] of [
      [31, 2_000, 2_000],
      [40, 4_000, 8_000],
      [150, 4_000, 4_000],
      [120, 100, 8_000],
      [500, 10, 10],
    ] as const) {
      const request = buildChatRequestMessages(conversation(turns, userChars, assistantChars));
      expectValidShape(request);
      expect(request.length).toBeLessThanOrEqual(CHAT_LIMITS.messages);
      expect(total(request)).toBeLessThanOrEqual(CHAT_LIMITS.totalChars);
      expect(chatRequestSchema.safeParse({ messages: request }).success).toBe(true);
    }
  });

  it('applies a character budget in windowFromUserTurn without losing the newest message', () => {
    const messages = conversation(5, 100, 100);
    const window = windowFromUserTurn(messages, 200, 250);
    expectValidShape(window);
    expect(window.at(-1)).toEqual(messages.at(-1));
    expect(total(window)).toBeLessThanOrEqual(250);
    expect(windowFromUserTurn(messages, 200, 1)).toEqual([messages.at(-1)]);
  });
});

// The schema still live in production (see `git show 6890bd8:lib/ai/chat-validation.ts`).
// Until the new server is deployed, every request must also pass this one.
const liveServerMessagesSchema = z
  .array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(4_000),
  }).strict())
  .min(1)
  .max(40)
  .superRefine((messages, context) => {
    if (messages.reduce((sum, message) => sum + message.content.length, 0) > 24_000) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Conversation is too large' });
    }
    if (messages.at(-1)?.role !== 'user') {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Last message must be from the user' });
    }
    if (messages[0]?.role !== 'user') {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'First message must be from the user' });
    }
    for (let index = 1; index < messages.length; index += 1) {
      if (messages[index].role === messages[index - 1].role) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'Roles must alternate' });
      }
    }
  });

describe('mobile chat history against the live (old) server schema', () => {
  it('trims a 60-message chat to <= 40 messages starting and ending on user turns', () => {
    const messages = conversation(31);
    messages.pop();
    messages.pop();
    messages.push({ role: 'user', content: 'newest question' });
    expect(messages).toHaveLength(60);
    expect(liveServerMessagesSchema.safeParse(messages).success).toBe(false);

    const request = buildChatRequestMessages(messages);
    expect(request.length).toBeLessThanOrEqual(40);
    expect(request[0].role).toBe('user');
    expect(request.at(-1)).toEqual({ role: 'user', content: 'newest question' });
    expectValidShape(request);
    expect(liveServerMessagesSchema.safeParse(request).success).toBe(true);
    expect(chatRequestSchema.safeParse({ messages: request }).success).toBe(true);
  });

  it('cuts a 7,000-character assistant reply to 4,000 characters', () => {
    const request = buildChatRequestMessages([
      { role: 'user', content: 'tell me a lot' },
      { role: 'assistant', content: 'y'.repeat(7_000) },
      { role: 'user', content: 'thanks' },
    ]);
    expect(request).toHaveLength(3);
    expect(request[1].content).toHaveLength(4_000);
    expect(liveServerMessagesSchema.safeParse(request).success).toBe(true);
    expect(chatRequestSchema.safeParse({ messages: request }).success).toBe(true);
  });

  it('keeps every long conversation under the live server limits', () => {
    for (const [turns, userChars, assistantChars] of [
      [31, 2_000, 2_000],
      [40, 4_000, 8_000],
      [25, 100, 7_000],
      [150, 4_000, 4_000],
      [500, 10, 10],
      [3, 6_000, 9_000],
    ] as const) {
      const messages = conversation(turns, userChars, assistantChars);
      const request = buildChatRequestMessages(messages);
      expectValidShape(request);
      expect(request.length).toBeLessThanOrEqual(40);
      expect(total(request)).toBeLessThanOrEqual(24_000);
      expect(request.at(-1)?.content).toBe(messages.at(-1)?.content.slice(0, 4_000));
      expect(liveServerMessagesSchema.safeParse(request).success).toBe(true);
      expect(chatRequestSchema.safeParse({ messages: request }).success).toBe(true);
    }
  });

  it('keeps the 12-message voice window valid for the live server', () => {
    for (let turns = 1; turns <= 15; turns += 1) {
      const window = windowFromUserTurn(conversation(turns, 3_000, 7_000), 12);
      const request = buildChatRequestMessages(window, 12);
      expect(request.length).toBeLessThanOrEqual(12);
      expect(request.at(-1)?.content).toBe(window.at(-1)?.content);
      expect(liveServerMessagesSchema.safeParse(request).success).toBe(true);
    }
  });
});

// Codex review of 5cba6ba: the live server rejects bodies over 64 KiB (413),
// and 24,000 chars of CJK text is ~72 KB of JSON.
const jsonBytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value), 'utf8');
const isHighSurrogate = (code: number) => code >= 0xd800 && code <= 0xdbff;

describe('mobile chat history byte budget', () => {
  it('matches TextEncoder for mixed text, emoji and lone surrogates', () => {
    for (const text of ['', 'abc', 'é ß', '漢字', '😀👍🏽', 'a\ud83db', '\udc00x', 'end\ud83d', 'mix é漢😀 "q" \n']) {
      expect(utf8ByteLength(text)).toBe(new TextEncoder().encode(text).length);
    }
  });

  it('fits seven 3,400-character CJK messages in the live server body limit', () => {
    const messages: ChatHistoryMessage[] = Array.from({ length: 7 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `${index}${'漢'.repeat(3_400)}`,
    }));
    expect(jsonBytes(messages)).toBeGreaterThan(64 * 1024);

    const request = buildChatRequestMessages(messages);
    expect(jsonBytes(request)).toBeLessThanOrEqual(CHAT_MESSAGES_MAX_BYTES);
    expect(request.at(-1)).toEqual(messages.at(-1));
    expectValidShape(request);
    expect(liveServerMessagesSchema.safeParse(request).success).toBe(true);
    expect(chatRequestSchema.safeParse({ messages: request }).success).toBe(true);
    // Worst case with a full 30,000-char ASCII userContext still fits 64 KiB.
    expect(jsonBytes({ messages: request, userContext: { notes: 'x'.repeat(30_000) } }))
      .toBeLessThanOrEqual(64 * 1024);
  });

  it('keeps every byte-heavy history under the budget', () => {
    for (const unit of ['漢', '😀', 'é', '"', '\u0001']) {
      for (const turns of [1, 3, 8, 30]) {
        const messages = conversation(turns).map((message) => ({
          ...message,
          content: unit.repeat(5_000),
        }));
        const request = buildChatRequestMessages(messages);
        expect(request.length).toBeGreaterThan(0);
        expect(jsonBytes(request)).toBeLessThanOrEqual(CHAT_MESSAGES_MAX_BYTES);
        expect(liveServerMessagesSchema.safeParse(request).success).toBe(true);
        expect(chatRequestSchema.safeParse({ messages: request }).success).toBe(true);
      }
    }
  });

  it('does not split an emoji at the 4,000-character cut', () => {
    const request = buildChatRequestMessages([
      { role: 'user', content: 'a'.repeat(3_999) + '😀' + 'tail' },
    ]);
    expect(request[0].content).toBe('a'.repeat(3_999));
    expect(isHighSurrogate(request[0].content.charCodeAt(request[0].content.length - 1))).toBe(false);
    expect(sliceCodePoints('ab😀', 3)).toBe('ab');
    expect(sliceCodePoints('ab😀', 4)).toBe('ab😀');
  });

  it('cuts the newest user turn on code points when it alone exceeds the budget', () => {
    const newest = '😀'.repeat(500);
    const request = buildChatRequestMessages(
      [
        { role: 'user', content: 'older' },
        { role: 'assistant', content: 'reply' },
        { role: 'user', content: newest },
      ],
      40,
      200
    );
    expect(request).toHaveLength(1);
    expect(request[0].role).toBe('user');
    expect(jsonBytes(request)).toBeLessThanOrEqual(200);
    expect(newest.startsWith(request[0].content)).toBe(true);
    expect(request[0].content.length % 2).toBe(0);
    expect(isHighSurrogate(request[0].content.charCodeAt(request[0].content.length - 1))).toBe(false);
  });

  it('applies a byte budget in windowFromUserTurn without losing the newest message', () => {
    const messages = conversation(5, 100, 100);
    const window = windowFromUserTurn(messages, 200, Number.POSITIVE_INFINITY, 500);
    expectValidShape(window);
    expect(window.at(-1)).toEqual(messages.at(-1));
    expect(jsonBytes(window)).toBeLessThanOrEqual(500);
    expect(windowFromUserTurn(messages, 200, Number.POSITIVE_INFINITY, 1)).toEqual([messages.at(-1)]);
  });

  it('returns [] when there is nothing valid to send', () => {
    expect(buildChatRequestMessages([])).toEqual([]);
    expect(buildChatRequestMessages([{ role: 'user', content: '   ' }])).toEqual([]);
    expect(buildChatRequestMessages([{ role: 'assistant', content: 'hello' }])).toEqual([]);
  });
});

describe('web chat history helpers', () => {
  it('is a byte-identical copy of the mobile helper', () => {
    const mobileSource = readFileSync(resolve(process.cwd(), 'mobile/lib/chat-history.ts'), 'utf8');
    const webSource = readFileSync(resolve(process.cwd(), 'lib/chat-request-history.ts'), 'utf8');
    expect(webSource).toBe(mobileSource);
    expect(webBuildChatRequestMessages(conversation(31, 2_000, 2_000))).toEqual(
      buildChatRequestMessages(conversation(31, 2_000, 2_000))
    );
  });

  it('builds the web chat request through the history helper', () => {
    const page = readFileSync(resolve(process.cwd(), 'app/chat/page.tsx'), 'utf8');
    expect(page).toContain('messages: buildChatRequestMessages(nextMessages)');
    expect(page).not.toMatch(/messages: nextMessages,/);
  });
});
