import { describe, expect, it } from 'vitest';
import { containsExplicitCrisis, CRISIS_RESPONSE } from '../../lib/ai/crisis';

const userMessage = (content: string) => [{ role: 'user' as const, content }];

describe('containsExplicitCrisis', () => {
  it.each([
    'I want to die',
    'I am planning to kill myself tonight',
    'I might overdose',
    'There is no point in living',
    "I can't go on",
    'I am going to shoot someone',
    'I feel suicidal',
    'I have been self-harming',
    "I don't want to live anymore",
    'I am thinking about jumping off a bridge',
    'I swallowed too many pills',
    'I have a gun and I am going to use it',
    'I am going to hang myself tonight',
    'I just took 30 Tylenol',
    'I want to kill my wife',
    'I have a plan to kill my family tonight',
  ])('intercepts explicit crisis language: %s', (content) => {
    expect(containsExplicitCrisis(userMessage(content))).toBe(true);
  });

  it.each([
    'I am not suicidal',
    'I used to be suicidal but I am safe now',
    'I am writing about suicide prevention research',
    'This article contains suicide statistics',
    'I feel overwhelmed at work',
  ])('does not intercept clearly non-current language: %s', (content) => {
    expect(containsExplicitCrisis(userMessage(content))).toBe(false);
  });

  it('only inspects user-authored messages', () => {
    expect(containsExplicitCrisis([
      { role: 'assistant', content: 'Are you thinking about suicide?' },
      { role: 'user', content: 'No, I am safe.' },
    ])).toBe(false);
  });

  it('provides deterministic emergency and 988 guidance', () => {
    expect(CRISIS_RESPONSE).toContain('local emergency number');
    expect(CRISIS_RESPONSE).toContain('988');
  });

  it('points people outside North America to real lines and a directory', () => {
    expect(CRISIS_RESPONSE).toContain('findahelpline.com');
    expect(CRISIS_RESPONSE).toContain('116 123');
    expect(CRISIS_RESPONSE).toContain('13 11 14');
    expect(CRISIS_RESPONSE).toContain('9-8-8 Suicide Crisis Helpline');
    expect(CRISIS_RESPONSE).not.toMatch(/\*\*|__|#/);
  });

  it.each([
    'Ｉ ＷＡＮＴ ＴＯ ＫＩＬＬ ＭＹＳＥＬＦ',
    'I want to kíll myself',
    'I want to ki​ll myself',
    'I’m thinking about ending my life',
  ])('normalises Unicode before matching: %s', (content) => {
    expect(containsExplicitCrisis(userMessage(content))).toBe(true);
  });

  // Intentionally unchanged. A "don't want to die" negation guard was
  // suggested in review but would stop an existing phrase from triggering, so
  // the server keeps over-including here. The on-device check has its own
  // clause-level negation and is unaffected.
  it.each([
    "I don't want to die, I just want to sleep",
    "I don't want to kill myself",
  ])('still intercepts negated phrasing on the server (fail-safe): %s', (content) => {
    expect(containsExplicitCrisis(userMessage(content))).toBe(true);
  });

  // Intentionally unchanged: the last three user messages are still checked
  // together, so the safety reply persists for two follow-up turns.
  it('keeps the multi-message crisis window', () => {
    const crisisTurn = { role: 'user' as const, content: "I don't see the point in living anymore" };
    const reply = { role: 'assistant' as const, content: CRISIS_RESPONSE };
    const conversation = [
      crisisTurn,
      reply,
      { role: 'user' as const, content: "I'm safe now, thanks" },
      reply,
      { role: 'user' as const, content: 'How do I switch off at night?' },
    ];
    expect(containsExplicitCrisis(conversation)).toBe(true);
    expect(containsExplicitCrisis([
      ...conversation,
      reply,
      { role: 'user' as const, content: 'Any sleep tips?' },
    ])).toBe(false);
  });
});
