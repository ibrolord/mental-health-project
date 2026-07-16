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
});
