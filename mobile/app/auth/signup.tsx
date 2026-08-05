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
  signupErrorMessage,
  validateAccountEmail,
} from '@/lib/auth-validation';
import { Colors } from '@/lib/constants';
import { SocialAuthButtons } from '@/components/social-auth-buttons';

const MIN_PASSWORD_LENGTH = 8;
type SignupStep = 'email' | 'confirmation' | 'password';

export default function SignupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const {
    accountUpgradePending,
    pendingAccountUpgradeEmail,
    startAccountUpgrade,
    completeAccountUpgrade,
    finishAccountUpgrade,
  } = useAuth();
  const [email, setEmail] = useState(pendingAccountUpgradeEmail ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submissionRef = useRef(false);
  const [step, setStep] = useState<SignupStep>(
    accountUpgradePending ? 'confirmation' : 'email'
  );

  const returnToApp = () =>
    router.dismissTo(params.returnTo === '/partner' ? '/partner' : '/(tabs)');

  const handleSignup = async () => {
    if (submissionRef.current) return;
    const validationError = validateAccountEmail(email);
    if (validationError) {
      setError(validationError);
      return;
    }

    submissionRef.current = true;
    setError('');
    setLoading(true);
    try {
      await startAccountUpgrade(normalizeEmail(email));
      setStep('confirmation');
    } catch (signupError) {
      setError(signupErrorMessage(signupError));
    } finally {
      submissionRef.current = false;
      setLoading(false);
    }
  };

  const finishUpgrade = async () => {
    if (submissionRef.current) return;
    submissionRef.current = true;
    setError('');
    setLoading(true);
    try {
      const status = await completeAccountUpgrade();
      if (status === 'password-required') {
        setStep('password');
      } else {
        returnToApp();
      }
    } catch (upgradeError) {
      setError(upgradeError instanceof Error ? upgradeError.message : 'Account setup is not complete yet.');
    } finally {
      submissionRef.current = false;
      setLoading(false);
    }
  };

  const savePassword = async () => {
    if (submissionRef.current) return;
    setError('');
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError('Those passwords do not match.');
      return;
    }

    submissionRef.current = true;
    setLoading(true);
    try {
      await finishAccountUpgrade(password);
      setPassword('');
      setConfirmPassword('');
      returnToApp();
    } catch (passwordError) {
      setError(
        passwordError instanceof Error
          ? passwordError.message
          : 'Could not create your password.'
      );
    } finally {
      submissionRef.current = false;
      setLoading(false);
    }
  };

  if (step === 'confirmation') {
    return (
      <View style={s.confirmationContainer}>
        <Text style={s.confirmationIcon}>✉️</Text>
        <Text style={s.title}>Check your email</Text>
        <Text style={s.confirmationText}>
          Open the link sent to <Text style={s.email}>{normalizeEmail(email)}</Text>.
          When your email is confirmed, return here to create your password.
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
          <Text style={s.btnText}>{loading ? 'Checking...' : 'I Confirmed My Email'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.linkButton} onPress={returnToApp}>
          <Text style={s.link}>Continue anonymously for now</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (step === 'password') {
    return (
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={s.flex}
          contentContainerStyle={s.container}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={s.title}>Create your password</Text>
          <Text style={s.subtitle}>
            Your email is confirmed. Finish setup without leaving the app.
          </Text>
          {error ? (
            <View style={s.errorBox} accessibilityRole="alert">
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}
          <Text style={s.label}>Password</Text>
          <TextInput
            style={s.input}
            value={password}
            onChangeText={setPassword}
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            placeholderTextColor={Colors.textSecondary}
            secureTextEntry
            textContentType="newPassword"
            autoComplete="new-password"
          />
          <Text style={s.label}>Confirm password</Text>
          <TextInput
            style={s.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Type it again"
            placeholderTextColor={Colors.textSecondary}
            secureTextEntry
            textContentType="newPassword"
            autoComplete="new-password"
            onSubmitEditing={() => void savePassword()}
          />
          <TouchableOpacity
            style={[s.btn, loading && s.disabled]}
            onPress={() => void savePassword()}
            disabled={loading}
            accessibilityRole="button"
          >
            <Text style={s.btnText}>
              {loading ? 'Finishing setup...' : 'Finish Account Setup'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
          We will email a secure confirmation link. Return here afterwards to create your password.
        </Text>

        <TouchableOpacity
          style={[s.btn, loading && s.disabled]}
          onPress={handleSignup}
          disabled={loading}
          accessibilityRole="button"
        >
          <Text style={s.btnText}>{loading ? 'Sending confirmation...' : 'Continue with Email'}</Text>
        </TouchableOpacity>

        <SocialAuthButtons intent="upgrade" onComplete={returnToApp} />

        <TouchableOpacity
          style={s.linkButton}
          onPress={() =>
            router.replace({
              pathname: '/auth/login',
              params: params.returnTo === '/partner' ? { returnTo: '/partner' } : {},
            })
          }
        >
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
