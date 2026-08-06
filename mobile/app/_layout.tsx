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
import { AppBackButton } from '@/components/AppBackButton';

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

        // Reconcile only a choice the user already made. This never requests
        // permission; the opt-in prompt is triggered from Settings.
        (async () => {
          try {
            await notificationsHelper.scheduleMoodReminders();
          } catch (e) {
            console.warn('Notification schedule sync failed:', e);
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
        <Stack
          screenOptions={{
            headerShown: false,
            headerBackTitle: 'Back',
            headerStyle: { backgroundColor: '#fffef8' },
            headerTintColor: '#163a32',
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="auth/login" options={stackScreenOptions('Sign In', '/settings', true)} />
          <Stack.Screen name="auth/signup" options={stackScreenOptions('Sign Up', '/settings', true)} />
          <Stack.Screen name="assessments/[type]" options={stackScreenOptions('Assessment', '/(tabs)/assessments')} />
          <Stack.Screen name="goals" options={stackScreenOptions('Life Organizer')} />
          <Stack.Screen name="habits" options={stackScreenOptions('Habit Tracker')} />
          <Stack.Screen name="journal" options={stackScreenOptions('Private Journal')} />
          <Stack.Screen name="affirmations" options={stackScreenOptions('Affirmations')} />
          <Stack.Screen name="library" options={stackScreenOptions('Library')} />
          <Stack.Screen name="ground" options={stackScreenOptions('Grounding')} />
          <Stack.Screen name="meditate" options={stackScreenOptions('Meditation')} />
          <Stack.Screen name="yoga" options={stackScreenOptions('Yoga')} />
          <Stack.Screen name="mind-games" options={stackScreenOptions('Mind Games')} />
          <Stack.Screen name="planner" options={stackScreenOptions('Life Planner')} />
          <Stack.Screen name="plans" options={stackScreenOptions('My Plans')} />
          <Stack.Screen name="focus" options={stackScreenOptions('Focus Mode')} />
          <Stack.Screen name="partner" options={stackScreenOptions('Accountability')} />
          <Stack.Screen name="resources" options={stackScreenOptions('Find Support')} />
          <Stack.Screen name="research" options={stackScreenOptions('Research')} />
          <Stack.Screen name="support" options={stackScreenOptions('Support')} />
          <Stack.Screen name="settings" options={stackScreenOptions('Settings')} />
          <Stack.Screen name="voice" options={stackScreenOptions('Voice Support')} />
        </Stack>
      </AuthProvider>
    </ErrorBoundary>
  );
}

function stackScreenOptions(
  title: string,
  fallback: '/(tabs)' | '/(tabs)/assessments' | '/settings' = '/(tabs)',
  modal = false
) {
  return {
    headerLeft: () => <AppBackButton fallback={fallback} />,
    headerShown: true,
    presentation: modal ? ('modal' as const) : ('card' as const),
    title,
  };
}

// Helper to capture router ref inside the navigation context
function RouterCapture({ routerRef }: { routerRef: React.MutableRefObject<ReturnType<typeof useRouter> | undefined> }) {
  const router = useRouter();
  useEffect(() => {
    routerRef.current = router;
  }, [router, routerRef]);
  return null;
}
