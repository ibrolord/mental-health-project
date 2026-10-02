type RefreshRequest = { isCurrent: () => boolean; allowConsent: boolean };

type Dependencies = {
  isOwnerCurrent: () => boolean;
  load: (request: RefreshRequest) => Promise<void>;
  onLoading: (loading: boolean) => void;
  onError: (error: unknown) => void;
};

// One focused screen owns this gate. Background/blur invalidate reads; mutations
// finish durably, then a queued foreground refresh reads the committed state.
export function createAdvisorLoopRefresh(dependencies: Dependencies) {
  let alive = true;
  let appActive = true;
  let revision = 0;
  let running: Promise<void> | null = null;
  let mutation: object | null = null;
  let queued = false;
  const available = () => alive && dependencies.isOwnerCurrent();

  function refresh(allowConsent = false): Promise<void> {
    if (!available() || !appActive) return Promise.resolve();
    if (mutation) {
      queued = true;
      return Promise.resolve();
    }
    if (running) return running;
    const request = ++revision;
    const isCurrent = () => available() && appActive && request === revision;
    dependencies.onLoading(true);
    const task = Promise.resolve()
      .then(() => isCurrent() ? dependencies.load({ isCurrent, allowConsent }) : undefined)
      .catch((error: unknown) => { if (isCurrent()) dependencies.onError(error); })
      .finally(() => {
        if (isCurrent()) dependencies.onLoading(false);
        if (running === task) running = null;
      });
    running = task;
    return task;
  }

  return {
    refresh,
    setAppActive(active: boolean) {
      if (!available() || appActive === active) return;
      appActive = active;
      if (active) {
        void refresh();
      } else {
        revision += 1;
        running = null;
        dependencies.onLoading(false);
      }
    },
    beginMutation() {
      if (!available() || mutation) return null;
      const token = {};
      mutation = token;
      if (running) queued = true;
      revision += 1;
      running = null;
      dependencies.onLoading(false);
      return {
        isCurrent: () => available() && mutation === token,
        finish() {
          if (mutation !== token) return;
          mutation = null;
          if (queued && available()) {
            queued = false;
            void refresh();
          }
        },
      };
    },
    dispose() {
      alive = false;
      revision += 1;
      queued = false;
    },
  };
}
