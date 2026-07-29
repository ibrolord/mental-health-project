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
  if (
    !state.running ||
    state.complete ||
    stepSeconds <= 0 ||
    totalSteps <= 0
  ) {
    return state;
  }

  if (state.elapsed + 1 < stepSeconds) {
    return { ...state, elapsed: state.elapsed + 1 };
  }

  if (state.stepIndex >= totalSteps - 1) {
    return {
      ...state,
      elapsed: stepSeconds,
      running: false,
      complete: true,
    };
  }

  return {
    ...state,
    stepIndex: state.stepIndex + 1,
    elapsed: 0,
  };
}
