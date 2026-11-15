import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { containsExplicitCrisis } from '../../lib/ai/crisis';
import {
  crisisTextVariants,
  legacyNormalizeCrisisText,
  normalizeCrisisText,
  SHARED_CRISIS_PATTERNS as SERVER_PATTERNS,
} from '../../lib/ai/crisis-patterns';
import { SHARED_CRISIS_PATTERNS as MOBILE_PATTERNS } from '../../mobile/lib/crisis-patterns';
import { hasExplicitUrgentSafetyLanguage } from '../../mobile/lib/local-safety';

const server = (content: string) => containsExplicitCrisis([{ role: 'user', content }]);
const mobile = (content: string) => hasExplicitUrgentSafetyLanguage(content);

// Every phrase here must be caught by BOTH the server and the on-device check.
// Includes every crisis phrase from the 2026-11 Advisor assessments.
const SHARED_CRISIS_PHRASES = [
  // Indirect
  "I don't see the point in living anymore",
  'I don’t see the point in living anymore',
  'There is no point in living anymore',
  'no reason to live',
  'There is nothing left to live for',
  "What's the point of living",
  "I'm so tired of living",
  'everyone would be better off without me',
  "They'd be better off if I was gone",
  'I wish I was dead',
  "I don't want to be here anymore",
  // Shorthand and slang
  'kms',
  'honestly might just kms',
  "I'm gonna kys",
  'i wanna die',
  'I want to just die',
  'I want to end it',
  'I want to end it all',
  'I want to go to sleep and never wake up',
  'I hope I never wake up',
  'I want to unalive myself',
  'thinking about unaliving myself',
  // Misspellings
  'I want to kil myself',
  'I want to kill my self',
  'gonna killmyself',
  'I keep thinking about sucide',
  // Means
  'I have pills saved up',
  "I've been saving up my pills",
  // Explicit phrases the two checks previously disagreed on
  "I've been thinking about suicide",
  "I can't keep myself safe",
  'I feel so suicidal',
  'I have been having suicidal thoughts',
  // Spanish
  'Quiero morir',
  'Me quiero matar',
  'No quiero vivir más',
  'No vale la pena vivir',
  // French
  'Je veux mourir',
  'Je ne veux plus vivre',
  'J’ai envie d’en finir',
  // German
  'Ich will sterben',
  'Ich möchte nicht mehr leben',
  'Ich bringe mich um',
  // Portuguese
  'Quero morrer',
  'Não quero mais viver',
  'Eu vou me matar',
  // Hindi (Devanagari and romanised)
  'मैं मरना चाहता हूँ',
  'मैं अब जीना नहीं चाहती',
  'मैं आत्महत्या के बारे में सोच रहा हूँ',
  'main marna chahta hoon',
  'khudkushi karne ka man hai',
  // Chinese
  '我不想活了',
] as const;

// Neither check may treat these as a crisis.
const SHARED_NON_CRISIS_PHRASES = [
  'this exam is killing me',
  'cutting down on caffeine',
  'killing it at work',
  'I ran 5 kms today',
  'Walk 3 kms',
  'I never wake up on time',
  'you should kys',
  'I want to end it with my boyfriend',
  'Stop forgetting to take my meds',
  'Take my meds at 8am',
  "I'm dying to see that film",
  'I could kill for a coffee',
  'I am not suicidal',
  'The article discusses suicide prevention',
  'I feel anxious and overwhelmed',
] as const;

describe('crisis detection parity between server and mobile', () => {
  it('keeps the server and mobile pattern modules byte-identical', () => {
    const serverSource = readFileSync(resolve(process.cwd(), 'lib/ai/crisis-patterns.ts'), 'utf8');
    const mobileSource = readFileSync(resolve(process.cwd(), 'mobile/lib/crisis-patterns.ts'), 'utf8');
    expect(mobileSource).toBe(serverSource);
    expect(MOBILE_PATTERNS.map(String)).toEqual(SERVER_PATTERNS.map(String));
  });

  it('avoids regex features unsupported by the mobile runtime target', () => {
    for (const pattern of SERVER_PATTERNS) {
      expect(pattern.source).not.toMatch(/\\p\{|\(\?<[=!]/);
      expect(pattern.flags).toBe('');
    }
  });

  it.each(SHARED_CRISIS_PHRASES)('both checks catch: %s', (phrase) => {
    expect({ server: server(phrase), mobile: mobile(phrase) }).toEqual({
      server: true,
      mobile: true,
    });
  });

  it.each(SHARED_NON_CRISIS_PHRASES)('neither check flags: %s', (phrase) => {
    expect({ server: server(phrase), mobile: mobile(phrase) }).toEqual({
      server: false,
      mobile: false,
    });
  });
});

describe('normalizeCrisisText', () => {
  it('keeps non-Latin scripts instead of stripping them', () => {
    expect(normalizeCrisisText('मैं मरना चाहता हूँ')).toContain('मरना चाहता');
    expect(normalizeCrisisText('我不想活了。')).toBe('我不想活了');
  });

  it('folds Latin accents, full-width letters, curly quotes and zero-width characters', () => {
    expect(normalizeCrisisText('Não quero')).toBe('nao quero');
    expect(normalizeCrisisText('Ich möchte')).toBe('ich mochte');
    expect(normalizeCrisisText('ＫＩＬＬ ＭＹＳＥＬＦ')).toBe('kill myself');
    expect(normalizeCrisisText('don’t')).toBe("don't");
    expect(normalizeCrisisText('ki​ll myself')).toBe('kill myself');
  });

  it('keeps apostrophes and hyphens used by patterns', () => {
    expect(normalizeCrisisText("I'm self-harming!")).toBe("i'm self-harming");
  });
});

describe('symbols between words never hide crisis language', () => {
  // Codex review of 26f5a58: these were caught by the pre-multilingual server
  // check (ASCII normalisation turned symbols into spaces) and must stay caught.
  const EMOJI_JOINED = [
    'I want to💔die',
    'kill🔪myself',
    'i want to 💔die',
    'I want to❤️die',
    'I want to☠die',
    'kill✂️myself',
    'I want to end🖤my🖤life',
    'I am going to⚡kill myself',
    'thinking about🙃suicide',
    'quiero💔morir',
    'não quero💔viver',
    'je veux🥀mourir',
    'मरना💔चाहता',
    '我想死😭',
  ];

  it.each(EMOJI_JOINED)('server detects: %s', (phrase) => {
    expect(server(phrase)).toBe(true);
  });

  it.each(EMOJI_JOINED)('mobile detects: %s', (phrase) => {
    expect(mobile(phrase)).toBe(true);
  });

  it('every shared phrase survives emoji between its words on both checks', () => {
    for (const phrase of SHARED_CRISIS_PHRASES) {
      const joined = phrase.replace(/ /g, '💔');
      expect(server(joined), joined).toBe(true);
      expect(mobile(joined), joined).toBe(true);
    }
  });

  it('keeps the legacy ASCII form among the variants checked', () => {
    expect(crisisTextVariants('kill🔪myself')).toContain(legacyNormalizeCrisisText('kill🔪myself'));
    expect(legacyNormalizeCrisisText('kill🔪myself')).toBe('kill myself');
    expect(crisisTextVariants('quiero💔morir')).toContain('quiero morir');
  });

  it('still ignores ordinary emoji-laden messages', () => {
    for (const phrase of ['I love this 💔 song', 'feeling 🙂 today', 'kill🔥the presentation tomorrow']) {
      expect(server(phrase), phrase).toBe(false);
      expect(mobile(phrase), phrase).toBe(false);
    }
  });
});
