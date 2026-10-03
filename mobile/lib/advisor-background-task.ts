/* eslint-disable @typescript-eslint/no-require-imports -- Native modules must be guarded and the refresh runtime loaded only on execution. */
import type * as BackgroundTaskModule from 'expo-background-task';
import type * as TaskManagerModule from 'expo-task-manager';

export const ADVISOR_BACKGROUND_TASK = 'mhtoolkit-advisor-background-refresh';

type Availability = 'available' | 'unavailable';
type NativeModules = {
  BackgroundTask: Pick<
    typeof BackgroundTaskModule,
    'BackgroundTaskResult' | 'BackgroundTaskStatus' | 'getStatusAsync'
    | 'registerTaskAsync' | 'unregisterTaskAsync'
  >;
  TaskManager: Pick<
    typeof TaskManagerModule,
    'isTaskDefined' | 'isTaskRegisteredAsync' | 'isAvailableAsync'
  > & {
    defineTask: (
      taskName: string,
      executor: TaskManagerModule.TaskManagerTaskExecutor<unknown>
    ) => void;
  };
};
type AdvisorClientRuntime = {
  runAdvisorClientRefresh: (source: 'background') => Promise<void>;
};
type Dependencies = {
  loadModules: () => NativeModules | null;
  loadRuntime: () => Promise<AdvisorClientRuntime>;
};

function isUnavailable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  // Only known capability failures are optional. Configuration/registration bugs must surface.
  return code === 'ERR_UNAVAILABLE'
    || code === 'ERR_BACKGROUND_TASKS_RESTRICTED'
    || code === 'ERR_TASK_MANAGER_NOT_FOUND'
    || (typeof message === 'string'
      && /^Cannot find native module '(ExpoBackgroundTask|ExpoTaskManager)'$/.test(message));
}

export function createAdvisorBackgroundTaskAdapter(deps: Dependencies) {
  let modules: NativeModules | null;
  try {
    modules = deps.loadModules();
    if (modules) {
      const { BackgroundTask, TaskManager } = modules;
      if (!TaskManager.isTaskDefined(ADVISOR_BACKGROUND_TASK)) {
        TaskManager.defineTask(ADVISOR_BACKGROUND_TASK, async ({ error }) => {
          if (error) return BackgroundTask.BackgroundTaskResult.Failed;
          try {
            const runtime = await deps.loadRuntime();
            await runtime.runAdvisorClientRefresh('background');
            return BackgroundTask.BackgroundTaskResult.Success;
          } catch {
            return BackgroundTask.BackgroundTaskResult.Failed;
          }
        });
      }
    }
  } catch (error) {
    if (!isUnavailable(error)) throw error;
    modules = null;
  }

  async function sync(enabled: boolean): Promise<Availability> {
    if (!modules) return 'unavailable';
    const { BackgroundTask, TaskManager } = modules;
    try {
      if (!(await TaskManager.isAvailableAsync())) return 'unavailable';
      const status = await BackgroundTask.getStatusAsync();
      const available = status === BackgroundTask.BackgroundTaskStatus.Available;
      if (enabled && !available) return 'unavailable';

      const registered = await TaskManager.isTaskRegisteredAsync(ADVISOR_BACKGROUND_TASK);
      if (enabled && !registered) {
        // Minutes, not seconds. iOS chooses when to run; this is not an hourly guarantee.
        await BackgroundTask.registerTaskAsync(ADVISOR_BACKGROUND_TASK, { minimumInterval: 60 });
        // Expo can silently skip registration if support changes between the checks.
        if (!(await TaskManager.isTaskRegisteredAsync(ADVISOR_BACKGROUND_TASK))) {
          return 'unavailable';
        }
      } else if (!enabled && registered) {
        // Still attempt cleanup of a persisted registration when execution is restricted.
        await BackgroundTask.unregisterTaskAsync(ADVISOR_BACKGROUND_TASK);
      }
      return available ? 'available' : 'unavailable';
    } catch (error) {
      if (isUnavailable(error)) return 'unavailable';
      throw error;
    }
  }

  let queue: Promise<unknown> = Promise.resolve();
  return {
    syncAdvisorBackgroundTask(enabled: boolean): Promise<Availability> {
      const result = queue.then(() => sync(enabled));
      // Keep later toggles running after a failure, without hiding it from this caller.
      queue = result.catch(() => undefined);
      return result;
    },
  };
}

// Synchronous module-scope definition is required for a headless native launch.
// Older binaries can lack these modules; the iOS simulator reports Restricted.
const adapter = createAdvisorBackgroundTaskAdapter({
  loadModules: () => ({
    TaskManager: require('expo-task-manager') as typeof TaskManagerModule,
    BackgroundTask: require('expo-background-task') as typeof BackgroundTaskModule,
  }),
  loadRuntime: async () => require('./advisor-client-runtime') as AdvisorClientRuntime,
});

export function syncAdvisorBackgroundTask(enabled: boolean): Promise<Availability> {
  return adapter.syncAdvisorBackgroundTask(enabled);
}
