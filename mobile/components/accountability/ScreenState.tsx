import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '@/lib/constants';

interface ScreenStateProps {
  kind: 'loading' | 'empty' | 'error';
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function ScreenState({ kind, title, message, actionLabel, onAction }: ScreenStateProps) {
  return (
    <View style={styles.container} accessibilityRole={kind === 'error' ? 'alert' : undefined} accessibilityLiveRegion={kind === 'loading' ? 'polite' : undefined} accessibilityLabel={kind === 'loading' ? `${title}. ${message}` : undefined}>
      {kind === 'loading' ? <ActivityIndicator color={Colors.primary} size="large" /> : null}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={styles.button}
          onPress={onAction}
        >
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingHorizontal: 28, paddingVertical: 48 },
  title: { color: Colors.text, fontSize: 18, fontWeight: '700', marginTop: 14, textAlign: 'center' },
  message: { color: Colors.textSecondary, fontSize: 15, lineHeight: 22, marginTop: 8, textAlign: 'center' },
  button: { backgroundColor: Colors.primary, borderRadius: 12, marginTop: 18, paddingHorizontal: 18, paddingVertical: 12 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
