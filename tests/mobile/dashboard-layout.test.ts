import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DASHBOARD_LAYOUT_VERSION,
  DASHBOARD_MODULES,
  DASHBOARD_PRESETS,
  MAX_DASHBOARD_MODULES,
  MIN_DASHBOARD_MODULES,
  applyDashboardPreset,
  dashboardDestinationForDrag,
  dashboardModulesForToday,
  dashboardOwnerChanged,
  moveDashboardModule,
  normalizeDashboardLayout,
  setDashboardModuleEnabled,
} from '../../mobile/lib/dashboard-layout';
import {
  createDashboardLayoutStorage,
  createDashboardLayoutWriter,
} from '../../mobile/lib/dashboard-layout-storage';

class MemoryStorage {
  values = new Map<string, string>();

  async getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe('customizable Today dashboard', () => {
  it('ships distinct, focused presets with Advisor fixed first', () => {
    expect(DASHBOARD_PRESETS).toEqual({
      mixed: ['advisor', 'accountability', 'grounding', 'planner', 'library'],
      productivity: ['advisor', 'planner', 'focus', 'habits', 'goals'],
      mental_health: ['advisor', 'grounding', 'meditation', 'journal', 'resources'],
      growth: ['advisor', 'reflection', 'goals', 'library', 'habits'],
    });

    for (const preset of Object.values(DASHBOARD_PRESETS)) {
      expect(preset[0]).toBe('advisor');
      expect(preset.length).toBeGreaterThanOrEqual(MIN_DASHBOARD_MODULES);
      expect(preset.length).toBeLessThanOrEqual(MAX_DASHBOARD_MODULES);
    }
  });

  it('normalizes corrupt, duplicate, unknown, and oversized layouts', () => {
    expect(normalizeDashboardLayout(null)).toEqual(applyDashboardPreset('mixed'));
    expect(
      normalizeDashboardLayout({
        version: 1,
        presetId: 'productivity',
        moduleIds: [
          'goals',
          'unknown',
          'goals',
          'focus',
          'journal',
          'habits',
          'planner',
          'library',
        ],
      })
    ).toEqual({
      version: DASHBOARD_LAYOUT_VERSION,
      presetId: 'custom',
      moduleIds: ['advisor', 'goals', 'focus', 'journal', 'habits', 'planner'],
    });
  });

  it('rejects layouts written by a newer app version', () => {
    expect(
      normalizeDashboardLayout({
        version: DASHBOARD_LAYOUT_VERSION + 1,
        presetId: 'custom',
        moduleIds: ['advisor', 'focus'],
      })
    ).toEqual(applyDashboardPreset('mixed'));
  });

  it('keeps Advisor pinned while allowing the other modules to move', () => {
    const original = applyDashboardPreset('productivity');

    expect(moveDashboardModule(original, 0, 3)).toBe(original);
    expect(moveDashboardModule(original, 2, 4)).toEqual({
      version: DASHBOARD_LAYOUT_VERSION,
      presetId: 'custom',
      moduleIds: ['advisor', 'planner', 'habits', 'goals', 'focus'],
    });
  });

  it('maps drag distance using the measured row pitch', () => {
    expect(dashboardDestinationForDrag(1, 126, 126, 5)).toBe(2);
    expect(dashboardDestinationForDrag(3, -126, 126, 5)).toBe(2);
    expect(dashboardDestinationForDrag(1, 126, 76, 5)).toBe(3);
    expect(dashboardDestinationForDrag(1, -500, 126, 5)).toBe(1);
    expect(dashboardDestinationForDrag(4, 500, 126, 5)).toBe(4);
  });

  it('distinguishes a same-owner refresh from a profile switch', () => {
    expect(dashboardOwnerChanged('user_id:a', 'user_id:a')).toBe(false);
    expect(dashboardOwnerChanged('user_id:a', 'user_id:b')).toBe(true);
    expect(dashboardOwnerChanged(null, 'user_id:a')).toBe(true);
  });

  it('enforces add and remove limits without silently dropping tools', () => {
    let layout = applyDashboardPreset('mixed');
    layout = setDashboardModuleEnabled(layout, 'focus', true);
    layout = setDashboardModuleEnabled(layout, 'goals', true);
    const fullLayout = setDashboardModuleEnabled(layout, 'planner', true);

    expect(fullLayout.moduleIds).toHaveLength(MAX_DASHBOARD_MODULES);
    expect(setDashboardModuleEnabled(fullLayout, 'library', true)).toBe(fullLayout);

    const minimum = normalizeDashboardLayout({
      version: 1,
      presetId: 'custom',
      moduleIds: ['advisor', 'focus'],
    });
    expect(setDashboardModuleEnabled(minimum, 'focus', false)).toBe(minimum);
  });

  it('uses a presentation-only low-energy subset without changing persisted order', () => {
    const layout = applyDashboardPreset('productivity');
    const before = [...layout.moduleIds];

    expect(dashboardModulesForToday(layout, false, ['goals'])).toEqual(layout.moduleIds);
    expect(dashboardModulesForToday(layout, true, ['goals', 'habits'])).toEqual([
      'advisor',
      'goals',
      'habits',
    ]);
    expect(dashboardModulesForToday(layout, true, [])).toEqual(layout.moduleIds);
    expect(dashboardModulesForToday(layout, true, ['grounding', 'mood', 'goals'])).toEqual([
      'advisor',
      'grounding',
      'mood',
      'goals',
    ]);
    expect(layout.moduleIds).toEqual(before);
  });

  it('keeps catalog ids and routes unique with compact copy', () => {
    expect(new Set(DASHBOARD_MODULES.map((module) => module.id)).size).toBe(
      DASHBOARD_MODULES.length
    );
    expect(new Set(DASHBOARD_MODULES.map((module) => module.href)).size).toBe(
      DASHBOARD_MODULES.length
    );
    for (const module of DASHBOARD_MODULES) {
      expect(module.description.length).toBeLessThanOrEqual(52);
    }
  });

  it('persists layouts per owner and self-heals invalid JSON', async () => {
    const memory = new MemoryStorage();
    const storage = createDashboardLayoutStorage(memory);
    await storage.writeLayout('user_id:a', applyDashboardPreset('growth'));
    memory.values.set('mhtoolkit.dashboard.layout.user_id:b', '{bad json');

    await expect(storage.readLayout('user_id:a')).resolves.toEqual(
      applyDashboardPreset('growth')
    );
    await expect(storage.readLayout('user_id:b')).resolves.toEqual(
      applyDashboardPreset('mixed')
    );
    expect(memory.values.get('mhtoolkit.dashboard.layout.user_id:b')).toBe(
      JSON.stringify(applyDashboardPreset('mixed'))
    );
  });

  it('coalesces rapid writes for the same owner to the latest layout', async () => {
    const storage = createDashboardLayoutStorage(new MemoryStorage());
    const writer = createDashboardLayoutWriter(storage);

    const first = writer.writeLatest('user_id:a', applyDashboardPreset('growth'));
    const second = writer.writeLatest(
      'user_id:a',
      applyDashboardPreset('mental_health')
    );

    await Promise.all([first, second]);
    await expect(storage.readLayout('user_id:a')).resolves.toEqual(
      applyDashboardPreset('mental_health')
    );
    await expect(first).resolves.toMatchObject({ current: false });
    await expect(second).resolves.toMatchObject({ current: true, error: null });
  });

  it('keeps drag out of Today and provides accessible reorder controls', () => {
    const today = readFileSync(resolve('mobile/app/(tabs)/index.tsx'), 'utf8');
    const editor = readFileSync(resolve('mobile/app/dashboard-layout.tsx'), 'utf8');
    const row = readFileSync(
      resolve('mobile/components/DashboardLayoutRow.tsx'),
      'utf8'
    );

    expect(today).toContain('Customize your Today page');
    expect(today).toContain('<RowGroup>');
    expect(today).not.toContain('PanResponder');
    expect(today).not.toContain('onLongPress');
    expect(editor).toContain('Start with a template');
    expect(editor).toContain('Add tools');
    expect(editor).toContain('disabled={!ready}');
    expect(row).toContain('PanResponder.create');
    expect(row).toContain('delayLongPress={220}');
    expect(row).toContain("accessibilityRole={locked ? 'text' : 'adjustable'}");
    expect(row).toContain('Move ${title} up');
    expect(row).toContain('Move ${title} down');
    expect(row).toContain('if (dragging) return;');
  });
});
