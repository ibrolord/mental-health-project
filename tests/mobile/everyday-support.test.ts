import { describe, expect, it } from 'vitest';
import { BODY_PRACTICES, visualFocusTravel } from '../../mobile/lib/body-practices';
import { REFLECTION_TEMPLATES, assertReflectionDraftsMergeable, createReflectionDraftStorage, serializeReflectionResponses, validateReflectionResponses, type ReflectionDraft } from '../../mobile/lib/reflections';
import { ROUTINE_TEMPLATES, selectedRoutineItems } from '../../mobile/lib/wellbeing/habits';

describe('iOS everyday support tools', () => {
  const worry = REFLECTION_TEMPLATES.find(({ id }) => id === 'worry-time')!;
  const card = REFLECTION_TEMPLATES.find(({ id }) => id === 'coping-card')!;
  it('protects conflicting drafts during anonymous migration, without blocking identical copies', () => {
    const draft: ReflectionDraft = { templateId: 'worry-time', stepIndex: 0, responses: { worry: 'QA source concern', action: '' }, updatedAt: '2026-10-02T12:00:00Z' };
    expect(() => assertReflectionDraftsMergeable(draft, null)).not.toThrow();
    expect(() => assertReflectionDraftsMergeable(null, draft)).not.toThrow();
    expect(() => assertReflectionDraftsMergeable(draft, { ...draft, stepIndex: 2, responses: { worry: 'QA source concern' }, updatedAt: '2026-10-02T13:00:00Z' })).not.toThrow();
    expect(() => assertReflectionDraftsMergeable(draft, { ...draft, responses: { worry: 'QA destination concern' } })).toThrow('Neither draft has been discarded');
    expect(() => assertReflectionDraftsMergeable(draft, { ...draft, templateId: 'coping-card' })).toThrow('Both profiles');
  });
  it('requires meaningful writing, not just a review date, and accepts an optional date', () => {
    expect(validateReflectionResponses(worry, { 'review-at': '2026-10-03T15:00:00Z' })).toContain('Add a worry');
    expect(validateReflectionResponses(worry, { worry: 'An everyday concern' })).toBeNull();
    expect(validateReflectionResponses(worry, { worry: 'Concern', 'review-at': 'invalid' })).toContain('valid review');
    expect(validateReflectionResponses(card, { action: 'Ask for help' })).toContain('coping words');
    expect(validateReflectionResponses(card, { words: 'One step at a time' })).toBeNull();
  });
  it('serializes a human-readable date including year and keeps journal filter tags distinct', () => {
    const result = serializeReflectionResponses(worry, { worry: 'Concern', 'review-at': '2027-01-06T15:30:00Z' });
    expect(result).toContain('2027');
    expect(result).not.toContain('T15:30');
    expect(worry.tags).toContain('worry time');
    expect(card.tags).toContain('coping card');
    expect(worry.note).toContain('not a notification');
  });
  it.each(['worry-time', 'coping-card'] as const)('persists, isolates and clears %s through the existing secure draft store', async (id) => {
    const values = new Map<string, string>();
    const store = createReflectionDraftStorage({ secureStore: {
      getItemAsync: async (key) => values.get(key) ?? null,
      setItemAsync: async (key, value) => { values.set(key, value); },
      deleteItemAsync: async (key) => { values.delete(key); },
    } });
    const template = REFLECTION_TEMPLATES.find((item) => item.id === id)!;
    const responses = { [template.steps[0].id]: 'Private QA example' };
    await store.write('owner-a', { templateId: id, stepIndex: 0, responses });
    expect(await store.read('owner-a')).toMatchObject({ templateId: id, responses });
    expect(await store.read('owner-b')).toBeNull();
    await store.clear('owner-a');
    expect(await store.read('owner-a')).toBeNull();
  });
  it('installs only selected basics in template order, without accepting unknown or duplicate items', () => {
    const template = ROUTINE_TEMPLATES.find(({ id }) => id === 'everyday-basics')!;
    expect(selectedRoutineItems(template)).toHaveLength(5);
    expect(selectedRoutineItems(template, [])).toEqual([]);
    expect(selectedRoutineItems(template, ['unknown'])).toEqual([]);
    expect(selectedRoutineItems(template, [template.items[2].name, template.items[0].name, template.items[0].name])).toEqual([template.items[0], template.items[2]]);
    expect(template.items.every((item) => item.routineSlot === 'anytime')).toBe(true);
  });
  it('uses bounded offline practices with source links and release/stop guidance', () => {
    expect(new Set(BODY_PRACTICES.map(({ id }) => id)).size).toBe(2);
    for (const practice of BODY_PRACTICES) {
      expect(practice.source.url).toMatch(/^https:\/\//);
      expect(practice.steps.every(({ seconds }) => seconds > 0 && seconds <= 60)).toBe(true);
      expect(practice.steps.reduce((total, step) => total + step.seconds, 0)).toBeLessThanOrEqual(180);
      expect(practice.note).toMatch(/Stop/);
    }
    expect(BODY_PRACTICES[0].note).toContain('instead of tensing');
    expect(BODY_PRACTICES[1].note).toContain('not a vagus nerve reset');
  });
  it('bounds dot travel on tiny, wide, rotated and invalid layouts', () => {
    expect(visualFocusTravel(20, false)).toBe(0);
    expect(visualFocusTravel(100, false)).toBe(18);
    expect(visualFocusTravel(1000, false)).toBe(76);
    expect(visualFocusTravel(1000, true)).toBe(36);
    expect(visualFocusTravel(NaN, false)).toBe(0);
  });
});
