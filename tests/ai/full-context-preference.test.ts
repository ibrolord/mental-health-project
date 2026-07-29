import { describe, expect, it } from 'vitest';
import { fullContextPreferenceKey } from '../../lib/ai/full-context-preference';

describe('AI full-context preference', () => {
  it('isolates the preference by data owner', () => {
    const firstOwner = fullContextPreferenceKey('user_id:first');
    const secondOwner = fullContextPreferenceKey('user_id:second');

    expect(firstOwner).not.toBe(secondOwner);
    expect(firstOwner).toContain(encodeURIComponent('user_id:first'));
    expect(firstOwner).toContain('mhtoolkit.ai_full_context.v3');
    expect(firstOwner).not.toContain('mhtoolkit.ai_full_context.v2');
  });
});
