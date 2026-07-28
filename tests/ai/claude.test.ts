import { describe, expect, it } from 'vitest';
import { DEFAULT_CLAUDE_MODEL } from '../../lib/ai/claude';

describe('Claude model configuration', () => {
  it('uses the supported Sonnet model as the fallback default', () => {
    expect(DEFAULT_CLAUDE_MODEL).toBe('claude-sonnet-5');
  });
});
