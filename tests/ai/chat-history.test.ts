import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MODEL_HISTORY_CHAR_BUDGET, trimConversationForModel } from '../../lib/ai/chat-history';
import { CHAT_LIMITS, chatRequestSchema } from '../../lib/ai/chat-validation';
import {
  buildChatRequestMessages,
  CHAT_ASSISTANT_MESSAGE_MAX_CHARS,
  CHAT_USER_MESSAGE_MAX_CHARS,
  windowFromUserTurn,
  type ChatHistoryMessage,
} from '../../mobile/lib/chat-history';

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
  it('match the server per-message limits', () => {
    expect(CHAT_USER_MESSAGE_MAX_CHARS).toBe(CHAT_LIMITS.userMessageChars);
    expect(CHAT_ASSISTANT_MESSAGE_MAX_CHARS).toBe(CHAT_LIMITS.assistantMessageChars);
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
    expect(chat).toContain('messages: buildChatRequestMessages(nextMessages)');
    const catchBlock = chat.slice(chat.indexOf('} catch (reason) {'), chat.indexOf('} finally {', chat.indexOf('} catch (reason) {')));
    expect(catchBlock).toContain('setMessages(previousMessages)');
    expect(catchBlock).toContain('setSendError(');
    expect(catchBlock).not.toContain("role: 'assistant'");
  });

  it('builds every mobile voice request through the history helpers', () => {
    const voice = readFileSync(resolve(process.cwd(), 'mobile/app/voice.tsx'), 'utf8');
    expect(voice).not.toContain('.slice(-12)');
    expect(voice.match(/buildChatRequestMessages\(/g)?.length).toBe(2);
  });
});
