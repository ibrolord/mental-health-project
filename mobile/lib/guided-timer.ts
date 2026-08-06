export type GuidedTimerState = {
  stepIndex: number;
  elapsed: number;
  running: boolean;
  complete: boolean;
};

export const IDLE_GUIDED_TIMER: GuidedTimerState = {
  stepIndex: 0,
  elapsed: 0,
  running: false,
  complete: false,
};

export function resetGuidedTimer(running: boolean): GuidedTimerState {
  return {
    ...IDLE_GUIDED_TIMER,
    running,
  };
}

export function advanceGuidedTimer(
  state: GuidedTimerState,
  stepSeconds: number,
  totalSteps: number
): GuidedTimerState {
  return advanceGuidedTimerBy(
    state,
    Array.from({ length: Math.max(0, totalSteps) }, () => stepSeconds),
    1
  );
}

export function advanceGuidedTimerBy(
  state: GuidedTimerState,
  stepDurations: readonly number[],
  seconds: number
): GuidedTimerState {
  if (
    !state.running ||
    state.complete ||
    stepDurations.length <= 0 ||
    !Number.isFinite(seconds) ||
    seconds <= 0
  ) {
    return state;
  }

  let next = { ...state };
  let remaining = Math.floor(seconds);

  while (remaining > 0 && !next.complete) {
    const stepSeconds = stepDurations[next.stepIndex] ?? 0;

    if (!Number.isFinite(stepSeconds) || stepSeconds <= 0) {
      if (next.stepIndex >= stepDurations.length - 1) {
        next = { ...next, elapsed: 0, running: false, complete: true };
      } else {
        next = { ...next, stepIndex: next.stepIndex + 1, elapsed: 0 };
      }
      continue;
    }

    const available = Math.max(0, stepSeconds - next.elapsed);
    if (remaining < available) {
      next = { ...next, elapsed: next.elapsed + remaining };
      remaining = 0;
      continue;
    }

    remaining -= available;
    if (next.stepIndex >= stepDurations.length - 1) {
      next = {
        ...next,
        elapsed: stepSeconds,
        running: false,
        complete: true,
      };
    } else {
      next = { ...next, stepIndex: next.stepIndex + 1, elapsed: 0 };
    }
  }

  return next;
}
