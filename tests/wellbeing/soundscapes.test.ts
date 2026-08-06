import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const generator = readFileSync(
  resolve(root, 'mobile/scripts/generate-soundscapes.mjs'),
  'utf8'
);
const webPlayer = readFileSync(
  resolve(root, 'components/optional-soundscape.tsx'),
  'utf8'
);
const nativePlayer = readFileSync(
  resolve(root, 'mobile/components/OptionalSoundscape.tsx'),
  'utf8'
);
const nativeFocus = readFileSync(resolve(root, 'mobile/app/focus.tsx'), 'utf8');
const appConfig = JSON.parse(
  readFileSync(resolve(root, 'mobile/app.json'), 'utf8')
) as {
  expo: { ios: { infoPlist: { UIBackgroundModes?: string[] } } };
};

const assets = ['deep-brown.m4a', 'steady-rain.m4a', 'ocean-wash.m4a'];

function digest(path: string) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function inspectM4a(path: string) {
  const data = readFileSync(path);
  const audioEntry = data.indexOf(Buffer.from('mp4a'));
  const movieHeader = data.indexOf(Buffer.from('mvhd'));
  expect(audioEntry).toBeGreaterThan(0);
  expect(movieHeader).toBeGreaterThan(0);
  expect(data[movieHeader + 4]).toBe(0);
  const timescale = data.readUInt32BE(movieHeader + 16);
  const duration = data.readUInt32BE(movieHeader + 20) / timescale;
  return {
    channels: data.readUInt16BE(audioEntry + 20),
    duration,
    sampleRate: data.readUInt32BE(audioEntry + 28) / 65_536,
  };
}

describe('focus soundscapes', () => {
  it('ships matching, non-trivial AAC assets for web and mobile', () => {
    for (const asset of assets) {
      const mobilePath = resolve(root, 'mobile/assets/audio', asset);
      const webPath = resolve(root, 'public/audio/focus', asset);
      expect(statSync(mobilePath).size).toBeGreaterThan(1_000_000);
      expect(readFileSync(mobilePath).subarray(4, 8).toString()).toBe('ftyp');
      expect(digest(mobilePath)).toBe(digest(webPath));
      expect(inspectM4a(mobilePath)).toEqual({
        channels: 2,
        duration: 90,
        sampleRate: 48_000,
      });
    }
  });

  it('generates long seamless 48 kHz stereo sources', () => {
    expect(generator).toContain('const sampleRate = 48_000');
    expect(generator).toContain('const durationSeconds = 90');
    expect(generator).toContain('const crossfadeSeconds = 6');
    expect(generator).toContain("buffer.writeUInt16LE(2, 22)");
    expect(generator).toMatch(/'-b:a',\s*'160k'/);
    expect(generator).toContain("mkdtempSync(resolve(tmpdir(), 'mhtoolkit-soundscapes-'))");
    expect(generator).toContain('renameSync(staged, destination)');
    expect(generator).toContain("'stream=codec_name,sample_rate,channels:format=duration'");
  });

  it('crossfades web and native sound changes instead of stopping first', () => {
    expect(webPlayer).toContain('const previous = activeAudioRef.current');
    expect(webPlayer).toContain('fadeAudio(nextAudio');
    expect(webPlayer).toContain('releaseAudio(previous, true)');
    expect(nativePlayer).toContain('const previous = soundRef.current');
    expect(nativePlayer).toContain('void fadeVolume(');
    expect(nativePlayer).toContain(
      'void releaseSound(previous, ownedSoundsRef.current, true)'
    );
    expect(webPlayer).toContain('if (previous) releaseAudio(previous, false)');
    expect(webPlayer).toContain('pendingAudioRef.current.add(nextAudio)');
    expect(webPlayer).toContain('releasePendingAudio()');
    expect(nativePlayer).toContain('releaseAllSounds(false)');
    expect(nativePlayer).toContain('shouldPlay: false');
    expect(nativePlayer).toContain('await nextSound.playAsync()');
    expect(nativePlayer).toContain("AppState.addEventListener('change'");
    expect(nativePlayer).toContain('const resumeActiveSoundscape = useCallback');
    expect(nativePlayer).toContain('void resumeActiveSoundscape()');
    expect(webPlayer).toContain('audio.volume = Math.max(0, Math.min(1, nextVolume))');
  });

  it('keeps the native player mounted during a focus session', () => {
    expect(nativeFocus).toContain('<OptionalSoundscape');
    expect(nativeFocus).toContain('backgroundPlayback');
    expect(nativeFocus).not.toMatch(/!active\s*\?\s*\(\s*<OptionalSoundscape/);
    expect(nativePlayer).toContain('useFocusEffect(');
    expect(nativeFocus).toContain('soundSyncRef.current = soundSyncRef.current');
    expect(nativeFocus).toContain('sessionIdRef.current = data.id as string');
    expect(appConfig.expo.ios.infoPlist.UIBackgroundModes).toContain('audio');
  });
});
