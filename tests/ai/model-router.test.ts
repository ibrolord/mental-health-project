import { beforeEach, describe, expect, it, vi } from 'vitest';

const { geminiChat, claudeChat } = vi.hoisted(() => ({
  geminiChat: vi.fn(),
  claudeChat: vi.fn(),
}));

vi.mock('../../lib/ai/gemini', () => ({ chat: geminiChat }));
vi.mock('../../lib/ai/claude', () => ({ chat: claudeChat }));

import { chat } from '../../lib/ai/model-router';

describe('model router crisis interception', () => {
  beforeEach(() => {
    geminiChat.mockReset();
    claudeChat.mockReset();
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
});
