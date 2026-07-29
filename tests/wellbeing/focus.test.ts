import { describe, expect, it } from 'vitest';
import {
  advanceFocusClock,
  advanceFocusClockBy,
  completedFocusCycles,
  createFocusClock,
  formatClock,
} from '../../lib/wellbeing/focus';

describe('focus clock', () => {
  it('creates a paused clock with bounded positive minutes', () => {
    expect(createFocusClock(0, 1)).toEqual({
      phase: 'focus',
      cycle: 1,
      secondsRemaining: 60,
      running: false,
      complete: false,
    });
  });

  it('does not advance while paused', () => {
    const paused = createFocusClock(25, 2);
    expect(advanceFocusClock(paused, 25, 5, 2)).toBe(paused);
  });

  it('moves from focus to a paused break at the exact boundary', () => {
    const next = advanceFocusClock(
      {
        phase: 'focus',
        cycle: 1,
        secondsRemaining: 1,
        running: true,
        complete: false,
      },
      25,
      5,
      2
    );
    expect(next).toEqual({
      phase: 'break',
      cycle: 1,
      secondsRemaining: 300,
      running: false,
      complete: false,
    });
    expect(completedFocusCycles(next)).toBe(1);
  });

  it('moves from break to the next paused focus cycle', () => {
    expect(
      advanceFocusClock(
        {
          phase: 'break',
          cycle: 1,
          secondsRemaining: 1,
          running: true,
          complete: false,
        },
        15,
        5,
        3
      )
    ).toEqual({
      phase: 'focus',
      cycle: 2,
      secondsRemaining: 900,
      running: false,
      complete: false,
    });
  });

  it('completes after the final focus block without adding a break', () => {
    const complete = advanceFocusClock(
      {
        phase: 'focus',
        cycle: 2,
        secondsRemaining: 1,
        running: true,
        complete: false,
      },
      25,
      5,
      2
    );
    expect(complete.complete).toBe(true);
    expect(complete.running).toBe(false);
    expect(complete.secondsRemaining).toBe(0);
    expect(completedFocusCycles(complete)).toBe(2);
  });

  it('reconciles elapsed background time without drifting', () => {
    expect(
      advanceFocusClockBy(
        {
          phase: 'focus',
          cycle: 1,
          secondsRemaining: 10,
          running: true,
          complete: false,
        },
        7,
        25,
        5,
        2
      )
    ).toMatchObject({
      phase: 'focus',
      secondsRemaining: 3,
      running: true,
    });
  });

  it('pauses at a phase boundary instead of consuming the next block', () => {
    expect(
      advanceFocusClockBy(
        {
          phase: 'focus',
          cycle: 1,
          secondsRemaining: 10,
          running: true,
          complete: false,
        },
        600,
        25,
        5,
        2
      )
    ).toEqual({
      phase: 'break',
      cycle: 1,
      secondsRemaining: 300,
      running: false,
      complete: false,
    });
  });

  it('does not reconcile elapsed time while paused', () => {
    const paused = createFocusClock(25, 1);
    expect(advanceFocusClockBy(paused, 600, 25, 5, 1)).toBe(paused);
  });

  it('formats safe minute and second output', () => {
    expect(formatClock(1_501)).toBe('25:01');
    expect(formatClock(-10)).toBe('0:00');
  });
});
