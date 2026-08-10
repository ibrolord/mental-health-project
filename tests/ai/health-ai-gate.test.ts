import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isHealthAiEnabled } from '../../lib/ai/health-ai-gate';

describe('Apple Health AI release gate', () => {
  it('fails closed unless the server flag is exactly true', () => {
    expect(isHealthAiEnabled({})).toBe(false);
    expect(isHealthAiEnabled({ HEALTH_AI_ENABLED: 'false' })).toBe(false);
    expect(isHealthAiEnabled({ HEALTH_AI_ENABLED: 'TRUE' })).toBe(false);
    expect(isHealthAiEnabled({ HEALTH_AI_ENABLED: 'true' })).toBe(true);
  });

  it('guards the chat route before any provider call', () => {
    const route = readFileSync(
      resolve(process.cwd(), 'app/api/chat/route.ts'),
      'utf8'
    );

    expect(route.indexOf('!isHealthAiEnabled()')).toBeGreaterThan(-1);
    expect(route.indexOf('!isHealthAiEnabled()')).toBeLessThan(
      route.indexOf('await chat(messages, userContext)')
    );
  });
});
