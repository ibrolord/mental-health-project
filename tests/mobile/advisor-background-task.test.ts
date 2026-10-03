import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import type * as AdapterModule from '../../mobile/lib/advisor-background-task';

type Dependencies = Parameters<typeof AdapterModule.createAdvisorBackgroundTaskAdapter>[0];
type NativeModules = NonNullable<ReturnType<Dependencies['loadModules']>>;
type Executor = Parameters<NativeModules['TaskManager']['defineTask']>[1];

const source = readFileSync(resolve('mobile/lib/advisor-background-task.ts'), 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

// Evaluate the whole module, including boot-time definition, without loading React Native in Node.
function loadAdapter(requireModule: (name: string) => unknown) {
  const evaluated = { exports: {} as typeof AdapterModule };
  new Function('require', 'module', 'exports', code)(
    requireModule, evaluated, evaluated.exports
  );
  return evaluated.exports;
}

const { ADVISOR_BACKGROUND_TASK, createAdvisorBackgroundTaskAdapter } = loadAdapter(() => {
  throw new Error("Cannot find native module 'ExpoTaskManager'");
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

function harness(initiallyRegistered = false) {
  let registered = initiallyRegistered;
  let executor: Executor | undefined;
  const operations: string[] = [];
  const TaskManager = {
    defineTask: vi.fn((_name: string, callback: Executor) => { executor = callback; }),
    isTaskDefined: vi.fn(() => false),
    isAvailableAsync: vi.fn(async () => true),
    isTaskRegisteredAsync: vi.fn(async () => registered),
  };
  const BackgroundTask = {
    BackgroundTaskResult: { Success: 1, Failed: 2 } as const,
    BackgroundTaskStatus: { Available: 2, Restricted: 1 } as const,
    getStatusAsync: vi.fn(async (): Promise<1 | 2> => 2),
    registerTaskAsync: vi.fn(async () => {
      operations.push('register');
      registered = true;
    }),
    unregisterTaskAsync: vi.fn(async () => {
      operations.push('unregister');
      registered = false;
    }),
  };
  const modules: NativeModules = { TaskManager, BackgroundTask };
  const runAdvisorClientRefresh = vi.fn(async (_source: 'background'): Promise<void> => {});
  const loadRuntime = vi.fn(async () => ({ runAdvisorClientRefresh }));
  const deps: Dependencies = { loadModules: () => modules, loadRuntime };
  return {
    TaskManager, BackgroundTask, modules, runAdvisorClientRefresh, loadRuntime, deps, operations,
    isRegistered: () => registered,
    execute: (error: Parameters<Executor>[0]['error'] = null) => {
      if (!executor) throw new Error('Task was not defined');
      return executor({
        data: {}, error,
        executionInfo: { eventId: 'event-1', taskName: ADVISOR_BACKGROUND_TASK },
      });
    },
  };
}

describe('Advisor background task availability and module boot', () => {
  it.each(['ExpoTaskManager', 'ExpoBackgroundTask'])('launches without native %s', async (missing) => {
    const h = harness();
    const requireModule = vi.fn((name: string) => {
      if (name === 'expo-task-manager' && missing !== 'ExpoTaskManager') return h.TaskManager;
      throw new Error(`Cannot find native module '${missing}'`);
    });
    const adapter = loadAdapter(requireModule);
    await expect(adapter.syncAdvisorBackgroundTask(true)).resolves.toBe('unavailable');
    await expect(adapter.syncAdvisorBackgroundTask(false)).resolves.toBe('unavailable');
    expect(h.TaskManager.defineTask).not.toHaveBeenCalled();
    expect(requireModule).not.toHaveBeenCalledWith('./advisor-client-runtime');
  });

  it('reports unavailable when the injected module bundle is absent', async () => {
    const loadRuntime = vi.fn();
    const adapter = createAdvisorBackgroundTaskAdapter({ loadModules: () => null, loadRuntime });
    await expect(adapter.syncAdvisorBackgroundTask(true)).resolves.toBe('unavailable');
    expect(loadRuntime).not.toHaveBeenCalled();
  });

  it('does not disguise an unexpected module initialization error', () => {
    expect(() => loadAdapter(() => { throw new Error('invalid module implementation'); }))
      .toThrow('invalid module implementation');
  });

  it('reports unavailable when TaskManager is unsupported', async () => {
    const h = harness();
    h.TaskManager.isAvailableAsync.mockResolvedValue(false);
    const adapter = createAdvisorBackgroundTaskAdapter(h.deps);
    await expect(adapter.syncAdvisorBackgroundTask(true)).resolves.toBe('unavailable');
    expect(h.BackgroundTask.getStatusAsync).not.toHaveBeenCalled();
    expect(h.BackgroundTask.registerTaskAsync).not.toHaveBeenCalled();
  });

  it('does not register on a restricted device or iOS simulator', async () => {
    const h = harness();
    h.BackgroundTask.getStatusAsync.mockResolvedValue(1);
    const adapter = createAdvisorBackgroundTaskAdapter(h.deps);
    await expect(adapter.syncAdvisorBackgroundTask(true)).resolves.toBe('unavailable');
    expect(h.TaskManager.isTaskRegisteredAsync).not.toHaveBeenCalled();
    expect(h.BackgroundTask.registerTaskAsync).not.toHaveBeenCalled();
  });

  it.each(['ERR_UNAVAILABLE', 'ERR_BACKGROUND_TASKS_RESTRICTED', 'ERR_TASK_MANAGER_NOT_FOUND'])(
    'treats the known native capability error %s as unavailable', async (code) => {
      const h = harness();
      h.BackgroundTask.registerTaskAsync.mockRejectedValue(Object.assign(new Error('unsupported'), { code }));
      const adapter = createAdvisorBackgroundTaskAdapter(h.deps);
      await expect(adapter.syncAdvisorBackgroundTask(true)).resolves.toBe('unavailable');
    }
  );

  it('reports an unsupported availability API rather than rejecting', async () => {
    const h = harness();
    h.TaskManager.isAvailableAsync.mockRejectedValue({ code: 'ERR_UNAVAILABLE' });
    const adapter = createAdvisorBackgroundTaskAdapter(h.deps);
    await expect(adapter.syncAdvisorBackgroundTask(true)).resolves.toBe('unavailable');
  });
});

describe('Advisor background task registration', () => {
  it('registers once with an inexact 60-minute minimum and avoids duplicate work', async () => {
    const h = harness();
    const adapter = createAdvisorBackgroundTaskAdapter(h.deps);
    await expect(adapter.syncAdvisorBackgroundTask(true)).resolves.toBe('available');
    await expect(adapter.syncAdvisorBackgroundTask(true)).resolves.toBe('available');
    expect(h.BackgroundTask.registerTaskAsync).toHaveBeenCalledExactlyOnceWith(
      ADVISOR_BACKGROUND_TASK, { minimumInterval: 60 }
    );
    expect(h.TaskManager.isTaskRegisteredAsync).toHaveBeenCalledWith(ADVISOR_BACKGROUND_TASK);
    expect(h.loadRuntime).not.toHaveBeenCalled();
  });

  it('does not redefine an existing task or register an already-persisted task', async () => {
    const h = harness(true);
    h.TaskManager.isTaskDefined.mockReturnValue(true);
    const adapter = createAdvisorBackgroundTaskAdapter(h.deps);
    await expect(adapter.syncAdvisorBackgroundTask(true)).resolves.toBe('available');
    expect(h.TaskManager.defineTask).not.toHaveBeenCalled();
    expect(h.BackgroundTask.registerTaskAsync).not.toHaveBeenCalled();
  });

  it('unregisters only this task when disabled and tolerates repeated disable', async () => {
    const h = harness(true);
    const adapter = createAdvisorBackgroundTaskAdapter(h.deps);
    await expect(adapter.syncAdvisorBackgroundTask(false)).resolves.toBe('available');
    await expect(adapter.syncAdvisorBackgroundTask(false)).resolves.toBe('available');
    expect(h.BackgroundTask.unregisterTaskAsync).toHaveBeenCalledExactlyOnceWith(ADVISOR_BACKGROUND_TASK);
    expect(h.isRegistered()).toBe(false);
  });

  it('attempts persisted-task cleanup even when execution is restricted', async () => {
    const h = harness(true);
    h.BackgroundTask.getStatusAsync.mockResolvedValue(1);
    const adapter = createAdvisorBackgroundTaskAdapter(h.deps);
    await expect(adapter.syncAdvisorBackgroundTask(false)).resolves.toBe('unavailable');
    expect(h.BackgroundTask.unregisterTaskAsync).toHaveBeenCalledWith(ADVISOR_BACKGROUND_TASK);
  });

  it('reports unavailable if Expo silently skips registration after a restriction race', async () => {
    const h = harness();
    h.BackgroundTask.registerTaskAsync.mockResolvedValue(undefined);
    const adapter = createAdvisorBackgroundTaskAdapter(h.deps);
    await expect(adapter.syncAdvisorBackgroundTask(true)).resolves.toBe('unavailable');
  });

  it.each(['ERR_BACKGROUND_TASKS_NOT_CONFIGURED', 'ERR_COULD_NOT_REGISTER_WORKER_TASK', 'ERR_STORAGE'])(
    'propagates real registration error %s and does not poison later toggles', async (code) => {
      const h = harness();
      const error = Object.assign(new Error('registration failed'), { code });
      h.BackgroundTask.registerTaskAsync.mockRejectedValueOnce(error);
      const adapter = createAdvisorBackgroundTaskAdapter(h.deps);
      const failed = adapter.syncAdvisorBackgroundTask(true);
      const retry = adapter.syncAdvisorBackgroundTask(true);
      await expect(failed).rejects.toBe(error);
      await expect(retry).resolves.toBe('available');
      expect(h.isRegistered()).toBe(true);
    }
  );

  it('propagates unregister errors without blocking a queued retry', async () => {
    const h = harness(true);
    h.BackgroundTask.unregisterTaskAsync.mockRejectedValueOnce(new Error('native cancellation failed'));
    const adapter = createAdvisorBackgroundTaskAdapter(h.deps);
    const failed = adapter.syncAdvisorBackgroundTask(false);
    const retry = adapter.syncAdvisorBackgroundTask(false);
    await expect(failed).rejects.toThrow('native cancellation failed');
    await expect(retry).resolves.toBe('available');
    expect(h.isRegistered()).toBe(false);
  });

  it('does not hide errors reading persisted registration', async () => {
    const h = harness();
    h.TaskManager.isTaskRegisteredAsync.mockRejectedValue(new Error('task store unavailable'));
    const adapter = createAdvisorBackgroundTaskAdapter(h.deps);
    await expect(adapter.syncAdvisorBackgroundTask(true)).rejects.toThrow('task store unavailable');
  });
});

describe('Advisor background task toggle serialization', () => {
  it.each([false, true])('serializes enable then disable, with final re-enable %s', async (reenable) => {
    const h = harness();
    const entered = deferred();
    const release = deferred();
    const register = h.BackgroundTask.registerTaskAsync.getMockImplementation()!;
    h.BackgroundTask.registerTaskAsync.mockImplementationOnce(async () => {
      entered.resolve();
      await release.promise;
      await register();
    });
    const adapter = createAdvisorBackgroundTaskAdapter(h.deps);
    const enabling = adapter.syncAdvisorBackgroundTask(true);
    await entered.promise;
    const disabling = adapter.syncAdvisorBackgroundTask(false);
    const finalEnable = reenable ? adapter.syncAdvisorBackgroundTask(true) : Promise.resolve();
    await Promise.resolve();
    expect(h.BackgroundTask.unregisterTaskAsync).not.toHaveBeenCalled();
    release.resolve();
    await Promise.all([enabling, disabling, finalEnable]);
    expect(h.operations).toEqual(reenable ? ['register', 'unregister', 'register'] : ['register', 'unregister']);
    expect(h.isRegistered()).toBe(reenable);
  });

  it('waits for an in-flight disable before re-enabling', async () => {
    const h = harness(true);
    const entered = deferred();
    const release = deferred();
    const unregister = h.BackgroundTask.unregisterTaskAsync.getMockImplementation()!;
    h.BackgroundTask.unregisterTaskAsync.mockImplementationOnce(async () => {
      entered.resolve();
      await release.promise;
      await unregister();
    });
    const adapter = createAdvisorBackgroundTaskAdapter(h.deps);
    const disabling = adapter.syncAdvisorBackgroundTask(false);
    await entered.promise;
    const enabling = adapter.syncAdvisorBackgroundTask(true);
    await Promise.resolve();
    expect(h.BackgroundTask.registerTaskAsync).not.toHaveBeenCalled();
    release.resolve();
    await Promise.all([disabling, enabling]);
    expect(h.operations).toEqual(['unregister', 'register']);
    expect(h.isRegistered()).toBe(true);
  });

  it('coalesces concurrent enable calls through the persisted registration check', async () => {
    const h = harness();
    const adapter = createAdvisorBackgroundTaskAdapter(h.deps);
    await Promise.all(Array.from({ length: 5 }, () => adapter.syncAdvisorBackgroundTask(true)));
    expect(h.BackgroundTask.registerTaskAsync).toHaveBeenCalledOnce();
  });
});

describe('Advisor headless task handler', () => {
  it('defines at module scope and lazily calls the parent runtime with the background route', async () => {
    const h = harness();
    const requireModule = vi.fn((name: string) => {
      if (name === 'expo-task-manager') return h.TaskManager;
      if (name === 'expo-background-task') return h.BackgroundTask;
      if (name === './advisor-client-runtime') return { runAdvisorClientRefresh: h.runAdvisorClientRefresh };
      throw new Error(`Unexpected dependency: ${name}`);
    });
    const adapter = loadAdapter(requireModule);
    expect(h.TaskManager.defineTask).toHaveBeenCalledExactlyOnceWith(ADVISOR_BACKGROUND_TASK, expect.any(Function));
    expect(requireModule).not.toHaveBeenCalledWith('./advisor-client-runtime');
    await adapter.syncAdvisorBackgroundTask(true);
    expect(requireModule).not.toHaveBeenCalledWith('./advisor-client-runtime');
    await expect(h.execute()).resolves.toBe(h.BackgroundTask.BackgroundTaskResult.Success);
    expect(requireModule).toHaveBeenCalledWith('./advisor-client-runtime');
    expect(h.runAdvisorClientRefresh).toHaveBeenCalledExactlyOnceWith('background');
  });

  it('waits for the Promise<void> refresh before reporting success', async () => {
    const h = harness();
    const release = deferred();
    h.runAdvisorClientRefresh.mockReturnValue(release.promise);
    createAdvisorBackgroundTaskAdapter(h.deps);
    const finished = vi.fn();
    const execution = h.execute().then(finished);
    await Promise.resolve();
    await Promise.resolve();
    expect(h.runAdvisorClientRefresh).toHaveBeenCalledWith('background');
    expect(finished).not.toHaveBeenCalled();
    release.resolve();
    await execution;
    expect(finished).toHaveBeenCalledWith(h.BackgroundTask.BackgroundTaskResult.Success);
  });

  it('maps a TaskManager event error to Failed without loading the runtime', async () => {
    const h = harness();
    createAdvisorBackgroundTaskAdapter(h.deps);
    await expect(h.execute({ code: 'ERR_TASK', message: 'execution failed' }))
      .resolves.toBe(h.BackgroundTask.BackgroundTaskResult.Failed);
    expect(h.loadRuntime).not.toHaveBeenCalled();
  });

  it('maps runtime import failures to Failed', async () => {
    const h = harness();
    h.loadRuntime.mockRejectedValue(new Error('runtime could not load'));
    createAdvisorBackgroundTaskAdapter(h.deps);
    await expect(h.execute()).resolves.toBe(h.BackgroundTask.BackgroundTaskResult.Failed);
  });

  it('maps refresh failures to Failed and permits a later successful execution', async () => {
    const h = harness();
    h.runAdvisorClientRefresh.mockRejectedValueOnce(new Error('refresh failed'));
    createAdvisorBackgroundTaskAdapter(h.deps);
    await expect(h.execute()).resolves.toBe(h.BackgroundTask.BackgroundTaskResult.Failed);
    await expect(h.execute()).resolves.toBe(h.BackgroundTask.BackgroundTaskResult.Success);
  });
});

describe('Advisor native background configuration', () => {
  it('uses the SDK 54 worker identifier without enabling HealthKit delivery or remote push', () => {
    const { expo } = JSON.parse(readFileSync(resolve('mobile/app.json'), 'utf8'));
    expect(expo.plugins).toContain('expo-background-task');
    expect(expo.ios.infoPlist.UIBackgroundModes).toEqual(['audio', 'processing']);
    expect(expo.ios.infoPlist.BGTaskSchedulerPermittedIdentifiers)
      .toEqual(['com.expo.modules.backgroundtask.processing']);
    expect(expo.plugins.find((plugin: unknown) => Array.isArray(plugin) && plugin[0] === '@kingstinct/react-native-healthkit')[1].background)
      .toBe(false);
    expect(expo.plugins.find((plugin: unknown) => Array.isArray(plugin) && plugin[0] === 'expo-notifications')[1].enableBackgroundRemoteNotifications)
      .toBe(false);
  });
});
