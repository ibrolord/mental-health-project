import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getGenerativeModel, sendMessage, startChat } = vi.hoisted(() => ({
  getGenerativeModel: vi.fn(),
  sendMessage: vi.fn(),
  startChat: vi.fn(),
}));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn(() => ({ getGenerativeModel })),
}));

import { chat } from '../../lib/ai/gemini';

describe('Gemini chat adapter', () => {
  beforeEach(() => {
    delete process.env.GEMINI_MODEL;
    getGenerativeModel.mockReset();
    sendMessage.mockReset();
    startChat.mockReset();

    sendMessage.mockResolvedValue({
      response: { text: () => 'A supportive response' },
    });
    startChat.mockReturnValue({ sendMessage });
    getGenerativeModel.mockReturnValue({ startChat });
  });

  afterEach(() => {
    delete process.env.GEMINI_MODEL;
  });

  it('uses the current supported model by default', async () => {
    const response = await chat([{ role: 'user', content: 'Hello' }]);

    expect(response).toBe('A supportive response');
    expect(getGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gemini-3.5-flash' }),
    );
    expect(startChat).toHaveBeenCalledWith({ history: [] });
    expect(sendMessage).toHaveBeenCalledWith('Hello');
  });

  it('uses the configured model override', async () => {
    process.env.GEMINI_MODEL = 'gemini-custom';

    await chat([{ role: 'user', content: 'Hello' }]);

    expect(getGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gemini-custom' }),
    );
  });
});
