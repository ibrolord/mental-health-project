import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/lib/constants';
import { accountabilityClient } from '@/lib/accountability/runtime';

export default function JoinTogetherScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      await accountabilityClient.joinConnection({ inviteToken: code });
      Alert.alert('Connected', 'You can now support each other through explicitly shared commitments.');
      router.back();
    } catch (error) {
      Alert.alert('Could not join', error instanceof Error ? error.message : 'Check the code and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Join your partner</Text>
          <Text style={styles.body}>Paste the private invite code they shared with you. A code only connects Together; it does not grant access to moods, chats, assessments, goals, or reflections.</Text>
          <Text style={styles.label}>Invite code</Text>
          <TextInput
            accessibilityLabel="Invite code"
            accessibilityHint="Paste the private code from your accountability partner"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Paste invite code"
            placeholderTextColor={Colors.textSecondary}
            returnKeyType="go"
            style={styles.input}
            value={code}
            onChangeText={setCode}
            onSubmitEditing={() => void submit()}
          />
          <TouchableOpacity accessibilityRole="button" disabled={submitting || !code.trim()} style={[styles.button, (submitting || !code.trim()) && styles.disabled]} onPress={() => void submit()}>
            <Text style={styles.buttonText}>{submitting ? 'Joining…' : 'Join Together'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: Colors.background, flex: 1 },
  content: { padding: 20 },
  title: { color: Colors.text, fontSize: 24, fontWeight: '700' },
  body: { color: Colors.textSecondary, fontSize: 15, lineHeight: 22, marginBottom: 28, marginTop: 8 },
  label: { color: Colors.text, fontSize: 14, fontWeight: '600', marginBottom: 7 },
  input: { backgroundColor: Colors.card, borderColor: Colors.border, borderRadius: 12, borderWidth: 1, color: Colors.text, fontSize: 16, padding: 14 },
  button: { alignItems: 'center', backgroundColor: Colors.primary, borderRadius: 12, marginTop: 18, paddingVertical: 15 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.45 },
});
