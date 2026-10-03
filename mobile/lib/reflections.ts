import { JOURNAL_LIMITS } from './journal';
import {
  createSecureSessionStorage,
  type SecureKeyValueStore,
} from './secure-session-storage';

export type ReflectionTemplateId =
  | 'balanced-thought'
  | 'solve-one-thing'
  | 'make-room'
  | 'compassionate-reset'
  | 'good-moments'
  | 'express-and-close'
  | 'weekly-patterns'
  | 'worry-time'
  | 'coping-card';

export type ReflectionStep = {
  id: string;
  label: string;
  prompt: string;
  placeholder: string;
  kind?: 'date-time';
};

export type ReflectionTemplate = {
  id: ReflectionTemplateId;
  title: string;
  skill: string;
  summary: string;
  duration: string;
  primary: boolean;
  tags: string[];
  evidenceIds: string[];
  steps: ReflectionStep[];
  note?: string;
  source?: { label: string; url: string };
};

export type ReflectionDraft = {
  templateId: ReflectionTemplateId;
  stepIndex: number;
  responses: Record<string, string>;
  updatedAt: string;
};

export function assertReflectionDraftsMergeable(
  source: ReflectionDraft | null,
  target: ReflectionDraft | null
): void {
  if (!source || !target) return;
  const entries = (draft: ReflectionDraft) => Object.entries(draft.responses)
    .filter(([, value]) => value.trim()).sort(([a], [b]) => a.localeCompare(b));
  if (source.templateId === target.templateId &&
      JSON.stringify(entries(source)) === JSON.stringify(entries(target))) return;
  throw new Error('Both profiles have an unfinished reflection. Save your current reflection to Journal before signing in. Neither draft has been discarded.');
}

export type ReflectionDraftWriteToken = {
  ownerId: string;
  revision: number;
};

type StoredReflectionDraft = ReflectionDraft & {
  version: typeof REFLECTION_DRAFT_VERSION;
  ownerId: string;
  _ownerMigration?: {
    version: 1;
    sourceOwnerId: string;
    copiedDraft: string;
  };
};

type ReflectionDraftStorageOptions = {
  secureStore: SecureKeyValueStore;
  now?: () => string;
  createGeneration?: () => string;
  onCleanupError?: (error: unknown) => void;
};

export const REFLECTION_RESPONSE_LIMIT = 2_000;

const REFLECTION_DRAFT_VERSION = 1;
const REFLECTION_DRAFT_PREFIX = 'mhtoolkit.reflection-draft.v1';
const MAX_REFLECTION_DRAFT_BYTES = 64_000;

export const REFLECTION_TEMPLATES: ReflectionTemplate[] = [
  {
    id: 'balanced-thought',
    title: 'Untangle a thought',
    skill: 'Perspective',
    summary:
      'Slow down one difficult thought and look for a balanced, believable response.',
    duration: '5-8 min',
    primary: true,
    tags: ['thought record', 'perspective'],
    evidenceIds: ['guided-self-help', 'journaling-reflection'],
    steps: [
      {
        id: 'situation',
        label: 'What happened',
        prompt: 'Describe the situation using only the facts you know.',
        placeholder: 'Where were you, who was involved, and what happened?',
      },
      {
        id: 'feeling',
        label: 'What you noticed',
        prompt: 'Name the emotions and body sensations that showed up.',
        placeholder: 'For example: tense, disappointed, relieved, hopeful...',
      },
      {
        id: 'thought',
        label: 'The thought',
        prompt: 'What did your mind say the situation meant?',
        placeholder: 'Write the thought in your own words.',
      },
      {
        id: 'supporting-evidence',
        label: 'What supports it',
        prompt: 'What facts make the thought feel true?',
        placeholder: 'Stick to observable evidence rather than guesses.',
      },
      {
        id: 'other-evidence',
        label: 'What else is true',
        prompt: 'What facts, context, or exceptions does the thought leave out?',
        placeholder: 'Consider what a neutral observer might notice.',
      },
      {
        id: 'balanced-response',
        label: 'A balanced response',
        prompt: 'Write a response that includes the full picture and feels believable.',
        placeholder: 'Aim for balanced, not artificially positive.',
      },
      {
        id: 'next-step',
        label: 'What now',
        prompt: 'What is one safe, useful next step?',
        placeholder: 'A conversation, pause, boundary, task, or request for support.',
      },
    ],
  },
  {
    id: 'solve-one-thing',
    title: 'Solve one thing',
    skill: 'Problem solving',
    summary: 'Turn one current, solvable problem into a small plan you can test.',
    duration: '4-7 min',
    primary: true,
    tags: ['problem solving', 'next step'],
    evidenceIds: ['guided-self-help', 'implementation-intentions'],
    steps: [
      {
        id: 'problem',
        label: 'Name the problem',
        prompt: 'What specific problem are you trying to solve?',
        placeholder: 'Keep it current and narrow enough to act on.',
      },
      {
        id: 'control',
        label: 'Your part',
        prompt: 'Which parts can you influence, and which parts are outside your control?',
        placeholder: 'Separate your actions from other people or uncertain outcomes.',
      },
      {
        id: 'options',
        label: 'Possible moves',
        prompt: 'List a few safe options without judging them yet.',
        placeholder: 'Include asking for help, reducing the task, or waiting for information.',
      },
      {
        id: 'choice',
        label: 'Choose one',
        prompt: 'Which option is useful and realistic with the capacity you have today?',
        placeholder: 'Pick the smallest option worth testing.',
      },
      {
        id: 'if-then',
        label: 'Make it specific',
        prompt: 'Complete: If this situation occurs, then I will...',
        placeholder: 'If [cue], then I will [specific action].',
      },
    ],
  },
  {
    id: 'make-room',
    title: 'Make room',
    skill: 'Acceptance and values',
    summary:
      'Notice what is present without forcing it away, then choose a values-based action.',
    duration: '3-5 min',
    primary: true,
    tags: ['acceptance', 'values'],
    evidenceIds: ['who-stress-skills'],
    steps: [
      {
        id: 'notice',
        label: 'Notice and name',
        prompt: 'What thought, feeling, or urge is present right now?',
        placeholder: 'Try: I notice that I am feeling... or my mind is telling me...',
      },
      {
        id: 'body',
        label: 'Make room',
        prompt: 'Where do you notice it in your body, and can it be there for this moment?',
        placeholder: 'Describe the sensation without needing to change it.',
      },
      {
        id: 'values',
        label: 'Choose your direction',
        prompt: 'What quality do you want to bring to this situation?',
        placeholder: 'For example: honesty, care, patience, courage, or fairness.',
      },
      {
        id: 'action',
        label: 'One values action',
        prompt: 'What small action would express that quality today?',
        placeholder: 'Choose something observable and within your control.',
      },
    ],
  },
  {
    id: 'compassionate-reset',
    title: 'Compassionate reset',
    skill: 'Self-compassion',
    summary: 'Respond to self-criticism with honesty, care, and one supportive action.',
    duration: '3-5 min',
    primary: false,
    tags: ['self-compassion', 'support'],
    evidenceIds: ['self-compassion-reflection'],
    steps: [
      {
        id: 'criticism',
        label: 'The criticism',
        prompt: 'What are you criticizing or blaming yourself for?',
        placeholder: 'Write the message your inner critic is repeating.',
      },
      {
        id: 'context',
        label: 'The full context',
        prompt: 'What difficulty, effort, need, or limitation deserves to be acknowledged?',
        placeholder: 'Compassion can include responsibility without humiliation.',
      },
      {
        id: 'friend',
        label: 'A kinder response',
        prompt: 'What would you say to someone you care about in this situation?',
        placeholder: 'Use words that are warm, honest, and believable.',
      },
      {
        id: 'support',
        label: 'Support yourself',
        prompt: 'What supportive action can you take next?',
        placeholder: 'Rest, repair, ask for help, set a boundary, or try again differently.',
      },
    ],
  },
  {
    id: 'good-moments',
    title: 'Notice a good moment',
    skill: 'Appreciation',
    summary:
      'Record something meaningful or pleasant without denying what is difficult.',
    duration: '2-4 min',
    primary: false,
    tags: ['appreciation', 'good moment'],
    evidenceIds: ['gratitude-reflection'],
    steps: [
      {
        id: 'moment',
        label: 'The moment',
        prompt: 'What felt good, meaningful, useful, or quietly okay?',
        placeholder: 'It can be very small and does not need to cancel out a hard day.',
      },
      {
        id: 'detail',
        label: 'What you noticed',
        prompt: 'What specific detail made the moment stand out?',
        placeholder: 'A person, place, sensation, action, or change.',
      },
      {
        id: 'meaning',
        label: 'Why it mattered',
        prompt: 'What did this moment give you or remind you of?',
        placeholder: 'Connection, relief, progress, beauty, capability, or something else.',
      },
      {
        id: 'repeat',
        label: 'Make room for another',
        prompt: 'Is there a gentle way to create another opportunity like it?',
        placeholder: 'Keep this optional and realistic.',
      },
    ],
  },
  {
    id: 'express-and-close',
    title: 'Express and close',
    skill: 'Expressive writing',
    summary: 'Write honestly for a bounded moment, then choose how you want to close.',
    duration: '5-10 min',
    primary: false,
    tags: ['expressive writing', 'closure'],
    evidenceIds: ['journaling-reflection'],
    steps: [
      {
        id: 'write',
        label: 'Say what needs saying',
        prompt: 'What feels unfinished, unspoken, or heavy right now?',
        placeholder: 'Write freely. You do not need to make it polished or positive.',
      },
      {
        id: 'meaning',
        label: 'What matters underneath',
        prompt: 'What need, value, loss, hope, or boundary sits underneath this?',
        placeholder: 'Name what this is important to you.',
      },
      {
        id: 'close',
        label: 'Close the page',
        prompt: 'What would help you leave this reflection and return to the present?',
        placeholder: 'Ground, move, rest, connect, make a plan, or stop for now.',
      },
    ],
  },
  {
    id: 'weekly-patterns',
    title: 'Weekly pattern review',
    skill: 'Self-observation',
    summary: 'Review the week for patterns without turning them into a diagnosis.',
    duration: '6-10 min',
    primary: false,
    tags: ['weekly review', 'patterns'],
    evidenceIds: ['journaling-reflection'],
    steps: [
      {
        id: 'events',
        label: 'What shaped the week',
        prompt: 'Which situations, demands, or changes affected you most?',
        placeholder: 'Include positive, difficult, and neutral events.',
      },
      {
        id: 'patterns',
        label: 'Patterns you noticed',
        prompt: 'What repeated across your mood, energy, thoughts, or behavior?',
        placeholder: 'Describe patterns without diagnosing their cause.',
      },
      {
        id: 'helped',
        label: 'What helped',
        prompt: 'Which actions, people, places, routines, or supports were useful?',
        placeholder: 'Notice what helped even a little.',
      },
      {
        id: 'drained',
        label: 'What made things harder',
        prompt: 'What added strain or reduced your capacity?',
        placeholder: 'Consider workload, sleep, conflict, health, isolation, or uncertainty.',
      },
      {
        id: 'continue',
        label: 'Carry one thing forward',
        prompt: 'What will you continue, change, ask for, or discuss with a professional?',
        placeholder: 'Choose one realistic next step.',
      },
    ],
  },
];

// These iOS additions use the same encrypted draft and journal lifecycle.
REFLECTION_TEMPLATES.push(
  {
    id: 'worry-time', title: 'Worry time', skill: 'Set it down for now',
    summary: 'Capture a worry, separate action from uncertainty, and choose when to return.',
    duration: '3-5 min', primary: false, tags: ['worry time'], evidenceIds: [],
    note: 'For everyday worries, not urgent safety needs. Your note stays available in Journal. A review time is a plan, not a notification.',
    source: { label: 'NHS guidance on worry time', url: 'https://www.nhs.uk/every-mind-matters/mental-wellbeing-tips/self-help-cbt-techniques/tackling-your-worries/' },
    steps: [
      { id: 'worry', label: 'The worry', prompt: 'What is taking up space in your mind? A sentence is enough.', placeholder: 'I keep thinking about...' },
      { id: 'action', label: 'What is in your hands?', prompt: 'Is there a practical action you can take, or is this uncertainty you cannot solve right now?', placeholder: 'One small action, or: I cannot act on this right now.' },
      { id: 'review-at', label: 'Return to it', prompt: 'Optionally choose a time for a short review. You can return sooner if you need to.', placeholder: '', kind: 'date-time' },
      { id: 'return', label: 'Back to now', prompt: 'What would you like to give your attention to next? At review time, decide whether to act, ask for support, or let the worry go.', placeholder: 'For now, I will...' },
    ],
  },
  {
    id: 'coping-card', title: 'My coping card', skill: 'Words to come back to',
    summary: 'Keep a believable reminder and one helpful action ready for difficult moments.',
    duration: '2-3 min', primary: false, tags: ['coping card'], evidenceIds: [],
    note: 'Saved with your journal, not automatically shared with Advisor or a partner. Mark the entry Important to find it quickly.',
    steps: [
      { id: 'words', label: 'Words that help', prompt: 'What would you want to hear in a difficult moment? Choose something kind and believable, not forced positivity.', placeholder: 'I can take one small step without solving everything.' },
      { id: 'action', label: 'One helpful action', prompt: 'What simple action or source of support tends to help you?', placeholder: 'Sit somewhere quiet, ask someone to listen, or use a familiar tool.' },
      { id: 'when', label: 'When to use this', prompt: 'What might remind you to come back to this card?', placeholder: 'When I notice...' },
    ],
  },
);

export function reflectionTemplateById(
  id: ReflectionTemplateId | null
): ReflectionTemplate | null {
  return REFLECTION_TEMPLATES.find((template) => template.id === id) ?? null;
}

export function completedReflectionSteps(
  template: ReflectionTemplate,
  responses: Record<string, string>
): number {
  return template.steps.filter((step) => responses[step.id]?.trim()).length;
}

export function serializeReflectionResponses(
  template: ReflectionTemplate,
  responses: Record<string, string>
): string {
  return template.steps
    .flatMap((step) => {
      const response = responses[step.id]?.trim();
      const formatted = step.kind === 'date-time' && response && Number.isFinite(Date.parse(response))
        ? new Date(response).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
        : response;
      return formatted ? [`## ${step.label}\n${formatted}`] : [];
    })
    .join('\n\n');
}

export function validateReflectionResponses(
  template: ReflectionTemplate,
  responses: Record<string, string>
): string | null {
  const values = template.steps.map((step) => responses[step.id] ?? '');
  if ((template.id === 'worry-time' || template.id === 'coping-card') && !responses[template.steps[0].id]?.trim()) {
    return `Add ${template.id === 'worry-time' ? 'a worry' : 'your coping words'} before saving.`;
  }
  if (template.steps.some((step) => step.kind === 'date-time' && responses[step.id] && !Number.isFinite(Date.parse(responses[step.id])))) {
    return 'Choose a valid review date and time.';
  }
  if (!values.some((value) => value.trim())) {
    return 'Write at least one response before saving.';
  }
  if (values.some((value) => value.length > REFLECTION_RESPONSE_LIMIT)) {
    return `Keep each response under ${REFLECTION_RESPONSE_LIMIT.toLocaleString()} characters.`;
  }
  if (serializeReflectionResponses(template, responses).length > JOURNAL_LIMITS.content) {
    return `Keep the reflection under ${JOURNAL_LIMITS.content.toLocaleString()} characters.`;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertOwnerId(ownerId: string): void {
  if (!/^[a-z0-9_-]{1,128}$/i.test(ownerId)) {
    throw new Error('Reflection draft owner is invalid');
  }
}

export function reflectionDraftStorageKey(ownerId: string): string {
  assertOwnerId(ownerId);
  return `${REFLECTION_DRAFT_PREFIX}.${ownerId}`;
}

function isReflectionTemplateId(value: unknown): value is ReflectionTemplateId {
  return (
    typeof value === 'string' &&
    REFLECTION_TEMPLATES.some((template) => template.id === value)
  );
}

function isValidResponses(
  responses: unknown,
  template: ReflectionTemplate
): responses is Record<string, string> {
  if (!isRecord(responses)) return false;
  const stepIds = new Set(template.steps.map((step) => step.id));
  return Object.entries(responses).every(
    ([stepId, response]) =>
      stepIds.has(stepId) &&
      typeof response === 'string' &&
      response.length <= REFLECTION_RESPONSE_LIMIT
  );
}

function isStoredReflectionDraft(
  value: unknown,
  ownerId: string
): value is StoredReflectionDraft {
  if (
    !isRecord(value) ||
    value.version !== REFLECTION_DRAFT_VERSION ||
    value.ownerId !== ownerId ||
    !isReflectionTemplateId(value.templateId) ||
    typeof value.updatedAt !== 'string'
  ) {
    return false;
  }

  const template = reflectionTemplateById(value.templateId);
  return Boolean(
    template &&
      Number.isInteger(value.stepIndex) &&
      Number(value.stepIndex) >= 0 &&
      Number(value.stepIndex) < template.steps.length &&
      isValidResponses(value.responses, template)
  );
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    bytes +=
      codePoint <= 0x7f
        ? 1
        : codePoint <= 0x7ff
          ? 2
          : codePoint <= 0xffff
            ? 3
            : 4;
  }
  return bytes;
}

export function createReflectionDraftStorage({
  secureStore,
  now = () => new Date().toISOString(),
  createGeneration,
  onCleanupError = () => {},
}: ReflectionDraftStorageOptions) {
  const emptyStore = {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  };
  const storage = createSecureSessionStorage({
    secureStore,
    legacyStorage: emptyStore,
    createGeneration,
    onCleanupError,
  });
  const ownerRevisions = new Map<string, number>();
  const queues = new Map<string, Promise<unknown>>();
  const pending = new Map<string, Set<Promise<unknown>>>();
  const failedWrites = new Map<string, unknown>();
  const reservations = new Map<string, Promise<void>>();
  const retiredOwners = new Set<string>();

  const ownerRevision = (ownerId: string) => ownerRevisions.get(ownerId) ?? 0;
  const invalidate = (ownerId: string) => ownerRevisions.set(ownerId, ownerRevision(ownerId) + 1);

  function runExclusive<T>(ownerId: string, operation: () => Promise<T>): Promise<T> {
    const current = (queues.get(ownerId) ?? Promise.resolve()).catch(() => {}).then(operation);
    queues.set(ownerId, current);
    const operations = pending.get(ownerId) ?? new Set<Promise<unknown>>();
    pending.set(ownerId, operations);
    operations.add(current);
    return current.finally(() => {
      operations.delete(current);
      if (!operations.size) pending.delete(ownerId);
      if (queues.get(ownerId) === current) queues.delete(ownerId);
    });
  }

  function assertWritable(ownerId: string): void {
    if (reservations.has(ownerId)) {
      throw new Error('Reflection drafts are being transferred. Wait for sign-in to finish, then try again.');
    }
  }

  async function readStored(ownerId: string, preserveInvalid = false): Promise<StoredReflectionDraft | null> {
    const key = reflectionDraftStorageKey(ownerId);
    const raw = await storage.getItem(key);
    if (raw === null) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
    if (!isStoredReflectionDraft(parsed, ownerId)) {
      if (preserveInvalid) {
        throw new Error('A reflection draft could not be read. Sign-in was stopped to preserve it.');
      }
      await storage.removeItem(key);
      return null;
    }

    return parsed;
  }

  function publicDraft(draft: ReflectionDraft): ReflectionDraft {
    return { templateId: draft.templateId, stepIndex: draft.stepIndex,
      responses: { ...draft.responses }, updatedAt: draft.updatedAt };
  }

  function draftIdentity(draft: ReflectionDraft): string {
    return JSON.stringify([draft.templateId, draft.stepIndex, draft.updatedAt,
      Object.entries(draft.responses).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)]);
  }

  function isUnchangedProvisional(draft: StoredReflectionDraft | null, sourceOwnerId: string): boolean {
    const provenance = draft?._ownerMigration;
    return Boolean(draft && isRecord(provenance) && provenance.version === 1 &&
      provenance.sourceOwnerId === sourceOwnerId && provenance.copiedDraft === draftIdentity(draft));
  }

  function serializeDraft(
    ownerId: string,
    draft: Omit<ReflectionDraft, 'updatedAt'>,
    updatedAt = now(),
    migration?: StoredReflectionDraft['_ownerMigration']
  ): string {
    const stored: StoredReflectionDraft = {
      templateId: draft.templateId,
      stepIndex: draft.stepIndex,
      responses: { ...draft.responses },
      version: REFLECTION_DRAFT_VERSION,
      ownerId,
      updatedAt,
    };
    if (!isStoredReflectionDraft(stored, ownerId)) {
      throw new Error('Reflection draft is invalid');
    }
    const serialized = JSON.stringify(stored);
    if (utf8ByteLength(serialized) > MAX_REFLECTION_DRAFT_BYTES) {
      throw new Error('Reflection draft is too large for encrypted storage');
    }
    // Provenance and its exact baseline commit in the same encrypted generation.
    // Normal writes deliberately strip it, including identical explicit saves.
    // The baseline can double the payload, still below the secure store's 180 KB limit.
    return migration ? JSON.stringify({ ...stored, _ownerMigration: migration }) : serialized;
  }

  async function readForEditing(ownerId: string): Promise<{
    draft: ReflectionDraft | null;
    writeToken: ReflectionDraftWriteToken;
  }> {
    reflectionDraftStorageKey(ownerId);
    const reservation = reservations.get(ownerId);
    if (reservation) {
      await reservation;
      return readForEditing(ownerId);
    }
    // Include validation/cleanup in the owner queue, not just the encrypted read.
    const revision = ownerRevision(ownerId);
    const draft = await runExclusive(ownerId, () => readStored(ownerId));
    // A read accepted before reservation must not hydrate a mounted screen with
    // the pre-transfer snapshot while the migration drains its underlying I/O.
    if (revision !== ownerRevision(ownerId)) return readForEditing(ownerId);
    return { draft: draft ? publicDraft(draft) : null, writeToken: { ownerId, revision } };
  }

  function isWriteTokenCurrent(token: ReflectionDraftWriteToken): boolean {
    return !reservations.has(token.ownerId) && !retiredOwners.has(token.ownerId) &&
      token.revision === ownerRevision(token.ownerId);
  }

  return {
    captureWriteToken(ownerId: string): ReflectionDraftWriteToken {
      reflectionDraftStorageKey(ownerId);
      return { ownerId, revision: ownerRevision(ownerId) };
    },

    read: async (ownerId: string) => (await readForEditing(ownerId)).draft,
    readForEditing,
    isWriteTokenCurrent,

    async write(
      ownerId: string,
      draft: Omit<ReflectionDraft, 'updatedAt'>,
      token?: ReflectionDraftWriteToken
    ): Promise<boolean> {
      const key = reflectionDraftStorageKey(ownerId);
      assertWritable(ownerId);
      if (retiredOwners.has(ownerId)) {
        throw new Error('This reflection profile has been transferred. Reopen the reflection in your signed-in account.');
      }
      if (
        token &&
        (token.ownerId !== ownerId || token.revision !== ownerRevision(ownerId))
      ) {
        return false;
      }
      const serialized = serializeDraft(ownerId, draft);
      await runExclusive(ownerId, async () => {
        try {
          await storage.setItem(key, serialized);
          failedWrites.delete(ownerId);
        } catch (error) {
          // A settled failure must still block sign-in until a save or explicit
          // discard succeeds; otherwise preflight silently sees an older draft.
          failedWrites.set(ownerId, error);
          throw error;
        }
      });
      return true;
    },

    async clear(ownerId: string, token?: ReflectionDraftWriteToken): Promise<void> {
      const key = reflectionDraftStorageKey(ownerId);
      assertWritable(ownerId);
      if (token && (token.ownerId !== ownerId || !isWriteTokenCurrent(token))) {
        throw new Error('This reflection changed. Reload the saved draft before clearing it.');
      }
      // Invalidate captured snapshots before the encrypted removal is queued.
      invalidate(ownerId);
      return runExclusive(ownerId, async () => {
        await storage.removeItem(key);
        failedWrites.delete(ownerId);
      });
    },

    async beginOwnerMigration(sourceOwnerId: string, targetOwnerId: string) {
      const sourceKey = reflectionDraftStorageKey(sourceOwnerId);
      const targetKey = reflectionDraftStorageKey(targetOwnerId);
      if (sourceOwnerId === targetOwnerId || retiredOwners.has(sourceOwnerId)) {
        throw new Error('This reflection profile cannot be transferred again.');
      }
      const owners = [sourceOwnerId, targetOwnerId];
      owners.forEach(assertWritable);
      let unlock!: () => void;
      const reservation = new Promise<void>((resolve) => { unlock = resolve; });
      // Reserve both owners synchronously, before waiting for any accepted I/O.
      const draining = owners.flatMap((owner) => [...(pending.get(owner) ?? [])]);
      for (const owner of owners) {
        reservations.set(owner, reservation);
        invalidate(owner);
      }
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        for (const owner of owners) {
          // Tokens captured by a mounted screen during the transfer are stale too.
          invalidate(owner);
          reservations.delete(owner);
        }
        unlock();
      };

      try {
        const drained = await Promise.allSettled(draining);
        const failure = drained.find((result) => result.status === 'rejected');
        if (failure?.status === 'rejected') throw failure.reason;
        for (const owner of owners) {
          if (failedWrites.has(owner)) {
            throw new Error('A reflection edit could not be saved. Save or discard it before signing in.');
          }
        }
        const source = await readStored(sourceOwnerId, true);
        const target = await readStored(targetOwnerId, true);
        const unchangedProvisional = isUnchangedProvisional(target, sourceOwnerId);
        if (!unchangedProvisional) assertReflectionDraftsMergeable(source, target);
        let provisionalCopy = target?._ownerMigration ? publicDraft(target) : null;
        if (source && (!target || unchangedProvisional)) {
          // Keep the source, but make a durable destination copy BEFORE the server
          // can delete its account. On failure either/both encrypted copies remain.
          await storage.setItem(targetKey, serializeDraft(targetOwnerId, source, source.updatedAt, {
            version: 1, sourceOwnerId, copiedDraft: draftIdentity(source),
          }));
          const copied = await readStored(targetOwnerId, true);
          if (!copied || draftIdentity(copied) !== draftIdentity(source) ||
              !isUnchangedProvisional(copied, sourceOwnerId)) {
            throw new Error('The reflection draft transfer could not be verified. The source draft was kept.');
          }
          provisionalCopy = publicDraft(copied);
        } else if (!source && unchangedProvisional) {
          // A discard or journal save also retires this unchanged provisional
          // copy. Propagate removal before the server can delete the source account.
          await storage.removeItem(targetKey);
          provisionalCopy = null;
        }
        let finished = false;
        return {
          async finish(): Promise<void> {
            if (released) throw new Error('The reflection draft transfer has ended.');
            if (finished) return;
            // Commit ownership before deleting source bytes. A crash/cleanup
            // failure must not leave the only surviving draft replaceable on retry.
            if (provisionalCopy) {
              await storage.setItem(targetKey, serializeDraft(targetOwnerId, provisionalCopy, provisionalCopy.updatedAt));
            }
            if (source) await storage.removeItem(sourceKey);
            retiredOwners.add(sourceOwnerId);
            finished = true;
          },
          release,
        };
      } catch (error) {
        release();
        throw error;
      }
    },
  };
}
