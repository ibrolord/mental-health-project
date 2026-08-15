import { useCallback, useState } from 'react';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Alert, RefreshControl, ScrollView, Share, StyleSheet, Switch, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Radius, Spacing, Typography } from '@/lib/constants';
import { useAuth } from '@/lib/auth-context';
import { accountabilityClient } from '@/lib/accountability/runtime';
import type { AccountabilityConnection, AccountabilityNudge, ScopeControl, SharedCommitment } from '@/lib/accountability/types';
import { accountabilityInviteUrl, clearAccountabilityInvite, loadAccountabilityInvite, type StoredAccountabilityInvite } from '@/lib/accountability/invite-storage';
import { CommitmentCard } from '@/components/accountability/CommitmentCard';
import { ScreenState } from '@/components/accountability/ScreenState';

type ListMode = 'mine' | 'theirs';

export default function TogetherScreen() {
  const router = useRouter();
  const { fontScale } = useWindowDimensions();
  const stacksPrimaryActions = fontScale >= 1.35;
  const { isAnonymous } = useAuth();
  const [mode, setMode] = useState<ListMode>('mine');
  const [connections, setConnections] = useState<AccountabilityConnection[]>([]);
  const [commitments, setCommitments] = useState<SharedCommitment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scopes, setScopes] = useState<Record<string, ScopeControl>>({});
  const [selectedConnectionId, setSelectedConnectionId] = useState('');
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
      const [scopeEntries, nudgeLists, nextStoredInvite] = await Promise.all([
        Promise.all(active.map(async (connection) => [
          connection.id,
          await accountabilityClient.getScopeControl({ connectionId: connection.id }),
        ] as const)),
        Promise.all(active.map((connection) => accountabilityClient.listNudges({ connectionId: connection.id }))),
        loadAccountabilityInvite(),
      ]);
      setScopes(Object.fromEntries(scopeEntries));
      setSelectedConnectionId((current) => active.some((connection) => connection.id === current)
        ? current
        : active[0]?.id ?? '');
      setReceivedNudges(nudgeLists.flat());
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
    const scope = scopes[selectedConnectionId];
    if (!scope || !selectedConnectionId || savingScope) return;
    const previous = scope;
    const next = { ...scope, ...patch };
    setScopes((current) => ({ ...current, [selectedConnectionId]: next }));
    setSavingScope(true);
    try {
      const saved = await accountabilityClient.updateScopeControl(next);
      setScopes((current) => ({ ...current, [selectedConnectionId]: saved }));
    } catch (scopeError) {
      setScopes((current) => ({ ...current, [selectedConnectionId]: previous }));
      Alert.alert('Sharing not updated', scopeError instanceof Error ? scopeError.message : 'Please try again.');
    } finally {
      setSavingScope(false);
    }
  };

  if (isAnonymous) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.anonymousContent} showsVerticalScrollIndicator={false}>
          <View accessibilityLabel="Together leaf" accessibilityRole="image" style={styles.anonymousLeaf}>
            <MaterialCommunityIcons color={Colors.primary} name="leaf" size={32} />
          </View>
          <Text style={styles.eyebrow}>TOGETHER</Text>
          <Text accessibilityRole="header" style={styles.anonymousTitle}>A little easier with someone beside you.</Text>
          <Text style={styles.anonymousDescription}>Choose one commitment, check in, and celebrate the effort.</Text>

          <View style={styles.benefitCard}>
            <View style={styles.benefitRow}>
              <MaterialCommunityIcons color={Colors.primary} name="check-circle-outline" size={21} />
              <Text style={styles.benefitText}>Share a small commitment</Text>
            </View>
            <View style={styles.benefitRow}>
              <MaterialCommunityIcons color={Colors.primary} name="hand-heart-outline" size={21} />
              <Text style={styles.benefitText}>Send gentle support</Text>
            </View>
            <View style={styles.benefitRow}>
              <MaterialCommunityIcons color={Colors.primary} name="shield-lock-outline" size={21} />
              <Text style={styles.benefitText}>You control what is shared</Text>
            </View>
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            style={styles.signInButton}
            onPress={() => router.push({ pathname: '/auth/login', params: { returnTo: '/accountability' } })}
          >
            <Text style={styles.primaryButtonText}>Sign in or create account</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (loading) {
    return <SafeAreaView style={styles.safe} edges={['bottom']}><ScreenState kind="loading" title="Loading Together" message="Getting your shared commitments…" /></SafeAreaView>;
  }

  if (error) {
    return <SafeAreaView style={styles.safe} edges={['bottom']}><ScreenState kind="error" title="Together is unavailable" message={error} actionLabel="Try again" onAction={() => void load()} /></SafeAreaView>;
  }

  const activeConnections = connections.filter((connection) => connection.status === 'active');
  const selectedConnection = activeConnections.find((connection) => connection.id === selectedConnectionId) ?? null;
  const scope = selectedConnectionId ? scopes[selectedConnectionId] ?? null : null;
  const visibleNudges = receivedNudges.filter((nudge) => !selectedConnectionId || nudge.connectionId === selectedConnectionId);
  const visible = commitments.filter((commitment) =>
    (!selectedConnectionId || commitment.connectionId === selectedConnectionId) &&
    (mode === 'mine' ? commitment.isMine : !commitment.isMine)
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
      >
        <View style={styles.heroRow}>
          <View accessibilityLabel="Together leaf" accessibilityRole="image" style={styles.leafMark}>
            <MaterialCommunityIcons color={Colors.primary} name="leaf" size={27} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>TOGETHER</Text>
            <Text accessibilityRole="header" style={styles.heroTitle}>Keep showing up, together.</Text>
            <Text style={styles.heroDescription}>One shared commitment at a time.</Text>
          </View>
        </View>
        <View style={styles.privacyNote}>
          <MaterialCommunityIcons color={Colors.primary} name="lock-outline" size={17} />
          <Text style={styles.privacyNoteText}>Only what you choose for Together is shared.</Text>
        </View>
        <View style={[styles.actionRow, stacksPrimaryActions && styles.actionRowStacked]}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityHint={activeConnections.length > 0 ? 'Shares a new commitment with an active partner' : 'Creates an invite for an accountability partner'}
            style={styles.primaryButton}
            onPress={() => router.push(activeConnections.length > 0 ? '/accountability/create' : '/accountability/invite')}
          >
            <Text style={styles.primaryButtonText}>{activeConnections.length > 0 ? 'Add commitment' : 'Invite someone'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityHint="Join with a code from your partner"
            style={styles.secondaryButton}
            onPress={() => router.push('/accountability/join')}
          >
            <Text style={styles.secondaryButtonText}>Enter code</Text>
          </TouchableOpacity>
        </View>

        {activeConnections.length > 1 ? (
          <View style={styles.partnerPicker} accessibilityRole="tablist">
            <Text style={styles.partnerPickerLabel}>Partner</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.partnerPickerOptions}>
              {activeConnections.map((connection) => {
                const selected = connection.id === selectedConnectionId;
                return (
                  <TouchableOpacity
                    key={connection.id}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    style={[styles.partnerChip, selected && styles.partnerChipSelected]}
                    onPress={() => setSelectedConnectionId(connection.id)}
                  >
                    <Text style={[styles.partnerChipText, selected && styles.partnerChipTextSelected]}>{connection.partnerName}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

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
            <Text style={styles.sectionTitle}>What {selectedConnection?.partnerName ?? 'my partner'} can see</Text>
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
            <TouchableOpacity accessibilityRole="button" style={styles.activitySharingLink} onPress={() => router.push('/partner')}>
              <View style={styles.activitySharingCopy}>
                <Text style={styles.activitySharingTitle}>Activity sharing</Text>
                <Text style={styles.activitySharingDescription}>Review any optional app activity counts shared with a partner.</Text>
              </View>
              <MaterialCommunityIcons color={Colors.primary} name="chevron-right" size={22} />
            </TouchableOpacity>
          </View>
        ) : null}

        {visibleNudges.length > 0 ? (
          <View style={styles.supportCard}>
            <Text style={styles.sectionTitle}>Support from your partner</Text>
            {visibleNudges.slice(0, 3).map((nudge) => <Text key={nudge.id} style={styles.supportText}>{nudge.kind === 'celebrate_progress' ? 'They celebrated your progress.' : nudge.kind === 'gentle_reminder' ? 'They sent a gentle reminder.' : 'They sent encouragement.'}</Text>)}
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
              <Text style={[styles.segmentText, mode === item && styles.segmentTextActive]}>{item === 'mine' ? 'Shared by me' : 'Shared with me'}</Text>
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
  content: { padding: Spacing.md, paddingBottom: 40 },
  anonymousContent: { flexGrow: 1, padding: Spacing.lg, paddingTop: 44, paddingBottom: 40 },
  anonymousLeaf: { alignItems: 'center', backgroundColor: Colors.primaryLight, borderRadius: 30, height: 60, justifyContent: 'center', marginBottom: Spacing.lg, width: 60 },
  eyebrow: { color: Colors.accent, ...Typography.eyebrow, marginBottom: Spacing.xs },
  anonymousTitle: { color: Colors.text, ...Typography.display, fontSize: 30, lineHeight: 36, maxWidth: 520 },
  anonymousDescription: { color: Colors.textSecondary, fontSize: 16, lineHeight: 23, marginTop: Spacing.sm, maxWidth: 500 },
  benefitCard: { backgroundColor: Colors.card, borderColor: Colors.border, borderRadius: Radius.lg, borderWidth: 1, gap: Spacing.md, marginTop: Spacing.xl, padding: Spacing.lg },
  benefitRow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.sm, minHeight: 32 },
  benefitText: { color: Colors.text, flex: 1, fontSize: 15, fontWeight: '600' },
  signInButton: { alignItems: 'center', backgroundColor: Colors.primary, borderRadius: Radius.md, justifyContent: 'center', marginTop: Spacing.lg, minHeight: 50, paddingHorizontal: Spacing.lg },
  heroRow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  heroCopy: { flex: 1, minWidth: 0 },
  leafMark: { alignItems: 'center', backgroundColor: Colors.primaryLight, borderRadius: 24, height: 48, justifyContent: 'center', width: 48 },
  heroTitle: { color: Colors.text, ...Typography.sectionTitle, fontSize: 23, lineHeight: 28 },
  heroDescription: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  privacyNote: { alignItems: 'center', backgroundColor: Colors.primaryLight, borderRadius: Radius.md, flexDirection: 'row', gap: Spacing.xs, minHeight: 44, paddingHorizontal: Spacing.sm },
  privacyNoteText: { color: Colors.textSecondary, flex: 1, fontSize: 12, lineHeight: 17 },
  actionRow: { flexDirection: 'row', gap: 10, marginVertical: 14 },
  actionRowStacked: { flexDirection: 'column' },
  primaryButton: { alignItems: 'center', backgroundColor: Colors.primary, borderRadius: Radius.md, flex: 1.5, justifyContent: 'center', minHeight: 48, paddingHorizontal: Spacing.sm },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  secondaryButton: { alignItems: 'center', backgroundColor: Colors.card, borderColor: Colors.border, borderRadius: Radius.md, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: Spacing.sm },
  secondaryButtonText: { color: Colors.primary, fontSize: 15, fontWeight: '700' },
  partnerPicker: { marginBottom: Spacing.md },
  partnerPickerLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: Spacing.xs },
  partnerPickerOptions: { gap: Spacing.xs, paddingRight: Spacing.md },
  partnerChip: { alignItems: 'center', backgroundColor: Colors.card, borderColor: Colors.borderStrong, borderRadius: Radius.pill, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: Spacing.md },
  partnerChipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  partnerChipText: { color: Colors.primary, fontSize: 13, fontWeight: '700' },
  partnerChipTextSelected: { color: Colors.card },
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
  activitySharingLink: { alignItems: 'center', borderTopColor: Colors.border, borderTopWidth: 1, flexDirection: 'row', gap: Spacing.sm, minHeight: 60, paddingTop: Spacing.xs },
  activitySharingCopy: { flex: 1, minWidth: 0 },
  activitySharingTitle: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  activitySharingDescription: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
  manageButton: { alignItems: 'center', backgroundColor: Colors.card, borderColor: Colors.border, borderRadius: 12, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, minHeight: 48, paddingHorizontal: 14 },
  manageButtonText: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  supportCard: { backgroundColor: Colors.successLight, borderRadius: 12, marginBottom: 16, padding: 14 },
  supportText: { color: Colors.text, fontSize: 14, lineHeight: 20, marginTop: 4 },
});
