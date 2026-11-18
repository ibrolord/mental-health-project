import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  chat: vi.fn(),
  createMessage: vi.fn(),
  advisor: vi.fn(),
  transcribeAudio: vi.fn(),
  generateVoiceResponse: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseAdmin: vi.fn(() => {
    throw new Error('Supabase must not be used in these tests');
  }),
}));

vi.mock('@/lib/api/auth', () => ({
  corsHeaders: vi.fn(() => ({ 'Access-Control-Allow-Origin': '*' })),
  unauthorizedResponse: vi.fn(),
  verifyAuth: vi.fn(async (request: Request) => ({
    valid: true,
    userId: request.headers.get('x-test-user') ?? 'user-1',
  })),
}));

vi.mock('@/lib/ai/model-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/ai/model-router')>()),
  chat: mocks.chat,
}));

vi.mock('@/lib/ai/advisor-model', () => ({
  ADVISOR_DEADLINE_MS: 6_000,
  createModelAdvisorRecommendation: mocks.advisor,
}));

vi.mock('@/lib/ai/voice-chat', () => ({
  generateVoiceResponse: mocks.generateVoiceResponse,
  transcribeAudio: mocks.transcribeAudio,
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mocks.createMessage };
  },
}));

import { POST as chatPost } from '../../app/api/chat/route';
import { POST as affirmationPost } from '../../app/api/affirmations/generate/route';
import { POST as voicePost } from '../../app/api/voice/route';
import { POST as advisorPost } from '../../app/api/advisor/route';
import { CRISIS_RESPONSE } from '../../lib/ai/crisis';
import { AI_USAGE_RULES, MemoryUsageStore, setUsageStore } from '../../lib/ai/usage-limit';
import { CHAT_LIMITS } from '../../lib/ai/chat-validation';

function jsonRequest(path: string, body: unknown, user = 'user-1', ip = '9.9.9.9'): NextRequest {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return new NextRequest(`https://example.test${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'content-length': String(Buffer.byteLength(text)),
      'x-forwarded-for': ip,
      'x-test-user': user,
    },
    body: text,
  });
}

const chatBody = { messages: [{ role: 'user', content: 'I had a long day at work.' }] };

beforeEach(() => {
  setUsageStore(new MemoryUsageStore());
  mocks.chat.mockReset();
  mocks.chat.mockResolvedValue({ response: 'That sounds tiring.', model: 'claude' });
  mocks.createMessage.mockReset();
  mocks.createMessage.mockResolvedValue({ content: [{ type: 'text', text: '"You are allowed to rest."' }] });
  mocks.generateVoiceResponse.mockReset();
  mocks.generateVoiceResponse.mockImplementation(async () =>
    new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'audio/mpeg' } })
  );
});

describe('/api/chat usage limits', () => {
  it('returns 429 with Retry-After after the burst limit and stops calling the model', async () => {
    const burst = AI_USAGE_RULES.chat.subject[0].limit;
    for (let i = 0; i < burst; i += 1) {
      expect((await chatPost(jsonRequest('/api/chat', chatBody))).status).toBe(200);
    }
    const limited = await chatPost(jsonRequest('/api/chat', chatBody));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect((await limited.json()).error).toMatch(/try again/i);
    expect(mocks.chat).toHaveBeenCalledTimes(burst);

    // Another person is unaffected.
    expect((await chatPost(jsonRequest('/api/chat', chatBody, 'user-2', '8.8.8.8'))).status).toBe(200);
  });

  it('still answers crisis language with the safety response when over the limit', async () => {
    const burst = AI_USAGE_RULES.chat.subject[0].limit;
    for (let i = 0; i < burst + 1; i += 1) await chatPost(jsonRequest('/api/chat', chatBody));
    mocks.chat.mockImplementation(async () => ({ response: CRISIS_RESPONSE, model: 'safety' }));
    const crisis = await chatPost(jsonRequest('/api/chat', {
      messages: [{ role: 'user', content: 'I want to kill myself' }],
    }));
    expect(crisis.status).toBe(200);
    expect(await crisis.json()).toMatchObject({ model: 'safety', response: CRISIS_RESPONSE });
  });

  it('accepts the largest request the live iOS 1.0.9 client sends', async () => {
    // 1.0.9 trims to 40 messages, 4000 chars each, 24000 chars, 32 KB body.
    // A valid history starts and ends with the user, so 39 messages.
    const messages = Array.from({ length: 38 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: 'é'.repeat(300),
    }));
    messages.push({ role: 'user', content: 'x'.repeat(4_000) });
    expect(Buffer.byteLength(JSON.stringify({ messages }))).toBeGreaterThan(24 * 1024);
    const response = await chatPost(jsonRequest('/api/chat', { messages }));
    expect(response.status).toBe(200);
    expect(CHAT_LIMITS.userMessageChars).toBeGreaterThanOrEqual(4_000);
    expect(CHAT_LIMITS.messages).toBeGreaterThanOrEqual(40);
    expect(CHAT_LIMITS.totalChars).toBeGreaterThanOrEqual(24_000);
  });

  it('rejects an oversized body with 413 before the model', async () => {
    const huge = JSON.stringify({ messages: [{ role: 'user', content: 'a'.repeat(600 * 1024) }] });
    const response = await chatPost(jsonRequest('/api/chat', huge));
    expect(response.status).toBe(413);
    expect(mocks.chat).not.toHaveBeenCalled();
  });
});

describe('/api/affirmations/generate', () => {
  it('returns the safety response for crisis language in a mood note and never calls the model', async () => {
    const response = await affirmationPost(jsonRequest('/api/affirmations/generate', {
      moods: [{ emoji: '😢', note: 'I want to end my life' }],
      assessments: [],
      goals: [],
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      response: CRISIS_RESPONSE,
      model: 'safety',
      affirmation: CRISIS_RESPONSE,
    });
    expect(mocks.createMessage).not.toHaveBeenCalled();
  });

  it('checks goal text sent by older clients too', async () => {
    const response = await affirmationPost(jsonRequest('/api/affirmations/generate', {
      moods: [{ emoji: '😐', note: null }],
      goals: [{ content: 'plan to kill myself on friday', status: 'pending' }],
    }));
    expect((await response.json()).model).toBe('safety');
    expect(mocks.createMessage).not.toHaveBeenCalled();
  });

  it('never puts mood notes or goal text in the model prompt', async () => {
    const response = await affirmationPost(jsonRequest('/api/affirmations/generate', {
      moods: [{ emoji: '🙂', note: 'private note about my sister' }, { emoji: '😐', note: null }],
      assessments: [{ type: 'GAD7', score: 7, max_score: 21 }],
      goals: [{ content: 'secret goal text', status: 'completed' }, { content: 'other', status: 'pending' }],
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ affirmation: 'You are allowed to rest.' });
    const prompt = mocks.createMessage.mock.calls[0][0].messages[0].content as string;
    expect(prompt).toContain('🙂 😐');
    expect(prompt).toContain('GAD7: 33% severity');
    expect(prompt).toContain('1 of 2 completed');
    expect(prompt).not.toContain('private note');
    expect(prompt).not.toContain('secret goal');
  });

  it('accepts the web request shape (emoji-only moods, goals with content)', async () => {
    const response = await affirmationPost(jsonRequest('/api/affirmations/generate', {
      moods: [{ emoji: '😊' }],
      assessments: null,
      goals: [{ content: 'walk', status: 'pending' }],
    }));
    expect(response.status).toBe(200);
  });

  it('rejects invalid input with 400 and oversized bodies with 413', async () => {
    expect((await affirmationPost(jsonRequest('/api/affirmations/generate', { moods: 'nope' }))).status).toBe(400);
    expect((await affirmationPost(jsonRequest('/api/affirmations/generate', '{bad json'))).status).toBe(400);
    const huge = JSON.stringify({ moods: [{ emoji: '😊', note: 'a'.repeat(200 * 1024) }] });
    expect((await affirmationPost(jsonRequest('/api/affirmations/generate', huge))).status).toBe(413);
    expect(mocks.createMessage).not.toHaveBeenCalled();
  });

  it('rate limits with 429 and Retry-After', async () => {
    const burst = AI_USAGE_RULES.affirmations.subject[0].limit;
    const body = { moods: [{ emoji: '😊' }] };
    for (let i = 0; i < burst; i += 1) {
      expect((await affirmationPost(jsonRequest('/api/affirmations/generate', body))).status).toBe(200);
    }
    const limited = await affirmationPost(jsonRequest('/api/affirmations/generate', body));
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).toBeTruthy();
    expect(mocks.createMessage).toHaveBeenCalledTimes(burst);
  });
});

describe('/api/voice usage limits and size', () => {
  it('returns 429 after the voice burst limit', async () => {
    const burst = AI_USAGE_RULES.voice.subject[0].limit;
    for (let i = 0; i < burst; i += 1) {
      expect((await voicePost(jsonRequest('/api/voice', { text: 'Hello there.' }))).status).toBe(200);
    }
    const limited = await voicePost(jsonRequest('/api/voice', { text: 'Hello there.' }));
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).toBeTruthy();
    expect(mocks.generateVoiceResponse).toHaveBeenCalledTimes(burst);
  });

  it('bounds the text-to-speech body even without a content-length header', async () => {
    const request = new NextRequest('https://example.test/api/voice', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'a'.repeat(40 * 1024) }),
    });
    expect((await voicePost(request)).status).toBe(413);
    expect(mocks.generateVoiceResponse).not.toHaveBeenCalled();
  });
});

describe('/api/advisor usage limits', () => {
  const body = {
    nowIso: '2026-11-18T12:00:00.000Z',
    mood: null,
    candidates: [{
      id: 'c1',
      observation: 'You checked in today.',
      observations: ['You checked in today.'],
      action: 'Take a short walk.',
      smallerAction: 'Stand up and stretch.',
      sourceLabels: ['Mood'],
    }],
    signals: [],
    appleHealthSummary: null,
    recentFeedback: [],
  };

  it('returns 429 after the Advisor burst limit', async () => {
    mocks.advisor.mockReset();
    mocks.advisor.mockResolvedValue({ selection: null, model: 'claude', personalized: false });
    const burst = AI_USAGE_RULES.advisor.subject[0].limit;
    for (let i = 0; i < burst; i += 1) {
      expect((await advisorPost(jsonRequest('/api/advisor', body))).status).toBe(200);
    }
    const limited = await advisorPost(jsonRequest('/api/advisor', body));
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).toBeTruthy();
    expect(mocks.advisor).toHaveBeenCalledTimes(burst);
  });
});
