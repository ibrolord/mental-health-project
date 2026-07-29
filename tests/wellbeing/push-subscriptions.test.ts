import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260728213751_register_push_subscription.sql'
  ),
  'utf8'
);
const component = readFileSync(
  resolve(process.cwd(), 'components/push-notification-settings.tsx'),
  'utf8'
);
const authContext = readFileSync(
  resolve(process.cwd(), 'lib/auth-context.tsx'),
  'utf8'
);

describe('push subscription ownership', () => {
  it('requires proof of the existing browser keys before reassignment', () => {
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain("SET search_path = ''");
    expect(migration).toContain('pg_catalog.pg_advisory_xact_lock');
    expect(migration).toContain(
      'v_existing.p256dh IS DISTINCT FROM p_p256dh'
    );
    expect(migration).toContain(
      'v_existing.auth_key IS DISTINCT FROM p_auth_key'
    );
    expect(migration).toContain(
      'Push subscription ownership could not be verified'
    );
    expect(migration).toContain('TO authenticated');
    expect(migration).toContain('FROM PUBLIC, anon');
  });

  it('uses the guarded RPC and derives enabled state from current ownership', () => {
    expect(component).toContain(
      "supabase.rpc('register_push_subscription'"
    );
    expect(component).not.toContain(
      ".from('push_subscriptions').upsert"
    );
    expect(component).toContain(".eq('user_id', user.id)");
    expect(component).toContain(".eq('endpoint', subscription.endpoint)");
    expect(component).toContain('setEnabled(isOwnedByCurrentUser)');
  });

  it('does not strand a device channel during account changes', () => {
    expect(authContext).toContain("'push_subscriptions'");
    expect(authContext).toContain('removeCurrentDevicePushSubscription(user.id)');
    expect(authContext).toContain('subscription.unsubscribe()');
    expect(authContext).toContain(
      'Sign out was blocked because device reminders could not be disconnected.'
    );
  });
});
