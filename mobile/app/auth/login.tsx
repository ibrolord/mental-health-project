import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { normalizeEmail } from '@/lib/auth-validation';
import { Colors } from '@/lib/constants';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const returnToApp = () => router.dismissTo('/(tabs)');

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await signIn(normalizeEmail(email), password);
      returnToApp();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Failed to sign in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <ScrollView
        style={s.flex}
        contentContainerStyle={s.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.title}>Welcome back</Text>
        <Text style={s.subtitle}>Sign in to sync your MHtoolkit data.</Text>

        {error ? (
          <View style={s.errorBox} accessibilityRole="alert">
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        <Text style={s.label}>Email</Text>
        <TextInput
          style={s.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={Colors.textSecondary}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={s.label}>Password</Text>
        <TextInput
          style={s.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Your password"
          placeholderTextColor={Colors.textSecondary}
          textContentType="password"
          autoComplete="current-password"
          secureTextEntry
          onSubmitEditing={handleLogin}
        />

        <TouchableOpacity
          style={[s.btn, loading && s.disabled]}
          onPress={handleLogin}
          disabled={loading}
          accessibilityRole="button"
        >
          <Text style={s.btnText}>{loading ? 'Signing in...' : 'Sign In'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.linkButton} onPress={() => router.replace('/auth/signup')}>
          <Text style={s.link}>New to MHtoolkit? Create an account</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.linkButton} onPress={returnToApp}>
          <Text style={s.link}>Continue anonymously</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: Colors.text, marginBottom: 6, textAlign: 'center' },
  subtitle: { fontSize: 16, color: Colors.textSecondary, marginBottom: 28, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
    color: Colors.text,
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
  },
  errorText: { color: '#991b1b', fontSize: 14, lineHeight: 20 },
  btn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  disabled: { opacity: 0.55 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  linkButton: { paddingVertical: 10, marginTop: 4 },
  link: { color: Colors.primary, textAlign: 'center', fontSize: 15, fontWeight: '500' },
});
