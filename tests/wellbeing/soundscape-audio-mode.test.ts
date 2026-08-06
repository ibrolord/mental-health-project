import { describe, expect, it, vi } from 'vitest';
import { createSoundscapeAudioModeCoordinator } from '../../mobile/lib/soundscape-audio-mode';

describe('native soundscape audio mode coordination', () => {
  it('restores the audio mode after a foreground-only soundscape stops', async () => {
    const setAudioMode = vi.fn(async () => undefined);
    const coordinator = createSoundscapeAudioModeCoordinator(setAudioMode);
    const owner = Symbol('yoga');

    await coordinator.enable(owner, false);
    await coordinator.release(owner);

    expect(setAudioMode).toHaveBeenNthCalledWith(1, {
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
    expect(setAudioMode).toHaveBeenNthCalledWith(2, {
      playsInSilentModeIOS: false,
      staysActiveInBackground: false,
    });
  });

  it('does not let an old screen disable a newer screen audio session', async () => {
    const calls: boolean[] = [];
    const coordinator = createSoundscapeAudioModeCoordinator(async (mode) => {
      calls.push(mode.playsInSilentModeIOS);
    });
    const yogaOwner = Symbol('yoga');
    const focusOwner = Symbol('focus');

    await coordinator.enable(yogaOwner, false);
    const oldRelease = coordinator.release(yogaOwner);
    const newEnable = coordinator.enable(focusOwner, true);
    await Promise.all([oldRelease, newEnable]);

    expect(calls).toEqual([true, true]);
    await coordinator.release(focusOwner);
    expect(calls).toEqual([true, true, false]);
  });
});
