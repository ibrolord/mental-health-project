import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';

const defaults = { enabled: false, quietStartHour: 21, quietEndHour: 8, pausedUntil: null as string | null };
const syncError = 'Your choice is saved, but device reminders could not update. Retry.';
type Preferences = typeof defaults;
type Element = { type: any; props: Record<string, any>; key?: string };
type Slot = { value?: any; deps?: unknown[]; cleanup?: () => void };
const source = readFileSync('mobile/components/AdvisorClientSettings.tsx', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

// Like the existing mobile callback tests, this runs real handlers with mocked
// native views and hooks. It does not verify native picker layout or VoiceOver.
function harness(initial = defaults, os = 'ios') {
  const read = vi.fn<(owner: string) => Promise<Preferences>>().mockResolvedValue(initial);
  const update = vi.fn<(owner: string, patch: Partial<Preferences>) => Promise<void>>().mockResolvedValue(undefined);
  let slots: Slot[] = [];
  let cursor = 0;
  let effects: (() => void)[] = [];
  let ownerKey = 'owner-a';
  let mountedKey: string | undefined;
  let tree: Element | null;
  const hooks = {
    useState(initialValue: any) {
      const index = cursor++;
      const slot = slots[index] ??= { value: initialValue };
      return [slot.value, (next: any) => { slot.value = typeof next === 'function' ? next(slot.value) : next; }];
    },
    useRef(initialValue: any) {
      return (slots[cursor++] ??= { value: { current: initialValue } }).value;
    },
    useEffect(effect: () => (() => void), deps: unknown[]) {
      const index = cursor++;
      const previous = slots[index];
      if (previous?.deps?.length === deps.length && deps.every((value, i) => Object.is(previous.deps?.[i], value))) return;
      const slot: Slot = slots[index] = { deps };
      effects.push(() => { previous?.cleanup?.(); slot.cleanup = effect(); });
    },
  };
  const jsx = (type: unknown, props: Record<string, unknown>, key?: string) => ({ type, props, key });
  const evaluated = { AdvisorClientSettings: (_props: { ownerKey: string }): Element | null => null };
  new Function('require', 'exports', compiled)((id: string) => {
    if (id === 'react') return hooks;
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (id === 'react-native') return {
      ActivityIndicator: 'ActivityIndicator', Switch: 'Switch', Text: 'Text', View: 'View',
      Platform: { OS: os }, StyleSheet: { create: (value: unknown) => value },
    };
    if (id === '@react-native-community/datetimepicker') return { default: 'DateTimePicker' };
    if (id === './AppUI') return { AppButton: 'AppButton', AppCard: 'AppCard', InlineStatus: 'InlineStatus' };
    if (id === '@/lib/constants') return { Colors: {}, Spacing: {}, Typography: {} };
    if (id === '@/lib/advisor-client-runtime') return {
      readAdvisorClientPreferences: read, updateAdvisorClientPreferences: update,
    };
    throw new Error(`Unexpected dependency: ${id}`);
  }, evaluated);
  const unmount = () => { slots.forEach((slot) => slot.cleanup?.()); slots = []; mountedKey = undefined; };
  const render = (nextOwner = ownerKey) => {
    ownerKey = nextOwner;
    const wrapper = evaluated.AdvisorClientSettings({ ownerKey });
    if (!wrapper) { unmount(); tree = null; return tree; }
    if (wrapper.key !== mountedKey) { unmount(); mountedKey = wrapper.key; }
    cursor = 0;
    effects = [];
    tree = wrapper.type(wrapper.props);
    effects.forEach((effect) => effect());
    return tree;
  };
  const elements = (node: any = tree): Element[] => {
    if (Array.isArray(node)) return node.flatMap((child) => elements(child));
    if (!node || typeof node !== 'object' || !('props' in node)) return [];
    return [node, ...elements(node.props.children ?? null)];
  };
  const find = (label: string) => {
    const result = elements().find(({ props }) => props.label === label || props.accessibilityLabel === label);
    if (!result) throw new Error(`Missing control: ${label}`);
    return result.props;
  };
  const press = (label: string) => {
    const props = find(label);
    expect(props.disabled).not.toBe(true);
    props.onPress();
    render();
  };
  const settle = async () => { await Promise.resolve(); await Promise.resolve(); render(); };
  render();
  return { render, elements, find, press, settle, read, update, unmount };
}

afterEach(() => vi.useRealTimers());

describe('AdvisorClientSettings callbacks', () => {
  it('starts off and disabled while loading, with concise prerequisite copy and hidden details', async () => {
    const h = harness();
    expect(h.find('Follow up on my steps')).toMatchObject({ value: false, disabled: true });
    expect(h.update).not.toHaveBeenCalled();
    await h.settle();
    expect(h.find('Follow up on my steps')).toMatchObject({ value: false, disabled: false });
    const copy = h.elements().map(({ props }) => props.children).filter((value) => typeof value === 'string');
    expect(copy).toContain('A gentle reminder after you start a step.');
    expect(copy).toContain('Requires device reminders and Advisor notifications.');
    expect(copy).toContain('Background updates depend on iOS and may be delayed.');
    expect(h.elements().some(({ props }) => props.label === 'Pause until tomorrow')).toBe(false);
  });

  it('writes only local opt-in, keeps the saved value during writes, and blocks duplicate callbacks', async () => {
    const h = harness();
    await h.settle();
    const pending = deferred<void>();
    h.update.mockReturnValueOnce(pending.promise);
    const toggle = h.find('Follow up on my steps').onValueChange;
    toggle(true); toggle(true);
    h.render();
    expect(h.update).toHaveBeenCalledExactlyOnceWith('owner-a', { enabled: true });
    expect(h.find('Follow up on my steps')).toMatchObject({ value: false, disabled: true });
    pending.resolve(); await h.settle();
    expect(h.find('Follow up on my steps')).toMatchObject({ value: true, disabled: false });
    expect(h.elements().filter(({ props }) => /^Quiet (start|end):/.test(props.label))).toHaveLength(2);
  });

  it('shows a generic error when storage did not change and preserves the prior setting', async () => {
    const h = harness(); await h.settle();
    h.update.mockRejectedValueOnce(new Error('disk full'));
    h.find('Follow up on my steps').onValueChange(true); await h.settle();
    expect(h.find('Follow up on my steps')).toMatchObject({ value: false, disabled: false });
    expect(h.elements().find(({ type }) => type === 'InlineStatus')?.props).toMatchObject({ tone: 'error', message: expect.stringContaining('Could not save') });
    expect(h.read).toHaveBeenCalledTimes(2);
    expect(h.elements().some(({ props }) => props.label === 'Retry')).toBe(false);
    h.find('Follow up on my steps').onValueChange(true); await h.settle();
    expect(h.find('Follow up on my steps').value).toBe(true);
    expect(h.elements().some(({ type }) => type === 'InlineStatus')).toBe(false);
  });

  it('fails closed on a read error and supports retry without writing defaults', async () => {
    const h = harness();
    h.read.mockRejectedValueOnce(new Error('read failed'));
    h.render('owner-b'); await h.settle();
    expect(h.find('Follow-up settings unavailable')).toBeDefined();
    expect(h.elements().some(({ type }) => type === 'Switch')).toBe(false);
    expect(h.update).not.toHaveBeenCalled();
    h.press('Retry'); await h.settle();
    expect(h.find('Follow up on my steps').disabled).toBe(false);
  });

  it.each(['register', 'unregister', 'cancel', 'quiet-hours sync'] as const)(
    'reloads the saved choice after %s fails and retries native sync with full preferences', async (failure) => {
      vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 2, 10));
      const initial = { ...defaults, enabled: failure !== 'register' };
      const persisted = {
        ...initial,
        enabled: failure !== 'unregister',
        quietEndHour: failure === 'quiet-hours sync' ? 9 : 8,
        pausedUntil: failure === 'cancel' ? new Date(2026, 9, 3, 8).toISOString() : null,
      };
      const h = harness(initial); await h.settle();
      h.update.mockImplementationOnce(async () => {
        h.read.mockResolvedValue(persisted);
        throw new Error(`${failure} failed after persistence`);
      });
      if (failure === 'cancel') h.press('Pause until tomorrow');
      else if (failure === 'quiet-hours sync') {
        h.press(h.elements().find(({ props }) => props.label?.startsWith('Quiet end:'))!.props.label);
        h.find('Quiet end hour').onChange({ type: 'set' }, new Date(2026, 9, 2, 9)); h.render();
        h.press('Save time');
      } else h.find('Follow up on my steps').onValueChange(persisted.enabled);
      await h.settle();
      expect(h.find('Follow up on my steps')).toMatchObject({ value: persisted.enabled, disabled: false });
      expect(h.elements().find(({ type }) => type === 'InlineStatus')?.props).toMatchObject({ tone: 'error', message: syncError });
      expect(h.elements().some(({ type }) => type === 'DateTimePicker')).toBe(false);
      if (failure === 'cancel') expect(h.find('Resume')).toBeDefined();

      // A repeated native failure has unchanged storage, but is still a sync failure.
      h.update.mockRejectedValueOnce(new Error('native retry failed'));
      h.press('Retry'); await h.settle();
      expect(h.update).toHaveBeenLastCalledWith('owner-a', persisted);
      expect(h.elements().find(({ type }) => type === 'InlineStatus')?.props.message).toBe(syncError);

      const pending = deferred<void>(); h.update.mockReturnValueOnce(pending.promise);
      const retry = h.find('Retry').onPress;
      retry(); retry(); h.render();
      expect(h.update).toHaveBeenCalledTimes(3);
      expect(h.update).toHaveBeenLastCalledWith('owner-a', persisted);
      expect(h.find('Retry').disabled).toBe(true);
      expect(h.find('Follow up on my steps').disabled).toBe(true);
      pending.resolve(); await h.settle();
      expect(h.elements().some(({ type }) => type === 'InlineStatus')).toBe(false);
      expect(h.elements().some(({ props }) => props.label === 'Retry')).toBe(false);
    },
  );

  it('fails closed when the recovery read fails, then reloads before allowing native retry', async () => {
    const h = harness(); await h.settle();
    const toggle = h.find('Follow up on my steps').onValueChange;
    h.update.mockRejectedValueOnce(new Error('registration failed'));
    h.read.mockRejectedValueOnce(new Error('storage unavailable'));
    toggle(true); await h.settle();
    expect(h.find('Follow-up settings unavailable')).toBeDefined();
    expect(h.elements().some(({ type }) => type === 'Switch')).toBe(false);
    expect(h.elements().find(({ type }) => type === 'InlineStatus')?.props.message).toContain('Could not load');
    toggle(true);
    expect(h.update).toHaveBeenCalledTimes(1);

    const reload = deferred<Preferences>(); h.read.mockReturnValueOnce(reload.promise);
    h.press('Retry');
    expect(h.find('Retry').disabled).toBe(true);
    expect(h.elements().some(({ type }) => type === 'Switch')).toBe(false);
    const persisted = { ...defaults, enabled: true };
    reload.resolve(persisted); await h.settle();
    expect(h.find('Follow up on my steps')).toMatchObject({ value: true, disabled: false });
    expect(h.elements().find(({ type }) => type === 'InlineStatus')?.props.message).toBe(syncError);
    expect(h.update).toHaveBeenCalledTimes(1);
    h.press('Retry'); await h.settle();
    expect(h.update).toHaveBeenLastCalledWith('owner-a', persisted);
    expect(h.elements().some(({ type }) => type === 'InlineStatus')).toBe(false);
  });

  it('reports a later storage failure without losing the earlier saved choice or native retry', async () => {
    const h = harness(); await h.settle();
    const persisted = { ...defaults, enabled: true };
    h.read.mockResolvedValue(persisted);
    h.update.mockRejectedValueOnce(new Error('register failed after write'));
    h.find('Follow up on my steps').onValueChange(true); await h.settle();
    h.update.mockRejectedValueOnce(new Error('disable write failed'));
    h.find('Follow up on my steps').onValueChange(false); await h.settle();
    expect(h.find('Follow up on my steps').value).toBe(true);
    expect(h.elements().find(({ type }) => type === 'InlineStatus')?.props.message).toContain('Could not save');
    h.press('Retry'); await h.settle();
    expect(h.update).toHaveBeenLastCalledWith('owner-a', persisted);
    expect(h.elements().some(({ type }) => type === 'InlineStatus')).toBe(false);
  });

  it('preserves the storage-failure distinction after a failed recovery read is retried', async () => {
    const h = harness({ ...defaults, enabled: true }); await h.settle();
    h.update.mockRejectedValueOnce(new Error('write failed'));
    h.read.mockRejectedValueOnce(new Error('read failed'));
    h.find('Follow up on my steps').onValueChange(false); await h.settle();
    h.press('Retry'); await h.settle();
    expect(h.find('Follow up on my steps').value).toBe(true);
    expect(h.elements().find(({ type }) => type === 'InlineStatus')?.props.message).toContain('Could not save');
    expect(h.elements().some(({ props }) => props.label === 'Retry')).toBe(false);
    expect(h.update).toHaveBeenCalledTimes(1);
  });

  it.each(['resolve', 'reject'] as const)('ignores a recovery-read %s after the owner changes', async (outcome) => {
    const h = harness(); await h.settle();
    const recovery = deferred<Preferences>();
    h.read.mockReturnValueOnce(recovery.promise);
    h.update.mockRejectedValueOnce(new Error('native failure'));
    h.find('Follow up on my steps').onValueChange(true); await h.settle();
    expect(h.read).toHaveBeenCalledTimes(2);
    expect(h.find('Follow up on my steps').disabled).toBe(true);
    h.render('owner-b'); await h.settle();
    if (outcome === 'resolve') recovery.resolve({ ...defaults, enabled: true });
    else recovery.reject(new Error('old read failed'));
    await h.settle();
    expect(h.find('Follow up on my steps')).toMatchObject({ value: false, disabled: false });
    expect(h.elements().some(({ type }) => type === 'InlineStatus')).toBe(false);
    expect(h.elements().some(({ props }) => props.label === 'Retry')).toBe(false);
  });

  it('drops native-retry handlers and late failures on owner change', async () => {
    const h = harness(); await h.settle();
    h.read.mockResolvedValueOnce({ ...defaults, enabled: true });
    h.update.mockRejectedValueOnce(new Error('register failed'));
    h.find('Follow up on my steps').onValueChange(true); await h.settle();
    const retry = h.find('Retry').onPress;
    const pending = deferred<void>(); h.update.mockReturnValueOnce(pending.promise);
    retry(); h.render(); h.render('owner-b'); await h.settle();
    const readsBefore = h.read.mock.calls.length;
    pending.reject(new Error('old retry failed')); await h.settle(); retry();
    expect(h.read).toHaveBeenCalledTimes(readsBefore);
    expect(h.update).toHaveBeenCalledTimes(2);
    expect(h.find('Follow up on my steps')).toMatchObject({ value: false, disabled: false });
    expect(h.elements().some(({ type }) => type === 'InlineStatus')).toBe(false);
  });

  it.each([['Quiet start', 'quietStartHour', 21, 22], ['Quiet end', 'quietEndHour', 8, 9]] as const)(
    'uses a native time picker for %s and persists only the confirmed hour', async (label, field, initial, selected) => {
      const h = harness({ ...defaults, enabled: true }); await h.settle();
      const button = h.elements().find(({ props }) => props.label?.startsWith(`${label}:`))!;
      h.press(button.props.label);
      const picker = h.find(`${label} hour`);
      expect(picker.mode).toBe('time');
      expect(picker.value.getHours()).toBe(initial);
      picker.onChange({ type: 'set' }, new Date(2026, 9, 2, selected, 45)); h.render();
      expect(h.update).not.toHaveBeenCalled();
      h.press('Save time'); await h.settle();
      expect(h.update).toHaveBeenCalledExactlyOnceWith('owner-a', { [field]: selected });
      expect(h.elements().some(({ type }) => type === 'DateTimePicker')).toBe(false);
    },
  );

  it('cancels picker drafts and rejects identical quiet hours', async () => {
    const h = harness({ ...defaults, enabled: true }); await h.settle();
    const label = h.elements().find(({ props }) => props.label?.startsWith('Quiet start:'))!.props.label;
    h.press(label);
    h.find('Quiet start hour').onChange({ type: 'set' }, new Date(2026, 9, 2, 8)); h.render();
    h.press('Save time');
    expect(h.update).not.toHaveBeenCalled();
    expect(h.elements().find(({ type }) => type === 'InlineStatus')?.props.message).toContain('different quiet');
    h.press('Cancel'); h.press(label);
    expect(h.find('Quiet start hour').value.getHours()).toBe(21);
    h.find('Quiet start hour').onChange({ type: 'dismissed' }); h.render();
    expect(h.elements().some(({ type }) => type === 'DateTimePicker')).toBe(false);
  });

  it('pauses until tomorrow at quiet end and resumes without changing opt-in', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 11, 31, 23, 30));
    const h = harness({ ...defaults, enabled: true }); await h.settle();
    h.press('Pause until tomorrow'); await h.settle();
    expect(h.update).toHaveBeenLastCalledWith('owner-a', { pausedUntil: new Date(2027, 0, 1, 8).toISOString() });
    h.press('Resume'); await h.settle();
    expect(h.update).toHaveBeenLastCalledWith('owner-a', { pausedUntil: null });
    expect(h.find('Follow up on my steps').value).toBe(true);
  });

  it('ignores late reads across owner changes, including switching back to the original owner', async () => {
    const h = harness(); await h.settle();
    const pending = deferred<Preferences>();
    h.read.mockReturnValueOnce(pending.promise);
    h.render('owner-b'); h.render('owner-a'); await h.settle();
    pending.resolve({ ...defaults, enabled: true }); await h.settle();
    expect(h.find('Follow up on my steps').value).toBe(false);
    expect(h.update).not.toHaveBeenCalled();
  });

  it.each(['resolve', 'reject'] as const)('isolates late save %s and stale handlers after an owner switch', async (outcome) => {
    const h = harness({ ...defaults, enabled: true }); await h.settle();
    const oldToggle = h.find('Follow up on my steps').onValueChange;
    const pending = deferred<void>(); h.update.mockReturnValueOnce(pending.promise);
    oldToggle(false);
    h.read.mockResolvedValue(defaults); h.render('owner-b'); await h.settle();
    if (outcome === 'resolve') pending.resolve();
    else pending.reject(new Error('old owner failed'));
    await h.settle(); oldToggle(true);
    expect(h.find('Follow up on my steps')).toMatchObject({ value: false, disabled: false });
    expect(h.elements().some(({ type }) => type === 'InlineStatus')).toBe(false);
    expect(h.update).toHaveBeenCalledExactlyOnceWith('owner-a', { enabled: false });
  });

  it('clears an open picker on owner change and ignores callbacks after unmount', async () => {
    const h = harness({ ...defaults, enabled: true }); await h.settle();
    h.press(h.elements().find(({ props }) => props.label?.startsWith('Quiet start:'))!.props.label);
    const oldSave = h.find('Save time').onPress;
    h.render('owner-b'); await h.settle(); oldSave();
    expect(h.elements().some(({ type }) => type === 'DateTimePicker')).toBe(false);
    expect(h.update).not.toHaveBeenCalled();
    const toggle = h.find('Follow up on my steps').onValueChange;
    h.unmount(); toggle(false);
    expect(h.update).not.toHaveBeenCalled();
  });

  it('does not read or render for non-iOS devices or empty owners', () => {
    const android = harness(defaults, 'android');
    expect(android.render()).toBeNull(); expect(android.read).not.toHaveBeenCalled();
    const h = harness(); h.read.mockClear();
    expect(h.render(' ')).toBeNull(); expect(h.read).not.toHaveBeenCalled();
  });
});
