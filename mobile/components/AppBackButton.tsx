import { Feather } from '@expo/vector-icons';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { Colors } from '@/lib/constants';
import { goBackOrReplace } from '@/lib/navigation';

export function AppBackButton({
  fallback,
  alwaysUseFallback = false,
}: {
  fallback: Href;
  alwaysUseFallback?: boolean;
}) {
  const router = useRouter();

  return (
    <Pressable
      accessibilityHint="Returns to the previous screen"
      accessibilityLabel="Back"
      accessibilityRole="button"
      hitSlop={10}
      onPress={() =>
        alwaysUseFallback
          ? router.replace(fallback)
          : goBackOrReplace(router, fallback)
      }
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Feather color={Colors.primary} name="chevron-left" size={24} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginLeft: -8,
    minHeight: 44,
    minWidth: 44,
  },
  pressed: {
    opacity: 0.55,
  },
});
