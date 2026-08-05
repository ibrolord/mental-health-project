import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createChat, sendMessage } = vi.hoisted(() => ({
  createChat: vi.fn(),
  sendMessage: vi.fn(),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(() => ({ chats: { create: createChat } })),
}));

import { chat } from '../../lib/ai/gemini';

describe('Gemini chat adapter', () => {
  beforeEach(() => {
    delete process.env.GEMINI_MODEL;
    createChat.mockReset();
    sendMessage.mockReset();

    sendMessage.mockResolvedValue({ text: 'A supportive response' });
    createChat.mockReturnValue({ sendMessage });
  });

  afterEach(() => {
    delete process.env.GEMINI_MODEL;
  });

  it('uses the current supported model by default', async () => {
    const response = await chat([{ role: 'user', content: 'Hello' }]);

    expect(response).toBe('A supportive response');
    expect(createChat).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gemini-3.5-flash', history: [] })
    );
    expect(sendMessage).toHaveBeenCalledWith({ message: 'Hello' });
  });

  it('uses the configured model override', async () => {
    process.env.GEMINI_MODEL = 'gemini-custom';

    await chat([{ role: 'user', content: 'Hello' }]);

    expect(createChat).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gemini-custom' }),
    );
  });
});
