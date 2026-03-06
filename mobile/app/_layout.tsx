import { useEffect, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/lib/auth-context';
import * as Notifications from 'expo-notifications';
import { scheduleMoodReminders, requestPermissions } from '@/lib/notifications';

export default function RootLayout() {
  const notificationResponseRef = useRef<Notifications.Subscription>(undefined);
  const routerRef = useRef<ReturnType<typeof useRouter>>(undefined);

  useEffect(() => {
    // Request permissions and schedule reminders on boot
    (async () => {
      const granted = await requestPermissions();
      if (granted) {
        await scheduleMoodReminders();
      }
    })();

    // Handle notification taps — navigate to mood tracker
    notificationResponseRef.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const screen = response.notification.request.content.data?.screen;
        if (screen && routerRef.current) {
          routerRef.current.push(screen as any);
        }
      });

    return () => {
      notificationResponseRef.current?.remove();
    };
  }, []);

  return (
    <AuthProvider>
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
        <Stack.Screen name="voice" options={{ headerShown: true, title: 'Voice Therapy' }} />
      </Stack>
    </AuthProvider>
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
