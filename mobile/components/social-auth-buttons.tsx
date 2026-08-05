import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
  useAuth,
  type SocialAuthIntent,
  type SocialAuthProvider,
} from '@/lib/auth-context';
import { getEnabledAuthProviders } from '@/lib/auth-providers';
import { Colors } from '@/lib/constants';

export function SocialAuthButtons({
  intent,
  onComplete,
}: {
  intent: SocialAuthIntent;
  onComplete: () => void;
}) {
  const { continueWithProvider } = useAuth();
  const [available, setAvailable] = useState({ google: false, apple: false });
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState<SocialAuthProvider | null>(null);
  const [error, setError] = useState('');
  const submissionRef = useRef(false);

  useEffect(() => {
    let active = true;
    const appleAvailability =
      Platform.OS === 'ios'
        ? AppleAuthentication.isAvailableAsync().catch(() => false)
        : Promise.resolve(false);

    Promise.all([
      getEnabledAuthProviders(),
      appleAvailability,
    ]).then(([providers, appleAvailable]) => {
      if (!active) return;
      setAvailable({
        google: providers.google,
        apple:
          providers.apple &&
          (Platform.OS === 'ios' ? appleAvailable : Platform.OS === 'android'),
      });
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!ready || (!available.google && !available.apple)) return null;

  const run = async (provider: SocialAuthProvider) => {
    if (submissionRef.current) return;
    submissionRef.current = true;
    setPending(provider);
    setError('');
    try {
      const completed = await continueWithProvider(provider, intent);
      if (completed) onComplete();
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : `${provider === 'google' ? 'Google' : 'Apple'} sign-in failed.`
      );
    } finally {
      submissionRef.current = false;
      setPending(null);
    }
  };

  return (
    <View style={s.container}>
      <View style={s.divider}>
        <View style={s.line} />
        <Text style={s.or}>or</Text>
        <View style={s.line} />
      </View>

      {available.google ? (
        <TouchableOpacity
          style={[s.providerButton, pending && s.disabled]}
          onPress={() => void run('google')}
          disabled={pending !== null}
          accessibilityRole="button"
          accessibilityLabel={`${intent === 'sign-in' ? 'Sign in' : 'Continue'} with Google`}
        >
          {pending === 'google' ? (
            <ActivityIndicator color={Colors.text} />
          ) : (
            <Text style={s.googleMark}>G</Text>
          )}
          <Text style={s.providerText}>
            {intent === 'sign-in' ? 'Sign in' : 'Continue'} with Google
          </Text>
        </TouchableOpacity>
      ) : null}

      {available.apple && Platform.OS === 'ios' ? (
        <View
          pointerEvents={pending ? 'none' : 'auto'}
          style={pending && s.disabled}
        >
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={
              intent === 'sign-in'
                ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                : AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
            }
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={12}
            style={s.appleButton}
            onPress={() => void run('apple')}
          />
        </View>
      ) : null}

      {available.apple && Platform.OS === 'android' ? (
        <TouchableOpacity
          style={[s.appleOAuthButton, pending && s.disabled]}
          onPress={() => void run('apple')}
          disabled={pending !== null}
          accessibilityRole="button"
          accessibilityLabel={`${intent === 'sign-in' ? 'Sign in' : 'Continue'} with Apple`}
        >
          {pending === 'apple' ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <FontAwesome name="apple" size={19} color="#ffffff" />
          )}
          <Text style={s.appleOAuthText}>
            {intent === 'sign-in' ? 'Sign in' : 'Continue'} with Apple
          </Text>
        </TouchableOpacity>
      ) : null}

      {error ? (
        <View style={s.errorBox} accessibilityRole="alert">
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  container: { marginTop: 18, gap: 12 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  or: { color: Colors.textSecondary, fontSize: 12, textTransform: 'uppercase' },
  providerButton: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  providerText: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  googleMark: { color: '#4285F4', fontSize: 19, fontWeight: '800' },
  appleButton: { width: '100%', height: 48 },
  appleOAuthButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#000000',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  appleOAuthText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.55 },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 12,
  },
  errorText: { color: '#991b1b', fontSize: 14, lineHeight: 20 },
});
