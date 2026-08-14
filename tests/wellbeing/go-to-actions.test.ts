import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GO_TO_ACTIONS,
  GO_TO_ACTION_LIMIT,
  GO_TO_TOOLS,
  parseGoToActions,
  sanitizeGoToActions,
  serializeGoToActions,
} from '../../lib/wellbeing/go-to-actions';
import {
  DEFAULT_GO_TO_ACTIONS as MOBILE_DEFAULTS,
  GO_TO_ACTION_LIMIT as MOBILE_LIMIT,
  GO_TO_TOOLS as MOBILE_TOOLS,
  parseGoToActions as parseMobileGoToActions,
} from '../../mobile/lib/wellbeing/go-to-actions';

describe('My Go-To Actions', () => {
  it('uses three calm defaults when no preference exists', () => {
    expect(parseGoToActions(null)).toEqual(DEFAULT_GO_TO_ACTIONS);
  });

  it('falls back safely when stored JSON is corrupt', () => {
    expect(parseGoToActions('{not-json')).toEqual(DEFAULT_GO_TO_ACTIONS);
  });

  it('falls back safely when the stored version is unknown', () => {
    expect(parseGoToActions(JSON.stringify({ version: 99, actions: [] }))).toEqual(
      DEFAULT_GO_TO_ACTIONS
    );
  });

  it('removes duplicate and unknown tools while preserving user order', () => {
    expect(
      sanitizeGoToActions([
        { toolId: 'journal', cue: '' },
        { toolId: 'unknown', cue: '' },
        { toolId: 'journal', cue: 'again' },
        { toolId: 'ground', cue: '' },
      ])
    ).toEqual([
      { toolId: 'journal', cue: '' },
      { toolId: 'ground', cue: '' },
    ]);
  });

  it('normalizes cue text and enforces the three-action limit', () => {
    const actions = sanitizeGoToActions([
      { toolId: 'ground', cue: `  thoughts   race ${'x'.repeat(100)}` },
      { toolId: 'meditate', cue: '' },
      { toolId: 'focus', cue: '' },
      { toolId: 'journal', cue: '' },
    ]);
    expect(actions).toEqual([
      { toolId: 'ground', cue: `thoughts race ${'x'.repeat(66)}` },
      { toolId: 'meditate', cue: '' },
      { toolId: 'focus', cue: '' },
    ]);
  });

  it('round-trips only the versioned sanitized payload', () => {
    expect(parseGoToActions(serializeGoToActions([{ toolId: 'plans', cue: '  I feel stuck ' }]))).toEqual([
      { toolId: 'plans', cue: 'I feel stuck' },
    ]);
  });

  it('keeps web and Expo allowlists, defaults, and limits aligned', () => {
    expect({
      limit: GO_TO_ACTION_LIMIT,
      defaults: DEFAULT_GO_TO_ACTIONS,
      tools: GO_TO_TOOLS.map(({ id, label, href }) => ({ id, label, route: href })),
    }).toEqual({
      limit: MOBILE_LIMIT,
      defaults: MOBILE_DEFAULTS,
      tools: MOBILE_TOOLS,
    });
  });

  it('uses the same corruption fallback on Expo', () => {
    expect(parseMobileGoToActions('not-json')).toEqual(MOBILE_DEFAULTS);
  });
});

describe('My Go-To Actions integration boundaries', () => {
  const source = (file: string) =>
    readFileSync(resolve(process.cwd(), file), 'utf8');

  it('keeps browser persistence device-local and owner-scoped', () => {
    const storage = source('lib/go-to-actions-storage.ts');
    expect(storage).toContain('encodeURIComponent(ownerKey)');
    expect(storage).not.toMatch(/supabase|apiRequest|fetch\(/);
  });

  it('keeps native persistence device-local and owner-scoped', () => {
    const storage = source('mobile/lib/go-to-actions-storage.ts');
    expect(storage).toContain('AsyncStorage');
    expect(storage).not.toMatch(/supabase|apiRequest|fetch\(/);
  });

  it('keeps the native low-energy experience to one adaptive next action', () => {
    const dashboard = source('mobile/app/(tabs)/index.tsx');
    const advisorCore = source('mobile/lib/advisor-core.ts');
    const advisorContext = source('mobile/lib/advisor-context.ts');
    expect(dashboard.match(/<AdvisorHomeCard\b/g)).toHaveLength(1);
    expect(advisorCore).toContain("id: 'low-energy-grounding'");
    expect(advisorCore).toContain("route: '/ground'");
    expect(advisorContext).toContain('dashboardPreferences.readLowEnergyMode');
    expect(dashboard).not.toContain("{ label: 'One small step'");
  });

  it('clears the preference during browser and native local-data cleanup', () => {
    expect([
      source('app/settings/page.tsx'),
      source('lib/auth-context.tsx'),
      source('mobile/app/settings.tsx'),
      source('mobile/lib/auth-context.tsx'),
    ].every((file) => file.includes('clearGoToActions'))).toBe(true);
  });

  it('isolates preferences when ownership changes and labels native cue inputs', () => {
    expect(source('app/dashboard/page.tsx')).toContain("key={moodOwnerKey ?? 'pending'}");
    expect(source('mobile/app/(tabs)/index.tsx')).toContain('lowEnergyOwnerKey === ownerKey');
    expect(source('mobile/app/(tabs)/more.tsx')).toContain('preferenceOwnerKey !== ownerKey');
    expect(source('mobile/components/GoToActions.tsx')).toContain('accessibilityLabel={`When I notice for ${tool.label}, optional`}');
  });

  it('hides actions while owner preferences load and resets mounted native state after deletion', () => {
    expect(source('components/go-to-actions.tsx')).toContain('if (!ready)');
    expect(source('mobile/components/GoToActions.tsx')).toContain('if (!ready)');
    expect(source('mobile/components/GoToActions.tsx')).toContain('subscribeGoToActionsCleared');
    expect(source('mobile/lib/go-to-actions-storage.ts')).toContain('clearListeners');
  });
});
