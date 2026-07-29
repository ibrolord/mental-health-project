import { NextRequest, NextResponse } from 'next/server';
import webPush from 'web-push';
import { supabaseAdmin } from '@/lib/supabase/server';
import {
  reminderDeliveryKey,
  type ReminderSchedule,
} from '@/lib/wellbeing/reminders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PushRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
  failed_count: number;
};

type WebPushFailure = Error & {
  statusCode?: number;
};

function authorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return request.headers.get('authorization') === `Bearer ${cronSecret}`;
}

function genericReminderBody(kind: string): string {
  switch (kind) {
    case 'focus':
      return 'Your focus block has reached its next transition.';
    case 'planner':
      return 'A planning check-in is ready when you are.';
    case 'routine':
      return 'Your routine is ready when you are.';
    default:
      return 'A small step is ready when you are.';
  }
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    return NextResponse.json(
      { error: 'Web Push is not configured.' },
      { status: 503 }
    );
  }

  webPush.setVapidDetails(subject, publicKey, privateKey);

  const { data: rawReminders, error: reminderError } = await supabaseAdmin
    .from('wellbeing_reminders')
    .select(
      'id, user_id, kind, label, route, timezone, days_of_week, local_time, scheduled_at, enabled'
    )
    .eq('enabled', true);
  if (reminderError) {
    return NextResponse.json(
      { error: `Reminder lookup failed: ${reminderError.message}` },
      { status: 500 }
    );
  }

  const reminders = (rawReminders ?? []) as Array<
    ReminderSchedule & { kind: string }
  >;
  const now = new Date();
  let claimed = 0;
  let delivered = 0;
  let failed = 0;
  let skipped = 0;

  for (const reminder of reminders) {
    const deliveryKey = reminderDeliveryKey(reminder, now, 9);
    if (!deliveryKey) continue;

    const { data: delivery, error: claimError } = await supabaseAdmin
      .from('reminder_deliveries')
      .insert({
        reminder_id: reminder.id,
        user_id: reminder.user_id,
        delivery_key: deliveryKey,
        status: 'claimed',
      })
      .select('id')
      .single();
    if (claimError?.code === '23505') {
      skipped += 1;
      continue;
    }
    if (claimError || !delivery) {
      failed += 1;
      continue;
    }
    claimed += 1;

    if (reminder.scheduled_at) {
      await supabaseAdmin
        .from('wellbeing_reminders')
        .update({ enabled: false, updated_at: now.toISOString() })
        .eq('id', reminder.id);
    }

    const { data: rawSubscriptions, error: subscriptionError } =
      await supabaseAdmin
        .from('push_subscriptions')
        .select('id, user_id, endpoint, p256dh, auth_key, failed_count')
        .eq('user_id', reminder.user_id);
    const subscriptions = (rawSubscriptions ?? []) as PushRow[];

    if (subscriptionError || subscriptions.length === 0) {
      await supabaseAdmin
        .from('reminder_deliveries')
        .update({
          status: subscriptionError ? 'failed' : 'no_subscription',
          error_code: subscriptionError ? 'subscription_lookup' : null,
        })
        .eq('id', delivery.id);
      failed += subscriptionError ? 1 : 0;
      continue;
    }

    const payload = JSON.stringify({
      title: 'MHtoolkit reminder',
      body: genericReminderBody(reminder.kind),
      route: reminder.route,
      tag: `mhtoolkit-${reminder.id}`,
    });
    let deliveredToDevice = false;

    for (const subscription of subscriptions) {
      try {
        await webPush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth_key,
            },
          },
          payload,
          { TTL: 60 * 60 }
        );
        deliveredToDevice = true;
        await supabaseAdmin
          .from('push_subscriptions')
          .update({ failed_count: 0, updated_at: now.toISOString() })
          .eq('id', subscription.id);
      } catch (error) {
        const failure = error as WebPushFailure;
        if (failure.statusCode === 404 || failure.statusCode === 410) {
          await supabaseAdmin
            .from('push_subscriptions')
            .delete()
            .eq('id', subscription.id);
        } else {
          await supabaseAdmin
            .from('push_subscriptions')
            .update({
              failed_count: Math.min(subscription.failed_count + 1, 20),
              updated_at: now.toISOString(),
            })
            .eq('id', subscription.id);
        }
      }
    }

    await supabaseAdmin
      .from('reminder_deliveries')
      .update({
        status: deliveredToDevice ? 'delivered' : 'failed',
        error_code: deliveredToDevice ? null : 'push_delivery',
        delivered_at: deliveredToDevice ? now.toISOString() : null,
      })
      .eq('id', delivery.id);
    if (deliveredToDevice) delivered += 1;
    else failed += 1;
  }

  return NextResponse.json({
    checked_at: now.toISOString(),
    claimed,
    delivered,
    failed,
    skipped,
  });
}
