import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { geminiChat, claudeChat } = vi.hoisted(() => ({
  geminiChat: vi.fn(),
  claudeChat: vi.fn(),
}));

vi.mock('../../lib/ai/gemini', () => ({ chat: geminiChat }));
vi.mock('../../lib/ai/claude', () => ({ chat: claudeChat }));

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  chat,
  ChatCancelledError,
  CHAT_DEADLINE_MS,
  MIN_FALLBACK_MS,
  PRIMARY_DEADLINE_SHARE,
  PROVIDER_TIMEOUT_MS,
} from '../../lib/ai/model-router';
import { MODEL_HISTORY_CHAR_BUDGET } from '../../lib/ai/chat-history';
import { ADVISOR_DEADLINE_MS } from '../../lib/ai/advisor-model';
import {
  MIN_SERVER_DEADLINE_MS,
  serverDeadlineMs,
} from '../../lib/ai/request-deadline';

describe('serverDeadlineMs', () => {
  const headers = (value?: string) =>
    new Headers(value === undefined ? {} : { 'X-Client-Timeout-Ms': value });

  it('uses the server maximum when the client sends nothing usable', () => {
    for (const value of [undefined, '', 'abc', '-5', '0', '1e5', '99999999']) {
      expect(serverDeadlineMs(headers(value), CHAT_DEADLINE_MS), String(value)).toBe(CHAT_DEADLINE_MS);
    }
  });

  it('shortens the deadline below the client timeout but never lengthens it', () => {
    expect(serverDeadlineMs(headers('45000'), CHAT_DEADLINE_MS)).toBe(CHAT_DEADLINE_MS);
    expect(serverDeadlineMs(headers('30000'), CHAT_DEADLINE_MS)).toBe(28_000);
    expect(serverDeadlineMs(headers('20000'), CHAT_DEADLINE_MS)).toBe(18_000);
    expect(serverDeadlineMs(headers('6000'), ADVISOR_DEADLINE_MS)).toBe(4_800);
    expect(serverDeadlineMs(headers('500'), CHAT_DEADLINE_MS)).toBe(MIN_SERVER_DEADLINE_MS);
  });
});

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

  // Codex review of 26f5a58: every caller's client timeout must fit both
  // attempts, and cancellation must stop the fallback.
  it.each([
    ['text chat (45s client)', 45_000],
    ['voice turn (30s client)', 30_000],
    ['voice realtime fallback (20s client)', 20_000],
    ['Advisor (6s client)', 6_000],
  ])('answers from the fallback inside the %s timeout', async (_label, clientTimeoutMs) => {
    const deadlineMs = serverDeadlineMs(
      new Headers({ 'X-Client-Timeout-Ms': String(clientTimeoutMs) }),
      clientTimeoutMs === 6_000 ? ADVISOR_DEADLINE_MS : CHAT_DEADLINE_MS
    );
    expect(deadlineMs).toBeLessThan(clientTimeoutMs);
    claudeChat.mockImplementation(() => new Promise(() => undefined));
    geminiChat.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve('Fallback answer'), 500))
    );

    let settledAt: number | null = null;
    const pending = chat([{ role: 'user', content: 'Help me switch off tonight' }], undefined, {
      deadlineMs,
    }).then((result) => {
      settledAt = Date.now();
      return result;
    });
    const startedAt = Date.now();
    await vi.advanceTimersByTimeAsync(deadlineMs);

    await expect(pending).resolves.toEqual({ model: 'gemini', response: 'Fallback answer' });
    expect(settledAt! - startedAt).toBeLessThanOrEqual(deadlineMs);
  });

  it.each([18_000, 4_800, 2_000])('fails within a %ims deadline when both providers hang', async (deadlineMs) => {
    claudeChat.mockImplementation(() => new Promise(() => undefined));
    geminiChat.mockImplementation(() => new Promise(() => undefined));

    let settled = false;
    const pending = chat([{ role: 'user', content: 'Hello' }], undefined, { deadlineMs });
    pending.catch(() => undefined).finally(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(deadlineMs);
    expect(settled).toBe(true);
    await expect(pending).rejects.toThrow('AI service temporarily unavailable');
  });

  it('gives the primary only its share of the deadline when a fallback exists', async () => {
    let primarySignal: AbortSignal | undefined;
    claudeChat.mockImplementation((_messages, _context, options) => {
      primarySignal = options?.signal;
      return new Promise(() => undefined);
    });
    geminiChat.mockResolvedValue('ok');

    const pending = chat([{ role: 'user', content: 'Hello' }], undefined, { deadlineMs: 10_000 });
    await vi.advanceTimersByTimeAsync(Math.floor(10_000 * PRIMARY_DEADLINE_SHARE) - 1);
    expect(primarySignal?.aborted).toBe(false);
    expect(geminiChat).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual({ model: 'gemini', response: 'ok' });
    expect(primarySignal?.aborted).toBe(true);
  });

  it('gives the primary the whole deadline when no fallback is configured', async () => {
    delete process.env.GOOGLE_API_KEY;
    claudeChat.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve('Late but in time'), 9_000))
    );

    const pending = chat([{ role: 'user', content: 'Hello' }], undefined, { deadlineMs: 10_000 });
    await vi.advanceTimersByTimeAsync(9_000);
    await expect(pending).resolves.toEqual({ model: 'claude', response: 'Late but in time' });
  });

  it('skips the fallback when too little time is left', async () => {
    claudeChat.mockImplementation(() => new Promise(() => undefined));
    geminiChat.mockResolvedValue('should not be used');
    const deadlineMs = 3_000;
    expect(deadlineMs * (1 - PRIMARY_DEADLINE_SHARE)).toBeLessThan(MIN_FALLBACK_MS);

    const pending = chat([{ role: 'user', content: 'Hello' }], undefined, { deadlineMs });
    const assertion = expect(pending).rejects.toThrow('AI service temporarily unavailable');
    await vi.advanceTimersByTimeAsync(deadlineMs);
    await assertion;
    expect(geminiChat).not.toHaveBeenCalled();
  });

  it('cancels the primary and never starts the fallback when the request is aborted', async () => {
    let primarySignal: AbortSignal | undefined;
    claudeChat.mockImplementation((_messages, _context, options) => {
      primarySignal = options?.signal;
      return new Promise(() => undefined);
    });
    geminiChat.mockResolvedValue('should not be used');
    const controller = new AbortController();

    const pending = chat([{ role: 'user', content: 'Hello' }], undefined, {
      signal: controller.signal,
    });
    const assertion = expect(pending).rejects.toBeInstanceOf(ChatCancelledError);
    await vi.advanceTimersByTimeAsync(1_000);
    controller.abort();
    await assertion;
    expect(primarySignal?.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(CHAT_DEADLINE_MS);
    expect(geminiChat).not.toHaveBeenCalled();
  });

  it('skips the fallback when the request is aborted while the primary is failing', async () => {
    const controller = new AbortController();
    claudeChat.mockImplementation(async () => {
      controller.abort();
      throw new Error('provider failed');
    });
    geminiChat.mockResolvedValue('should not be used');

    await expect(
      chat([{ role: 'user', content: 'Hello' }], undefined, { signal: controller.signal })
    ).rejects.toBeInstanceOf(ChatCancelledError);
    expect(geminiChat).not.toHaveBeenCalled();
  });

  it('cancels the fallback too when the request is aborted during it', async () => {
    claudeChat.mockRejectedValue(new Error('provider failed'));
    let fallbackSignal: AbortSignal | undefined;
    geminiChat.mockImplementation((_messages, _context, options) => {
      fallbackSignal = options?.signal;
      return new Promise(() => undefined);
    });
    const controller = new AbortController();

    const pending = chat([{ role: 'user', content: 'Hello' }], undefined, {
      signal: controller.signal,
    });
    const assertion = expect(pending).rejects.toBeInstanceOf(ChatCancelledError);
    await vi.advanceTimersByTimeAsync(100);
    expect(geminiChat).toHaveBeenCalledOnce();
    controller.abort();
    await assertion;
    expect(fallbackSignal?.aborted).toBe(true);
  });

  it('makes no provider call when the request is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      chat([{ role: 'user', content: 'Hello' }], undefined, { signal: controller.signal })
    ).rejects.toBeInstanceOf(ChatCancelledError);
    expect(claudeChat).not.toHaveBeenCalled();
    expect(geminiChat).not.toHaveBeenCalled();
  });

  it('still returns the crisis response for an aborted request without a model call', async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await chat([{ role: 'user', content: 'I want to💔die' }], undefined, {
      signal: controller.signal,
    });
    expect(result.model).toBe('safety');
    expect(claudeChat).not.toHaveBeenCalled();
  });

  it('wires the request signal and client deadline through both routes', () => {
    for (const path of ['app/api/chat/route.ts', 'app/api/advisor/route.ts']) {
      const route = readFileSync(resolve(process.cwd(), path), 'utf8');
      expect(route, path).toContain('signal: request.signal');
      expect(route, path).toContain('serverDeadlineMs(request.headers');
      expect(route, path).toContain('ChatCancelledError');
    }
    const api = readFileSync(resolve(process.cwd(), 'mobile/lib/api.ts'), 'utf8');
    expect(api).toContain("'X-Client-Timeout-Ms'");
    const voice = readFileSync(resolve(process.cwd(), 'mobile/app/voice.tsx'), 'utf8');
    expect(voice).toContain("'X-Client-Timeout-Ms': String(MAX_CHAT_REQUEST_MS)");
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
