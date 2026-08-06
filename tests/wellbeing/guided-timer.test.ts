import { describe, expect, it } from 'vitest';
import {
  IDLE_GUIDED_TIMER,
  advanceGuidedTimer,
  advanceGuidedTimerBy,
  resetGuidedTimer,
} from '../../lib/guided-timer';

describe('guided timer transitions', () => {
  it('does not advance a paused or complete timer', () => {
    expect(advanceGuidedTimer(IDLE_GUIDED_TIMER, 10, 3)).toBe(
      IDLE_GUIDED_TIMER
    );
    const complete = {
      stepIndex: 2,
      elapsed: 10,
      running: false,
      complete: true,
    };
    expect(advanceGuidedTimer(complete, 10, 3)).toBe(complete);
  });

  it('advances elapsed time without changing other timer state', () => {
    expect(
      advanceGuidedTimer(
        { stepIndex: 0, elapsed: 3, running: true, complete: false },
        10,
        3
      )
    ).toEqual({
      stepIndex: 0,
      elapsed: 4,
      running: true,
      complete: false,
    });
  });

  it('moves to the next step exactly once at a boundary', () => {
    const boundary = {
      stepIndex: 0,
      elapsed: 9,
      running: true,
      complete: false,
    };
    const advanced = advanceGuidedTimer(boundary, 10, 3);
    expect(advanced).toEqual({
      stepIndex: 1,
      elapsed: 0,
      running: true,
      complete: false,
    });
    expect(advanceGuidedTimer(boundary, 10, 3)).toEqual(advanced);
  });

  it('stops at the end and resets without retaining old progress', () => {
    expect(
      advanceGuidedTimer(
        { stepIndex: 2, elapsed: 9, running: true, complete: false },
        10,
        3
      )
    ).toEqual({
      stepIndex: 2,
      elapsed: 10,
      running: false,
      complete: true,
    });
    expect(resetGuidedTimer(true)).toEqual({
      stepIndex: 0,
      elapsed: 0,
      running: true,
      complete: false,
    });
  });

  it('reconciles delayed ticks across steps using elapsed time', () => {
    expect(
      advanceGuidedTimerBy(
        { stepIndex: 0, elapsed: 8, running: true, complete: false },
        [10, 20, 30],
        7
      )
    ).toEqual({
      stepIndex: 1,
      elapsed: 5,
      running: true,
      complete: false,
    });
  });

  it('completes safely when a delayed tick crosses the practice end', () => {
    expect(
      advanceGuidedTimerBy(
        { stepIndex: 1, elapsed: 18, running: true, complete: false },
        [10, 20],
        10
      )
    ).toEqual({
      stepIndex: 1,
      elapsed: 20,
      running: false,
      complete: true,
    });
  });
});
