export type FocusPhase = 'focus' | 'break';

export type FocusClock = {
  phase: FocusPhase;
  cycle: number;
  secondsRemaining: number;
  running: boolean;
  complete: boolean;
};

export function normalizeGoalIdParam(value: unknown): string {
  const first = Array.isArray(value) ? value[0] : value;
  if (typeof first !== 'string') return '';
  const normalized = first.trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
    normalized
  )
    ? normalized
    : '';
}

export function createFocusClock(
  focusMinutes: number,
  plannedCycles: number
): FocusClock {
  return {
    phase: 'focus',
    cycle: 1,
    secondsRemaining: Math.max(1, focusMinutes) * 60,
    running: false,
    complete: plannedCycles < 1,
  };
}

export function advanceFocusClock(
  state: FocusClock,
  focusMinutes: number,
  breakMinutes: number,
  plannedCycles: number
): FocusClock {
  if (!state.running || state.complete) return state;
  if (state.secondsRemaining > 1) {
    return { ...state, secondsRemaining: state.secondsRemaining - 1 };
  }

  if (state.phase === 'focus') {
    if (state.cycle >= plannedCycles) {
      return {
        ...state,
        secondsRemaining: 0,
        running: false,
        complete: true,
      };
    }
    return {
      phase: 'break',
      cycle: state.cycle,
      secondsRemaining: Math.max(1, breakMinutes) * 60,
      running: false,
      complete: false,
    };
  }

  return {
    phase: 'focus',
    cycle: state.cycle + 1,
    secondsRemaining: Math.max(1, focusMinutes) * 60,
    running: false,
    complete: false,
  };
}

export function advanceFocusClockBy(
  state: FocusClock,
  elapsedSeconds: number,
  focusMinutes: number,
  breakMinutes: number,
  plannedCycles: number
): FocusClock {
  if (!state.running || state.complete) return state;

  const elapsed = Math.max(0, Math.floor(elapsedSeconds));
  if (elapsed === 0) return state;
  if (elapsed < state.secondsRemaining) {
    return { ...state, secondsRemaining: state.secondsRemaining - elapsed };
  }

  // A phase boundary always pauses for an explicit user restart. Do not consume
  // background time from the next focus or break block.
  return advanceFocusClock(
    { ...state, secondsRemaining: 1 },
    focusMinutes,
    breakMinutes,
    plannedCycles
  );
}

export function completedFocusCycles(state: FocusClock): number {
  if (state.complete) return state.cycle;
  if (state.phase === 'break') return state.cycle;
  return Math.max(0, state.cycle - 1);
}

export function formatClock(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
