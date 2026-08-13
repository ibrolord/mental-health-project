import { useRef, useState } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import {
  normalizeEmail,
  validateAccountEmail,
} from '@/lib/auth-validation';
import { Colors } from '@/lib/constants';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; returnTo?: string }>();
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState(params.email ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const submissionRef = useRef(false);
  const returnTo =
    params.returnTo === '/partner' || params.returnTo === '/accountability'
      ? params.returnTo
      : '/(tabs)';

  const sendReset = async () => {
    if (submissionRef.current) return;
    const validationError = validateAccountEmail(email);
    if (validationError) {
      setError(validationError);
      return;
    }

    submissionRef.current = true;
    setLoading(true);
    setError('');
    try {
      await requestPasswordReset(normalizeEmail(email));
      setSent(true);
    } catch (resetError) {
      const message = resetError instanceof Error ? resetError.message : '';
      setError(
        /rate limit/i.test(message)
          ? 'Too many reset emails were requested. Wait a few minutes, then try again.'
          : 'The reset email could not be sent. Check your connection and try again.'
      );
    } finally {
      submissionRef.current = false;
      setLoading(false);
    }
  };

  const goToLogin = () =>
    router.replace({
      pathname: '/auth/login',
      params: {
        email: normalizeEmail(email),
        ...(returnTo === '/(tabs)' ? {} : { returnTo }),
      },
    });

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
        <Text style={s.title}>Reset your password</Text>
        <Text style={s.subtitle}>
          We will email a secure link to choose a new password.
        </Text>

        {sent ? (
          <View style={s.successBox} accessibilityRole="alert">
            <Text style={s.successTitle}>Check your email</Text>
            <Text style={s.successText}>
              If an account exists for {normalizeEmail(email)}, a reset link is on its way.
            </Text>
          </View>
        ) : null}
        {error ? (
          <View style={s.errorBox} accessibilityRole="alert">
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        <Text style={s.label}>Email</Text>
        <TextInput
          style={s.input}
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setSent(false);
          }}
          placeholder="you@example.com"
          placeholderTextColor={Colors.textSecondary}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={() => void sendReset()}
          accessibilityLabel="Email"
        />

        <TouchableOpacity
          style={[s.btn, loading && s.disabled]}
          onPress={() => void sendReset()}
          disabled={loading}
          accessibilityRole="button"
        >
          <Text style={s.btnText}>
            {loading ? 'Sending...' : sent ? 'Send Again' : 'Send Reset Link'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.linkButton}
          onPress={goToLogin}
          accessibilityRole="button"
        >
          <Text style={s.link}>Back to sign in</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  subtitle: { fontSize: 16, color: Colors.textSecondary, lineHeight: 23, marginBottom: 28, marginTop: 8, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  input: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 16, color: Colors.text },
  btn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  disabled: { opacity: 0.55 },
  btnText: { color: '#ffffff', fontWeight: '600', fontSize: 16 },
  linkButton: { minHeight: 44, justifyContent: 'center', paddingVertical: 12 },
  link: { color: Colors.primary, textAlign: 'center', fontSize: 15, fontWeight: '600' },
  successBox: { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#6ee7b7', borderRadius: 12, padding: 14, marginBottom: 18 },
  successTitle: { color: '#064e3b', fontSize: 15, fontWeight: '700' },
  successText: { color: '#064e3b', fontSize: 14, lineHeight: 20, marginTop: 3 },
  errorBox: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 12, padding: 12, marginBottom: 18 },
  errorText: { color: '#991b1b', fontSize: 14, lineHeight: 20 },
});
