import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('privacy copy matches the code (1.0.10)', () => {
  const privacy = read('app/privacy/page.tsx').replace(/\s+/g, ' ');

  it('does not promise that anonymous data is never purged', () => {
    for (const source of [privacy, read('app/support/page.tsx'), read('mobile/app/support.tsx')]) {
      expect(source).not.toMatch(/not automatically purged|never purged/i);
      expect(source).toContain('cleanup');
    }
    // The cleanup function exists; scheduling is not in the migrations.
    const reaper = read('supabase/migrations/20260926115248_add_tool_completions.sql');
    expect(reaper).toContain('reap_stale_anonymous_users');
  });

  it('says affirmations do not send mood notes, matching the server prompt', () => {
    expect(privacy).toContain('mood notes and goal text are not sent');
    const prompt = read('lib/ai/affirmation-request.ts');
    const builder = prompt.slice(prompt.indexOf('export function buildAffirmationPrompt'));
    expect(builder).not.toMatch(/\.note\b|\.content\b/);
    expect(read('app/api/affirmations/generate/route.ts')).toContain("from '@anthropic-ai/sdk'");
    expect(privacy).toMatch(/Anthropic Claude:<\/strong>[^<]*affirmations/);
  });

  it('does not say OpenAI handles text chat', () => {
    expect(privacy).toContain('OpenAI is not used for text chat');
    expect(read('lib/ai/model-router.ts')).not.toMatch(/openai/i);
  });

  it('keeps the copy rules', () => {
    for (const source of [privacy, read('mobile/lib/ai-consent-copy.ts'), read('lib/ai-consent.ts')]) {
      expect(source).not.toMatch(/no data collection|no tracking|clinically proven|registered charity/i);
    }
  });
});
