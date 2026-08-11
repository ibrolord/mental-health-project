import { useCallback, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Share, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/lib/constants';
import { useAuth } from '@/lib/auth-context';
import { accountabilityClient } from '@/lib/accountability/runtime';
import type { AccountabilityConnection, AccountabilityNudge, ScopeControl, SharedCommitment } from '@/lib/accountability/types';
import { accountabilityInviteUrl, clearAccountabilityInvite, loadAccountabilityInvite, type StoredAccountabilityInvite } from '@/lib/accountability/invite-storage';
import { CommitmentCard } from '@/components/accountability/CommitmentCard';
import { ScreenState } from '@/components/accountability/ScreenState';

type ListMode = 'mine' | 'theirs';

export default function TogetherScreen() {
  const router = useRouter();
  const { isAnonymous } = useAuth();
  const [mode, setMode] = useState<ListMode>('mine');
  const [connections, setConnections] = useState<AccountabilityConnection[]>([]);
  const [commitments, setCommitments] = useState<SharedCommitment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<ScopeControl | null>(null);
  const [savingScope, setSavingScope] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [receivedNudges, setReceivedNudges] = useState<AccountabilityNudge[]>([]);
  const [storedInvite, setStoredInvite] = useState<StoredAccountabilityInvite | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isAnonymous) {
      setLoading(false);
      return;
    }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const nextConnections = await accountabilityClient.listConnections();
      const active = nextConnections.filter((connection) => connection.status === 'active');
      const lists = await Promise.all(
        active.map((connection) => accountabilityClient.listCommitments({ connectionId: connection.id }))
      );
      setConnections(nextConnections);
      setCommitments(lists.flat());
      const [nextScope, nextNudges, nextStoredInvite] = await Promise.all([
        active[0] ? accountabilityClient.getScopeControl({ connectionId: active[0].id }) : Promise.resolve(null),
        active[0] ? accountabilityClient.listNudges({ connectionId: active[0].id }) : Promise.resolve([]),
        loadAccountabilityInvite(),
      ]);
      setScope(nextScope);
      setReceivedNudges(nextNudges);
      setStoredInvite(nextStoredInvite);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Together could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAnonymous]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const disconnect = (connection: AccountabilityConnection, block: boolean) => {
    Alert.alert(
      block ? 'Block this partner?' : 'End this connection?',
      block
        ? 'They will lose access to everything you shared in Together.'
        : 'You will both lose access to shared commitments in Together.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: block ? 'Block' : 'End connection',
          style: 'destructive',
          onPress: () => {
            const action = block
              ? accountabilityClient.blockConnection({ connectionId: connection.id })
              : accountabilityClient.revokeConnection({ connectionId: connection.id });
            void action.then(() => load()).catch((actionError: unknown) => {
              Alert.alert('Could not update connection', actionError instanceof Error ? actionError.message : 'Please try again.');
            });
          },
        },
      ]
    );
  };

  const updateScope = async (patch: Partial<Omit<ScopeControl, 'connectionId'>>) => {
    if (!scope || savingScope) return;
    const previous = scope;
    const next = { ...scope, ...patch };
    setScope(next);
    setSavingScope(true);
    try {
      setScope(await accountabilityClient.updateScopeControl(next));
    } catch (scopeError) {
      setScope(previous);
      Alert.alert('Sharing not updated', scopeError instanceof Error ? scopeError.message : 'Please try again.');
    } finally {
      setSavingScope(false);
    }
  };

  if (isAnonymous) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ScreenState
          kind="empty"
          title="Sign in to use Together"
          message="Together connects two verified accounts. Your private MHtoolkit data is never included."
          actionLabel="Sign in"
          onAction={() => router.push('/auth/login')}
        />
      </SafeAreaView>
    );
  }

  if (loading) {
    return <SafeAreaView style={styles.safe} edges={['bottom']}><ScreenState kind="loading" title="Loading Together" message="Getting your shared commitments…" /></SafeAreaView>;
  }

  if (error) {
    return <SafeAreaView style={styles.safe} edges={['bottom']}><ScreenState kind="error" title="Together is unavailable" message={error} actionLabel="Try again" onAction={() => void load()} /></SafeAreaView>;
  }

  const visible = commitments.filter((commitment) => mode === 'mine' ? commitment.isMine : !commitment.isMine);
  const activeConnections = connections.filter((connection) => connection.status === 'active');

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
      >
        <Text style={styles.intro}>Only commitments you explicitly share appear here. Moods, assessments, chats, goals, and reflections stay private.</Text>
        <View style={styles.actionRow}>
          <TouchableOpacity accessibilityRole="button" accessibilityHint="Creates an invite for an accountability partner" style={styles.secondaryButton} onPress={() => router.push('/accountability/invite')}>
            <Text style={styles.secondaryButtonText}>Invite</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityHint="Join with a code from your partner" style={styles.secondaryButton} onPress={() => router.push('/accountability/join')}>
            <Text style={styles.secondaryButtonText}>Join</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityHint="Shares a new commitment with an active partner"
            disabled={activeConnections.length === 0}
            style={[styles.primaryButton, activeConnections.length === 0 && styles.disabled]}
            onPress={() => router.push('/accountability/create')}
          >
            <Text style={styles.primaryButtonText}>Share</Text>
          </TouchableOpacity>
        </View>

        {connections.length > 0 || scope ? (
          <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: manageOpen }} style={styles.manageButton} onPress={() => setManageOpen((value) => !value)}>
            <Text style={styles.manageButtonText}>Partner & privacy</Text>
            <Text style={styles.manageButtonText}>{manageOpen ? 'Hide' : 'Manage'}</Text>
          </TouchableOpacity>
        ) : null}

        {manageOpen && connections.length > 0 ? (
          <View style={styles.connectionSection}>
            <Text style={styles.sectionTitle}>Connections</Text>
            {connections.map((connection) => (
              <View key={connection.id} style={styles.connectionRow}>
                <View style={styles.connectionText}>
                  <Text style={styles.connectionName}>{connection.partnerName}</Text>
                  <Text style={styles.connectionStatus}>{connection.status}</Text>
                </View>
                {connection.status === 'active' ? (
                  <View style={styles.connectionActions}>
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`End connection with ${connection.partnerName}`} style={styles.actionTarget} onPress={() => disconnect(connection, false)}><Text style={styles.link}>End</Text></TouchableOpacity>
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Block ${connection.partnerName}`} style={styles.actionTarget} onPress={() => disconnect(connection, true)}><Text style={styles.dangerLink}>Block</Text></TouchableOpacity>
                  </View>
                ) : connection.status === 'pending' && storedInvite?.connectionId === connection.id ? (
                  <View style={styles.connectionActions}>
                    <TouchableOpacity accessibilityRole="button" style={styles.actionTarget} onPress={() => void Share.share({ message: `Join me on MHtoolkit Together: ${accountabilityInviteUrl(storedInvite.token)}` })}><Text style={styles.link}>Share</Text></TouchableOpacity>
                    <TouchableOpacity accessibilityRole="button" style={styles.actionTarget} onPress={() => {
                      Alert.alert('Cancel invite?', `This invite for ${storedInvite.partnerEmail} will stop working.`, [{ text: 'Keep it', style: 'cancel' }, { text: 'Cancel invite', style: 'destructive', onPress: () => void accountabilityClient.cancelInvite({ connectionId: connection.id }).then(clearAccountabilityInvite).then(() => load()).catch((cause: unknown) => Alert.alert('Invite not cancelled', cause instanceof Error ? cause.message : 'Please try again.')) }]);
                    }}><Text style={styles.dangerLink}>Cancel</Text></TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {manageOpen && scope ? (
          <View style={styles.scopeCard}>
            <Text style={styles.sectionTitle}>What my partner can see</Text>
            <Text style={styles.scopeIntro}>These controls apply only to Together commitments.</Text>
            <View style={styles.scopeRow}>
              <Text style={styles.scopeLabel}>Commitment titles</Text>
              <Switch accessibilityLabel="Share commitment titles" disabled={savingScope} value={scope.sharesCommitmentTitles} onValueChange={(value) => void updateScope({ sharesCommitmentTitles: value })} trackColor={{ false: Colors.border, true: Colors.primary }} />
            </View>
            <View style={styles.scopeRow}>
              <Text style={styles.scopeLabel}>Check-in counts</Text>
              <Switch accessibilityLabel="Share check-in counts" disabled={savingScope} value={scope.sharesProgress} onValueChange={(value) => void updateScope({ sharesProgress: value })} trackColor={{ false: Colors.border, true: Colors.primary }} />
            </View>
            <View style={styles.scopeRow}>
              <Text style={styles.scopeLabel}>Notes I mark as shared</Text>
              <Switch accessibilityLabel="Allow explicitly shared Together notes" disabled={savingScope} value={scope.sharesNotes} onValueChange={(value) => void updateScope({ sharesNotes: value })} trackColor={{ false: Colors.border, true: Colors.primary }} />
            </View>
          </View>
        ) : null}

        {receivedNudges.length > 0 ? (
          <View style={styles.supportCard}>
            <Text style={styles.sectionTitle}>Support from your partner</Text>
            {receivedNudges.slice(0, 3).map((nudge) => <Text key={nudge.id} style={styles.supportText}>{nudge.kind === 'celebrate_progress' ? 'They celebrated your progress.' : nudge.kind === 'gentle_reminder' ? 'They sent a gentle reminder.' : 'They sent encouragement.'}</Text>)}
          </View>
        ) : null}

        <View style={styles.segment} accessibilityRole="tablist">
          {(['mine', 'theirs'] as const).map((item) => (
            <TouchableOpacity
              key={item}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === item }}
              style={[styles.segmentButton, mode === item && styles.segmentActive]}
              onPress={() => setMode(item)}
            >
              <Text style={[styles.segmentText, mode === item && styles.segmentTextActive]}>{item === 'mine' ? 'Mine' : 'Theirs'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {visible.length === 0 ? (
          <ScreenState
            kind="empty"
            title={mode === 'mine' ? 'No shared commitments yet' : 'Nothing shared with you yet'}
            message={mode === 'mine' ? 'Share one small commitment when you are ready.' : 'Your partner controls what they share.'}
            actionLabel={mode === 'mine' && activeConnections.length > 0 ? 'Share a commitment' : undefined}
            onAction={mode === 'mine' && activeConnections.length > 0 ? () => router.push('/accountability/create') : undefined}
          />
        ) : visible.map((commitment) => (
          <CommitmentCard
            key={commitment.id}
            commitment={commitment}
            onPress={() => router.push({ pathname: '/accountability/[commitmentId]', params: { commitmentId: commitment.id } })}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: Colors.background, flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  intro: { backgroundColor: Colors.primaryLight, borderRadius: 12, color: Colors.textSecondary, fontSize: 14, lineHeight: 21, padding: 14 },
  actionRow: { flexDirection: 'row', gap: 10, marginVertical: 16 },
  primaryButton: { alignItems: 'center', backgroundColor: Colors.primary, borderRadius: 12, flex: 1, paddingVertical: 13 },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  secondaryButton: { alignItems: 'center', backgroundColor: Colors.card, borderColor: Colors.border, borderRadius: 12, borderWidth: 1, flex: 1, paddingVertical: 13 },
  secondaryButtonText: { color: Colors.primary, fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  connectionSection: { marginBottom: 18 },
  sectionTitle: { color: Colors.text, fontSize: 17, fontWeight: '700', marginBottom: 10 },
  connectionRow: { alignItems: 'center', backgroundColor: Colors.card, borderRadius: 12, flexDirection: 'row', marginBottom: 8, padding: 13 },
  connectionText: { flex: 1 },
  connectionName: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  connectionStatus: { color: Colors.textSecondary, fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  connectionActions: { flexDirection: 'row', gap: 14 },
  actionTarget: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44, paddingHorizontal: 6 },
  link: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
  dangerLink: { color: Colors.danger, fontSize: 13, fontWeight: '600' },
  segment: { backgroundColor: Colors.border, borderRadius: 12, flexDirection: 'row', marginBottom: 16, padding: 3 },
  segmentButton: { alignItems: 'center', borderRadius: 10, flex: 1, paddingVertical: 10 },
  segmentActive: { backgroundColor: Colors.card },
  segmentText: { color: Colors.textSecondary, fontSize: 15, fontWeight: '600' },
  segmentTextActive: { color: Colors.text },
  scopeCard: { backgroundColor: Colors.card, borderColor: Colors.border, borderRadius: 14, borderWidth: 1, marginBottom: 18, padding: 14 },
  scopeIntro: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, marginBottom: 4, marginTop: -4 },
  scopeRow: { alignItems: 'center', borderTopColor: Colors.border, borderTopWidth: 1, flexDirection: 'row', minHeight: 48 },
  scopeLabel: { color: Colors.text, flex: 1, fontSize: 14, paddingRight: 12 },
  manageButton: { alignItems: 'center', backgroundColor: Colors.card, borderColor: Colors.border, borderRadius: 12, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, minHeight: 48, paddingHorizontal: 14 },
  manageButtonText: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  supportCard: { backgroundColor: Colors.successLight, borderRadius: 12, marginBottom: 16, padding: 14 },
  supportText: { color: Colors.text, fontSize: 14, lineHeight: 20, marginTop: 4 },
});
