'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { recordOperationalEvent } from '@/lib/observability';

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from(rawData, (character) => character.charCodeAt(0));
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export function PushNotificationSettings({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
  const dispatchEnabled =
    process.env.NEXT_PUBLIC_REMINDER_DISPATCH_ENABLED === 'true';

  useEffect(() => {
    let active = true;
    const isSupported =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;
    setSupported(isSupported);
    setEnabled(false);
    if (!isSupported || !user) {
      return () => {
        active = false;
      };
    }

    void currentSubscription()
      .then(async (subscription) => {
        if (!subscription) return false;
        const { data, error } = await supabase
          .from('push_subscriptions')
          .select('id')
          .eq('user_id', user.id)
          .eq('endpoint', subscription.endpoint)
          .maybeSingle();
        if (error) throw error;
        return Boolean(data);
      })
      .then((isOwnedByCurrentUser) => {
        if (active) setEnabled(isOwnedByCurrentUser);
      })
      .catch(() => {
        if (active) setEnabled(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  const enable = async () => {
    if (!user || !supported || !publicKey || !dispatchEnabled) return;
    setBusy(true);
    setMessage('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        void recordOperationalEvent('notification_permission_denied');
        setMessage('Notifications were not enabled. You can change this in browser settings.');
        return;
      }
      void recordOperationalEvent('notification_permission_granted');

      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));
      const json = subscription.toJSON();
      if (!subscription.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error('The browser returned an incomplete push subscription.');
      }

      const { error } = await supabase.rpc('register_push_subscription', {
        p_endpoint: subscription.endpoint,
        p_p256dh: json.keys.p256dh,
        p_auth_key: json.keys.auth,
        p_user_agent: navigator.userAgent.slice(0, 500),
      });
      if (error) throw error;
      void recordOperationalEvent('notification_registration_succeeded');
      setEnabled(true);
      setMessage('Background reminders are enabled on this device.');
    } catch (error) {
      void recordOperationalEvent('notification_registration_failed');
      setMessage(
        error instanceof Error ? error.message : 'Notifications could not be enabled.'
      );
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!user || !supported) return;
    setBusy(true);
    setMessage('');
    try {
      const subscription = await currentSubscription();
      if (subscription) {
        const { error } = await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', subscription.endpoint);
        if (error) throw error;
        await subscription.unsubscribe();
      }
      setEnabled(false);
      setMessage('Background reminders are off on this device.');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Notifications could not be disabled.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className={cn(
        compact ? 'rounded-xl border border-border bg-background p-4' : 'app-panel p-5'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {enabled ? (
              <Bell className="h-4 w-4" aria-hidden="true" />
            ) : (
              <BellOff className="h-4 w-4" aria-hidden="true" />
            )}
            <h2 className="font-semibold text-foreground">Background reminders</h2>
          </div>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
            Off by default. Your browser asks for permission, and you choose the
            reminder time for each routine. No journal, mood note, assessment, or AI
            content appears in a notification.
          </p>
        </div>
        <ShieldCheck className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>

      {supported === false && (
        <p className="mt-3 text-sm text-muted-foreground">
          This browser does not support Web Push.
        </p>
      )}
      {supported && !publicKey && (
        <p className="mt-3 text-sm text-muted-foreground">
          Reminder scheduling is available, but this deployment has not configured its
          Web Push public key yet.
        </p>
      )}
      {supported && publicKey && !dispatchEnabled && (
        <p className="mt-3 text-sm text-muted-foreground">
          Reminder times can be saved, but background delivery is not active on this
          deployment yet.
        </p>
      )}
      {supported && publicKey && dispatchEnabled && (
        <button
          type="button"
          disabled={busy || !user}
          onClick={() => void (enabled ? disable() : enable())}
          className={cn(
            'mt-4 rounded-full px-4 py-2 text-sm font-medium transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
            enabled
              ? 'border border-border bg-background text-foreground'
              : 'bg-primary text-primary-foreground'
          )}
        >
          {busy ? 'Updating…' : enabled ? 'Turn off on this device' : 'Enable reminders'}
        </button>
      )}
      {message && (
        <p role="status" className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {message}
        </p>
      )}
    </section>
  );
}
