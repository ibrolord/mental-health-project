import { describe, expect, it } from 'vitest';
import {
  isCompleteConversation,
  isCurrentConversationOperation,
} from '../../lib/ai/conversation';

describe('private chat persistence guard', () => {
  it('accepts only completed alternating conversations', () => {
    expect(
      isCompleteConversation([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' },
      ])
    ).toBe(true);
    expect(
      isCompleteConversation([
        { role: 'user', content: 'One' },
        { role: 'assistant', content: 'Two' },
        { role: 'user', content: 'Three' },
        { role: 'assistant', content: 'Four' },
      ])
    ).toBe(true);
  });

  it('rejects pending, malformed, and empty turns', () => {
    expect(
      isCompleteConversation([{ role: 'user', content: 'Pending' }])
    ).toBe(false);
    expect(
      isCompleteConversation([
        { role: 'assistant', content: 'Wrong start' },
        { role: 'user', content: 'Wrong end' },
      ])
    ).toBe(false);
    expect(
      isCompleteConversation([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: '   ' },
      ])
    ).toBe(false);
  });

  it('invalidates delayed work when either identity or revision changes', () => {
    const operation = { ownerKey: 'user_id:user-a', revision: 4 };

    expect(
      isCurrentConversationOperation(operation, 'user_id:user-a', 4)
    ).toBe(true);
    expect(
      isCurrentConversationOperation(operation, 'user_id:user-b', 4)
    ).toBe(false);
    expect(
      isCurrentConversationOperation(operation, 'user_id:user-a', 5)
    ).toBe(false);
  });
});
