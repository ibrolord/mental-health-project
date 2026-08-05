import { useEffect, useMemo, useRef, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import {
  Alert,
  Pressable,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  AppButton,
  AppCard,
  AppInput,
  AppScreen,
  ChoiceChip,
  EmptyState,
  PageHeader,
  SectionHeader,
  Stat,
  appUiStyles,
} from '@/components/AppUI';
import { useAuth } from '@/lib/auth-context';
import { Colors } from '@/lib/constants';
import {
  DEFAULT_SCOPES,
  REWARD_COPY,
  SCOPE_COPY,
  createInvite,
  describeCelebration,
  fetchSnapshot,
  listInvites,
  listReceivedCelebrations,
  listSharingWith,
  listSupporting,
  markCelebrationSeen,
  revokeInvite,
  revokeLink,
  sendPartnerCelebration,
  updateScope,
  type CelebrationKind,
  type PartnerCelebration,
  type PartnerInvite,
  type PartnerLink,
  type PartnerScopes,
  type PartnerSnapshot,
  type RewardKey,
  type ScopeKey,
} from '@/lib/partners';
import { PartnerSupportPreferences } from '@/components/PartnerSupportPreferences';

const CORE_SCOPES: ScopeKey[] = [
  'share_checkins',
  'share_goals',
  'share_habits',
  'share_streaks',
  'allow_celebrations',
];
const MORE_SCOPES: ScopeKey[] = [
  'share_journal_activity',
  'share_assessment_activity',
  'share_planner_progress',
  'share_focus_progress',
  'share_library_activity',
];
const REWARD_OPTIONS = Object.entries(REWARD_COPY) as [RewardKey, string][];

function ScopeToggle({
  scopeKey,
  checked,
  disabled,
  onChange,
}: {
  scopeKey: ScopeKey;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  const copy = SCOPE_COPY[scopeKey];
  return (
    <View style={styles.scopeRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.scopeTitle}>{copy.label}</Text>
        <Text style={appUiStyles.muted}>{copy.description}</Text>
      </View>
      <Switch
        accessibilityLabel={`Share ${copy.label}`}
        value={checked}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: Colors.border, true: Colors.sage }}
        thumbColor="#fffef8"
      />
    </View>
  );
}

function SnapshotStats({ snapshot }: { snapshot: PartnerSnapshot }) {
  const stats: ({ label: string; value: string | number } | null)[] = [
    snapshot.checkins
      ? { label: 'Check-ins this week', value: `${snapshot.checkins.days}/7` }
      : null,
    snapshot.goals
      ? { label: 'Goals completed', value: snapshot.goals.completed }
      : null,
    snapshot.habits
      ? {
          label: 'Habits today',
          value: `${snapshot.habits.completed_today}/${snapshot.habits.due_today}`,
        }
      : null,
    snapshot.streaks
      ? { label: 'Best streak', value: `${snapshot.streaks.best_current}d` }
      : null,
    snapshot.journal
      ? { label: 'Journal entries', value: snapshot.journal.entries }
      : null,
    snapshot.assessments
      ? { label: 'Assessments', value: snapshot.assessments.completed }
      : null,
    snapshot.planner
      ? { label: 'Plan items', value: snapshot.planner.completed }
      : null,
    snapshot.focus
      ? { label: 'Focus sessions', value: snapshot.focus.sessions }
      : null,
    snapshot.library
      ? { label: 'Library activity', value: snapshot.library.items }
      : null,
  ];
  const visible = stats.filter(
    (item): item is { label: string; value: string | number } => item !== null
  );

  if (visible.length === 0) {
    return (
      <Text style={[appUiStyles.muted, { marginTop: 12 }]}>
        They have paused all sharing.
      </Text>
    );
  }

  return (
    <View style={styles.stats}>
      {visible.map((item) => (
        <Stat key={item.label} label={item.label} value={item.value} />
      ))}
    </View>
  );
}

function SupportingCard({
  link,
  onLeave,
}: {
  link: PartnerLink;
  onLeave: () => void;
}) {
  const [snapshot, setSnapshot] = useState<PartnerSnapshot | null>(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState<CelebrationKind | null>(null);
  const [rewardKey, setRewardKey] = useState<RewardKey>('walk_together');

  useEffect(() => {
    let active = true;
    void fetchSnapshot(link.owner_id)
      .then((next) => {
        if (active) setSnapshot(next);
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message);
      });
    return () => {
      active = false;
    };
  }, [link.owner_id]);

  const source =
    (snapshot?.streaks?.best_current ?? 0) > 0
      ? 'habit_streak'
      : (snapshot?.goals?.completed ?? 0) > 0
        ? 'goal_progress'
        : 'general';

  const celebrate = async (kind: CelebrationKind) => {
    if (sending) return;
    setSending(kind);
    setError('');
    try {
      await sendPartnerCelebration(
        link.owner_id,
        source,
        kind,
        kind === 'reward' ? rewardKey : undefined
      );
      Alert.alert(
        kind === 'reward' ? 'Reward sent' : 'Cheer sent',
        'They will see it in MHtoolkit.'
      );
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSending(null);
    }
  };

  return (
    <AppCard>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>
            {link.partner_label ?? 'Someone you support'}
          </Text>
          <Text style={appUiStyles.muted}>Shared progress</Text>
        </View>
        <AppButton
          label="Leave"
          icon="log-out"
          variant="danger"
          onPress={onLeave}
        />
      </View>
      {snapshot ? (
        <SnapshotStats snapshot={snapshot} />
      ) : error ? null : (
        <Text style={[appUiStyles.muted, { marginTop: 12 }]}>Loading...</Text>
      )}
      {error ? (
        <Text style={[appUiStyles.error, { marginTop: 10 }]}>{error}</Text>
      ) : null}
      {snapshot?.scopes.celebrations ? (
        <View style={styles.celebrateBox}>
          <Text style={styles.scopeTitle}>Celebrate their progress</Text>
          <View style={styles.actions}>
            <AppButton
              label="Send a cheer"
              icon="star"
              loading={sending === 'cheer'}
              disabled={Boolean(sending)}
              onPress={() => void celebrate('cheer')}
            />
            <AppButton
              label="Offer reward"
              icon="gift"
              variant="secondary"
              loading={sending === 'reward'}
              disabled={Boolean(sending)}
              onPress={() => void celebrate('reward')}
            />
          </View>
          <View style={styles.rewardChips}>
            {REWARD_OPTIONS.map(([key, label]) => (
              <ChoiceChip
                key={key}
                label={label}
                selected={rewardKey === key}
                onPress={() => setRewardKey(key)}
              />
            ))}
          </View>
        </View>
      ) : null}
    </AppCard>
  );
}

export default function PartnerScreen() {
  const router = useRouter();
  const {
    user,
    isAnonymous,
    accountUpgradePending,
    loading: authLoading,
  } = useAuth();
  const [scopes, setScopes] = useState<PartnerScopes>({ ...DEFAULT_SCOPES });
  const [label, setLabel] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [invites, setInvites] = useState<PartnerInvite[]>([]);
  const [sharingWith, setSharingWith] = useState<PartnerLink[]>([]);
  const [supporting, setSupporting] = useState<PartnerLink[]>([]);
  const [celebrations, setCelebrations] = useState<PartnerCelebration[]>([]);
  const [moreOpen, setMoreOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyScope, setBusyScope] = useState('');
  const [error, setError] = useState('');
  const createRef = useRef(false);
  const permanentUser = Boolean(user && !isAnonymous && !accountUpgradePending);

  const refresh = async () => {
    if (!user || isAnonymous) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [nextInvites, nextSharing, nextSupporting, nextCelebrations] =
        await Promise.all([
          listInvites(),
          listSharingWith(user.id),
          listSupporting(user.id),
          listReceivedCelebrations(user.id),
        ]);
      setInvites(nextInvites);
      setSharingWith(nextSharing);
      setSupporting(nextSupporting);
      setCelebrations(nextCelebrations);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) void refresh();
    // refresh is intentionally keyed to identity changes only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, isAnonymous]);

  const allScopeKeys = useMemo(
    () => [...CORE_SCOPES, ...MORE_SCOPES],
    []
  );

  const makeInvite = async () => {
    if (createRef.current) return;
    createRef.current = true;
    setCreating(true);
    setError('');
    try {
      const result = await createInvite(scopes, label);
      setInvites((current) => [result.invite, ...current]);
      setInviteUrl(result.url);
      setLabel('');
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      createRef.current = false;
      setCreating(false);
    }
  };

  const shareInvite = async () => {
    if (!inviteUrl) return;
    try {
      await Share.share({
        message: `Join me as an accountability partner on MHtoolkit: ${inviteUrl}`,
        url: inviteUrl,
      });
    } catch {
      setError('The share sheet could not be opened.');
    }
  };

  const changeLinkScope = async (
    link: PartnerLink,
    scopeKey: ScopeKey,
    next: boolean
  ) => {
    const key = `${link.id}:${scopeKey}`;
    if (busyScope) return;
    setBusyScope(key);
    setError('');
    setSharingWith((current) =>
      current.map((candidate) =>
        candidate.id === link.id ? { ...candidate, [scopeKey]: next } : candidate
      )
    );
    try {
      await updateScope(link.id, scopeKey, next);
    } catch (reason) {
      setSharingWith((current) =>
        current.map((candidate) =>
          candidate.id === link.id
            ? { ...candidate, [scopeKey]: link[scopeKey] }
            : candidate
        )
      );
      setError((reason as Error).message);
    } finally {
      setBusyScope('');
    }
  };

  const confirmRevoke = (
    title: string,
    message: string,
    action: () => Promise<void>
  ) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          void action().catch((reason) => {
            setError((reason as Error).message);
          }),
      },
    ]);
  };

  if (!authLoading && !permanentUser) {
    return (
      <AppScreen>
        <PageHeader
          eyebrow="Accountability"
          title={
            accountUpgradePending
              ? 'Finish your account to connect.'
              : 'Create an account to connect.'
          }
          description={
            accountUpgradePending
              ? 'Confirm your email and create a password, then your partner setup will continue here.'
              : 'A permanent account keeps partner controls tied to you across devices.'
          }
          icon="users"
        />
        <AppCard>
          <View style={styles.accountActions}>
            <AppButton
              label={accountUpgradePending ? 'Finish account setup' : 'Create account'}
              icon="user-plus"
              onPress={() =>
                router.push({
                  pathname: '/auth/signup',
                  params: { returnTo: '/partner' },
                })
              }
            />
            {!accountUpgradePending ? (
              <AppButton
                label="Sign in"
                icon="log-in"
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: '/auth/login',
                    params: { returnTo: '/partner' },
                  })
                }
              />
            ) : null}
          </View>
        </AppCard>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <PageHeader
        eyebrow="Accountability"
        title="Share progress on your terms."
        description="Choose the counts a partner can see. Private text and scores stay private."
        icon="users"
      />

      <PartnerSupportPreferences />

      <AppCard>
        <SectionHeader
          title="Invite a partner"
          description="The invite expires after seven days and works once."
        />
        <AppInput
          label="Name or label (optional)"
          value={label}
          onChangeText={setLabel}
          maxLength={80}
          placeholder="Example: Sam"
        />
        {CORE_SCOPES.map((scopeKey) => (
          <ScopeToggle
            key={scopeKey}
            scopeKey={scopeKey}
            checked={scopes[scopeKey]}
            onChange={(next) =>
              setScopes((current) => ({ ...current, [scopeKey]: next }))
            }
          />
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: moreOpen }}
          onPress={() => setMoreOpen((current) => !current)}
          style={styles.moreButton}
        >
          <Text style={styles.moreText}>More sharing options</Text>
          <Feather
            name={moreOpen ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={Colors.primary}
          />
        </Pressable>
        {moreOpen
          ? MORE_SCOPES.map((scopeKey) => (
              <ScopeToggle
                key={scopeKey}
                scopeKey={scopeKey}
                checked={scopes[scopeKey]}
                onChange={(next) =>
                  setScopes((current) => ({ ...current, [scopeKey]: next }))
                }
              />
            ))
          : null}
        {error ? (
          <Text style={[appUiStyles.error, { marginTop: 10 }]}>{error}</Text>
        ) : null}
        <AppButton
          label="Create invite"
          icon="link"
          loading={creating}
          disabled={!permanentUser}
          onPress={() => void makeInvite()}
          style={{ marginTop: 14 }}
        />
      </AppCard>

      {inviteUrl ? (
        <AppCard style={styles.inviteReady}>
          <SectionHeader
            title="Invite ready"
            description="Share it now. The raw invite is not stored and will disappear when you leave this screen."
          />
          <AppButton
            label="Share invite"
            icon="share-2"
            onPress={() => void shareInvite()}
          />
        </AppCard>
      ) : null}

      <SectionHeader title="Pending invites" />
      {invites.length === 0 ? (
        <Text style={appUiStyles.muted}>No pending invites.</Text>
      ) : (
        invites.map((invite) => (
          <AppCard key={invite.id} quiet>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>
                  {invite.invitee_label ?? 'Accountability partner'}
                </Text>
                <Text style={appUiStyles.muted}>
                  Expires {new Date(invite.expires_at).toLocaleDateString()}
                </Text>
              </View>
              <AppButton
                label="Revoke"
                icon="trash-2"
                variant="danger"
                onPress={() =>
                  confirmRevoke(
                    'Revoke invite?',
                    'The invite link will stop working.',
                    async () => {
                      await revokeInvite(invite.id);
                      setInvites((current) =>
                        current.filter(({ id }) => id !== invite.id)
                      );
                    }
                  )
                }
              />
            </View>
          </AppCard>
        ))
      )}

      <SectionHeader
        title="People seeing your progress"
        description="Changes apply immediately."
      />
      {loading ? (
        <Text style={appUiStyles.muted}>Loading connections...</Text>
      ) : sharingWith.length === 0 ? (
        <EmptyState
          icon="shield"
          title="Nothing is being shared"
          description="Create an invite when you are ready."
        />
      ) : (
        sharingWith.map((link) => (
          <AppCard key={link.id}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>
                  {link.partner_label ?? 'Accountability partner'}
                </Text>
                <Text style={appUiStyles.muted}>Counts only</Text>
              </View>
              <AppButton
                label="Remove"
                icon="user-x"
                variant="danger"
                onPress={() =>
                  confirmRevoke(
                    'Remove partner?',
                    'They will no longer see your progress.',
                    async () => {
                      await revokeLink(link.id);
                      setSharingWith((current) =>
                        current.filter(({ id }) => id !== link.id)
                      );
                    }
                  )
                }
              />
            </View>
            {allScopeKeys.map((scopeKey) => (
              <ScopeToggle
                key={scopeKey}
                scopeKey={scopeKey}
                checked={link[scopeKey]}
                disabled={Boolean(busyScope)}
                onChange={(next) =>
                  void changeLinkScope(link, scopeKey, next)
                }
              />
            ))}
          </AppCard>
        ))
      )}

      <SectionHeader title="People you support" />
      {supporting.length === 0 ? (
        <Text style={appUiStyles.muted}>
          You are not supporting anyone yet.
        </Text>
      ) : (
        supporting.map((link) => (
          <SupportingCard
            key={link.id}
            link={link}
            onLeave={() =>
              confirmRevoke(
                'Leave this connection?',
                'You will stop seeing their shared progress.',
                async () => {
                  await revokeLink(link.id);
                  setSupporting((current) =>
                    current.filter(({ id }) => id !== link.id)
                  );
                }
              )
            }
          />
        ))
      )}

      {celebrations.length > 0 ? (
        <>
          <SectionHeader title="Recent cheers" />
          {celebrations.map((event) => (
            <AppCard key={event.id} quiet>
              <View style={styles.cardHeader}>
                <Feather
                  name={event.kind === 'reward' ? 'gift' : 'star'}
                  size={20}
                  color={Colors.accent}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.celebrationText}>
                    {describeCelebration(event)}
                  </Text>
                  <Text style={appUiStyles.muted}>
                    {new Date(event.created_at).toLocaleDateString()}
                  </Text>
                </View>
                {!event.seen_at ? (
                  <AppButton
                    label="Seen"
                    icon="check"
                    variant="quiet"
                    onPress={() =>
                      void markCelebrationSeen(event.id)
                        .then(() =>
                          setCelebrations((current) =>
                            current.map((candidate) =>
                              candidate.id === event.id
                                ? {
                                    ...candidate,
                                    seen_at: new Date().toISOString(),
                                  }
                                : candidate
                            )
                          )
                        )
                        .catch((reason) =>
                          setError((reason as Error).message)
                        )
                    }
                  />
                ) : null}
              </View>
            </AppCard>
          ))}
        </>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  accountActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  scopeRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingVertical: 11,
  },
  scopeTitle: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  moreButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  moreText: { color: Colors.primary, fontSize: 13, fontWeight: '700' },
  inviteReady: {
    backgroundColor: Colors.successLight,
    borderColor: '#b8d8c5',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  cardTitle: { color: Colors.text, fontSize: 17, fontWeight: '700' },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 16,
  },
  celebrateBox: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 16,
    paddingTop: 14,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  rewardChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 10,
  },
  celebrationText: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
});
