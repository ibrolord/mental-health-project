import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { Colors } from '@/lib/constants';

export default function SignupScreen() {
  const router = useRouter();
  const { isAnonymous, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSignup = async () => {
    if (!email.trim() || password.length < 8) {
      Alert.alert('Check your details', 'Enter a valid email and a password with at least 8 characters.');
      return;
    }
    if (password !== confirmation) {
      Alert.alert('Check your password', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await signUp(email.trim(), password);
      setSent(true);
    } catch (cause) {
      Alert.alert('Account setup did not complete', cause instanceof Error ? cause.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {sent ? (
          <View accessibilityLiveRegion="polite">
            <Text style={s.title}>Check your email</Text>
            <Text style={s.subtitle}>Verify {email}, then return to MHtoolkit{isAnonymous ? ' to create your password' : ' and sign in'}. Your current data stays with this profile.</Text>
            {!isAnonymous ? (
              <TouchableOpacity accessibilityRole="button" style={s.button} onPress={() => router.replace('/auth/login')}>
                <Text style={s.buttonText}>Back to sign in</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <View>
            <Text style={s.title}>Keep your progress</Text>
            <Text style={s.subtitle}>Add a verified email to use Together and sync across devices.</Text>
            <Text style={s.label}>Email</Text>
            <TextInput style={s.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="you@example.com" placeholderTextColor={Colors.textSecondary} />
            <Text style={s.label}>Password</Text>
            <TextInput style={s.input} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" placeholder="At least 8 characters" placeholderTextColor={Colors.textSecondary} />
            <Text style={s.label}>Confirm password</Text>
            <TextInput style={s.input} value={confirmation} onChangeText={setConfirmation} secureTextEntry autoComplete="new-password" placeholder="Enter it again" placeholderTextColor={Colors.textSecondary} />
            <TouchableOpacity accessibilityRole="button" style={[s.button, loading && s.disabled]} disabled={loading} onPress={handleSignup}>
              <Text style={s.buttonText}>{loading ? 'Setting up account...' : 'Create account'}</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="link" style={s.linkButton} onPress={() => router.replace('/auth/login')}>
              <Text style={s.link}>Already registered? Sign in</Text>
            </TouchableOpacity>
          </View>
        )}
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
  button: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  disabled: { opacity: 0.55 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  linkButton: { paddingVertical: 18 },
  link: { color: Colors.primary, textAlign: 'center', fontSize: 15, fontWeight: '600' },
});
