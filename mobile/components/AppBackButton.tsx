import { Feather } from '@expo/vector-icons';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Colors } from '@/lib/constants';
import { goBackOrReplace } from '@/lib/navigation';

export function AppBackButton({ fallback }: { fallback: Href }) {
  const router = useRouter();

  return (
    <Pressable
      accessibilityHint="Returns to the previous screen"
      accessibilityLabel="Back"
      accessibilityRole="button"
      hitSlop={10}
      onPress={() => goBackOrReplace(router, fallback)}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Feather color={Colors.primary} name="chevron-left" size={24} />
      <Text style={styles.label}>Back</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    flexDirection: 'row',
    marginLeft: -6,
    minHeight: 44,
  },
  label: {
    color: Colors.primary,
    flexShrink: 1,
    fontSize: 17,
  },
  pressed: {
    opacity: 0.55,
  },
});
