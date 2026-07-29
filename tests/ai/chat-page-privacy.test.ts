import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const chatPage = readFileSync(
  resolve(process.cwd(), 'app/chat/page.tsx'),
  'utf8'
);
const journalPage = readFileSync(
  resolve(process.cwd(), 'app/journal/page.tsx'),
  'utf8'
);
const libraryPage = readFileSync(
  resolve(process.cwd(), 'app/library/page.tsx'),
  'utf8'
);

describe('chat page private-context lifecycle', () => {
  it('rolls back a failed text turn so retry preserves alternating roles', () => {
    const catchBlock =
      chatPage
        .split("console.error('Chat request failed:'")[1]
        ?.split('} finally {')[0] ?? '';

    expect(catchBlock).toContain('setMessages(messages)');
    expect(catchBlock).toContain('setInput(trimmed)');
    expect(catchBlock).not.toContain('setMessages(nextMessages)');
  });

  it('keeps the selected context when switching between voice and text', () => {
    const leaveVoiceMode =
      chatPage
        .split('const leaveVoiceMode = () => {')[1]
        ?.split('\n  };')[0] ?? '';

    expect(leaveVoiceMode).not.toContain(
      'setSelections(createEmptyAiContextSelections())'
    );
    expect(leaveVoiceMode).not.toContain("setContextStatus('idle')");
    expect(chatPage.match(/onClick=\{leaveVoiceMode\}/g)).toHaveLength(1);
    expect(chatPage).toContain('onClose={leaveVoiceMode}');
  });

  it('keeps the private context chooser collapsed until the user opens it', () => {
    expect(chatPage).toContain(
      'const [contextExpanded, setContextExpanded] = useState(false)'
    );
    expect(chatPage).toContain('aria-expanded={contextExpanded}');
    expect(chatPage).toContain('aria-controls="chat-context-options"');
    expect(chatPage).toContain('id="chat-context-options"');
    expect(chatPage).toContain('Use my MHtoolkit context');
    expect(chatPage).toContain('Context is off');
  });

  it('drops loaded private context when the authenticated identity changes', () => {
    expect(chatPage).toContain('previousQueryKeyRef.current === queryKey');
    expect(chatPage).toContain('chatAbortRef.current?.abort()');
    expect(chatPage).toContain('setMessages([])');
    expect(chatPage).toContain('const visibleMessages = conversationMatchesIdentity');
    expect(chatPage).toContain('setSelections(createEmptyAiContextSelections())');
    expect(chatPage).toContain('setContextOwnerKey(null)');
    expect(chatPage).toContain('!authLoading && contextOwnerKey === queryKey');
    expect(chatPage).toContain('hasFullContextPreference(queryKey)');
    expect(chatPage).toContain('saveFullContextPreference(queryKey, next)');
  });

  it('saves only a completed conversation with a single-flight guard', () => {
    expect(chatPage).toContain('savingRef.current');
    expect(chatPage).toContain('!isCompleteConversation(visibleMessages)');
    expect(chatPage).toContain('isCurrentConversationOperation');
    expect(chatPage).toContain('activeSaveRef.current !== saveId');
    expect(chatPage).toContain("saving ? 'Saving...' : 'Save privately'");
  });

  it('does not accept another turn while a private save is running', () => {
    const sendGuard =
      chatPage
        .split('const send = async (text: string) => {')[1]
        ?.split("if (!ensureAiDataSharingConsent()) return;")[0] ?? '';

    expect(sendGuard).toContain('savingRef.current');
    expect(chatPage).toContain('saving ||');
  });

  it('keeps private-writing controls concise and user-directed', () => {
    expect(journalPage).toContain('You choose when AI uses your journal.');
    expect(journalPage).toContain('Partner sharing');
    expect(libraryPage).toContain(
      'AI can use this note when context is on.'
    );
  });

  it('filters invalid legacy goals and bounds assessment recency before AI use', () => {
    const assessmentLoader =
      chatPage
        .split('if (selections.assessments) {')[1]
        ?.split('if (selections.goals) {')[0] ?? '';
    const goalLoader =
      chatPage
        .split('if (selections.goals) {')[1]
        ?.split('if (selections.habits) {')[0] ?? '';

    expect(assessmentLoader).toContain(".gte('created_at', since)");
    expect(goalLoader).toContain(
      '.filter((row) => row.content.trim().length > 0)'
    );
    expect(goalLoader).toContain('content: row.content.trim().slice(0, 700)');
  });
});
