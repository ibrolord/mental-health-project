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
import {
  normalizeEmail,
  signupErrorMessage,
  validateAccountEmail,
} from '@/lib/auth-validation';
import { Colors } from '@/lib/constants';

export default function SignupScreen() {
  const router = useRouter();
  const {
    accountUpgradePending,
    pendingAccountUpgradeEmail,
    startAccountUpgrade,
    completeAccountUpgrade,
  } = useAuth();
  const [email, setEmail] = useState(pendingAccountUpgradeEmail ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(accountUpgradePending);

  const returnToApp = () => router.dismissTo('/(tabs)');

  const handleSignup = async () => {
    const validationError = validateAccountEmail(email);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setLoading(true);
    try {
      await startAccountUpgrade(normalizeEmail(email));
      setAwaitingConfirmation(true);
    } catch (signupError) {
      setError(signupErrorMessage(signupError));
    } finally {
      setLoading(false);
    }
  };

  const finishUpgrade = async () => {
    setError('');
    setLoading(true);
    try {
      await completeAccountUpgrade();
      returnToApp();
    } catch (upgradeError) {
      setError(upgradeError instanceof Error ? upgradeError.message : 'Account setup is not complete yet.');
    } finally {
      setLoading(false);
    }
  };

  if (awaitingConfirmation) {
    return (
      <View style={s.confirmationContainer}>
        <Text style={s.confirmationIcon}>✉️</Text>
        <Text style={s.title}>Check your email</Text>
        <Text style={s.confirmationText}>
          Open the link sent to <Text style={s.email}>{normalizeEmail(email)}</Text>.
          Your browser will ask you to create a password. When it says your account is ready,
          return here.
        </Text>
        {error ? (
          <View style={s.errorBox} accessibilityRole="alert">
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}
        <TouchableOpacity
          style={[s.btn, loading && s.disabled]}
          onPress={finishUpgrade}
          disabled={loading}
        >
          <Text style={s.btnText}>{loading ? 'Checking...' : 'I Finished Setup in Browser'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.linkButton} onPress={() => router.replace('/auth/login')}>
          <Text style={s.link}>Sign in instead</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.linkButton} onPress={returnToApp}>
          <Text style={s.link}>Continue anonymously for now</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
        <Text style={s.title}>Create an account</Text>
        <Text style={s.subtitle}>
          Add an email and password without losing anything saved in this anonymous profile.
        </Text>

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
          onSubmitEditing={handleSignup}
        />

        <Text style={s.helper}>
          We will email a secure confirmation link. You will create your password in the browser,
          then return to the app.
        </Text>

        <TouchableOpacity
          style={[s.btn, loading && s.disabled]}
          onPress={handleSignup}
          disabled={loading}
          accessibilityRole="button"
        >
          <Text style={s.btnText}>{loading ? 'Sending confirmation...' : 'Continue with Email'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.linkButton} onPress={() => router.replace('/auth/login')}>
          <Text style={s.link}>Already have an account? Sign in</Text>
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
  confirmationContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 24,
    justifyContent: 'center',
  },
  confirmationIcon: { fontSize: 42, textAlign: 'center', marginBottom: 14 },
  confirmationText: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  email: { color: Colors.text, fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '700', color: Colors.text, marginBottom: 6, textAlign: 'center' },
  subtitle: { fontSize: 16, lineHeight: 23, color: Colors.textSecondary, marginBottom: 24, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 10,
    color: Colors.text,
  },
  helper: { fontSize: 13, lineHeight: 19, color: Colors.textSecondary, marginBottom: 16 },
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
