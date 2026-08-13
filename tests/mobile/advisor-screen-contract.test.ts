import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const advisor = readFileSync(
  path.resolve(process.cwd(), 'mobile/app/advisor.tsx'),
  'utf8'
);
const togetherCreate = readFileSync(
  path.resolve(process.cwd(), 'mobile/app/accountability/create.tsx'),
  'utf8'
);

describe('mobile Advisor screen contracts', () => {
  it('binds loading, preview, and generation to a frozen source selection', () => {
    expect(advisor).toContain('const selectedSources: Sources');
    expect(advisor).toContain('setPreviewSources(selectedSources)');
    expect(advisor).toContain('previewSources.health && context.health');
    expect(advisor).toContain('disabled={loading}');
  });

  it('clears consent choices for every new suggestion', () => {
    const reset = advisor.slice(advisor.indexOf('const reset = () =>'), advisor.indexOf('return ('));
    expect(reset).toContain('setSources(INITIAL_SOURCES)');
    expect(reset).toContain('setPreviewSources(INITIAL_SOURCES)');
  });

  it('keeps reminder and Together actions revocable and capability-gated', () => {
    expect(advisor).toContain('Cancel Advisor reminder');
    expect(advisor).toContain('const canUseTogether = isAuthenticated && !isAnonymous');
    expect(advisor).toContain('disabled={reminderBusy}');
    expect(advisor).toContain("pathname: '/auth/login'");
    expect(advisor).toContain("params: { returnTo: '/accountability' }");
  });

  it('shows an exact sharing preview and routes no-partner users to setup', () => {
    expect(togetherCreate).toContain('Before you share');
    expect(togetherCreate).toContain('Partner:');
    expect(togetherCreate).toContain('Check-in rhythm:');
    expect(togetherCreate).toContain("router.replace('/accountability')");
    expect(togetherCreate).toContain('!selectedConnection');
    expect(togetherCreate).toContain('if (!value.trim()) setNotesShared(false)');
  });

  it('previews every selected field that can determine the suggestion', () => {
    expect(advisor).toContain('Due ${formatAdvisorDueDate(context.goals[0].dueAt)}');
    expect(advisor).toContain('Smallest step: ${context.habits[0].tinyStep?.trim()');
    expect(advisor).toContain('Advisor could not safely turn the selected item into an action.');
  });
});
