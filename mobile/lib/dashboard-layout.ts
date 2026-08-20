export const DASHBOARD_LAYOUT_VERSION = 1;
export const MIN_DASHBOARD_MODULES = 2;
export const MAX_DASHBOARD_MODULES = 6;

export type DashboardPresetId =
  | 'mixed'
  | 'productivity'
  | 'mental_health'
  | 'growth'
  | 'custom';

export type DashboardModuleId =
  | 'advisor'
  | 'affirmations'
  | 'mood'
  | 'assessments'
  | 'chat'
  | 'voice'
  | 'accountability'
  | 'focus'
  | 'goals'
  | 'grounding'
  | 'habits'
  | 'journal'
  | 'library'
  | 'meditation'
  | 'mind_games'
  | 'planner'
  | 'plans'
  | 'reflection'
  | 'resources'
  | 'saved'
  | 'yoga';

export type DashboardLayout = {
  version: number;
  presetId: DashboardPresetId;
  moduleIds: DashboardModuleId[];
};

export type DashboardModule = {
  id: DashboardModuleId;
  title: string;
  description: string;
  icon:
    | 'activity'
    | 'anchor'
    | 'book-open'
    | 'bookmark'
    | 'calendar'
    | 'clipboard'
    | 'edit-3'
    | 'flag'
    | 'grid'
    | 'life-buoy'
    | 'map'
    | 'message-circle'
    | 'mic'
    | 'moon'
    | 'repeat'
    | 'sun'
    | 'sunrise'
    | 'target'
    | 'users'
    | 'wind';
  href: string;
  navigation: 'navigate' | 'push';
};

export const DASHBOARD_MODULES: readonly DashboardModule[] = Object.freeze([
  { id: 'affirmations', title: 'Affirmations', description: 'Find a steady thought for right now.', icon: 'sun', href: '/affirmations', navigation: 'push' },
  { id: 'mood', title: 'Mood history', description: 'See how your check-ins have moved.', icon: 'activity', href: '/(tabs)/tracker', navigation: 'navigate' },
  { id: 'assessments', title: 'Assessments', description: 'Check in on how things are going.', icon: 'clipboard', href: '/(tabs)/assessments', navigation: 'navigate' },
  { id: 'chat', title: 'AI support', description: 'Talk something through.', icon: 'message-circle', href: '/(tabs)/chat', navigation: 'navigate' },
  { id: 'voice', title: 'Voice session', description: 'Speak instead of typing.', icon: 'mic', href: '/voice', navigation: 'push' },
  { id: 'accountability', title: 'Together', description: 'Share a commitment with someone you trust.', icon: 'users', href: '/accountability', navigation: 'push' },
  { id: 'focus', title: 'Focus', description: 'One task, one timer.', icon: 'target', href: '/focus', navigation: 'push' },
  { id: 'goals', title: 'Goals', description: 'Keep the longer arc in view.', icon: 'flag', href: '/goals', navigation: 'push' },
  { id: 'grounding', title: 'Grounding', description: 'A few minutes to come back down.', icon: 'anchor', href: '/ground', navigation: 'push' },
  { id: 'habits', title: 'Habits', description: 'Small things, done often.', icon: 'repeat', href: '/habits', navigation: 'push' },
  { id: 'journal', title: 'Journal', description: 'Write it down before it loops.', icon: 'edit-3', href: '/journal', navigation: 'push' },
  { id: 'library', title: 'Library', description: 'Read something useful for today.', icon: 'book-open', href: '/library', navigation: 'push' },
  { id: 'meditation', title: 'Meditation', description: 'Pause with a guided practice.', icon: 'moon', href: '/meditate', navigation: 'push' },
  { id: 'mind_games', title: 'Mind games', description: 'A gentle mental reset.', icon: 'grid', href: '/mind-games', navigation: 'push' },
  { id: 'planner', title: 'Planner', description: 'Shape the day before it shapes you.', icon: 'calendar', href: '/planner', navigation: 'push' },
  { id: 'plans', title: 'My plans', description: 'Pick up where a plan left off.', icon: 'map', href: '/plans', navigation: 'push' },
  { id: 'reflection', title: 'Reflection', description: 'Look back at what actually happened.', icon: 'sunrise', href: '/reflect', navigation: 'push' },
  { id: 'resources', title: 'Find support', description: 'Directories and trusted communities.', icon: 'life-buoy', href: '/resources', navigation: 'push' },
  { id: 'saved', title: 'Saved', description: 'Return to things you kept.', icon: 'bookmark', href: '/saved', navigation: 'push' },
  { id: 'yoga', title: 'Yoga', description: 'Move a little, gently.', icon: 'wind', href: '/yoga', navigation: 'push' },
]);

export const DASHBOARD_PRESETS = Object.freeze({
  mixed: Object.freeze<DashboardModuleId[]>([
    'advisor',
    'accountability',
    'grounding',
    'planner',
    'library',
  ]),
  productivity: Object.freeze<DashboardModuleId[]>([
    'advisor',
    'planner',
    'focus',
    'habits',
    'goals',
  ]),
  mental_health: Object.freeze<DashboardModuleId[]>([
    'advisor',
    'grounding',
    'meditation',
    'journal',
    'resources',
  ]),
  growth: Object.freeze<DashboardModuleId[]>([
    'advisor',
    'reflection',
    'goals',
    'library',
    'habits',
  ]),
});

export const DASHBOARD_PRESET_OPTIONS = Object.freeze([
  { id: 'mixed' as const, title: 'Mixed', description: 'A balanced set for everyday use.' },
  { id: 'productivity' as const, title: 'Productivity', description: 'Plan, focus, and follow through.' },
  { id: 'mental_health' as const, title: 'Mental health', description: 'Check in, steady yourself, and reflect.' },
  { id: 'growth' as const, title: 'Growth', description: 'Build habits and keep the bigger picture close.' },
]);

const MODULE_IDS = new Set<DashboardModuleId>([
  'advisor',
  ...DASHBOARD_MODULES.map((module) => module.id),
]);

const PRESET_IDS = new Set<DashboardPresetId>([
  'mixed',
  'productivity',
  'mental_health',
  'growth',
  'custom',
]);

export function defaultDashboardLayout(): DashboardLayout {
  return applyDashboardPreset('mixed');
}

export function applyDashboardPreset(
  presetId: Exclude<DashboardPresetId, 'custom'>
): DashboardLayout {
  return {
    version: DASHBOARD_LAYOUT_VERSION,
    presetId,
    moduleIds: [...DASHBOARD_PRESETS[presetId]],
  };
}

export function normalizeDashboardLayout(value: unknown): DashboardLayout {
  if (!isRecord(value)) return defaultDashboardLayout();
  if (
    typeof value.version === 'number' &&
    value.version > DASHBOARD_LAYOUT_VERSION
  ) {
    return defaultDashboardLayout();
  }
  if (!Array.isArray(value.moduleIds)) return defaultDashboardLayout();

  const uniqueIds: DashboardModuleId[] = [];
  for (const candidate of value.moduleIds) {
    if (
      typeof candidate === 'string' &&
      MODULE_IDS.has(candidate as DashboardModuleId) &&
      !uniqueIds.includes(candidate as DashboardModuleId)
    ) {
      uniqueIds.push(candidate as DashboardModuleId);
    }
  }

  const withoutAdvisor = uniqueIds.filter((id) => id !== 'advisor');
  const moduleIds = ([
    'advisor' as DashboardModuleId,
    ...withoutAdvisor,
  ] as DashboardModuleId[]).slice(0, MAX_DASHBOARD_MODULES);

  for (const fallbackId of DASHBOARD_PRESETS.mixed) {
    if (moduleIds.length >= MIN_DASHBOARD_MODULES) break;
    if (!moduleIds.includes(fallbackId)) moduleIds.push(fallbackId);
  }

  const storedPreset =
    typeof value.presetId === 'string' &&
    PRESET_IDS.has(value.presetId as DashboardPresetId)
      ? (value.presetId as DashboardPresetId)
      : null;
  const matchingPreset = presetForModules(moduleIds);

  return {
    version: DASHBOARD_LAYOUT_VERSION,
    presetId:
      storedPreset && storedPreset !== 'custom' && storedPreset === matchingPreset
        ? storedPreset
        : matchingPreset ?? 'custom',
    moduleIds,
  };
}

export function moveDashboardModule(
  layout: DashboardLayout,
  fromIndex: number,
  toIndex: number
): DashboardLayout {
  if (
    fromIndex <= 0 ||
    fromIndex >= layout.moduleIds.length ||
    toIndex <= 0 ||
    toIndex >= layout.moduleIds.length ||
    fromIndex === toIndex
  ) {
    return layout;
  }

  const moduleIds = [...layout.moduleIds];
  const [moved] = moduleIds.splice(fromIndex, 1);
  moduleIds.splice(toIndex, 0, moved);
  return { ...layout, presetId: presetForModules(moduleIds) ?? 'custom', moduleIds };
}

export function dashboardDestinationForDrag(
  index: number,
  distanceY: number,
  rowPitch: number,
  total: number
): number {
  if (total <= 1 || index <= 0 || !Number.isFinite(rowPitch) || rowPitch <= 0) {
    return index;
  }
  return Math.min(
    Math.max(index + Math.round(distanceY / rowPitch), 1),
    total - 1
  );
}

export function dashboardOwnerChanged(
  previousOwnerKey: string | null,
  nextOwnerKey: string | null
): boolean {
  return previousOwnerKey !== nextOwnerKey;
}

export function setDashboardModuleEnabled(
  layout: DashboardLayout,
  moduleId: DashboardModuleId,
  enabled: boolean
): DashboardLayout {
  if (moduleId === 'advisor') return layout;

  const alreadyEnabled = layout.moduleIds.includes(moduleId);
  if (enabled && !alreadyEnabled) {
    if (layout.moduleIds.length >= MAX_DASHBOARD_MODULES) return layout;
    const moduleIds = [...layout.moduleIds, moduleId];
    return { ...layout, presetId: presetForModules(moduleIds) ?? 'custom', moduleIds };
  }

  if (!enabled && alreadyEnabled) {
    if (layout.moduleIds.length <= MIN_DASHBOARD_MODULES) return layout;
    const moduleIds = layout.moduleIds.filter((id) => id !== moduleId);
    return { ...layout, presetId: presetForModules(moduleIds) ?? 'custom', moduleIds };
  }

  return layout;
}

export function dashboardModulesForToday(
  layout: DashboardLayout,
  _lowEnergy: boolean
): DashboardModuleId[] {
  // Low-energy mode changes guidance copy, not the user's selected tools.
  return [...layout.moduleIds];
}

export function dashboardModuleById(
  moduleId: DashboardModuleId
): DashboardModule | null {
  return DASHBOARD_MODULES.find((module) => module.id === moduleId) ?? null;
}

function presetForModules(
  moduleIds: readonly DashboardModuleId[]
): Exclude<DashboardPresetId, 'custom'> | null {
  for (const option of DASHBOARD_PRESET_OPTIONS) {
    const preset = DASHBOARD_PRESETS[option.id];
    if (
      preset.length === moduleIds.length &&
      preset.every((id, index) => id === moduleIds[index])
    ) {
      return option.id;
    }
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
