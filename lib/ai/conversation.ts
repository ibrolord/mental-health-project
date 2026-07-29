export type ConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type ConversationOperation = {
  ownerKey: string | null;
  revision: number;
};

export function isCurrentConversationOperation(
  operation: ConversationOperation,
  ownerKey: string | null,
  revision: number
): boolean {
  return operation.ownerKey === ownerKey && operation.revision === revision;
}

export function isCompleteConversation(
  messages: readonly ConversationMessage[]
): boolean {
  return (
    messages.length >= 2 &&
    messages.at(-1)?.role === 'assistant' &&
    messages.every(
      (message, index) =>
        message.role === (index % 2 === 0 ? 'user' : 'assistant') &&
        message.content.trim().length > 0
    )
  );
}
