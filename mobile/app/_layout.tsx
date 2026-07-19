import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/lib/auth-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { loadNotificationsBundle } from '@/lib/notifications-runtime';
import type {
  NotificationResponseLike,
  NotificationSubscription,
} from '@/lib/notifications-types';
import { AcquisitionCapture } from '@/components/AcquisitionCapture';

// NOTE: Shared iOS-loaded files must not reference expo-notifications or
// expo-device at all. Those modules are resolved through platform-specific
// files so the iOS JS bundle does not carry notification-module load paths.

export default function RootLayout() {
  const notificationResponseRef = useRef<NotificationSubscription | null>(null);
  const routerRef = useRef<ReturnType<typeof useRouter>>(undefined);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      return;
    }

    let cancelled = false;
    let pendingTimer: ReturnType<typeof setTimeout> | null = null;

    // Defer past first paint. rAF → setTimeout(0) guarantees we're past the
    // initial render pass before we touch any native module. Unlike
    // InteractionManager.runAfterInteractions (which fires on the next
    // setImmediate when no interactions are active), this gives React a
    // full frame to mount the tree.
    const raf = requestAnimationFrame(() => {
      pendingTimer = setTimeout(() => {
        pendingTimer = null;
        if (cancelled) return;

        const notificationBundle = loadNotificationsBundle();
        if (!notificationBundle) {
          return;
        }
        const { Notifications, notificationsHelper } = notificationBundle;

        (async () => {
          try {
            const granted = await notificationsHelper.requestPermissions();
            if (granted) {
              await notificationsHelper.scheduleMoodReminders();
            }
          } catch (e) {
            console.warn('Notification setup failed:', e);
          }
        })();

        // Handle cold-start taps: if the app was opened by tapping a
        // notification, the live listener registers too late to catch it.
        // Check the last response once here.
        (async () => {
          try {
            const last = await Notifications.getLastNotificationResponseAsync();
            const screen = last?.notification.request.content.data?.screen;
            if (screen && routerRef.current) {
              routerRef.current.push(screen as any);
            }
          } catch (e) {
            console.warn('Failed to read last notification response:', e);
          }
        })();

        try {
          notificationResponseRef.current =
            Notifications.addNotificationResponseReceivedListener((
              response: NotificationResponseLike
            ) => {
              const screen = response.notification.request.content.data?.screen;
              if (screen && routerRef.current) {
                routerRef.current.push(screen as any);
              }
            });
        } catch (e) {
          console.warn('Failed to attach notification response listener:', e);
        }
      }, 0);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (pendingTimer) clearTimeout(pendingTimer);
      notificationResponseRef.current?.remove();
      notificationResponseRef.current = null;
    };
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <AcquisitionCapture />
        <RouterCapture routerRef={routerRef} />
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="auth/login" options={{ presentation: 'modal', headerShown: true, title: 'Sign In' }} />
          <Stack.Screen name="auth/signup" options={{ presentation: 'modal', headerShown: true, title: 'Sign Up' }} />
          <Stack.Screen name="assessments/[type]" options={{ headerShown: true, title: 'Assessment' }} />
          <Stack.Screen name="goals" options={{ headerShown: true, title: 'Life Organizer' }} />
          <Stack.Screen name="habits" options={{ headerShown: true, title: 'Habit Tracker' }} />
          <Stack.Screen name="affirmations" options={{ headerShown: true, title: 'Affirmations' }} />
          <Stack.Screen name="library" options={{ headerShown: true, title: 'Book Library' }} />
          <Stack.Screen name="settings" options={{ headerShown: true, title: 'Settings' }} />
          <Stack.Screen name="voice" options={{ headerShown: true, title: 'Voice Support' }} />
        </Stack>
      </AuthProvider>
    </ErrorBoundary>
  );
}

// Helper to capture router ref inside the navigation context
function RouterCapture({ routerRef }: { routerRef: React.MutableRefObject<ReturnType<typeof useRouter> | undefined> }) {
  const router = useRouter();
  useEffect(() => {
    routerRef.current = router;
  }, [router]);
  return null;
}
