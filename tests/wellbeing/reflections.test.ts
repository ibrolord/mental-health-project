import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EVIDENCE_SOURCES } from '../../lib/wellbeing/evidence';
import {
  completedReflectionSteps,
  REFLECTION_RESPONSE_LIMIT,
  REFLECTION_TEMPLATES,
  reflectionTemplateById,
  serializeReflectionResponses,
  validateReflectionResponses,
} from '../../lib/reflections';
import {
  clearWebReflectionDraft,
  readWebReflectionDraft,
  webReflectionDraftKey,
  writeWebReflectionDraft,
} from '../../lib/reflection-draft-storage';

const reflectPage = readFileSync(
  resolve(process.cwd(), 'app/reflect/page.tsx'),
  'utf8'
);
const navigation = readFileSync(
  resolve(process.cwd(), 'lib/navigation.ts'),
  'utf8'
);
const researchPage = readFileSync(
  resolve(process.cwd(), 'app/research/page.tsx'),
  'utf8'
);

describe('guided reflections', () => {
  it('persists validated drafts by owner for refresh recovery', () => {
    const values = new Map<string, string>();
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        sessionStorage: {
          getItem: (key: string) => values.get(key) ?? null,
          setItem: (key: string, value: string) => values.set(key, value),
          removeItem: (key: string) => values.delete(key),
        },
      },
    });

    try {
      writeWebReflectionDraft('owner-a', {
        templateId: 'balanced-thought',
        stepIndex: 2,
        responses: { situation: 'A specific moment.' },
      });
      writeWebReflectionDraft('owner-b', {
        templateId: 'make-room',
        stepIndex: 0,
        responses: { notice: 'A different private draft.' },
      });

      expect(readWebReflectionDraft('owner-a')).toMatchObject({
        templateId: 'balanced-thought',
        responses: { situation: 'A specific moment.' },
      });
      expect(readWebReflectionDraft('owner-b')).toMatchObject({
        templateId: 'make-room',
      });
      clearWebReflectionDraft('owner-a');
      expect(readWebReflectionDraft('owner-a')).toBeNull();
      expect(values.has(webReflectionDraftKey('owner-b'))).toBe(true);
    } finally {
      if (originalWindow) {
        Object.defineProperty(globalThis, 'window', originalWindow);
      } else {
        Reflect.deleteProperty(globalThis, 'window');
      }
    }
  });

  it('provides three primary modes and four progressively disclosed modes', () => {
    expect(REFLECTION_TEMPLATES).toHaveLength(7);
    expect(REFLECTION_TEMPLATES.filter((template) => template.primary)).toHaveLength(3);
    expect(REFLECTION_TEMPLATES.filter((template) => !template.primary)).toHaveLength(4);
    expect(new Set(REFLECTION_TEMPLATES.map((template) => template.id)).size).toBe(7);
  });

  it('keeps every template structured and connected to known evidence', () => {
    const evidenceIds = new Set(EVIDENCE_SOURCES.map((source) => source.id));

    for (const template of REFLECTION_TEMPLATES) {
      expect(template.steps.length).toBeGreaterThanOrEqual(3);
      expect(new Set(template.steps.map((step) => step.id)).size).toBe(
        template.steps.length
      );
      expect(template.evidenceIds.length).toBeGreaterThan(0);
      for (const evidenceId of template.evidenceIds) {
        expect(evidenceIds.has(evidenceId)).toBe(true);
      }
    }
  });

  it('serializes only answered steps in the intended order', () => {
    const template = REFLECTION_TEMPLATES[1];
    const responses = {
      [template.steps[0].id]: '  A specific problem  ',
      [template.steps[2].id]: '',
      [template.steps[4].id]: 'If it is 9 AM, I will begin for five minutes.',
    };

    const content = serializeReflectionResponses(template, responses);
    expect(content).toContain(`## ${template.steps[0].label}\nA specific problem`);
    expect(content).toContain(`## ${template.steps[4].label}\nIf it is 9 AM`);
    expect(content).not.toContain(`## ${template.steps[2].label}`);
    expect(completedReflectionSteps(template, responses)).toBe(2);
  });

  it('rejects blank and oversized responses before saving', () => {
    const template = REFLECTION_TEMPLATES[0];
    expect(validateReflectionResponses(template, {})).toBe(
      'Write at least one response before saving.'
    );
    expect(
      validateReflectionResponses(template, {
        [template.steps[0].id]: 'x'.repeat(REFLECTION_RESPONSE_LIMIT + 1),
      })
    ).toContain('Keep each response under');
  });

  it('owner-scopes journal saves and rejects stale save completions', () => {
    expect(reflectPage).toContain(".from('journal_entries')");
    expect(reflectPage).toContain('.insert({ ...prepared, user_id: ownerId })');
    expect(reflectPage).toContain('const responsesSnapshot = { ...responsesRef.current }');
    expect(reflectPage).toContain('saveOperationGenerationRef.current === saveOperationGeneration');
    expect(reflectPage).toContain('draftRevisionRef.current === saveDraftRevision');
    expect(reflectPage).toContain('if (!saveIsCurrent()) return;');
    expect(reflectPage).toContain('Your responses are still here.');
    expect(reflectPage).toContain("window.confirm('Discard this reflection draft?')");
    expect(reflectPage).toContain('readWebReflectionDraft(ownerId)');
    expect(reflectPage).toContain('writeWebReflectionDraft(readyOwnerId');
    expect(reflectPage).toContain('clearWebReflectionDraft(ownerId)');
    expect(reflectPage).toContain('Partners only see enabled activity counts.');
    expect(reflectPage).toContain('} catch {');
    expect(reflectPage).toContain('draftOwnerId === readyOwnerId');
    expect(reflectPage).not.toContain("from('partner_links')");
    expect(reflectPage).not.toContain("fetch('/api");
  });

  it('preselects a valid weekly mode once without overriding a draft', () => {
    expect(reflectionTemplateById('weekly-patterns')?.id).toBe('weekly-patterns');
    expect(reflectPage).toContain("new URLSearchParams(window.location.search)");
    expect(reflectPage).toContain('preselectionGenerationRef.current');
    expect(reflectPage).toContain('activeIdRef.current ||');
    expect(reflectPage).toContain('draftOwnerIdRef.current ||');
  });

  it('announces and focuses guided step changes', () => {
    expect(reflectPage).toContain('stepHeadingRef.current?.focus()');
    expect(reflectPage).toContain('aria-live="polite"');
    expect(reflectPage).toContain('tabIndex={-1}');
  });

  it('accurately discloses the self-compassion evidence limitations', () => {
    const evidence = EVIDENCE_SOURCES.find(
      (source) => source.id === 'self-compassion-reflection'
    );

    expect(evidence?.strength).toBe('emerging');
    expect(evidence?.summary).toContain('Overall risk of bias was high');
    expect(evidence?.summary).toContain('this exact reflection was not studied');
  });

  it('is reachable under Reflect and documents its research limits', () => {
    expect(navigation).toContain("href: '/reflect'");
    expect(navigation).toContain("label: 'Guided reflection'");
    expect(researchPage).toContain("id: 'reflection'");
    expect(reflectPage).toContain('href="/research#reflection"');
  });
});
