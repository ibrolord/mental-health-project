import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Colors } from '@/lib/constants';
import { supabase } from '@/lib/supabase';

export default function CompleteSignupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const code = Array.isArray(params.code) ? params.code[0] : params.code;
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user?.email_confirmed_at || data.user.is_anonymous) {
          throw new Error('Open the latest verification link from your email to continue.');
        }
        if (active) setReady(true);
      } catch (cause) {
        Alert.alert('Verification required', cause instanceof Error ? cause.message : 'Please open the verification link again.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [code]);

  const finish = async () => {
    if (password.length < 8 || password !== confirmation) {
      Alert.alert('Check your password', password.length < 8 ? 'Use at least 8 characters.' : 'Passwords do not match.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return Alert.alert('Password not saved', error.message);
    router.replace('/accountability');
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>Create your password</Text>
        <Text style={s.subtitle}>Your verified profile and existing MHtoolkit data stay together.</Text>
        <Text style={s.label}>Password</Text>
        <TextInput accessibilityLabel="Password" style={s.input} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" editable={ready && !loading} />
        <Text style={s.label}>Confirm password</Text>
        <TextInput accessibilityLabel="Confirm password" style={s.input} value={confirmation} onChangeText={setConfirmation} secureTextEntry autoComplete="new-password" editable={ready && !loading} />
        <TouchableOpacity accessibilityRole="button" style={[s.button, (!ready || loading) && s.disabled]} disabled={!ready || loading} onPress={() => void finish()}>
          <Text style={s.buttonText}>{loading ? 'Checking verification…' : 'Finish account setup'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.text, marginBottom: 6 },
  subtitle: { fontSize: 16, lineHeight: 23, color: Colors.textSecondary, marginBottom: 28 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  input: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 16, color: Colors.text },
  button: { backgroundColor: Colors.primary, borderRadius: 12, minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  disabled: { opacity: 0.55 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
