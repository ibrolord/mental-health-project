import { useEffect, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppCard } from '@/components/AppUI';
import { Colors } from '@/lib/constants';

export type SoundscapeId = 'off' | 'brown_noise' | 'rain' | 'ocean';

const SOUNDSCAPES: {
  id: SoundscapeId;
  label: string;
  detail: string;
  icon: 'volume-x' | 'wind' | 'cloud-rain' | 'activity';
  source?: number;
}[] = [
  {
    id: 'off',
    label: 'Quiet',
    detail: 'No added sound',
    icon: 'volume-x',
  },
  {
    id: 'brown_noise',
    label: 'Low noise',
    detail: 'A soft neutral texture',
    icon: 'wind',
    source: require('@/assets/audio/brown-noise.wav'),
  },
  {
    id: 'rain',
    label: 'Soft rain',
    detail: 'A light rain-like texture',
    icon: 'cloud-rain',
    source: require('@/assets/audio/soft-rain.wav'),
  },
  {
    id: 'ocean',
    label: 'Slow tide',
    detail: 'A slowly swelling texture',
    icon: 'activity',
    source: require('@/assets/audio/slow-tide.wav'),
  },
];

export function OptionalSoundscape({
  title = 'Optional sound',
  compact = false,
  onChange,
}: {
  title?: string;
  compact?: boolean;
  onChange?: (soundscape: SoundscapeId) => void;
}) {
  const [selected, setSelected] = useState<SoundscapeId>('off');
  const [error, setError] = useState('');
  const soundRef = useRef<Audio.Sound | null>(null);
  const requestRef = useRef(0);

  const stop = async () => {
    const sound = soundRef.current;
    soundRef.current = null;
    if (sound) {
      await sound.stopAsync().catch(() => undefined);
      await sound.unloadAsync().catch(() => undefined);
    }
  };

  useEffect(() => {
    return () => {
      requestRef.current += 1;
      void stop();
    };
  }, []);

  const choose = async (id: SoundscapeId, source?: number) => {
    const request = requestRef.current + 1;
    requestRef.current = request;
    setError('');
    await stop();
    if (requestRef.current !== request) return;

    if (!source || id === 'off') {
      setSelected('off');
      onChange?.('off');
      return;
    }

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
      const { sound } = await Audio.Sound.createAsync(source, {
        isLooping: true,
        shouldPlay: true,
        volume: 0.16,
      });
      if (requestRef.current !== request) {
        await sound.unloadAsync();
        return;
      }
      soundRef.current = sound;
      setSelected(id);
      onChange?.(id);
    } catch (soundError) {
      console.warn('Unable to play optional soundscape:', soundError);
      setSelected('off');
      onChange?.('off');
      setError('Sound could not start. You can continue in quiet.');
    }
  };

  return (
    <AppCard quiet style={compact ? styles.compactCard : undefined}>
      <View style={styles.titleRow}>
        <Feather name="headphones" size={17} color={Colors.primary} />
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.options}>
        {SOUNDSCAPES.map((soundscape) => (
          <Pressable
            key={soundscape.id}
            accessibilityRole="button"
            accessibilityState={{ selected: selected === soundscape.id }}
            onPress={() => void choose(soundscape.id, soundscape.source)}
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
