import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHAT_SYSTEM_PROMPT } from '../../lib/ai/chat-prompt';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('shared chat system prompt', () => {
  it('is the only prompt used by both Claude and Gemini', () => {
    for (const provider of ['lib/ai/claude.ts', 'lib/ai/gemini.ts']) {
      const source = read(provider);
      expect(source).toContain("import { CHAT_SYSTEM_PROMPT } from './chat-prompt'");
      expect(source).toContain('buildContextualPrompt(CHAT_SYSTEM_PROMPT, userContext)');
      expect(source).not.toContain('BASE_SYSTEM_PROMPT');
      expect(source).not.toContain('You are a compassionate');
    }
  });

  it('keeps the existing safety instructions', () => {
    for (const text of [
      'Never diagnose, treat, or replace professional care',
      'CRISIS DETECTION:',
      'Suicidal thoughts or self-harm',
      'Immediate danger to self or others',
      'local emergency number or nearest emergency department',
      '988 only when they say they are in the United States or Canada',
      'country-specific crisis directory',
      'trusted person who can stay with them',
    ]) {
      expect(CHAT_SYSTEM_PROMPT).toContain(text);
    }
  });

  it('contains the response rules', () => {
    expect(CHAT_SYSTEM_PROMPT).toContain('Write plain text only. Do not use markdown');
    expect(CHAT_SYSTEM_PROMPT).toContain('around 120 words');
    expect(CHAT_SYSTEM_PROMPT).toContain('Never diagnose or suggest the user has a condition');
    expect(CHAT_SYSTEM_PROMPT).toMatch(/Never advise starting, stopping, skipping or changing the dose of any medication[^\n]*prescriber/);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/panic[^\n]*one concrete grounding step/);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/two weeks or more[^\n]*PHQ-9 questionnaire in Assessments[^\n]*GP/);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/burnout, stress or sleep[^\n]*specific practical steps/);
    // The Advisor endpoint asks for JSON through the same prompt.
    expect(CHAT_SYSTEM_PROMPT).toContain('such as JSON, follow that format exactly');
  });

  it.each([
    ['Ground', ['app/ground', 'mobile/app/ground.tsx']],
    ['Daily Reset', ['app/daily-reset']],
    ['Journal', ['app/journal', 'mobile/app/journal.tsx']],
    ['Mood check-in', ['app/tracker', 'mobile/app/(tabs)/tracker.tsx']],
    ['Assessments', ['app/assessments', 'mobile/app/(tabs)/assessments.tsx']],
    ['Goals', ['app/goals', 'mobile/app/goals.tsx']],
    ['Habits', ['app/habits', 'mobile/app/habits.tsx']],
    ['Focus', ['app/focus', 'mobile/app/focus.tsx']],
    ['Meditate', ['app/meditate', 'mobile/app/meditate.tsx']],
    ['My plans', ['app/plans', 'mobile/app/plans.tsx']],
    ['Resources', ['app/resources', 'mobile/app/resources.tsx']],
  ] as const)('names %s, which exists in the apps', (tool, paths) => {
    expect(CHAT_SYSTEM_PROMPT).toContain(`- ${tool}:`);
    for (const path of paths) expect(existsSync(resolve(process.cwd(), path))).toBe(true);
  });

  it('marks Daily Reset as web-only because mobile has no such screen', () => {
    expect(existsSync(resolve(process.cwd(), 'mobile/app/daily-reset.tsx'))).toBe(false);
    expect(CHAT_SYSTEM_PROMPT).toContain('Daily Reset: a short guided reset (web app)');
  });
});

describe('provider call limits', () => {
  it('sets a Claude timeout with no SDK retries', () => {
    const source = read('lib/ai/claude.ts');
    expect(source).toContain('CLAUDE_TIMEOUT_MS = 20_000');
    expect(source).toContain('maxRetries: 0');
    expect(source).toContain("throw new Error('Claude returned an empty response')");
  });

  it('passes the router abort signal to Gemini', () => {
    expect(read('lib/ai/gemini.ts')).toContain('abortSignal: options.signal');
  });
});
