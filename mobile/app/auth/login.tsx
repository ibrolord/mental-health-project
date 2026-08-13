import { useRef, useState } from 'react';
import {
  Alert,
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
import Feather from '@expo/vector-icons/Feather';
import {
  getAnonymousProfileDataConflictUserId,
  isAnonymousProfileDataConflict,
  useAuth,
  type SocialAuthProvider,
} from '@/lib/auth-context';
import { normalizeEmail, signInErrorMessage } from '@/lib/auth-validation';
import { Colors } from '@/lib/constants';
import { SocialAuthButtons } from '@/components/social-auth-buttons';

type BlockedAttempt = (
  | { kind: 'password' }
  | { kind: 'provider'; provider: SocialAuthProvider }
) & { anonymousUserId: string };

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    returnTo?: string;
    email?: string;
    reason?: string;
    provider?: SocialAuthProvider;
    reset?: string;
  }>();
  const { continueWithProvider, discardAnonymousProfile, signIn } = useAuth();
  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [blockedAttempt, setBlockedAttempt] = useState<BlockedAttempt | null>(null);
  const [anonymousDataDeleted, setAnonymousDataDeleted] = useState(false);
  const submissionRef = useRef(false);
  const returnTo =
    params.returnTo === '/partner' || params.returnTo === '/accountability'
      ? params.returnTo
      : '/(tabs)';
  const returnToApp = () => router.dismissTo(returnTo);

  const handleLogin = async () => {
    if (submissionRef.current || blockedAttempt) return;
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    submissionRef.current = true;
    setError('');
    setLoading(true);
    try {
      await signIn(normalizeEmail(email), password);
      returnToApp();
    } catch (loginError) {
      const anonymousUserId = getAnonymousProfileDataConflictUserId(loginError);
      if (anonymousUserId && isAnonymousProfileDataConflict(loginError)) {
        setAnonymousDataDeleted(false);
        setBlockedAttempt({ kind: 'password', anonymousUserId });
      } else {
        setError(signInErrorMessage(loginError));
      }
    } finally {
      submissionRef.current = false;
      setLoading(false);
    }
  };

  const discardAndContinue = async () => {
    if (!blockedAttempt || submissionRef.current) return;
    submissionRef.current = true;
    setError('');
    setLoading(true);
    try {
      const attempt = blockedAttempt;
      await discardAnonymousProfile(attempt.anonymousUserId);
      setBlockedAttempt(null);
      setAnonymousDataDeleted(true);
      if (attempt.kind === 'password') {
        await signIn(normalizeEmail(email), password);
        returnToApp();
      } else {
        const completed = await continueWithProvider(
          attempt.provider,
          'sign-in'
        );
        if (completed) {
          returnToApp();
        } else {
          setError('Sign-in was canceled. You can try again.');
        }
      }
    } catch (signInError) {
      setError(
        signInError instanceof Error
          ? signInError.message
          : 'Could not finish signing in.'
      );
    } finally {
      submissionRef.current = false;
      setLoading(false);
    }
  };

  const confirmDiscard = () => {
    Alert.alert(
      'Delete anonymous data?',
      'This permanently deletes the activity saved in this anonymous profile, then continues signing in. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete and Sign In',
          style: 'destructive',
          onPress: () => void discardAndContinue(),
        },
      ]
    );
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
        <Text style={s.subtitle}>Sign in to your MHtoolkit account.</Text>

        {params.reason === 'existing-account' ? (
          <View style={s.noticeBox} accessibilityRole="alert">
            <Text style={s.noticeTitle}>This account already exists</Text>
            <Text style={s.noticeText}>
              {params.provider === 'apple'
                ? 'Use Sign in with Apple below.'
                : params.provider === 'google'
                  ? 'Use Sign in with Google below.'
                  : 'Enter your password, or reset it if you created the account with Apple or Google.'}
            </Text>
          </View>
        ) : null}

        {params.reset === 'complete' ? (
          <View style={s.successBox} accessibilityRole="alert">
            <Text style={s.successText}>Password updated. You can sign in now.</Text>
          </View>
        ) : null}

        {blockedAttempt ? (
          <View style={s.choiceBox} accessibilityRole="alert">
            <Text style={s.choiceTitle}>This profile has saved activity</Text>
            <Text style={s.choiceText}>
              This anonymous activity cannot be merged automatically into an
              existing account. Keep using this profile, or delete it before
              signing in.
            </Text>
            <TouchableOpacity
              style={s.keepButton}
              onPress={returnToApp}
              accessibilityRole="button"
            >
              <Text style={s.keepButtonText}>Keep Data and Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.deleteButton}
              onPress={confirmDiscard}
              disabled={loading}
              accessibilityRole="button"
            >
              <Text style={s.deleteButtonText}>
                {loading ? 'Deleting Data...' : 'Delete Data and Sign In'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {error ? (
          <View style={s.errorBox} accessibilityRole="alert">
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        {anonymousDataDeleted ? (
          <View style={s.successBox} accessibilityRole="alert">
            <Text style={s.successText}>
              Anonymous data deleted. You can retry sign-in if it did not finish.
            </Text>
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
          accessibilityLabel="Email"
        />

        <Text style={s.label}>Password</Text>
        <View style={s.passwordField}>
          <TextInput
            style={[s.input, s.passwordInput]}
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            placeholderTextColor={Colors.textSecondary}
            textContentType="password"
            autoComplete="current-password"
            secureTextEntry={!showPassword}
            onSubmitEditing={handleLogin}
            accessibilityLabel="Password"
          />
          <TouchableOpacity
            style={s.passwordToggle}
            onPress={() => setShowPassword((visible) => !visible)}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            hitSlop={8}
          >
            <Feather
              name={showPassword ? 'eye-off' : 'eye'}
              size={20}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={s.forgotButton}
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
          <Text style={s.forgotText}>Forgot password?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.btn, loading && s.disabled]}
          onPress={handleLogin}
          disabled={loading || blockedAttempt !== null}
          accessibilityRole="button"
        >
          <Text style={s.btnText}>{loading ? 'Signing in...' : 'Sign In'}</Text>
        </TouchableOpacity>

        <SocialAuthButtons
          intent="sign-in"
          onComplete={returnToApp}
          disabled={loading || blockedAttempt !== null}
          submissionRef={submissionRef}
          onAnonymousDataBlocked={(provider, anonymousUserId) => {
            setError('');
            setAnonymousDataDeleted(false);
            setBlockedAttempt({ kind: 'provider', provider, anonymousUserId });
          }}
        />

        <TouchableOpacity
          style={s.linkButton}
          onPress={() =>
            router.replace({
              pathname: '/auth/signup',
              params: returnTo === '/(tabs)' ? {} : { returnTo },
            })
          }
        >
          <Text style={s.link}>New to MHtoolkit? Create an account</Text>
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
  passwordField: { position: 'relative', marginBottom: 16 },
  passwordInput: { marginBottom: 0, paddingRight: 50 },
  passwordToggle: {
    position: 'absolute',
    right: 4,
    top: 4,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forgotButton: {
    alignSelf: 'flex-end',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginTop: -10,
    marginBottom: 8,
  },
  forgotText: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
  },
  errorText: { color: '#991b1b', fontSize: 14, lineHeight: 20 },
  successBox: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#6ee7b7',
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
  },
  successText: { color: '#064e3b', fontSize: 14, lineHeight: 20 },
  noticeBox: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#93c5fd',
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
  },
  noticeTitle: { color: '#1e3a8a', fontSize: 15, fontWeight: '700' },
  noticeText: { color: '#1e3a8a', fontSize: 14, lineHeight: 20, marginTop: 3 },
  choiceBox: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
  },
  choiceTitle: { color: '#78350f', fontSize: 15, fontWeight: '700' },
  choiceText: { color: '#78350f', fontSize: 14, lineHeight: 20, marginTop: 4 },
  keepButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    minHeight: 44,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  keepButtonText: { color: '#ffffff', fontWeight: '600', fontSize: 14 },
  deleteButton: {
    borderWidth: 1,
    borderColor: '#dc2626',
    borderRadius: 10,
    minHeight: 44,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  deleteButtonText: { color: '#b91c1c', fontWeight: '600', fontSize: 14 },
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
