export const GO_TO_ACTION_VERSION = 1 as const;
export const GO_TO_ACTION_LIMIT = 3;
export const GO_TO_CUE_LIMIT = 80;

export const GO_TO_TOOLS = [
  { id: 'ground', label: 'Ground me', route: '/ground' },
  { id: 'meditate', label: 'Meditate', route: '/meditate' },
  { id: 'yoga', label: 'Yoga', route: '/yoga' },
  { id: 'focus', label: 'Focus', route: '/focus' },
  { id: 'journal', label: 'Journal', route: '/journal' },
  { id: 'plans', label: 'My plans', route: '/plans' },
] as const;

export type GoToToolId = (typeof GO_TO_TOOLS)[number]['id'];
export type GoToTool = (typeof GO_TO_TOOLS)[number];
export type GoToRoute = GoToTool['route'];

export type GoToAction = {
  toolId: GoToToolId;
  cue: string;
};

export type GoToActionPayload = {
  version: typeof GO_TO_ACTION_VERSION;
  actions: GoToAction[];
};

export const DEFAULT_GO_TO_ACTIONS: GoToAction[] = [
  { toolId: 'ground', cue: '' },
  { toolId: 'focus', cue: '' },
  { toolId: 'journal', cue: '' },
];

const toolIds = new Set<GoToToolId>(GO_TO_TOOLS.map(({ id }) => id));

function compactCue(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, GO_TO_CUE_LIMIT);
}

function isToolId(value: unknown): value is GoToToolId {
  return typeof value === 'string' && toolIds.has(value as GoToToolId);
}

export function sanitizeGoToActions(input: unknown): GoToAction[] {
  if (!Array.isArray(input)) return DEFAULT_GO_TO_ACTIONS.map((action) => ({ ...action }));

  const seen = new Set<GoToToolId>();
  const actions: GoToAction[] = [];
  for (const candidate of input) {
    if (!candidate || typeof candidate !== 'object') continue;
    const { toolId, cue } = candidate as { toolId?: unknown; cue?: unknown };
    if (!isToolId(toolId) || seen.has(toolId)) continue;
    seen.add(toolId);
    actions.push({
      toolId,
      cue: typeof cue === 'string' ? compactCue(cue) : '',
    });
    if (actions.length === GO_TO_ACTION_LIMIT) break;
  }

  return actions.length > 0
    ? actions
    : DEFAULT_GO_TO_ACTIONS.map((action) => ({ ...action }));
}

export function parseGoToActions(raw: string | null): GoToAction[] {
  if (!raw) return sanitizeGoToActions(null);
  try {
    const payload = JSON.parse(raw) as Partial<GoToActionPayload>;
    if (payload.version !== GO_TO_ACTION_VERSION) return sanitizeGoToActions(null);
    return sanitizeGoToActions(payload.actions);
  } catch {
    return sanitizeGoToActions(null);
  }
}

export function serializeGoToActions(actions: unknown): string {
  return JSON.stringify({
    version: GO_TO_ACTION_VERSION,
    actions: sanitizeGoToActions(actions),
  } satisfies GoToActionPayload);
}

export function getGoToTool(toolId: GoToToolId): GoToTool {
  return GO_TO_TOOLS.find(({ id }) => id === toolId) ?? GO_TO_TOOLS[0];
}
