import {
  REFLECTION_RESPONSE_LIMIT,
  reflectionTemplateById,
  type ReflectionTemplateId,
} from './reflections';

export type WebReflectionDraft = {
  templateId: ReflectionTemplateId;
  stepIndex: number;
  responses: Record<string, string>;
  updatedAt: string;
};

const STORAGE_PREFIX = 'mhtoolkit:reflection-draft:v1:';

export function webReflectionDraftKey(ownerId: string): string {
  return `${STORAGE_PREFIX}${ownerId}`;
}

function parseDraft(value: string): WebReflectionDraft | null {
  try {
    const parsed = JSON.parse(value) as Partial<WebReflectionDraft>;
    const template = reflectionTemplateById(parsed.templateId ?? null);
    if (!template || !Number.isInteger(parsed.stepIndex)) return null;
    if (
      (parsed.stepIndex ?? -1) < 0 ||
      (parsed.stepIndex ?? template.steps.length) >= template.steps.length ||
      !parsed.responses ||
      typeof parsed.responses !== 'object' ||
      Array.isArray(parsed.responses)
    ) {
      return null;
    }

    const allowedStepIds = new Set(template.steps.map((step) => step.id));
    const responses: Record<string, string> = {};
    for (const [stepId, response] of Object.entries(parsed.responses)) {
      if (
        !allowedStepIds.has(stepId) ||
        typeof response !== 'string' ||
        response.length > REFLECTION_RESPONSE_LIMIT
      ) {
        return null;
      }
      responses[stepId] = response;
    }

    return {
      templateId: template.id,
      stepIndex: parsed.stepIndex as number,
      responses,
      updatedAt:
        typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

export function readWebReflectionDraft(ownerId: string): WebReflectionDraft | null {
  if (typeof window === 'undefined') return null;
  const key = webReflectionDraftKey(ownerId);
  const stored = window.sessionStorage.getItem(key);
  if (!stored) return null;
  const draft = parseDraft(stored);
  if (!draft) window.sessionStorage.removeItem(key);
  return draft;
}

export function writeWebReflectionDraft(
  ownerId: string,
  draft: Omit<WebReflectionDraft, 'updatedAt'>
): void {
  if (typeof window === 'undefined') return;
  const validated = parseDraft(
    JSON.stringify({ ...draft, updatedAt: new Date().toISOString() })
  );
  if (!validated) throw new Error('Reflection draft is invalid.');
  window.sessionStorage.setItem(webReflectionDraftKey(ownerId), JSON.stringify(validated));
}

export function clearWebReflectionDraft(ownerId: string): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(webReflectionDraftKey(ownerId));
}
