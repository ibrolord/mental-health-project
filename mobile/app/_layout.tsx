import { useEffect, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppState } from 'react-native';
import { AuthProvider } from '@/lib/auth-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { loadNotificationsBundle } from '@/lib/notifications-runtime';
import type {
  NotificationResponseLike,
  NotificationSubscription,
} from '@/lib/notifications-types';
import { notificationScreenFromResponse } from '@/lib/notifications-types';
import { AcquisitionCapture } from '@/components/AcquisitionCapture';
import { AppBackButton } from '@/components/AppBackButton';

export default function RootLayout() {
  const router = useRouter();
  const notificationResponseRef = useRef<NotificationSubscription | null>(null);

  useEffect(() => {
    let cancelled = false;
    let pendingTimer: ReturnType<typeof setTimeout> | null = null;
    let routeTimer: ReturnType<typeof setTimeout> | null = null;
    let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

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

        const openNotification = async (
          response: NotificationResponseLike | null
        ) => {
          if (!response) return;

          const screen = notificationScreenFromResponse(response);
          if (screen) {
            if (routeTimer) clearTimeout(routeTimer);
            // iOS can deliver a response while the app is still transitioning
            // from background to active. Navigate after that transition settles.
            routeTimer = setTimeout(() => {
              routeTimer = null;
              if (!cancelled) router.navigate(screen as any);
            }, 250);
          }
          try {
            await Notifications.clearLastNotificationResponseAsync();
          } catch (error) {
            console.warn('Failed to clear notification response:', error);
          }
        };

        const reconcileLastNotificationResponse = async () => {
          try {
            const last = await Notifications.getLastNotificationResponseAsync();
            await openNotification(last);
          } catch (e) {
            console.warn('Failed to read last notification response:', e);
          }
        };

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
        void reconcileLastNotificationResponse();

        // iOS may resume the existing process without replaying the live
        // listener callback. Re-check the native response when it becomes active.
        appStateSubscription = AppState.addEventListener('change', (state) => {
          if (state === 'active') {
            void reconcileLastNotificationResponse();
          }
        });

        try {
          notificationResponseRef.current =
            Notifications.addNotificationResponseReceivedListener((
              response: NotificationResponseLike
            ) => {
              void openNotification(response);
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
      if (routeTimer) clearTimeout(routeTimer);
      appStateSubscription?.remove();
      notificationResponseRef.current?.remove();
      notificationResponseRef.current = null;
    };
  }, [router]);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <AcquisitionCapture />
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
