import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { geminiChat, claudeChat } = vi.hoisted(() => ({
  geminiChat: vi.fn(),
  claudeChat: vi.fn(),
}));

vi.mock('../../lib/ai/gemini', () => ({ chat: geminiChat }));
vi.mock('../../lib/ai/claude', () => ({ chat: claudeChat }));

import { chat, PROVIDER_TIMEOUT_MS } from '../../lib/ai/model-router';
import { MODEL_HISTORY_CHAR_BUDGET } from '../../lib/ai/chat-history';

const MOBILE_CHAT_TIMEOUT_MS = 45_000;

describe('model router deadlines and fallback', () => {
  const saved = {
    primary: process.env.AI_PRIMARY_PROVIDER,
    gemini: process.env.GOOGLE_API_KEY,
    claude: process.env.ANTHROPIC_API_KEY,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    geminiChat.mockReset();
    claudeChat.mockReset();
    delete process.env.AI_PRIMARY_PROVIDER;
    process.env.GOOGLE_API_KEY = 'configured';
    process.env.ANTHROPIC_API_KEY = 'configured';
  });

  afterEach(() => {
    vi.useRealTimers();
    for (const [key, value] of [
      ['AI_PRIMARY_PROVIDER', saved.primary],
      ['GOOGLE_API_KEY', saved.gemini],
      ['ANTHROPIC_API_KEY', saved.claude],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('keeps two provider attempts inside the mobile request timeout', () => {
    expect(PROVIDER_TIMEOUT_MS * 2).toBeLessThan(MOBILE_CHAT_TIMEOUT_MS);
  });

  it('gives up on a hanging primary and answers from the fallback in time', async () => {
    let primarySignal: AbortSignal | undefined;
    claudeChat.mockImplementation((_messages, _context, options) => {
      primarySignal = options?.signal;
      return new Promise(() => undefined);
    });
    geminiChat.mockResolvedValue('Fallback answer');

    const pending = chat([{ role: 'user', content: 'Help me switch off tonight' }]);
    await vi.advanceTimersByTimeAsync(PROVIDER_TIMEOUT_MS);
    const result = await pending;

    expect(result).toEqual({ model: 'gemini', response: 'Fallback answer' });
    expect(primarySignal?.aborted).toBe(true);
    expect(geminiChat).toHaveBeenCalledOnce();
  });

  it('fails cleanly when both providers hang', async () => {
    claudeChat.mockImplementation(() => new Promise(() => undefined));
    geminiChat.mockImplementation(() => new Promise(() => undefined));

    const pending = chat([{ role: 'user', content: 'Hello' }]);
    const assertion = expect(pending).rejects.toThrow('AI service temporarily unavailable');
    await vi.advanceTimersByTimeAsync(PROVIDER_TIMEOUT_MS * 2);
    await assertion;
  });

  it.each(['', '   '])('treats empty model output as a failure so fallback runs: %j', async (empty) => {
    claudeChat.mockResolvedValue(empty);
    geminiChat.mockResolvedValue('Real answer');

    const result = await chat([{ role: 'user', content: 'Hello' }]);

    expect(result).toEqual({ model: 'gemini', response: 'Real answer' });
  });

  it('sends a trimmed, user-first history to the model for long chats', async () => {
    claudeChat.mockResolvedValue('ok');
    const messages = Array.from({ length: 61 }, (_, index) => ({
      role: index % 2 === 0 ? ('user' as const) : ('assistant' as const),
      content: `${index} `.padEnd(1_200, 'x'),
    }));

    await chat(messages);

    const sent = claudeChat.mock.calls[0][0] as typeof messages;
    expect(sent.length).toBeLessThan(messages.length);
    expect(sent[0].role).toBe('user');
    expect(sent.at(-1)).toEqual(messages.at(-1));
    expect(sent.reduce((sum, message) => sum + message.content.length, 0)).toBeLessThanOrEqual(
      MODEL_HISTORY_CHAR_BUDGET
    );
  });

  it('runs crisis detection on the untrimmed conversation', async () => {
    // The newest messages fill the model budget exactly, so trimming alone
    // would drop the crisis turn; it is still within the 3-user-message window.
    const messages = [
      { role: 'user' as const, content: 'kms' },
      { role: 'assistant' as const, content: 'y'.repeat(8_000) },
      { role: 'user' as const, content: 'x'.repeat(4_000) },
      { role: 'assistant' as const, content: 'y'.repeat(8_000) },
      { role: 'user' as const, content: 'x'.repeat(4_000) },
    ];

    const result = await chat(messages);

    expect(result.model).toBe('safety');
    expect(claudeChat).not.toHaveBeenCalled();
    expect(geminiChat).not.toHaveBeenCalled();
  });
});
