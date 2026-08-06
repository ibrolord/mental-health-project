import { useCallback, useEffect, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import { Feather } from '@expo/vector-icons';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AppCard } from '@/components/AppUI';
import { Colors } from '@/lib/constants';
import { createSoundscapeAudioModeCoordinator } from '@/lib/soundscape-audio-mode';

export type SoundscapeId = 'off' | 'brown_noise' | 'rain' | 'ocean';

const TARGET_VOLUME = 0.2;
const FADE_STEPS = 8;
const FADE_STEP_MS = 55;

const SOUNDSCAPES: {
  id: SoundscapeId;
  label: string;
  detail: string;
  icon: 'volume-x' | 'wind' | 'cloud-rain' | 'activity';
  source?: number;
  volume?: number;
}[] = [
  {
    id: 'off',
    label: 'Quiet',
    detail: 'No added sound',
    icon: 'volume-x',
  },
  {
    id: 'brown_noise',
    label: 'Deep brown noise',
    detail: 'A smooth, low-frequency sound bed',
    icon: 'wind',
    source: require('@/assets/audio/deep-brown.m4a'),
    volume: 0.2,
  },
  {
    id: 'rain',
    label: 'Steady rain',
    detail: 'A spacious rain texture with soft detail',
    icon: 'cloud-rain',
    source: require('@/assets/audio/steady-rain.m4a'),
    volume: 0.18,
  },
  {
    id: 'ocean',
    label: 'Ocean wash',
    detail: 'Slow, layered waves without abrupt peaks',
    icon: 'activity',
    source: require('@/assets/audio/ocean-wash.m4a'),
    volume: 0.22,
  },
];

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function fadeVolume(
  sound: Audio.Sound,
  target: number,
  shouldContinue: () => boolean = () => true
) {
  const status = await sound.getStatusAsync().catch(() => null);
  if (!status?.isLoaded) return;
  const start = status.volume ?? TARGET_VOLUME;
  for (let step = 1; step <= FADE_STEPS; step += 1) {
    if (!shouldContinue()) return;
    const progress = step / FADE_STEPS;
    await sound
      .setVolumeAsync(start + (target - start) * progress)
      .catch(() => undefined);
    if (step < FADE_STEPS) await wait(FADE_STEP_MS);
  }
}

async function releaseSound(
  sound: Audio.Sound,
  ownedSounds: Set<Audio.Sound>,
  fade: boolean
) {
  let unloaded = false;
  let lastError: unknown = null;
  try {
    if (fade) await fadeVolume(sound, 0);
    await sound.stopAsync().catch((error) => {
      lastError = error;
    });
    for (let attempt = 0; attempt < 3 && !unloaded; attempt += 1) {
      try {
        await sound.unloadAsync();
        unloaded = true;
      } catch (error) {
        lastError = error;
        if (attempt < 2) await wait(50 * (attempt + 1));
      }
    }
  } finally {
    if (unloaded) {
      ownedSounds.delete(sound);
    } else {
      console.warn('Unable to fully release optional soundscape:', lastError);
    }
  }
}

const audioModeCoordinator = createSoundscapeAudioModeCoordinator((mode) =>
  Audio.setAudioModeAsync(mode)
);

async function releaseSoundscapeAudio(owner: symbol) {
  await audioModeCoordinator.release(owner).catch((error) => {
    console.warn('Unable to restore the default audio mode:', error);
  });
}

export function OptionalSoundscape({
  title = 'Optional sound',
  compact = false,
  backgroundPlayback = false,
  options = ['off', 'brown_noise', 'rain', 'ocean'],
  onChange,
}: {
  title?: string;
  compact?: boolean;
  backgroundPlayback?: boolean;
  options?: readonly SoundscapeId[];
  onChange?: (soundscape: SoundscapeId) => void;
}) {
  const [selected, setSelected] = useState<SoundscapeId>('off');
  const [error, setError] = useState('');
  const soundRef = useRef<Audio.Sound | null>(null);
  const activeIdRef = useRef<SoundscapeId>('off');
  const ownedSoundsRef = useRef(new Set<Audio.Sound>());
  const retiringSoundsRef = useRef(new Set<Audio.Sound>());
  const requestRef = useRef(0);
  const mountedRef = useRef(true);
  const onChangeRef = useRef(onChange);
  const backgroundPlaybackRef = useRef(backgroundPlayback);
  const audioOwnerRef = useRef(Symbol('optional-soundscape'));
  onChangeRef.current = onChange;
  backgroundPlaybackRef.current = backgroundPlayback;
  const visibleOptions: readonly SoundscapeId[] = options.includes('off')
    ? options
    : ['off', ...options];

  const releaseAllSounds = useCallback((notify = false) => {
    requestRef.current += 1;
    soundRef.current = null;
    activeIdRef.current = 'off';
    const ownedSounds = ownedSoundsRef.current;
    retiringSoundsRef.current.clear();
    for (const sound of [...ownedSounds]) {
      void releaseSound(sound, ownedSounds, false);
    }
    void releaseSoundscapeAudio(audioOwnerRef.current);
    if (notify && mountedRef.current) {
      setSelected('off');
      onChangeRef.current?.('off');
    }
  }, []);

  const resumeActiveSoundscape = useCallback(async () => {
    const sound = soundRef.current;
    const request = requestRef.current;
    if (!sound) return;

    try {
      const status = await sound.getStatusAsync();
      if (
        !mountedRef.current ||
        requestRef.current !== request ||
        soundRef.current !== sound ||
        !status.isLoaded ||
        status.isPlaying
      ) {
        return;
      }
      await sound.playAsync();
    } catch (resumeError) {
      console.warn('Unable to resume optional soundscape:', resumeError);
      if (mountedRef.current && soundRef.current === sound) {
        setError('Sound could not resume. Choose it again to restart.');
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      releaseAllSounds(false);
    };
  }, [releaseAllSounds]);

  useFocusEffect(
    useCallback(() => {
      return () => releaseAllSounds(true);
    }, [releaseAllSounds])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void resumeActiveSoundscape();
        return;
      }
      const ownedSounds = ownedSoundsRef.current;
      for (const sound of [...retiringSoundsRef.current]) {
        retiringSoundsRef.current.delete(sound);
        void releaseSound(sound, ownedSounds, false);
      }
    });
    return () => subscription.remove();
  }, [resumeActiveSoundscape]);

  const choose = async (
    id: SoundscapeId,
    source?: number,
    targetVolume = TARGET_VOLUME
  ) => {
    const request = requestRef.current + 1;
    requestRef.current = request;
    setError('');
    setSelected(id);
    onChangeRef.current?.(id);

    if (!source || id === 'off') {
      releaseAllSounds(false);
      return;
    }

    let nextSound: Audio.Sound | null = null;
    try {
      await audioModeCoordinator.enable(
        audioOwnerRef.current,
        backgroundPlaybackRef.current
      );
      const created = await Audio.Sound.createAsync(source, {
        isLooping: true,
        shouldPlay: false,
        volume: 0,
        progressUpdateIntervalMillis: 1_000,
      });
      nextSound = created.sound;
      ownedSoundsRef.current.add(nextSound);
      if (!mountedRef.current || requestRef.current !== request) {
        await releaseSound(nextSound, ownedSoundsRef.current, false);
        return;
      }

      const previous = soundRef.current;
      const previousId = activeIdRef.current;
      soundRef.current = nextSound;
      activeIdRef.current = id;
      try {
        await nextSound.playAsync();
      } catch (playError) {
        if (soundRef.current === nextSound) {
          soundRef.current = previous;
          activeIdRef.current = previousId;
        }
        throw playError;
      }
      if (
        !mountedRef.current ||
        requestRef.current !== request ||
        soundRef.current !== nextSound
      ) {
        await releaseSound(nextSound, ownedSoundsRef.current, false);
        return;
      }
      void fadeVolume(
        nextSound,
        targetVolume,
        () => mountedRef.current && soundRef.current === nextSound
      );
      if (previous) {
        retiringSoundsRef.current.add(previous);
        void releaseSound(previous, ownedSoundsRef.current, true).finally(() => {
          retiringSoundsRef.current.delete(previous);
        });
      }
    } catch (soundError) {
      if (nextSound) {
        await releaseSound(nextSound, ownedSoundsRef.current, false);
      }
      console.warn('Unable to play optional soundscape:', soundError);
      if (!mountedRef.current || requestRef.current !== request) return;
      const fallback = activeIdRef.current;
      setSelected(fallback);
      onChangeRef.current?.(fallback);
      if (!soundRef.current) {
        void releaseSoundscapeAudio(audioOwnerRef.current);
      }
      setError(
        soundRef.current
          ? 'Sound could not switch. Your current sound is still playing.'
          : 'Sound could not start. You can continue in quiet.'
      );
    }
  };

  return (
    <AppCard quiet style={compact ? styles.compactCard : undefined}>
      <View style={styles.titleRow}>
        <Feather name="headphones" size={17} color={Colors.primary} />
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.options}>
        {SOUNDSCAPES.filter(({ id }) => visibleOptions.includes(id)).map((soundscape) => (
          <Pressable
            key={soundscape.id}
            accessibilityRole="button"
            accessibilityState={{ selected: selected === soundscape.id }}
            onPress={() =>
              void choose(
                soundscape.id,
                soundscape.source,
                soundscape.volume ?? TARGET_VOLUME
              )
            }
            style={({ pressed }) => [
              styles.option,
              selected === soundscape.id && styles.optionSelected,
              pressed && styles.pressed,
            ]}
          >
            <Feather
              name={soundscape.icon}
              size={16}
              color={selected === soundscape.id ? '#fffef8' : Colors.primary}
            />
            <View style={styles.optionCopy}>
              <Text
                style={[
                  styles.optionLabel,
                  selected === soundscape.id && styles.optionTextSelected,
                ]}
              >
                {soundscape.label}
              </Text>
              {!compact ? (
                <Text
                  style={[
                    styles.optionDetail,
                    selected === soundscape.id && styles.optionDetailSelected,
                  ]}
                >
                  {soundscape.detail}
                </Text>
              ) : null}
            </View>
          </Pressable>
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  compactCard: { padding: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  options: { gap: 8, marginTop: 12 },
  option: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    paddingHorizontal: 13,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  optionCopy: { flex: 1 },
  optionLabel: { color: Colors.text, fontSize: 13, fontWeight: '700' },
  optionDetail: { color: Colors.textSecondary, fontSize: 11, marginTop: 2 },
  optionTextSelected: { color: '#fffef8' },
  optionDetailSelected: { color: '#dce9df' },
  error: { color: Colors.danger, fontSize: 12, marginTop: 10 },
  pressed: { opacity: 0.78 },
});
