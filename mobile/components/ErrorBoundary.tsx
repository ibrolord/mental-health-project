import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { recordOperationalEvent } from '../lib/observability';
import { Colors } from '../lib/constants';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch() {
    void recordOperationalEvent('render_error');
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.icon}>
            <Feather name="refresh-cw" size={24} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            This screen could not load. Your saved information has not changed.
          </Text>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            onPress={() => this.setState({ hasError: false })}
          >
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: Colors.background,
  },
  icon: {
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    marginBottom: 16,
    width: 48,
  },
  title: { fontSize: 22, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  message: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  button: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  pressed: { opacity: 0.78 },
  buttonText: { color: Colors.card, fontSize: 15, fontWeight: '700' },
});
