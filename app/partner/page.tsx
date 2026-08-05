'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Check,
  Copy,
  Gift,
  HeartHandshake,
  Loader2,
  Lock,
  LogOut,
  PartyPopper,
  ShieldCheck,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import {
  DEFAULT_SCOPES,
  PRIVATE_CONTENT,
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
  type CelebrationSource,
  type PartnerCelebration,
  type PartnerInvite,
  type PartnerLink,
  type PartnerScopes,
  type PartnerSnapshot,
  type RewardKey,
  type ScopeKey,
} from '@/lib/partners';
import { PartnerSupportPreferences } from '@/components/partner-support-preferences';

const CORE_SCOPE_ORDER: ScopeKey[] = [
  'share_checkins',
  'share_goals',
  'share_habits',
  'share_streaks',
  'allow_celebrations',
];
const MORE_SCOPE_ORDER: ScopeKey[] = [
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
  onChange,
  disabled,
}: {
  scopeKey: ScopeKey;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const copy = SCOPE_COPY[scopeKey];
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors',
        checked ? 'border-primary/35 bg-secondary' : 'border-border bg-card',
        disabled && 'cursor-not-allowed opacity-60'
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors',
          checked
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border bg-background'
        )}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{copy.label}</span>
        <span className="block text-xs leading-relaxed text-muted-foreground">
          {copy.description}
        </span>
      </span>
    </label>
  );
}

function SnapshotCard({
  link,
  onLeave,
}: {
  link: PartnerLink;
  onLeave: () => Promise<void>;
}) {
  const [snapshot, setSnapshot] = useState<PartnerSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rewardKey, setRewardKey] = useState<RewardKey>('walk_together');
  const [sending, setSending] = useState<CelebrationKind | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [celebrationStatus, setCelebrationStatus] = useState<string | null>(null);
  const leavingRef = useRef(false);

  useEffect(() => {
    let active = true;
    fetchSnapshot(link.owner_id)
      .then((data) => {
        if (active) setSnapshot(data);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [link.owner_id]);

  // Every scope can be switched off while the link stays active. Say so
  // plainly rather than rendering an empty stat row that looks broken.
  const allScopesOff =
    snapshot !== null &&
    !snapshot.scopes.goals &&
    !snapshot.scopes.habits &&
    !snapshot.scopes.checkins &&
    !snapshot.scopes.streaks &&
    !snapshot.scopes.journal &&
    !snapshot.scopes.assessments &&
    !snapshot.scopes.planner &&
    !snapshot.scopes.focus &&
    !snapshot.scopes.library;

  const celebrationSource: CelebrationSource =
    (snapshot?.streaks?.best_current ?? 0) > 0
      ? 'habit_streak'
      : (snapshot?.goals?.completed ?? 0) > 0
        ? 'goal_progress'
        : 'general';
  const hasVisibleMilestone = celebrationSource !== 'general';

  const celebrate = async (kind: CelebrationKind) => {
    setSending(kind);
    setError(null);
    setCelebrationStatus(null);
    try {
      await sendPartnerCelebration(
        link.owner_id,
        celebrationSource,
        kind,
        kind === 'reward' ? rewardKey : undefined
      );
      setCelebrationStatus(
        kind === 'reward'
          ? 'The reward is ready for them to see.'
          : 'Your cheer is ready for them to see.'
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(null);
    }
  };

  const leave = async () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    setError(null);
    try {
      await onLeave();
    } catch (err) {
      console.error('Failed to stop following accountability link:', err);
      setError(
        'The connection is still active because it could not be ended. Please try again.'
      );
    } finally {
      leavingRef.current = false;
      setLeaving(false);
    }
  };

  return (
    <div className="app-panel p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">
          {link.partner_label ?? 'Someone you support'}
        </h3>
        <span className="text-[0.65rem] uppercase tracking-[0.08em] text-muted-foreground">
          Shared progress
        </span>
      </div>

      {allScopesOff && (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          They have paused sharing for now. The connection is still active, so
          this will fill back in if they turn something on.
        </p>
      )}

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      {!snapshot && !error && (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          Loading
        </p>
      )}

      {snapshot && (
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {snapshot.checkins && (
            <div>
              <dt className="text-xs text-muted-foreground">Check-ins</dt>
              <dd className="font-display text-2xl text-foreground">
                {snapshot.checkins.days}
                <span className="text-sm text-muted-foreground">/7</span>
              </dd>
            </div>
          )}
          {snapshot.goals && (
            <div>
              <dt className="text-xs text-muted-foreground">Goals done</dt>
              <dd className="font-display text-2xl text-foreground">
                {snapshot.goals.completed}
              </dd>
            </div>
          )}
          {snapshot.habits && (
            <div>
              <dt className="text-xs text-muted-foreground">Habits today</dt>
              <dd className="font-display text-2xl text-foreground">
                {snapshot.habits.completed_today}
                <span className="text-sm text-muted-foreground">
                  /{snapshot.habits.due_today}
                </span>
              </dd>
            </div>
          )}
          {snapshot.streaks && (
            <div>
              <dt className="text-xs text-muted-foreground">Best streak</dt>
              <dd className="font-display text-2xl text-foreground">
                {snapshot.streaks.best_current}
                <span className="text-sm text-muted-foreground"> days</span>
              </dd>
            </div>
          )}
          {snapshot.journal && (
            <div>
              <dt className="text-xs text-muted-foreground">Journal entries</dt>
              <dd className="font-display text-2xl text-foreground">
                {snapshot.journal.entries}
              </dd>
            </div>
          )}
          {snapshot.assessments && (
            <div>
              <dt className="text-xs text-muted-foreground">Assessments</dt>
              <dd className="font-display text-2xl text-foreground">
                {snapshot.assessments.completed}
              </dd>
            </div>
          )}
          {snapshot.planner && (
            <div>
              <dt className="text-xs text-muted-foreground">Plan items</dt>
              <dd className="font-display text-2xl text-foreground">
                {snapshot.planner.completed}
              </dd>
            </div>
          )}
          {snapshot.focus && (
            <div>
              <dt className="text-xs text-muted-foreground">Focus sessions</dt>
              <dd className="font-display text-2xl text-foreground">
                {snapshot.focus.sessions}
              </dd>
            </div>
          )}
          {snapshot.library && (
            <div>
              <dt className="text-xs text-muted-foreground">Library activity</dt>
              <dd className="font-display text-2xl text-foreground">
                {snapshot.library.items}
              </dd>
            </div>
          )}
        </dl>
      )}

      {snapshot?.scopes.celebrations && (
        <div className="mt-4 border-t border-border pt-4">
          <div className="flex items-center gap-2">
            <PartyPopper className="h-4 w-4 text-accent" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">Celebrate their progress</p>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Only a preset cheer or reward is sent. You cannot attach a message.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={sending !== null}
              onClick={() => void celebrate('cheer')}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {sending === 'cheer' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <PartyPopper className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Send a cheer
            </button>
            {hasVisibleMilestone && (
              <>
                <label className="sr-only" htmlFor={`reward-${link.id}`}>
                  Reward idea
                </label>
                <select
                  id={`reward-${link.id}`}
                  value={rewardKey}
                  onChange={(event) => setRewardKey(event.target.value as RewardKey)}
                  className="rounded-full border border-border bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {REWARD_OPTIONS.map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={sending !== null}
                  onClick={() => void celebrate('reward')}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {sending === 'reward' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Gift className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  Offer reward
                </button>
              </>
            )}
          </div>
          {celebrationStatus && (
            <p role="status" className="mt-2 text-xs text-brand-ink-soft">
              {celebrationStatus}
            </p>
          )}
        </div>
      )}

      {/* Partners can end the arrangement from their side too. The database
          trigger restricts them to revoking, never to widening scopes. */}
      <button
        type="button"
        onClick={() => void leave()}
        disabled={leaving}
        className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {leaving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {leaving ? 'Stopping...' : 'Stop following'}
      </button>
    </div>
  );
}

export default function PartnerPage() {
  const { user, isAnonymous, loading } = useAuth();

  const [scopes, setScopes] = useState<PartnerScopes>(DEFAULT_SCOPES);
  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [invites, setInvites] = useState<PartnerInvite[]>([]);
  const [sharingWith, setSharingWith] = useState<PartnerLink[]>([]);
  const [supporting, setSupporting] = useState<PartnerLink[]>([]);
  const [celebrations, setCelebrations] = useState<PartnerCelebration[]>([]);
  const [dataOwnerId, setDataOwnerId] = useState<string | null>(null);
  const [scopeUpdatingLinkIds, setScopeUpdatingLinkIds] = useState<Set<string>>(
    () => new Set()
  );
  const [revokingLinkIds, setRevokingLinkIds] = useState<Set<string>>(
    () => new Set()
  );
  const [cancelingInviteIds, setCancelingInviteIds] = useState<Set<string>>(
    () => new Set()
  );
  const [linkErrors, setLinkErrors] = useState<Record<string, string>>({});
  const [inviteErrors, setInviteErrors] = useState<Record<string, string>>({});
  const scopeUpdatingRef = useRef(new Set<string>());
  const revokingRef = useRef(new Set<string>());
  const cancelingInviteRef = useRef(new Set<string>());
  const creatingOwnerRef = useRef<string | null>(null);

  const ownerId = user && !isAnonymous ? user.id : null;
  const currentOwnerIdRef = useRef(ownerId);
  currentOwnerIdRef.current = ownerId;
  const canUse = ownerId !== null;

  const refresh = useCallback(async (expectedOwnerId: string): Promise<boolean> => {
    try {
      const [nextInvites, nextSharing, nextSupporting, nextCelebrations] =
        await Promise.all([
          listInvites(),
          listSharingWith(expectedOwnerId),
          listSupporting(expectedOwnerId),
          listReceivedCelebrations(expectedOwnerId),
        ]);
      if (currentOwnerIdRef.current !== expectedOwnerId) return false;
      setInvites(nextInvites);
      setSharingWith(nextSharing);
      setSupporting(nextSupporting);
      setCelebrations(nextCelebrations);
      setDataOwnerId(expectedOwnerId);
      return true;
    } catch (err) {
      if (currentOwnerIdRef.current === expectedOwnerId) {
        setError((err as Error).message);
        setDataOwnerId(expectedOwnerId);
      }
      return false;
    }
  }, []);

  useEffect(() => {
    setDataOwnerId(null);
    setInvites([]);
    setSharingWith([]);
    setSupporting([]);
    setCelebrations([]);
    setScopes(DEFAULT_SCOPES);
    setLabel('');
    setCreating(false);
    setGeneratedUrl(null);
    setCopied(false);
    setError(null);
    setLinkErrors({});
    setInviteErrors({});
    scopeUpdatingRef.current.clear();
    revokingRef.current.clear();
    cancelingInviteRef.current.clear();
    creatingOwnerRef.current = null;
    setScopeUpdatingLinkIds(new Set());
    setRevokingLinkIds(new Set());
    setCancelingInviteIds(new Set());

    if (ownerId) {
      void refresh(ownerId);
    }
  }, [ownerId, refresh]);

  const dataMatchesIdentity = ownerId !== null && dataOwnerId === ownerId;
  const visibleInvites = dataMatchesIdentity ? invites : [];
  const visibleSharingWith = dataMatchesIdentity ? sharingWith : [];
  const visibleSupporting = dataMatchesIdentity ? supporting : [];
  const visibleCelebrations = dataMatchesIdentity ? celebrations : [];

  const handleCreate = async () => {
    if (!ownerId || creatingOwnerRef.current !== null) return;
    const expectedOwnerId = ownerId;
    creatingOwnerRef.current = expectedOwnerId;
    setCreating(true);
    setError(null);
    setCopied(false);
    try {
      const { invite, url } = await createInvite(scopes, label);
      if (currentOwnerIdRef.current !== expectedOwnerId) return;
      setGeneratedUrl(url);
      setLabel('');
      setInvites((current) => [invite, ...current]);
      setDataOwnerId(expectedOwnerId);
      const refreshed = await refresh(expectedOwnerId);
      if (!refreshed && currentOwnerIdRef.current === expectedOwnerId) {
        setError(
          'The invite was created, but the latest invite list could not be refreshed.'
        );
      }
    } catch (err) {
      if (currentOwnerIdRef.current === expectedOwnerId) {
        setError((err as Error).message);
      }
    } finally {
      if (creatingOwnerRef.current === expectedOwnerId) {
        creatingOwnerRef.current = null;
      }
      if (currentOwnerIdRef.current === expectedOwnerId) {
        setCreating(false);
      }
    }
  };

  const handleCopy = async () => {
    if (!generatedUrl) return;
    await navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleScopeChange = async (link: PartnerLink, key: ScopeKey, next: boolean) => {
    if (!ownerId || dataOwnerId !== ownerId) return;
    const expectedOwnerId = ownerId;
    if (
      scopeUpdatingRef.current.has(link.id) ||
      revokingRef.current.has(link.id)
    ) {
      return;
    }
    scopeUpdatingRef.current.add(link.id);
    setScopeUpdatingLinkIds((current) => new Set(current).add(link.id));
    setLinkErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors[link.id];
      return nextErrors;
    });
    setSharingWith((current) =>
      current.map((item) => (item.id === link.id ? { ...item, [key]: next } : item))
    );
    try {
      await updateScope(link.id, key, next);
    } catch (err) {
      console.error('Failed to update accountability sharing scope:', err);
      if (currentOwnerIdRef.current !== expectedOwnerId) return;
      setSharingWith((current) =>
        current.map((item) =>
          item.id === link.id ? { ...item, [key]: link[key] } : item
        )
      );
      setLinkErrors((current) => ({
        ...current,
        [link.id]:
          'That privacy choice was not changed. Your previous sharing settings are still active.',
      }));
      await refresh(expectedOwnerId);
    } finally {
      scopeUpdatingRef.current.delete(link.id);
      if (currentOwnerIdRef.current === expectedOwnerId) {
        setScopeUpdatingLinkIds((current) => {
          const nextIds = new Set(current);
          nextIds.delete(link.id);
          return nextIds;
        });
      }
    }
  };

  const handleRevokeLink = async (linkId: string) => {
    if (!ownerId || dataOwnerId !== ownerId) return;
    const expectedOwnerId = ownerId;
    if (
      revokingRef.current.has(linkId) ||
      scopeUpdatingRef.current.has(linkId)
    ) {
      return;
    }
    revokingRef.current.add(linkId);
    setRevokingLinkIds((current) => new Set(current).add(linkId));
    setLinkErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors[linkId];
      return nextErrors;
    });
    try {
      await revokeLink(linkId);
      if (currentOwnerIdRef.current !== expectedOwnerId) return;
      setSharingWith((current) =>
        current.filter((link) => link.id !== linkId)
      );
      const refreshed = await refresh(expectedOwnerId);
      if (!refreshed && currentOwnerIdRef.current === expectedOwnerId) {
        setError(
          'Sharing was stopped, but the latest partner list could not be refreshed.'
        );
      }
    } catch (err) {
      console.error('Failed to stop accountability sharing:', err);
      if (currentOwnerIdRef.current !== expectedOwnerId) return;
      setLinkErrors((current) => ({
        ...current,
        [linkId]:
          'Sharing is still active because the connection could not be ended. Please try again.',
      }));
    } finally {
      revokingRef.current.delete(linkId);
      if (currentOwnerIdRef.current === expectedOwnerId) {
        setRevokingLinkIds((current) => {
          const nextIds = new Set(current);
          nextIds.delete(linkId);
          return nextIds;
        });
      }
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    if (!ownerId || dataOwnerId !== ownerId) return;
    const expectedOwnerId = ownerId;
    if (cancelingInviteRef.current.has(inviteId)) return;

    cancelingInviteRef.current.add(inviteId);
    setCancelingInviteIds((current) => new Set(current).add(inviteId));
    setInviteErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors[inviteId];
      return nextErrors;
    });

    try {
      await revokeInvite(inviteId);
      if (currentOwnerIdRef.current !== expectedOwnerId) return;
      setInvites((current) =>
        current.filter((invite) => invite.id !== inviteId)
      );
      const refreshed = await refresh(expectedOwnerId);
      if (!refreshed && currentOwnerIdRef.current === expectedOwnerId) {
        setError(
          'The invite was canceled, but the latest invite list could not be refreshed.'
        );
      }
    } catch (err) {
      console.error('Failed to cancel accountability invite:', err);
      if (currentOwnerIdRef.current !== expectedOwnerId) return;
      setInviteErrors((current) => ({
        ...current,
        [inviteId]:
          'The invite is still active because it could not be canceled. Please try again.',
      }));
    } finally {
      cancelingInviteRef.current.delete(inviteId);
      if (currentOwnerIdRef.current === expectedOwnerId) {
        setCancelingInviteIds((current) => {
          const nextIds = new Set(current);
          nextIds.delete(inviteId);
          return nextIds;
        });
      }
    }
  };

  const handleLeaveSupporting = async (linkId: string) => {
    if (!ownerId || dataOwnerId !== ownerId) return;
    const expectedOwnerId = ownerId;

    await revokeLink(linkId);
    if (currentOwnerIdRef.current !== expectedOwnerId) return;
    setSupporting((current) =>
      current.filter((link) => link.id !== linkId)
    );
    const refreshed = await refresh(expectedOwnerId);
    if (!refreshed && currentOwnerIdRef.current === expectedOwnerId) {
      setError(
        'You stopped following this partner, but the latest partner list could not be refreshed.'
      );
    }
  };

  if (loading) {
    return (
      <main className="px-4 py-8 md:px-8 md:py-12">
        <div className="mx-auto flex max-w-4xl items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 py-8 md:px-8 md:py-12">
      <div className="mx-auto max-w-4xl">
        <header className="max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <HeartHandshake className="h-3.5 w-3.5" aria-hidden="true" />
            Accountability
          </div>
          <h1 className="font-display text-4xl font-medium leading-[1.05] tracking-[-0.02em] text-foreground md:text-5xl">
            Let someone walk with you.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Invite one person to see whether you are showing up. You choose exactly
            what they see, and you can change it or end it at any time.
          </p>
        </header>

        <details className="mt-8 rounded-[var(--radius)] border border-border bg-secondary/60 p-5">
          <summary className="cursor-pointer list-none">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-foreground" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-foreground">
                How sharing works
              </h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              You choose each progress signal.
            </p>
          </summary>
          <ul className="mt-3 flex flex-wrap gap-2">
            {PRIVATE_CONTENT.map((item) => (
              <li
                key={item}
                className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground"
              >
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Sharing sends counts only. Private text stays private.
          </p>
        </details>

        {canUse && <div className="mt-8"><PartnerSupportPreferences /></div>}

        {!canUse ? (
          <section className="app-panel mt-8 p-6">
            <h2 className="font-display text-xl font-medium text-foreground">
              Connect an account
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Sign in or create an account to keep partner connections synced across
              devices.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/auth/login"
                className="inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Sign in
              </Link>
              <Link
                href="/auth/signup"
                className="inline-flex items-center rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Create account
              </Link>
            </div>
          </section>
        ) : !dataMatchesIdentity ? (
          <section className="app-panel mt-8 flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading your accountability settings
          </section>
        ) : (
          <>
            <section className="app-panel mt-8 p-6">
              <h2 className="font-display text-xl font-medium text-foreground">
                Invite a partner
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pick what they see, then send them the link yourself. It expires in
                seven days and works once.
              </p>

              <div className="mt-5">
                <label
                  htmlFor="partner-label"
                  className="mb-1.5 block text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground"
                >
                  Who is this for (only you see this)
                </label>
                <input
                  id="partner-label"
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  maxLength={60}
                  placeholder="Sam, my sister"
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <fieldset className="mt-5">
                <legend className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  They will see
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {CORE_SCOPE_ORDER.map((key) => (
                    <ScopeToggle
                      key={key}
                      scopeKey={key}
                      checked={scopes[key]}
                      onChange={(next) => setScopes((s) => ({ ...s, [key]: next }))}
                    />
                  ))}
                </div>
                <details className="mt-3 rounded-xl border border-border bg-background p-3">
                  <summary className="cursor-pointer text-sm font-medium text-foreground">
                    More app activity
                  </summary>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {MORE_SCOPE_ORDER.map((key) => (
                      <ScopeToggle
                        key={key}
                        scopeKey={key}
                        checked={scopes[key]}
                        onChange={(next) =>
                          setScopes((current) => ({ ...current, [key]: next }))
                        }
                      />
                    ))}
                  </div>
                </details>
              </fieldset>

              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                )}
                Create invite link
              </button>

              {generatedUrl && (
                <div className="mt-5 rounded-xl border border-primary/30 bg-secondary p-4">
                  <p className="text-xs font-medium text-foreground">
                    Copy this now. It is not shown again.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                      {generatedUrl}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}

              {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
            </section>

            {visibleInvites.length > 0 && (
              <section className="mt-8">
                <h2 className="font-display text-xl font-medium text-foreground">
                  Waiting to be accepted
                </h2>
                <ul className="mt-3 space-y-2">
                  {visibleInvites.map((invite) => (
                    <li
                      key={invite.id}
                      className="app-panel p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {invite.invitee_label ?? 'Unnamed invite'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Expires{' '}
                            {new Date(invite.expires_at).toLocaleDateString(
                              undefined,
                              {
                                month: 'short',
                                day: 'numeric',
                              }
                            )}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleCancelInvite(invite.id)}
                          disabled={cancelingInviteIds.has(invite.id)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {cancelingInviteIds.has(invite.id) ? (
                            <Loader2
                              className="h-3.5 w-3.5 animate-spin"
                              aria-hidden="true"
                            />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          {cancelingInviteIds.has(invite.id)
                            ? 'Canceling...'
                            : 'Cancel'}
                        </button>
                      </div>
                      {inviteErrors[invite.id] && (
                        <p
                          role="alert"
                          className="mt-2 text-sm text-destructive"
                        >
                          {inviteErrors[invite.id]}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {visibleCelebrations.length > 0 && (
              <section className="mt-10">
                <div className="flex items-center gap-2">
                  <PartyPopper className="h-4 w-4 text-accent" aria-hidden="true" />
                  <h2 className="font-display text-xl font-medium text-foreground">
                    Celebrations for you
                  </h2>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Preset cheers and reward ideas from your accountability partner.
                </p>
                <ul className="mt-3 space-y-2">
                  {visibleCelebrations.map((celebration) => {
                    const partnerName =
                      visibleSharingWith.find(
                        (link) => link.partner_id === celebration.partner_id
                      )?.partner_label ?? 'Your partner';
                    return (
                      <li
                        key={celebration.id}
                        className={cn(
                          'app-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between',
                          !celebration.seen_at && 'border-accent/35'
                        )}
                      >
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {describeCelebration(celebration)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {partnerName} ·{' '}
                            {new Date(celebration.created_at).toLocaleDateString(
                              undefined,
                              { month: 'short', day: 'numeric' }
                            )}
                          </p>
                        </div>
                        {!celebration.seen_at && (
                          <button
                            type="button"
                            onClick={async () => {
                              const marked = await markCelebrationSeen(
                                celebration.id
                              );
                              if (marked) {
                                setCelebrations((current) =>
                                  current.map((item) =>
                                    item.id === celebration.id
                                      ? {
                                          ...item,
                                          seen_at: new Date().toISOString(),
                                        }
                                      : item
                                  )
                                );
                              }
                            }}
                            className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            Mark seen
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <section className="mt-10">
              <h2 className="font-display text-xl font-medium text-foreground">
                Sharing with
              </h2>
              {visibleSharingWith.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Nobody yet. Nothing about you is shared until someone accepts an
                  invite.
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {visibleSharingWith.map((link) => (
                    <li key={link.id} className="app-panel p-5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-foreground">
                          {link.partner_label ?? 'Your partner'}
                        </p>
                        <button
                          type="button"
                          onClick={() => void handleRevokeLink(link.id)}
                          disabled={
                            revokingLinkIds.has(link.id) ||
                            scopeUpdatingLinkIds.has(link.id)
                          }
                          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {revokingLinkIds.has(link.id)
                            ? 'Stopping...'
                            : 'Stop sharing'}
                        </button>
                      </div>
                      {linkErrors[link.id] && (
                        <p
                          role="alert"
                          className="mt-3 text-sm text-destructive"
                        >
                          {linkErrors[link.id]}
                        </p>
                      )}
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {CORE_SCOPE_ORDER.map((key) => (
                          <ScopeToggle
                            key={key}
                            scopeKey={key}
                            checked={link[key]}
                            onChange={(next) => handleScopeChange(link, key, next)}
                            disabled={
                              scopeUpdatingLinkIds.has(link.id) ||
                              revokingLinkIds.has(link.id)
                            }
                          />
                        ))}
                      </div>
                      <details className="mt-3 rounded-xl border border-border bg-background p-3">
                        <summary className="cursor-pointer text-sm font-medium text-foreground">
                          More app activity
                        </summary>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {MORE_SCOPE_ORDER.map((key) => (
                            <ScopeToggle
                              key={key}
                              scopeKey={key}
                              checked={link[key]}
                              onChange={(next) =>
                                handleScopeChange(link, key, next)
                              }
                              disabled={
                                scopeUpdatingLinkIds.has(link.id) ||
                                revokingLinkIds.has(link.id)
                              }
                            />
                          ))}
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="mt-10">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-foreground" aria-hidden="true" />
                <h2 className="font-display text-xl font-medium text-foreground">
                  You are supporting
                </h2>
              </div>
              {visibleSupporting.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  When someone shares their progress with you, it appears here.
                </p>
              ) : (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {visibleSupporting.map((link) => (
                    <SnapshotCard
                      key={link.id}
                      link={link}
                      onLeave={() => handleLeaveSupporting(link.id)}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
