import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '@/lib/constants';
import {
  normalizePrivacyEvent,
  PRIVACY_EVENT_LABELS,
  type PrivacyActivityEvent,
} from '@/lib/privacy-events';
import { supabase } from '@/lib/supabase';

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time unavailable';
  return date.toLocaleString();
}

export function PrivacyActivity({ ownerId }: { ownerId: string | null }) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<PrivacyActivityEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestVersion = useRef(0);

  useEffect(() => {
    requestVersion.current += 1;
    setOpen(false);
    setEvents([]);
    setError('');
    setLoading(false);
  }, [ownerId]);

  const load = async () => {
    const version = ++requestVersion.current;
    if (!ownerId) {
      setEvents([]);
      setError('Sign in to view privacy activity.');
      return;
    }

    setLoading(true);
    setError('');
    const result = await supabase
      .from('privacy_events')
      .select('id, event_type, platform, occurred_at')
      .eq('user_id', ownerId)
      .order('occurred_at', { ascending: false })
      .limit(50);

    if (version !== requestVersion.current) return;
    if (result.error) {
      setEvents([]);
      setError('Privacy activity could not be loaded.');
    } else {
      setEvents(
        (result.data ?? [])
          .map(normalizePrivacyEvent)
          .filter((event): event is PrivacyActivityEvent => event !== null)
      );
    }
    setLoading(false);
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) void load();
  };

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={toggle}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
      >
        <View style={styles.headerIcon}>
          <Feather name="lock" size={18} color={Colors.primary} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Privacy Activity</Text>
          <Text style={styles.description}>Your recent privacy actions.</Text>
        </View>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.textSecondary} />
      </Pressable>

      {open ? (
        <View style={styles.body}>
          <View style={styles.bodyHeader}>
            <Text style={styles.helper}>Up to 50 recent actions</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh privacy activity"
              disabled={loading || !ownerId}
              onPress={() => void load()}
              style={({ pressed }) => [styles.refresh, pressed && styles.pressed]}
            >
              <Feather name="refresh-cw" size={15} color={Colors.primary} />
              <Text style={styles.refreshText}>Refresh</Text>
            </Pressable>
          </View>

          {loading && events.length === 0 ? (
            <View style={styles.messageRow}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.helper}>Loading...</Text>
            </View>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!loading && !error && events.length === 0 ? (
            <Text style={styles.empty}>No privacy activity yet.</Text>
          ) : null}
          {events.map((event) => (
            <View key={event.id} style={styles.event}>
              <View style={styles.eventTop}>
                <Text style={styles.eventTitle}>{PRIVACY_EVENT_LABELS[event.eventType]}</Text>
                <Text style={styles.platform}>{event.platform.toUpperCase()}</Text>
              </View>
              <Text style={styles.eventTime}>{formatTime(event.occurredAt)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20 },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1 },
  title: { fontSize: 18, fontWeight: '600', color: Colors.text },
  description: { marginTop: 3, fontSize: 14, color: Colors.textSecondary },
  body: { borderTopWidth: 1, borderTopColor: Colors.border, padding: 20, paddingTop: 16 },
  bodyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  helper: { fontSize: 13, color: Colors.textSecondary },
  refresh: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 6 },
  refreshText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  messageRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  error: { marginTop: 14, color: Colors.danger, fontSize: 14 },
  empty: {
    marginTop: 14,
    padding: 14,
    borderRadius: 12,
    backgroundColor: Colors.background,
    color: Colors.textSecondary,
    fontSize: 14,
  },
  event: { borderTopWidth: 1, borderTopColor: Colors.border, paddingVertical: 13 },
  eventTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  eventTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.text },
  eventTime: { marginTop: 4, fontSize: 12, color: Colors.textSecondary },
  platform: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  pressed: { opacity: 0.72 },
});
