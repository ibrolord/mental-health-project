import { useCallback, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/lib/constants';
import { accountabilityClient } from '@/lib/accountability/runtime';
import type { AccountabilityConnection, CommitmentCadence } from '@/lib/accountability/types';
import { ScreenState } from '@/components/accountability/ScreenState';

export default function CreateCommitmentScreen() {
  const router = useRouter();
  const [connections, setConnections] = useState<AccountabilityConnection[]>([]);
  const [connectionId, setConnectionId] = useState('');
  const [title, setTitle] = useState('');
  const [cadence, setCadence] = useState<CommitmentCadence>('daily');
  const [note, setNote] = useState('');
  const [notesShared, setNotesShared] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    void accountabilityClient.listConnections()
      .then((items) => {
        if (!active) return;
        const next = items.filter((item) => item.status === 'active');
        setConnections(next);
        setConnectionId((current) => current || next[0]?.id || '');
      })
      .catch((loadError: unknown) => active && setError(loadError instanceof Error ? loadError.message : 'Connections could not be loaded.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []));

  const submit = async () => {
    if (!title.trim() || !connectionId) return;
    setSubmitting(true);
    try {
      const commitment = await accountabilityClient.createCommitment({
        connectionId,
        title: title.trim(),
        cadence,
        ...(note.trim() ? { note: note.trim(), notesShared } : {}),
      });
      router.replace({ pathname: '/accountability/[commitmentId]', params: { commitmentId: commitment.id } });
    } catch (submitError) {
      Alert.alert('Commitment not shared', submitError instanceof Error ? submitError.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <SafeAreaView style={styles.safe} edges={['bottom']}><ScreenState kind="loading" title="Loading partners" message="Getting your active connections…" /></SafeAreaView>;
  if (error) return <SafeAreaView style={styles.safe} edges={['bottom']}><ScreenState kind="error" title="Could not start" message={error} /></SafeAreaView>;
  if (connections.length === 0) return <SafeAreaView style={styles.safe} edges={['bottom']}><ScreenState kind="empty" title="Connect first" message="Invite or join a partner before sharing a commitment." actionLabel="Back to Together" onAction={() => router.back()} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Share one commitment</Text>
          <Text style={styles.body}>This creates a separate Together item. It does not share an existing goal or anything else in MHtoolkit.</Text>

          <Text style={styles.label}>Share with</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
            {connections.map((connection) => (
              <TouchableOpacity key={connection.id} accessibilityRole="radio" accessibilityState={{ checked: connectionId === connection.id }} style={[styles.pill, connectionId === connection.id && styles.pillActive]} onPress={() => setConnectionId(connection.id)}>
                <Text style={[styles.pillText, connectionId === connection.id && styles.pillTextActive]}>{connection.partnerName}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Commitment</Text>
          <TextInput accessibilityLabel="Commitment title" placeholder="Take a 10-minute walk" placeholderTextColor={Colors.textSecondary} returnKeyType="next" style={styles.input} value={title} onChangeText={setTitle} />

          <Text style={styles.label}>Rhythm</Text>
          <View style={styles.segment}>
            {(['daily', 'weekly'] as const).map((item) => (
              <TouchableOpacity key={item} accessibilityRole="radio" accessibilityState={{ checked: cadence === item }} style={[styles.segmentButton, cadence === item && styles.segmentActive]} onPress={() => setCadence(item)}>
                <Text style={[styles.segmentText, cadence === item && styles.segmentTextActive]}>{item === 'daily' ? 'Daily' : 'Weekly'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Private note (optional)</Text>
          <TextInput accessibilityLabel="Optional commitment note" multiline placeholder="Add context for yourself" placeholderTextColor={Colors.textSecondary} style={[styles.input, styles.note]} textAlignVertical="top" value={note} onChangeText={setNote} />
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={styles.switchTitle}>Share this note</Text>
              <Text style={styles.switchBody}>Off by default. The commitment title can be shared without the note.</Text>
            </View>
            <Switch accessibilityLabel="Share this note with partner" disabled={!note.trim()} trackColor={{ false: Colors.border, true: Colors.primary }} value={notesShared && Boolean(note.trim())} onValueChange={setNotesShared} />
          </View>

          <TouchableOpacity accessibilityRole="button" disabled={submitting || !title.trim()} style={[styles.button, (submitting || !title.trim()) && styles.disabled]} onPress={() => void submit()}>
            <Text style={styles.buttonText}>{submitting ? 'Sharing…' : 'Share commitment'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: Colors.background, flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  title: { color: Colors.text, fontSize: 24, fontWeight: '700' },
  body: { color: Colors.textSecondary, fontSize: 15, lineHeight: 22, marginBottom: 24, marginTop: 8 },
  label: { color: Colors.text, fontSize: 14, fontWeight: '600', marginBottom: 7, marginTop: 16 },
  input: { backgroundColor: Colors.card, borderColor: Colors.border, borderRadius: 12, borderWidth: 1, color: Colors.text, fontSize: 16, padding: 14 },
  note: { minHeight: 92 },
  pills: { gap: 8 },
  pill: { backgroundColor: Colors.card, borderColor: Colors.border, borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9 },
  pillActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  pillText: { color: Colors.textSecondary, fontWeight: '600' },
  pillTextActive: { color: Colors.primary },
  segment: { backgroundColor: Colors.border, borderRadius: 12, flexDirection: 'row', padding: 3 },
  segmentButton: { alignItems: 'center', borderRadius: 10, flex: 1, paddingVertical: 10 },
  segmentActive: { backgroundColor: Colors.card },
  segmentText: { color: Colors.textSecondary, fontWeight: '600' },
  segmentTextActive: { color: Colors.text },
  switchRow: { alignItems: 'center', backgroundColor: Colors.card, borderRadius: 12, flexDirection: 'row', marginTop: 12, padding: 14 },
  switchText: { flex: 1, paddingRight: 12 },
  switchTitle: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  switchBody: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 3 },
  button: { alignItems: 'center', backgroundColor: Colors.primary, borderRadius: 12, marginTop: 24, paddingVertical: 15 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.45 },
});
