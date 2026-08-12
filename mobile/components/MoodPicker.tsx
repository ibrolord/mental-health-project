import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/lib/constants';
import type { MoodEmoji } from '@/lib/types';

export const MOOD_CHOICES: {
  emoji: MoodEmoji;
  label: string;
  tint: string;
}[] = [
  {
    emoji: '\u{1F604}',
    label: 'Great',
    tint: '#e4f3e8',
  },
  {
    emoji: '\u{1F642}',
    label: 'Good',
    tint: '#edf3df',
  },
  {
    emoji: '\u{1F610}',
    label: 'Okay',
    tint: '#f5efda',
  },
  {
    emoji: '\u{1F61E}',
    label: 'Low',
    tint: '#f8e9df',
  },
  {
    emoji: '\u{1F622}',
    label: 'Very low',
    tint: '#f7e4e2',
  },
];

export function getMoodLabel(mood: MoodEmoji): string {
  return MOOD_CHOICES.find((item) => item.emoji === mood)?.label ?? 'Mood';
}

export function MoodGlyph({ mood, size = 28 }: { mood: MoodEmoji; size?: number }) {
  const choice = MOOD_CHOICES.find((item) => item.emoji === mood) ?? MOOD_CHOICES[2];

  return (
    <Text
      accessible={false}
      maxFontSizeMultiplier={1.2}
      style={{ fontSize: size, lineHeight: Math.ceil(size * 1.25) }}
    >
      {choice.emoji}
    </Text>
  );
}

export function MoodPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: MoodEmoji | null;
  onChange: (mood: MoodEmoji) => void;
  disabled?: boolean;
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Choose how you feel"
      style={styles.row}
    >
      {MOOD_CHOICES.map((choice) => {
        const selected = value === choice.emoji;
        return (
          <Pressable
            key={choice.emoji}
            accessibilityRole="radio"
            accessibilityLabel={`${choice.label} mood`}
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(choice.emoji)}
            style={({ pressed }) => [
              styles.choice,
              { backgroundColor: selected ? choice.tint : 'transparent' },
              selected && styles.choiceSelected,
              disabled && styles.disabled,
              pressed && !disabled && styles.pressed,
            ]}
          >
            <View style={[styles.glyph, selected && styles.glyphSelected]}>
              <MoodGlyph mood={choice.emoji} size={28} />
            </View>
            <Text style={[styles.label, selected && styles.labelSelected]}>
              {choice.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 2,
    borderRadius: 28,
    backgroundColor: Colors.surfaceMuted,
    padding: 4,
  },
  choice: {
    minWidth: 0,
    minHeight: 64,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 24,
    paddingHorizontal: 2,
    paddingVertical: 8,
  },
  choiceSelected: {
    borderColor: Colors.primary,
    shadowOpacity: 0,
    elevation: 0,
  },
  glyph: {
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphSelected: {
    transform: [{ scale: 1.08 }],
  },
  label: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  labelSelected: {
    color: Colors.text,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.46,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
});
