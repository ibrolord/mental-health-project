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
    delete process.env.GEMINI_HEALTH_MODEL;
    createChat.mockReset();
    sendMessage.mockReset();

    sendMessage.mockResolvedValue({ text: 'A supportive response' });
    createChat.mockReturnValue({ sendMessage });
  });

  afterEach(() => {
    delete process.env.GEMINI_MODEL;
    delete process.env.GEMINI_HEALTH_MODEL;
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

  it('uses the cheaper Health model only for Apple Health context', async () => {
    await chat(
      [{ role: 'user', content: 'Reflect on my patterns.' }],
      {
        appleHealthSummary: {
          sevenDay: {
            coverageDays: 4,
            averageSteps: 4000,
            averageSleepMinutes: 420,
            exerciseMinutes: 80,
            mindfulMinutes: 15,
            workoutCount: 2,
            stateOfMindCount: 1,
          },
          thirtyDay: {
            coverageDays: 20,
            averageSteps: 3900,
            averageSleepMinutes: 410,
            exerciseMinutes: 250,
            mindfulMinutes: 45,
            workoutCount: 5,
            stateOfMindCount: 3,
          },
          moodComparison: 'Not enough overlap for a comparison.',
        },
      }
    );

    expect(createChat).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gemini-3.5-flash-lite' })
    );
  });

  it('supports a separate Health model override', async () => {
    process.env.GEMINI_HEALTH_MODEL = 'gemini-health-custom';

    await chat(
      [{ role: 'user', content: 'Reflect on my patterns.' }],
      {
        appleHealthSummary: {
          sevenDay: {
            coverageDays: 0,
            averageSteps: null,
            averageSleepMinutes: null,
            exerciseMinutes: 0,
            mindfulMinutes: 0,
            workoutCount: 0,
            stateOfMindCount: 0,
          },
          thirtyDay: {
            coverageDays: 1,
            averageSteps: 3000,
            averageSleepMinutes: null,
            exerciseMinutes: 0,
            mindfulMinutes: 0,
            workoutCount: 0,
            stateOfMindCount: 0,
          },
          moodComparison: 'No comparison available.',
        },
      }
    );

    expect(createChat).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gemini-health-custom' })
    );
  });
});
