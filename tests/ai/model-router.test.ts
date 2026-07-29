import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { geminiChat, claudeChat } = vi.hoisted(() => ({
  geminiChat: vi.fn(),
  claudeChat: vi.fn(),
}));

vi.mock('../../lib/ai/gemini', () => ({ chat: geminiChat }));
vi.mock('../../lib/ai/claude', () => ({ chat: claudeChat }));

import { chat } from '../../lib/ai/model-router';

describe('model router crisis interception', () => {
  const originalPrimaryProvider = process.env.AI_PRIMARY_PROVIDER;
  const originalGeminiKey = process.env.GOOGLE_API_KEY;
  const originalClaudeKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    geminiChat.mockReset();
    claudeChat.mockReset();
    delete process.env.AI_PRIMARY_PROVIDER;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    if (originalPrimaryProvider === undefined) {
      delete process.env.AI_PRIMARY_PROVIDER;
    } else {
      process.env.AI_PRIMARY_PROVIDER = originalPrimaryProvider;
    }
    if (originalGeminiKey === undefined) {
      delete process.env.GOOGLE_API_KEY;
    } else {
      process.env.GOOGLE_API_KEY = originalGeminiKey;
    }
    if (originalClaudeKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalClaudeKey;
    }
  });

  it('returns the deterministic response without invoking or falling back to a model', async () => {
    geminiChat.mockRejectedValue(new Error('must not run'));
    claudeChat.mockRejectedValue(new Error('must not run'));

    const result = await chat([{ role: 'user', content: 'I am planning to end my life.' }]);

    expect(result.model).toBe('safety');
    expect(result.response).toContain('988');
    expect(geminiChat).not.toHaveBeenCalled();
    expect(claudeChat).not.toHaveBeenCalled();
  });

  it('uses Claude directly when it is the only configured provider', async () => {
    process.env.ANTHROPIC_API_KEY = 'configured';
    claudeChat.mockResolvedValue('A useful next step');

    const result = await chat([{ role: 'user', content: 'Help me plan ten minutes.' }]);

    expect(result).toEqual({ model: 'claude', response: 'A useful next step' });
    expect(geminiChat).not.toHaveBeenCalled();
    expect(claudeChat).toHaveBeenCalledOnce();
  });

  it('uses an explicitly configured Gemini primary when its credential exists', async () => {
    process.env.AI_PRIMARY_PROVIDER = 'gemini';
    process.env.GOOGLE_API_KEY = 'configured';
    process.env.ANTHROPIC_API_KEY = 'configured';
    geminiChat.mockResolvedValue('A Gemini response');

    const result = await chat([{ role: 'user', content: 'Hello' }]);

    expect(result.model).toBe('gemini');
    expect(geminiChat).toHaveBeenCalledOnce();
    expect(claudeChat).not.toHaveBeenCalled();
  });

  it('skips a selected provider when its credential is missing', async () => {
    process.env.AI_PRIMARY_PROVIDER = 'gemini';
    process.env.ANTHROPIC_API_KEY = 'configured';
    claudeChat.mockResolvedValue('A Claude response');

    const result = await chat([{ role: 'user', content: 'Hello' }]);

    expect(result.model).toBe('claude');
    expect(geminiChat).not.toHaveBeenCalled();
  });

  it('falls back once when the configured primary fails', async () => {
    process.env.AI_PRIMARY_PROVIDER = 'gemini';
    process.env.GOOGLE_API_KEY = 'configured';
    process.env.ANTHROPIC_API_KEY = 'configured';
    geminiChat.mockRejectedValue(new Error('provider unavailable'));
    claudeChat.mockResolvedValue('Fallback response');

    const result = await chat([{ role: 'user', content: 'Hello' }]);

    expect(result).toEqual({ model: 'claude', response: 'Fallback response' });
    expect(geminiChat).toHaveBeenCalledOnce();
    expect(claudeChat).toHaveBeenCalledOnce();
  });
});
