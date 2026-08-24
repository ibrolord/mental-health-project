import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  AppState,
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
import { useAuth, type SocialAuthProvider } from '@/lib/auth-context';
import {
  isExistingAccountError,
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
    resendAccountUpgrade,
    completeAccountUpgrade,
    finishAccountUpgrade,
  } = useAuth();
  const [email, setEmail] = useState(pendingAccountUpgradeEmail ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [linkedIdentityProvider, setLinkedIdentityProvider] =
    useState<SocialAuthProvider | null>(null);
  const [existingEmailAccount, setExistingEmailAccount] = useState(false);
  const submissionRef = useRef(false);
  const [step, setStep] = useState<SignupStep>(
    accountUpgradePending ? 'confirmation' : 'email'
  );
  const [resendSeconds, setResendSeconds] = useState(accountUpgradePending ? 0 : 60);

  const returnTo =
    params.returnTo === '/partner' || params.returnTo === '/accountability'
      ? params.returnTo
      : '/(tabs)';
  const returnToApp = () => router.dismissTo(returnTo);

  const handleSignup = async () => {
    if (submissionRef.current) return;
    const validationError = validateAccountEmail(email);
    if (validationError) {
      setError(validationError);
      return;
    }

    submissionRef.current = true;
    setError('');
    setExistingEmailAccount(false);
    setLoading(true);
    try {
      await startAccountUpgrade(normalizeEmail(email));
      setResendSeconds(60);
      setStep('confirmation');
    } catch (signupError) {
      setExistingEmailAccount(isExistingAccountError(signupError));
      setError(signupErrorMessage(signupError));
    } finally {
      submissionRef.current = false;
      setLoading(false);
    }
  };

  const finishUpgrade = async (silent = false) => {
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
      if (!silent) {
        setError(upgradeError instanceof Error ? upgradeError.message : 'Account setup is not complete yet.');
      }
    } finally {
      submissionRef.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    if (step !== 'confirmation' || resendSeconds <= 0) return;
    const timer = setInterval(() => {
      setResendSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendSeconds, step]);

  useEffect(() => {
    if (step !== 'confirmation') return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void finishUpgrade(true);
    });
    return () => subscription.remove();
    // The handler intentionally uses the latest account-upgrade closure for this step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const resendConfirmation = async () => {
    if (submissionRef.current || resendSeconds > 0) return;
    submissionRef.current = true;
    setLoading(true);
    setError('');
    try {
      await resendAccountUpgrade(normalizeEmail(email));
      setResendSeconds(60);
      AccessibilityInfo.announceForAccessibility('Confirmation email resent.');
    } catch (resendError) {
      setError(signupErrorMessage(resendError));
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
      <ScrollView style={s.flex} contentContainerStyle={s.confirmationContainer}>
        <Text accessible={false} importantForAccessibility="no" style={s.confirmationIcon}>✉️</Text>
        <Text accessibilityRole="header" style={s.title}>Check your email</Text>
        <Text style={s.confirmationText}>
          We sent a link to <Text style={s.email}>{normalizeEmail(email)}</Text>.
          Open it, then come back here.
        </Text>
        {error ? (
          <View style={s.errorBox} accessibilityRole="alert">
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ disabled: loading, busy: loading }}
          style={[s.btn, loading && s.disabled]}
          onPress={() => void finishUpgrade()}
          disabled={loading}
        >
          <Text style={s.btnText}>{loading ? 'Checking…' : 'Continue'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ disabled: loading || resendSeconds > 0 }}
          style={s.linkButton}
          onPress={() => void resendConfirmation()}
          disabled={loading || resendSeconds > 0}
        >
          <Text style={[s.link, (loading || resendSeconds > 0) && s.linkDisabled]}>
            {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : 'Resend email'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          style={s.linkButton}
          onPress={() => {
            setError('');
            setStep('email');
          }}
        >
          <Text style={s.link}>Use a different email</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" style={s.linkButton} onPress={returnToApp}>
          <Text style={s.link}>Continue without an account</Text>
        </TouchableOpacity>
      </ScrollView>
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

        {error && !existingEmailAccount ? (
          <View style={s.errorBox} accessibilityRole="alert">
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        {linkedIdentityProvider || existingEmailAccount ? (
          <View style={s.recoveryBox} accessibilityRole="alert">
            <Text style={s.recoveryTitle}>This account already exists</Text>
            <Text style={s.recoveryText}>
              {linkedIdentityProvider
                ? `Sign in with ${linkedIdentityProvider === 'google' ? 'Google' : 'Apple'} instead.`
                : 'Sign in with this email instead.'}{' '}
              Any anonymous activity stays separate until you choose what to do
              with it on the sign-in screen.
            </Text>
            <TouchableOpacity
              style={s.recoveryButton}
              onPress={() =>
                router.replace({
                  pathname: '/auth/login',
                  params: {
                    email: normalizeEmail(email),
                    reason: 'existing-account',
                    ...(linkedIdentityProvider ? { provider: linkedIdentityProvider } : {}),
                    ...(returnTo === '/(tabs)' ? {} : { returnTo }),
                  },
                })
              }
              accessibilityRole="button"
            >
              <Text style={s.recoveryButtonText}>Sign In to Existing Account</Text>
            </TouchableOpacity>
            {existingEmailAccount ? (
              <TouchableOpacity
                style={s.recoveryLinkButton}
                onPress={() =>
                  router.push({
                    pathname: '/auth/forgot-password',
                    params: {
                      email: normalizeEmail(email),
                      ...(returnTo === '/(tabs)' ? {} : { returnTo }),
                    },
                  })
                }
                accessibilityRole="button"
              >
                <Text style={s.recoveryLink}>Reset Password</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <Text style={s.label}>Email</Text>
        <TextInput
          style={s.input}
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setExistingEmailAccount(false);
            setLinkedIdentityProvider(null);
            setError('');
          }}
          placeholder="you@example.com"
          placeholderTextColor={Colors.textSecondary}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={handleSignup}
          accessibilityLabel="Email"
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

        <SocialAuthButtons
          intent="upgrade"
          onComplete={returnToApp}
          onIdentityAlreadyLinked={(provider) => {
            setError('');
            setExistingEmailAccount(false);
            setLinkedIdentityProvider(provider);
          }}
        />

        <TouchableOpacity
          style={s.linkButton}
          onPress={() =>
            router.replace({
              pathname: '/auth/login',
              params: returnTo === '/(tabs)' ? {} : { returnTo },
            })
          }
        >
          <Text style={s.link}>Already have an account? Sign in</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.linkButton} onPress={returnToApp}>
          <Text style={s.link}>Continue without an account</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  confirmationContainer: {
    flexGrow: 1,
    backgroundColor: Colors.background,
    padding: 24,
    paddingTop: 72,
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
  recoveryBox: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#93c5fd',
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
  },
  recoveryTitle: { color: '#0c4a6e', fontSize: 15, fontWeight: '700' },
  recoveryText: { color: '#0c4a6e', fontSize: 14, lineHeight: 20, marginTop: 4 },
  recoveryButton: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    borderRadius: 999,
    marginTop: 12,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  recoveryButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  recoveryLinkButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 11,
  },
  recoveryLink: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
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
  linkDisabled: { color: Colors.textSecondary },
});
