import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const webMeditation = read('app/meditate/page.tsx');
const mobileMeditation = read('mobile/app/meditate.tsx');
const guidedPractice = read('mobile/components/GuidedPractice.tsx');

describe('meditation paused-resume wiring', () => {
  it('restores paused state without starting web or iOS timers', () => {
    expect(webMeditation).toContain('pausedTimerFromProgress(parsed)');
    expect(mobileMeditation).toContain('pausedTimerFromProgress(parsed)');
    expect(guidedPractice).toContain('const restored = { ...initialTimer, running: false }');
    expect(guidedPractice).toContain('onBeforeStart');
    expect(mobileMeditation).toContain(
      'onBeforeStart={() => clearStored(selectedOwnerId)}'
    );
  });

  it('pauses web on lifecycle changes and iOS on backgrounding', () => {
    expect(webMeditation).toContain("document.addEventListener('visibilitychange'");
    expect(webMeditation).toContain("window.addEventListener('pagehide'");
    expect(guidedPractice).toContain("AppState.addEventListener('change'");
    expect(guidedPractice).toContain("state !== 'active' && current.running");
    expect(guidedPractice).toContain('void onPauseRef.current?.(paused)');
    expect(guidedPractice).toContain('current.running && !current.complete');
    expect(guidedPractice).toContain('subscription.remove()');
  });

  it('clears a stored pause before running and persists only through paused helpers', () => {
    for (const source of [webMeditation, mobileMeditation]) {
      expect(source).toContain('clearPausedPracticeProgress');
      expect(source).toContain('savePausedPracticeProgress');
      expect(source).toContain("pausedProgressFromTimer('meditation'");
      expect(source).toContain(".eq('practice_type', 'meditation')");
    }
  });

  it('binds each iOS timer and persistence callback to its starting owner', () => {
    expect(mobileMeditation).toContain('selectedOwnerId === context.user_id');
    expect(mobileMeditation).toContain(
      'key={`${selectedOwnerId}:${selectedPractice.id}`}'
    );
    expect(mobileMeditation).toContain(
      'if (ownerRef.current !== expectedOwnerId) return;'
    );
    expect(mobileMeditation).toContain(
      'if (current && current.user_id !== expectedOwnerId) return;'
    );
    expect(mobileMeditation).toContain(
      'persistPaused(timer, selectedPractice.id, selectedOwnerId)'
    );
    expect(mobileMeditation).toContain('const previous = pendingPauseRef.current');
    expect(mobileMeditation).toContain('previous.catch(() => undefined)');
  });
});
