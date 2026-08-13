import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import {
  anonymousSignInState,
  clearPersistedSupabaseSession,
  supabase,
} from './supabase';
import type { Session, User } from '@supabase/supabase-js';
import { apiRequest } from './api';
import { clearStoredAcquisitionAttribution } from './acquisition';
import { resetAiDataSharingConsent } from './ai-consent';
import {
  ACCOUNT_UPGRADE_COMPLETION_FLAG,
  ACCOUNT_UPGRADE_EMAIL_FIELD,
  ACCOUNT_UPGRADE_STARTED_FLAG,
  getPendingAccountUpgradeEmail,
  isAccountEmailConfirmed,
  isAccountUpgradeComplete,
  isAccountUpgradePending,
} from './auth-validation';
import {
  appleProfileMetadata,
  isAppleAuthCancellation,
  linkedProviderVerificationError,
  parseOAuthCallback,
} from './social-auth';
import { createAnonymousSessionManager } from './session-bootstrap';
import {
  clearDeletedAccountSession,
  runDeletedAccountLocalCleanup,
} from './session-cleanup';
import { offlineSafetyPlanCache } from './offline-safety-plan-cache';
import { clearFullContextPreference } from './full-context-preference';
import { clearGoToActions } from './go-to-actions-storage';
import { clearContextSelections } from './chat-context-preference';
import { areRemindersEnabled, clearAllReminders, hasAdvisorReminder } from './notifications';
import { Colors } from './constants';
import {
  clearReflectionDraft,
  reflectionDraftStorage,
} from './reflection-draft-storage';
import { appleHealthPreference } from './apple-health-preference';
import {
  ANONYMOUS_PROFILE_DATA_CONFLICT,
  anonymousProfileDataConflict,
  discardAnonymousProfileSafely,
  getAnonymousProfileDataConflictUserId,
  isAnonymousProfileDataConflict,
} from './anonymous-profile-switch';

WebBrowser.maybeCompleteAuthSession();

export type AccountUpgradeStatus = 'complete' | 'password-required';
export type SocialAuthProvider = 'google' | 'apple';
export type SocialAuthIntent = 'sign-in' | 'upgrade';
export {
  ANONYMOUS_PROFILE_DATA_CONFLICT,
  getAnonymousProfileDataConflictUserId,
  isAnonymousProfileDataConflict,
};

const LEGACY_SESSION_KEY = 'anonymous_session_id';
const AUTH_SESSION_TIMEOUT_MS = 12_000;
const AUTH_INIT_ERROR_MESSAGE =
  'Your private profile could not be started. Check your connection and try again.';
const MOBILE_AUTH_REDIRECT = 'mhtoolkit://auth/callback';
async function assertAnonymousAccountIsEmpty(): Promise<void> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (session && !session.user.is_anonymous) {
    throw new Error('This device is already signed in. Sign out before using another account.');
  }
  if (!session) return;

  const [result, remindersEnabled, advisorReminder, reflectionDraft] = await Promise.all([
    apiRequest<{ hasOwnedData?: boolean }>(
      '/api/data/switch-status',
      {},
      { accessToken: session.access_token }
    ),
    areRemindersEnabled(),
    hasAdvisorReminder(),
    reflectionDraftStorage.read(session.user.id),
  ]);
  if (result.hasOwnedData !== false || remindersEnabled || advisorReminder || reflectionDraft) {
    throw anonymousProfileDataConflict(session.user.id);
  }
}

async function applyOAuthSessionFromUrl(url: string): Promise<void> {
  const { accessToken, refreshToken } = parseOAuthCallback(url);
  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) throw error;
}

async function verifyLinkedProvider(
  provider: SocialAuthProvider,
  expectedUserId?: string
): Promise<User> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user || userData.user.is_anonymous) {
    throw new Error(`Continue with ${provider === 'google' ? 'Google' : 'Apple'} did not finish.`);
  }
  if (expectedUserId && userData.user.id !== expectedUserId) {
    throw new Error('Account setup did not preserve the profile that started it.');
  }

  const { data, error } = await supabase.auth.getUserIdentities();
  if (error) throw error;
  const verificationError = linkedProviderVerificationError(
    userData.user,
    data.identities,
    provider,
    expectedUserId
  );
  if (verificationError) throw new Error(verificationError);
  return userData.user;
}

interface AuthContextType {
  user: User | null;
  sessionId: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAnonymous: boolean;
  accountUpgradePending: boolean;
  pendingAccountUpgradeEmail: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  startAccountUpgrade: (email: string) => Promise<void>;
  completeAccountUpgrade: () => Promise<AccountUpgradeStatus>;
  finishAccountUpgrade: (password: string) => Promise<void>;
  continueWithProvider: (
    provider: SocialAuthProvider,
    intent: SocialAuthIntent
  ) => Promise<boolean>;
  discardAnonymousProfile: (expectedAnonymousUserId: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  sessionId: null,
  loading: true,
  isAuthenticated: false,
  isAnonymous: false,
  accountUpgradePending: false,
  pendingAccountUpgradeEmail: null,
  signIn: async () => {},
  startAccountUpgrade: async () => {},
  completeAccountUpgrade: async () => 'complete',
  finishAccountUpgrade: async () => {},
  continueWithProvider: async () => false,
  discardAnonymousProfile: async () => {},
  signOut: async () => {},
  deleteAccount: async () => {},
});

const anonymousSessionManager = createAnonymousSessionManager(
  {
    getSession: () => supabase.auth.getSession(),
    signInAnonymously: () => supabase.auth.signInAnonymously(),
  },
  AUTH_SESSION_TIMEOUT_MS,
  anonymousSignInState
);

const ensureAnonymousSession = (): Promise<Session> =>
  anonymousSessionManager.ensureSession();

async function migrateLegacyData(session: Session): Promise<void> {
  const legacySessionId = await AsyncStorage.getItem(LEGACY_SESSION_KEY);
  if (!legacySessionId) return;

  const result = await apiRequest('/api/session/migrate', { legacySessionId });
  if (result?.verified !== true) {
    throw new Error('Legacy data migration was not verified');
  }

  await AsyncStorage.removeItem(LEGACY_SESSION_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializationError, setInitializationError] = useState('');
  const [authAttempt, setAuthAttempt] = useState(0);
  const accountDeletionInProgress = useRef(false);
  const lastOwnerId = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    const initAuth = async () => {
      setInitializationError('');
      try {
        const session = await ensureAnonymousSession();
        if (!active) return;

        // The authenticated profile can save immediately; the legacy migration
        // is a one-time background task and must not hold the app on its loader.
        lastOwnerId.current = session.user.id;
        setUser(session.user);
        setLoading(false);
        void migrateLegacyData(session).catch((error) => {
          // Keep the local key so the atomic migration can be retried next launch.
          console.error('Legacy data migration error:', error);
        });
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (active) setInitializationError(AUTH_INIT_ERROR_MESSAGE);
      } finally {
        if (active) setLoading(false);
      }
    };

    void initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;

      if (session) {
        lastOwnerId.current = session.user.id;
        setUser(session.user);
        setInitializationError('');
        setLoading(false);
      } else {
        if (accountDeletionInProgress.current) return;
        const previousOwnerId = lastOwnerId.current;
        lastOwnerId.current = null;
        setLoading(true);
        setUser(null);
        setInitializationError('');
        const localCleanup = previousOwnerId
          ? runDeletedAccountLocalCleanup(
              [
                clearStoredAcquisitionAttribution(),
                resetAiDataSharingConsent(`user_id:${previousOwnerId}`),
                clearFullContextPreference(`user_id:${previousOwnerId}`),
                clearGoToActions(`user_id:${previousOwnerId}`),
                clearContextSelections(`user_id:${previousOwnerId}`),
                clearAllReminders(),
                offlineSafetyPlanCache.clear(previousOwnerId),
                clearReflectionDraft(previousOwnerId),
                appleHealthPreference.clear(previousOwnerId),
              ],
              (error) => console.error('Expired-session local cleanup failed:', error)
            )
          : Promise.resolve(true);
        // Avoid calling another auth method from inside the auth callback lock.
        setTimeout(() => {
          void localCleanup
            .then((cleanupComplete) => {
              if (!cleanupComplete) {
                throw new Error(
                  'Local reminders or private drafts could not be cleared after this session ended.'
                );
              }
              return ensureAnonymousSession();
            })
            .then(async (anonymousSession) => {
              if (!active) return;
              lastOwnerId.current = anonymousSession.user.id;
              setUser(anonymousSession.user);
              setLoading(false);
              void migrateLegacyData(anonymousSession).catch((error) => {
                console.error('Legacy data migration error:', error);
              });
            })
            .catch((error) => {
              console.error('Anonymous sign-in error:', error);
              if (active) {
                setInitializationError(AUTH_INIT_ERROR_MESSAGE);
                setLoading(false);
              }
            });
        }, 0);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [authAttempt]);

  const isAuthenticated = !!user;
  const isAnonymous = user?.is_anonymous === true;
  const accountUpgradePending = isAccountUpgradePending(user);
  const pendingAccountUpgradeEmail = getPendingAccountUpgradeEmail(user);
  const sessionId = null;

  const signIn = async (email: string, password: string) => {
    await assertAnonymousAccountIsEmpty();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const startAccountUpgrade = async (email: string): Promise<void> => {
    const { data: current, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!current.session?.user.is_anonymous) {
      throw new Error('This device is already signed in to an account.');
    }

    // Link the email to the current anonymous user so its ID and saved data
    // remain unchanged. Password creation happens in the app after verification.
    const redirectUrl =
      `https://mhtoolkit.vercel.app/auth/mobile-confirmed?source=mobile&upgrade_user_id=${encodeURIComponent(current.session.user.id)}`;
    const { data, error } = await supabase.auth.updateUser(
      {
        email: email.trim(),
        data: {
          [ACCOUNT_UPGRADE_STARTED_FLAG]: true,
          [ACCOUNT_UPGRADE_EMAIL_FIELD]: email.trim(),
        },
      },
      { emailRedirectTo: redirectUrl }
    );
    if (error) throw error;
    setUser(data.user);
  };

  const completeAccountUpgrade = async (): Promise<AccountUpgradeStatus> => {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) throw error;
    if (isAccountUpgradeComplete(data.user)) {
      setUser(data.user);
      return 'complete';
    }

    if (!isAccountEmailConfirmed(data.user)) {
      throw new Error('Your email is not confirmed yet. Open the link in your inbox, then return here.');
    }

    setUser(data.user);
    return 'password-required';
  };

  const finishAccountUpgrade = async (password: string): Promise<void> => {
    const { data: current, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!isAccountEmailConfirmed(current.user)) {
      throw new Error('Confirm your email before creating a password.');
    }

    const { data, error } = await supabase.auth.updateUser({
      password,
      data: {
        [ACCOUNT_UPGRADE_COMPLETION_FLAG]: true,
        [ACCOUNT_UPGRADE_STARTED_FLAG]: false,
        [ACCOUNT_UPGRADE_EMAIL_FIELD]: null,
      },
    });
    if (error) throw error;
    if (!isAccountUpgradeComplete(data.user)) {
      throw new Error('Your password was saved, but account setup could not be verified.');
    }
    setUser(data.user);
  };

  const continueWithOAuth = async (
    provider: SocialAuthProvider,
    intent: SocialAuthIntent
  ): Promise<boolean> => {
    const { data: current, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const startingUserId =
      intent === 'upgrade' ? current.session?.user.id : undefined;

    let authorizationUrl: string | null = null;
    if (intent === 'upgrade') {
      if (!current.session?.user.is_anonymous) {
        throw new Error('This device is already signed in to an account.');
      }
      const { data, error } = await supabase.auth.linkIdentity({
        provider,
        options: {
          redirectTo: MOBILE_AUTH_REDIRECT,
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      authorizationUrl = data.url;
    } else {
      await assertAnonymousAccountIsEmpty();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: MOBILE_AUTH_REDIRECT,
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      authorizationUrl = data.url;
    }

    if (!authorizationUrl) {
      throw new Error(
        `${provider === 'google' ? 'Google' : 'Apple'} sign-in is not available right now.`
      );
    }
    const result = await WebBrowser.openAuthSessionAsync(
      authorizationUrl,
      MOBILE_AUTH_REDIRECT
    );
    if (result.type !== 'success') return false;

    await applyOAuthSessionFromUrl(result.url);
    const verifiedUser = await verifyLinkedProvider(provider, startingUserId);
    setUser(verifiedUser);
    return true;
  };

  const continueWithApple = async (intent: SocialAuthIntent): Promise<boolean> => {
    const { data: current, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const startingUserId =
      intent === 'upgrade' ? current.session?.user.id : undefined;
    if (intent === 'upgrade') {
      if (!current.session?.user.is_anonymous) {
        throw new Error('This device is already signed in to an account.');
      }
    } else {
      await assertAnonymousAccountIsEmpty();
    }

    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce
    );

    let credential: AppleAuthentication.AppleAuthenticationCredential;
    try {
      credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
    } catch (error) {
      if (isAppleAuthCancellation(error)) return false;
      throw new Error(
        'Apple sign-in could not start. Make sure you are signed in to your Apple Account in Settings, then try again.'
      );
    }

    if (!credential.identityToken) {
      throw new Error('Apple did not return a valid identity token.');
    }

    const response =
      intent === 'upgrade'
        ? await supabase.auth.linkIdentity({
            provider: 'apple',
            token: credential.identityToken,
            nonce: rawNonce,
          })
        : await supabase.auth.signInWithIdToken({
            provider: 'apple',
            token: credential.identityToken,
            nonce: rawNonce,
          });
    if (response.error) throw response.error;

    const verifiedUser = await verifyLinkedProvider('apple', startingUserId);
    setUser(verifiedUser);

    const profileMetadata = appleProfileMetadata(credential.fullName);
    if (profileMetadata) {
      const { data, error } = await supabase.auth.updateUser({
        data: profileMetadata,
      });
      if (error) {
        // Authentication succeeded. Name enrichment must not turn it into a
        // false sign-in failure because Apple may never return the name again.
        console.warn('Unable to save Apple profile name:', error);
      } else {
        setUser(data.user);
      }
    }
    return true;
  };

  const continueWithProvider = (
    provider: SocialAuthProvider,
    intent: SocialAuthIntent
  ): Promise<boolean> =>
    provider === 'apple' && Platform.OS === 'ios'
      ? continueWithApple(intent)
      : continueWithOAuth(provider, intent);

  const signOut = async () => {
    if (user) {
      const ownerKey = `user_id:${user.id}`;
      const localCleanupComplete = await runDeletedAccountLocalCleanup(
        [
          clearStoredAcquisitionAttribution(),
          resetAiDataSharingConsent(ownerKey),
          clearFullContextPreference(ownerKey),
          clearGoToActions(ownerKey),
          clearContextSelections(ownerKey),
          clearAllReminders(),
          offlineSafetyPlanCache.clear(user.id),
          clearReflectionDraft(user.id),
          appleHealthPreference.clear(user.id),
        ],
        (error) => console.error('Sign-out local cleanup failed:', error)
      );
      if (!localCleanupComplete) {
        throw new Error(
          'Local reminders or private drafts could not be cleared. Restart MHtoolkit and try signing out again.'
        );
      }
    }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const discardAnonymousProfile = async (expectedAnonymousUserId: string) => {
    const { data: current, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const anonymousUser = current.session?.user ?? null;
    const accessToken = current.session?.access_token;
    const ownerKey = `user_id:${expectedAnonymousUserId}`;

    await discardAnonymousProfileSafely({
      expectedAnonymousUserId,
      currentUser: anonymousUser,
      prepareLocalCleanup: () =>
        runDeletedAccountLocalCleanup(
          [
            clearStoredAcquisitionAttribution(),
            resetAiDataSharingConsent(ownerKey),
            clearFullContextPreference(ownerKey),
            clearGoToActions(ownerKey),
            clearContextSelections(ownerKey),
            clearAllReminders(),
            offlineSafetyPlanCache.clear(expectedAnonymousUserId),
            clearReflectionDraft(expectedAnonymousUserId),
            appleHealthPreference.clear(expectedAnonymousUserId),
          ],
          (error) => console.error('Anonymous-profile local cleanup failed:', error)
        ),
      deleteRemoteData: () =>
        apiRequest(
          '/api/data/delete',
          { expectedAnonymousUserId },
          { accessToken }
        ),
      localCleanupError:
        'This device could not clear local reminders or settings. No data was deleted; restart MHtoolkit and try again.',
    });
  };

  const deleteAccount = async () => {
    if (!user) {
      throw new Error('No authenticated account to delete');
    }

    const deletedOwnerId = user.id;
    const { data: current, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!current.session || current.session.user.id !== deletedOwnerId) {
      throw new Error('The account changed before deletion. No account was deleted.');
    }
    const result = await apiRequest(
      '/api/account/delete',
      { expectedUserId: deletedOwnerId },
      { accessToken: current.session.access_token }
    );
    if (!result?.deleted) {
      throw new Error(result?.error || 'Failed to delete account');
    }

    accountDeletionInProgress.current = true;
    try {
      const deletedOwnerKey = `user_id:${deletedOwnerId}`;
      const localCleanupComplete = await runDeletedAccountLocalCleanup(
        [
          clearStoredAcquisitionAttribution(),
          resetAiDataSharingConsent(deletedOwnerKey),
          clearFullContextPreference(deletedOwnerKey),
          clearGoToActions(deletedOwnerKey),
          clearContextSelections(deletedOwnerKey),
          clearAllReminders(),
          offlineSafetyPlanCache.clear(deletedOwnerId),
          clearReflectionDraft(deletedOwnerId),
          appleHealthPreference.clear(deletedOwnerId),
        ],
        (error) => console.error('Deleted-account local cleanup failed:', error)
      );
      const sessionCleared = await clearDeletedAccountSession(
        supabase.auth,
        clearPersistedSupabaseSession,
        (error) => console.error('Unable to clear persisted session after deletion:', error)
      );
      if (!sessionCleared) {
        throw new Error(
          'Your account was deleted, but this device session could not be cleared. Close the app and contact support before continuing.'
        );
      }
      if (!localCleanupComplete) {
        throw new Error(
          'Your account was deleted and this session was cleared, but local privacy data could not be fully removed. Delete and reinstall MHtoolkit before continuing.'
        );
      }
      const anonymousSession = await ensureAnonymousSession();
      setUser(anonymousSession.user);
    } catch (error) {
      setUser(null);
      setLoading(false);
      setInitializationError(
        error instanceof Error ? error.message : AUTH_INIT_ERROR_MESSAGE
      );
      throw error;
    } finally {
      accountDeletionInProgress.current = false;
    }
  };

  if (loading) {
    return (
      <View style={authStyles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (initializationError || !user) {
    return (
      <View style={authStyles.centered}>
        <View style={authStyles.errorCard} accessibilityRole="alert">
          <Text style={authStyles.errorTitle}>Unable to start securely</Text>
          <Text style={authStyles.errorMessage}>
            {initializationError || AUTH_INIT_ERROR_MESSAGE}
          </Text>
          <TouchableOpacity
            style={authStyles.retryButton}
            onPress={() => {
              setLoading(true);
              setInitializationError('');
              setAuthAttempt((attempt) => attempt + 1);
            }}
            accessibilityRole="button"
            accessibilityLabel="Try authentication again"
          >
            <Text style={authStyles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        sessionId,
        loading,
        isAuthenticated,
        isAnonymous,
        accountUpgradePending,
        pendingAccountUpgradeEmail,
        signIn,
        startAccountUpgrade,
        completeAccountUpgrade,
        finishAccountUpgrade,
        continueWithProvider,
        discardAnonymousProfile,
        signOut,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

const authStyles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    padding: 24,
  },
  errorCard: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    padding: 24,
  },
  errorTitle: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorMessage: {
    color: Colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 48,
    minWidth: 150,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: Colors.primary,
    marginTop: 20,
    paddingHorizontal: 20,
  },
  retryText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
