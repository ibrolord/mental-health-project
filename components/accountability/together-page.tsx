'use client';

import Link from 'next/link';
import {
  CalendarCheck,
  Check,
  ChevronRight,
  Clipboard,
  Link2,
  Loader2,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Unlink,
  UserRoundPlus,
  UsersRound,
} from 'lucide-react';
import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth-context';
import type { AccountabilityPriority } from '@/lib/accountability';
import { cn } from '@/lib/utils';

import {
  addCheckIn,
  addComment,
  createAccountabilityInvite,
  decideSuggestion,
  getAccountabilityErrorMessage,
  loadAccountabilityOverview,
  blockConnection,
  revokeAccountabilityInvite,
  revokeCommitmentShare,
  revokeConnection,
  sendNudge,
  setCheckInNoteSharing,
  setCommitmentNoteSharing,
  setCommitmentReward,
  shareCommitment,
  suggestPriority,
  updateAccountabilityScope,
} from './accountability-client';
import {
  NUDGE_TEMPLATES,
  buildNudgeRequest,
  canManageCommitment,
  formatAccountabilityDate,
  getAccessState,
  getDaysShownUpLabel,
  getNextTab,
  type CommitmentTab,
  type NudgeTemplateId,
} from './accountability-state';
import type { AccountabilityOverview, SharedCommitment } from './accountability-types';

type PendingAction =
  | 'invite'
  | 'copy'
  | 'disconnect'
  | 'block'
  | 'scope'
  | 'share'
  | 'unshare'
  | 'note-sharing'
  | 'check-in'
  | 'comment'
  | 'nudge'
  | 'suggest'
  | 'reward'
  | 'suggestion'
  | null;

function localDate(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function AccessCard({ kind }: { kind: 'loading' | 'signed-out' | 'anonymous' }): React.ReactElement {
  if (kind === 'loading') {
    return (
      <Card role="status" aria-label="Loading Together" className="mx-auto max-w-xl">
        <CardContent className="flex items-center gap-3 py-8 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          Loading your Together space…
        </CardContent>
      </Card>
    );
  }

  const anonymous = kind === 'anonymous';
  return (
    <Card className="mx-auto max-w-xl border-blue-100 shadow-sm">
      <CardHeader>
        <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <CardTitle>{anonymous ? 'Use a permanent account for Together' : 'Sign in to use Together'}</CardTitle>
        <CardDescription>
          Together connects one trusted partner to only the commitments you deliberately share.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Link className={cn(buttonVariants(), 'inline-flex')} href={anonymous ? '/auth/signup' : '/auth/login'}>
          {anonymous ? 'Create permanent account' : 'Sign in'}
        </Link>
      </CardContent>
    </Card>
  );
}

function EmptyConnection({
  pending,
  onInvite,
}: {
  pending: boolean;
  onInvite: (partnerEmail: string) => void;
}): React.ReactElement {
  const [partnerEmail, setPartnerEmail] = useState('');
  return (
    <Card className="border-blue-100 shadow-sm">
      <CardContent className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <UserRoundPlus className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900">Invite one person you trust</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            They will see only commitments you share here. Your moods, assessments, AI chat, and private reflections stay private.
          </p>
        </div>
        <form
          className="flex w-full flex-col gap-2 sm:flex-row md:w-auto"
          onSubmit={(event) => {
            event.preventDefault();
            if (partnerEmail.trim()) onInvite(partnerEmail.trim());
          }}
        >
          <div>
            <Label className="sr-only" htmlFor="together-partner-email">Partner email</Label>
            <Input
              id="together-partner-email"
              type="email"
              autoComplete="email"
              value={partnerEmail}
              onChange={(event) => setPartnerEmail(event.target.value)}
              placeholder="partner@example.com"
              required
            />
          </div>
          <Button type="submit" disabled={pending} className="gap-2 md:min-w-40">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Create invite
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PendingInvite({
  expiresAt,
  partnerEmail,
  inviteUrl,
  canCopy,
  pending,
  onCopy,
  onCancel,
}: {
  expiresAt: string;
  partnerEmail?: string;
  inviteUrl: string;
  canCopy: boolean;
  pending: PendingAction;
  onCopy: () => void;
  onCancel: () => void;
}): React.ReactElement {
  return (
    <Card className="border-amber-200 bg-amber-50/60 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Link2 className="h-5 w-5 text-amber-700" aria-hidden="true" />
          Invite ready
        </CardTitle>
        <CardDescription>
          {partnerEmail ? `Only ${partnerEmail} can accept. ` : ''}Waiting for your partner to join{expiresAt ? ` before ${formatAccountabilityDate(expiresAt)}` : ''}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {canCopy && (
          <Input className="basis-full bg-white font-mono text-xs" readOnly value={inviteUrl} aria-label="Invite link" onFocus={(event) => event.currentTarget.select()} />
        )}
        {canCopy ? (
          <Button onClick={onCopy} disabled={pending !== null} className="gap-2">
            {pending === 'copy' ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
            {pending === 'copy' ? 'Copied' : 'Copy invite link'}
          </Button>
        ) : (
          <p className="basis-full text-sm text-amber-900">
            This browser no longer has the invite link. Cancel it to create a new one.
          </p>
        )}
        <Button variant="outline" onClick={onCancel} disabled={pending !== null}>
          Cancel invite
        </Button>
      </CardContent>
    </Card>
  );
}

function CommitmentRow({
  commitment,
  active,
  onSelect,
}: {
  commitment: SharedCommitment;
  active: boolean;
  onSelect: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border p-4 text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        active ? 'border-blue-300 bg-blue-50/70' : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
      aria-pressed={active}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-900">{commitment.title}</p>
            {commitment.status === 'completed' && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Done</span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {commitment.cadence} · Last check-in {formatAccountabilityDate(commitment.lastCheckInAt)}
          </p>
          <div className="mt-3 flex items-center gap-3">
            {commitment.progressShared ? (
              <>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
              <div className="h-full rounded-full bg-blue-700" style={{ width: `${((commitment.daysShownUp ?? 0) / 14) * 100}%` }} />
            </div>
            <span className="whitespace-nowrap text-xs font-medium text-slate-600">
              {getDaysShownUpLabel(commitment.daysShownUp ?? 0)}
            </span>
              </>
            ) : <span className="text-xs font-medium text-slate-500">Progress not shared</span>}
          </div>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      </div>
    </button>
  );
}

function CommitmentDetail({
  commitment,
  viewerId,
  nudgeCooldownUntil,
  pending,
  onCheckIn,
  onComment,
  onNudge,
  onSuggest,
  onReward,
  onUnshare,
  onKeepCommitmentNotePrivate,
  onKeepCheckInNotePrivate,
}: {
  commitment: SharedCommitment;
  viewerId: string;
  nudgeCooldownUntil: string | null;
  pending: PendingAction;
  onCheckIn: (date: string, note: string, shareNote: boolean) => Promise<boolean>;
  onComment: (body: string) => Promise<boolean>;
  onNudge: (templateId: NudgeTemplateId) => Promise<boolean>;
  onSuggest: (priority: AccountabilityPriority) => Promise<boolean>;
  onReward: (reward: string) => Promise<boolean>;
  onUnshare: () => void;
  onKeepCommitmentNotePrivate: () => Promise<boolean>;
  onKeepCheckInNotePrivate: () => Promise<boolean>;
}): React.ReactElement {
  const owner = canManageCommitment(viewerId, commitment.ownerId);
  const [date, setDate] = useState(localDate());
  const [note, setNote] = useState('');
  const [shareNote, setShareNote] = useState(false);
  const [comment, setComment] = useState('');
  const [nudgeTemplate, setNudgeTemplate] = useState<NudgeTemplateId>(NUDGE_TEMPLATES[0].id);
  const [suggestedPriority, setSuggestedPriority] = useState<AccountabilityPriority>('high');
  const [reward, setReward] = useState(commitment.reward ?? '');
  const nudgeCoolingDown = nudgeCooldownUntil
    ? new Date(nudgeCooldownUntil).getTime() > Date.now()
    : false;

  const submitCheckIn = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (await onCheckIn(date, note, shareNote)) {
      setNote('');
      setShareNote(false);
    }
  };

  const submitComment = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (await onComment(comment)) setComment('');
  };

  return (
    <Card className="h-fit shadow-sm" aria-label={`${commitment.title} details`}>
      <CardHeader className="border-b border-slate-100">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardDescription>{owner ? 'Your shared commitment' : `${commitment.ownerName}'s commitment`}</CardDescription>
            <CardTitle className="mt-1 text-xl">{commitment.title}</CardTitle>
          </div>
          {owner && (
            <Button variant="ghost" size="sm" className="gap-2 text-slate-600" onClick={onUnshare} disabled={pending !== null}>
              <Unlink className="h-4 w-4" aria-hidden="true" />
              Stop sharing
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-blue-50 p-4">
            <p className="text-2xl font-bold text-blue-800">{commitment.progressShared ? commitment.daysShownUp : 'Private'}</p>
            <p className="mt-1 text-xs text-blue-950">{commitment.progressShared ? 'days shown up in the last 14' : 'progress is not shared'}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="font-semibold text-slate-900">{commitment.cadence}</p>
            <p className="mt-1 text-xs text-slate-500">chosen rhythm</p>
          </div>
        </div>

        {commitment.detail && (
          <div className="space-y-2">
            <p className="text-sm leading-6 text-slate-600">{commitment.detail}</p>
            {owner && commitment.noteShared && (
              <Button variant="outline" size="sm" disabled={pending !== null} onClick={() => void onKeepCommitmentNotePrivate()}>
                Keep this note private
              </Button>
            )}
          </div>
        )}
        {commitment.lastCheckInNote && (
          <div className="space-y-2">
            <blockquote className="rounded-lg border-l-4 border-blue-200 bg-blue-50/60 px-4 py-3 text-sm text-slate-700">
              “{commitment.lastCheckInNote}”
            </blockquote>
            {owner && commitment.lastCheckInId && (
              <Button variant="outline" size="sm" disabled={pending !== null} onClick={() => void onKeepCheckInNotePrivate()}>
                Keep this check-in note private
              </Button>
            )}
          </div>
        )}

        {owner && commitment.status === 'active' && (
          <form onSubmit={submitCheckIn} className="space-y-3 rounded-xl border border-slate-200 p-4">
            <div>
              <h3 className="font-semibold text-slate-900">Add a check-in</h3>
              <p className="mt-1 text-xs text-slate-500">This note belongs to Together and is separate from your wellbeing data.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[145px_1fr]">
              <div>
                <Label htmlFor={`check-in-date-${commitment.id}`}>Date</Label>
                <Input id={`check-in-date-${commitment.id}`} type="date" value={date} onChange={(event) => setDate(event.target.value)} required className="mt-1" />
              </div>
              <div>
                <Label htmlFor={`check-in-note-${commitment.id}`}>Note (optional)</Label>
                <Input
                  id={`check-in-note-${commitment.id}`}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="A small step I took…"
                  maxLength={2000}
                  className="mt-1"
                />
              </div>
            </div>
            <label className="flex items-start gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded accent-blue-600"
                checked={shareNote}
                onChange={(event) => setShareNote(event.target.checked)}
              />
              Share this note with my partner. Leave unchecked to count the day while keeping the note private.
            </label>
            <p className="text-xs text-slate-500">Moods, assessments, chat, and reflections stay private either way.</p>
            <Button type="submit" size="sm" disabled={pending !== null} className="gap-2">
              {pending === 'check-in' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />}
              Save check-in
            </Button>
          </form>
        )}

        {!owner && (
          <section className="grid gap-3 rounded-xl border border-blue-100 bg-blue-50/40 p-4 sm:grid-cols-2" aria-label="Partner support tools">
            <div className="space-y-2">
              <Label htmlFor={`nudge-${commitment.id}`}>Gentle nudge</Label>
              <select
                id={`nudge-${commitment.id}`}
                value={nudgeTemplate}
                onChange={(event) => setNudgeTemplate(event.target.value as NudgeTemplateId)}
                disabled={nudgeCoolingDown}
                className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {NUDGE_TEMPLATES.map((template) => (
                  <option key={template.id} value={template.id}>{template.label}</option>
                ))}
              </select>
              <p className="text-xs text-slate-500">“{NUDGE_TEMPLATES.find((item) => item.id === nudgeTemplate)?.message}”</p>
              <Button
                type="button"
                size="sm"
                disabled={pending !== null || nudgeCoolingDown}
                onClick={() => void onNudge(buildNudgeRequest(nudgeTemplate).templateId)}
              >
                {pending === 'nudge' ? 'Sending…' : nudgeCoolingDown ? 'Sent recently' : 'Send support'}
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`suggest-priority-${commitment.id}`}>Suggest a priority</Label>
              <select
                id={`suggest-priority-${commitment.id}`}
                value={suggestedPriority}
                onChange={(event) => setSuggestedPriority(event.target.value as AccountabilityPriority)}
                className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <p className="text-xs text-slate-500">The owner must approve it before anything changes.</p>
              <Button type="button" size="sm" variant="outline" disabled={pending !== null} onClick={() => void onSuggest(suggestedPriority)}>
                {pending === 'suggest' ? 'Sending…' : 'Send suggestion'}
              </Button>
            </div>
          </section>
        )}

        {owner && (
          <form
            className="space-y-3 rounded-xl border border-slate-200 p-4"
            onSubmit={async (event) => {
              event.preventDefault();
              await onReward(reward);
            }}
          >
            <div>
              <Label htmlFor={`reward-${commitment.id}`}>My self-set reward</Label>
              <p className="mt-1 text-xs text-slate-500">Choose something meaningful for yourself. Your partner cannot edit it.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id={`reward-${commitment.id}`}
                value={reward}
                onChange={(event) => setReward(event.target.value)}
                maxLength={500}
                placeholder="A quiet afternoon, a favourite meal…"
                required
              />
              <Button type="submit" variant="outline" disabled={pending !== null || !reward.trim()}>
                {pending === 'reward' ? 'Saving…' : 'Save reward'}
              </Button>
            </div>
          </form>
        )}

        <section aria-labelledby={`comments-${commitment.id}`}>
          <h3 id={`comments-${commitment.id}`} className="flex items-center gap-2 font-semibold text-slate-900">
            <MessageCircle className="h-4 w-4 text-blue-600" aria-hidden="true" />
            Comments
          </h3>
          <div className="mt-3 space-y-2">
            {commitment.comments.length === 0 ? (
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">No comments yet. Keep it kind and specific.</p>
            ) : (
              commitment.comments.map((item) => (
                <div key={item.id} className="rounded-lg bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-700">{item.authorName}</p>
                    <time className="text-xs text-slate-400">{formatAccountabilityDate(item.createdAt)}</time>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{item.body}</p>
                </div>
              ))
            )}
          </div>
          <form onSubmit={submitComment} className="mt-3 flex gap-2">
            <Label htmlFor={`comment-${commitment.id}`} className="sr-only">Add a comment</Label>
            <Input
              id={`comment-${commitment.id}`}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Add a supportive comment"
              maxLength={500}
              required
            />
            <Button type="submit" variant="outline" disabled={pending !== null || !comment.trim()}>
              {pending === 'comment' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Post'}
            </Button>
          </form>
        </section>
      </CardContent>
    </Card>
  );
}

export function TogetherPage(): React.ReactElement {
  const { user, loading: authLoading, isAnonymous } = useAuth();
  const userId = user?.id ?? null;
  const access = getAccessState({ loading: authLoading, userPresent: Boolean(user), isAnonymous });
  const [overview, setOverview] = useState<AccountabilityOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [tab, setTab] = useState<CommitmentTab>('mine');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [shareTitle, setShareTitle] = useState('');
  const [shareCadence, setShareCadence] = useState<'daily' | 'weekly' | 'custom'>('daily');
  const mineTab = useRef<HTMLButtonElement>(null);
  const theirsTab = useRef<HTMLButtonElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const currentUserId = useRef(userId);
  currentUserId.current = userId;

  const refresh = useCallback(async (): Promise<void> => {
    if (access !== 'ready' || !userId) return;
    setLoading(true);
    setError(null);
    try {
      const next = await loadAccountabilityOverview();
      if (currentUserId.current !== userId) return;
      if (next.viewerId !== userId) throw new Error('Together returned data for another account');
      setOverview(next);
    } catch (cause) {
      if (currentUserId.current === userId) setError(getAccountabilityErrorMessage(cause));
    } finally {
      if (currentUserId.current === userId) setLoading(false);
    }
  }, [access, userId]);

  useEffect(() => {
    setOverview(null);
    setError(null);
    setStatus(null);
    setPending(null);
    setSelectedId(null);
    setShareTitle('');
    setShareCadence('daily');
    setTab('mine');
    if (access === 'ready') void refresh();
    else setLoading(access === 'loading');
  }, [access, refresh, userId]);

  const run = async (
    action: Exclude<PendingAction, 'copy' | null>,
    operation: () => Promise<void>
  ): Promise<boolean> => {
    const actionUserId = userId;
    if (pending || !actionUserId) return false;
    setPending(action);
    setError(null);
    setStatus(null);
    try {
      await operation();
      if (currentUserId.current !== actionUserId) return false;
      await refresh();
      if (currentUserId.current !== actionUserId) return false;
      const messages: Record<Exclude<PendingAction, 'copy' | null>, string> = {
        invite: 'Invitation updated.',
        disconnect: 'Together connection ended.',
        block: 'Partner blocked and connection ended.',
        scope: 'Sharing choices updated.',
        share: 'Commitment shared.',
        unshare: 'Commitment stopped sharing. Your history is kept.',
        'note-sharing': 'Note sharing updated.',
        'check-in': 'Check-in saved.',
        comment: 'Comment posted.',
        nudge: 'Gentle nudge sent.',
        suggest: 'Priority suggestion sent for approval.',
        reward: 'Reward saved.',
        suggestion: 'Suggestion updated.',
      };
      setStatus(messages[action]);
      return true;
    } catch (cause) {
      if (currentUserId.current === actionUserId) {
        setError(getAccountabilityErrorMessage(cause));
      }
      return false;
    } finally {
      if (currentUserId.current === actionUserId) setPending(null);
    }
  };

  const commitments = overview ? (tab === 'mine' ? overview.mine : overview.theirs) : [];
  const selected = commitments.find((item) => item.id === selectedId) ?? commitments[0] ?? null;

  const switchTab = (next: CommitmentTab): void => {
    setTab(next);
    setSelectedId(null);
  };

  const handleTabKey = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const next = getNextTab(tab, event.key);
    if (next === tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    switchTab(next);
    (next === 'mine' ? mineTab : theirsTab).current?.focus();
  };

  if (access !== 'ready') {
    return <AccessCard kind={access} />;
  }

  if (overview && overview.viewerId !== userId) {
    return <AccessCard kind="loading" />;
  }

  if (loading && !overview) {
    return <AccessCard kind="loading" />;
  }

  if (!overview) {
    return (
      <Card className="mx-auto max-w-xl" role={error ? 'alert' : undefined}>
        <CardHeader>
          <CardTitle>Together is unavailable</CardTitle>
          <CardDescription>{error ?? 'We could not load your Together space.'}</CardDescription>
        </CardHeader>
        <CardContent><Button onClick={() => void refresh()} className="gap-2"><RefreshCw className="h-4 w-4" />Try again</Button></CardContent>
      </Card>
    );
  }

  const invite = overview.connection.invite;
  const connected = overview.connection.status === 'connected' && overview.connection.partner;

  return (
    <div className="space-y-5">
      <div aria-live="polite" aria-atomic="true">
        {status && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{status}</div>}
      </div>
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      {!connected && overview.connection.status === 'disconnected' && (
        <EmptyConnection pending={pending === 'invite'} onInvite={(email) => void run('invite', () => createAccountabilityInvite(email, userId ?? ''))} />
      )}

      {!connected && overview.connection.status === 'invite_pending' && invite && (
        <PendingInvite
          expiresAt={invite.expiresAt}
          partnerEmail={invite.partnerEmail}
          inviteUrl={invite.token && typeof window !== 'undefined' ? `${window.location.origin}/partner/join?token=${encodeURIComponent(invite.token)}` : ''}
          canCopy={Boolean(invite.token)}
          pending={pending}
          onCopy={() => {
            if (pending) return;
            setPending('copy');
            const url = `${window.location.origin}/partner/join?token=${encodeURIComponent(invite.token)}`;
            void navigator.clipboard.writeText(url).then(() => setTimeout(() => setPending(null), 1200)).catch(() => {
              setError('Copy failed. Select the invite link shown above and copy it manually.');
              setPending(null);
            });
          }}
          onCancel={() => void run('invite', () => revokeAccountabilityInvite(invite.id))}
        />
      )}

      {connected && (
        <>
          <Card className="border-blue-100 bg-gradient-to-r from-white to-blue-50/50 shadow-sm">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                  <UsersRound className="h-5 w-5" aria-hidden="true" />
                </div>
                <div><p className="text-xs font-medium uppercase tracking-wide text-blue-700">Connected</p><h2 className="font-semibold text-slate-900">You and {connected.displayName}</h2></div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="text-red-700 hover:bg-red-50 hover:text-red-800" disabled={pending !== null} onClick={() => {
                    if (window.confirm(`End your Together connection with ${connected.displayName}? Access stops immediately.`)) void run('disconnect', () => revokeConnection(overview.connection.id ?? ''));
                  }}>End connection</Button>
                <Button variant="outline" size="sm" className="text-red-800 hover:bg-red-50" disabled={pending !== null} onClick={() => {
                    if (window.confirm(`Block ${connected.displayName}? The connection ends and they cannot reconnect.`)) void run('block', () => blockConnection(overview.connection.id ?? ''));
                  }}>Block</Button>
              </div>
            </CardContent>
          </Card>

          {overview.scope && (
            <Card className="shadow-sm">
              <CardHeader className="pb-3"><CardTitle className="text-lg">What I share</CardTitle><CardDescription>Change these at any time. Private app data is never added automatically.</CardDescription></CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                {([
                  ['sharesCommitmentTitles', 'Commitment titles'],
                  ['sharesProgress', 'Progress counts'],
                  ['sharesNotes', 'Notes I mark shared'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
                    <input type="checkbox" className="h-5 w-5 accent-blue-800" checked={overview.scope?.[key] ?? false} disabled={pending !== null} onChange={(event) => {
                      const next = { ...overview.scope!, [key]: event.target.checked };
                      void run('scope', () => updateAccountabilityScope(next));
                    }} />
                    {label}
                  </label>
                ))}
              </CardContent>
            </Card>
          )}

          {overview.receivedNudges.length > 0 && (
            <Card className="border-emerald-200 bg-emerald-50/50 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-lg">Support from {connected.displayName}</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm text-emerald-950">
                {overview.receivedNudges.slice(0, 3).map((nudge) => <p key={nudge.id}>{nudge.kind === 'celebrate_progress' ? 'They celebrated your progress.' : nudge.kind === 'gentle_reminder' ? 'They sent a gentle reminder.' : 'They sent encouragement.'}</p>)}
              </CardContent>
            </Card>
          )}

          {overview.suggestions.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/60 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Priority suggestions</CardTitle>
                <CardDescription>Your partner can suggest. Only you can accept a change.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {overview.suggestions.map((suggestion) => (
                  <div key={suggestion.id} className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{suggestion.commitmentTitle}</p>
                      <p className="text-xs text-slate-600">{suggestion.suggestedBy.displayName} suggests {suggestion.suggestedPriority} priority.</p>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" disabled={pending !== null} onClick={() => void run('suggestion', () => decideSuggestion(suggestion.id, 'accepted'))}>Accept</Button>
                      <Button type="button" size="sm" variant="outline" disabled={pending !== null} onClick={() => void run('suggestion', () => decideSuggestion(suggestion.id, 'declined'))}>Decline</Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="shadow-sm">
            <CardContent className="p-4">
              <form
                className="flex flex-col gap-3 sm:flex-row sm:items-end"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!shareTitle.trim()) return;
                  void run('share', () => shareCommitment({
                    connectionId: overview.connection.id ?? '',
                    title: shareTitle.trim(),
                    cadence: shareCadence,
                  })).then((success) => { if (success) setShareTitle(''); });
                }}
              >
                <div className="flex-1">
                  <Label htmlFor="share-commitment">Share a commitment</Label>
                  <Input
                    id="share-commitment"
                    value={shareTitle}
                    onChange={(event) => setShareTitle(event.target.value)}
                    maxLength={240}
                    placeholder="The commitment I want support with"
                    required
                    className="mt-1"
                  />
                  <p className="mt-1 text-xs text-slate-500">This creates a Together-only commitment. It does not copy a Goal or its reflection.</p>
                </div>
                <div>
                  <Label htmlFor="share-cadence">Rhythm</Label>
                  <select
                    id="share-cadence"
                    value={shareCadence}
                    onChange={(event) => setShareCadence(event.target.value as 'daily' | 'weekly' | 'custom')}
                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-36"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <Button type="submit" disabled={!shareTitle.trim() || pending !== null} className="gap-2">
                  {pending === 'share' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRoundPlus className="h-4 w-4" />}
                  Share
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="rounded-xl border border-slate-200 bg-slate-100 p-1" role="tablist" aria-label="Shared commitments">
            <div className="grid grid-cols-2 gap-1">
              <button
                ref={mineTab}
                type="button"
                role="tab"
                id="mine-tab"
                aria-controls="mine-panel"
                aria-selected={tab === 'mine'}
                tabIndex={tab === 'mine' ? 0 : -1}
                onClick={() => switchTab('mine')}
                onKeyDown={handleTabKey}
                className={`rounded-lg px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 ${tab === 'mine' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              >
                Mine <span className="ml-1 text-xs text-slate-400">{overview.mine.length}</span>
              </button>
              <button
                ref={theirsTab}
                type="button"
                role="tab"
                id="theirs-tab"
                aria-controls="theirs-panel"
                aria-selected={tab === 'theirs'}
                tabIndex={tab === 'theirs' ? 0 : -1}
                onClick={() => switchTab('theirs')}
                onKeyDown={handleTabKey}
                className={`rounded-lg px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 ${tab === 'theirs' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              >
                Theirs <span className="ml-1 text-xs text-slate-400">{overview.theirs.length}</span>
              </button>
            </div>
          </div>

          <div
            role="tabpanel"
            id={`${tab}-panel`}
            aria-labelledby={`${tab}-tab`}
            tabIndex={0}
            className="grid gap-5 outline-none lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)]"
          >
            <section aria-label={`${tab === 'mine' ? 'My' : 'My partner’s'} shared commitments`} className="space-y-3">
              {commitments.length === 0 ? (
                <Card className="border-dashed shadow-none"><CardContent className="py-10 text-center"><p className="font-medium text-slate-800">Nothing shared here yet</p><p className="mt-1 text-sm text-slate-500">{tab === 'mine' ? 'Choose a commitment above to share it.' : 'Your partner decides what to share with you.'}</p></CardContent></Card>
              ) : commitments.map((item) => (
                <CommitmentRow key={item.id} commitment={item} active={selected?.id === item.id} onSelect={() => {
                  setSelectedId(item.id);
                  window.requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
                }} />
              ))}
            </section>

            {selected ? (
              <div ref={detailRef} className="scroll-mt-24">
              <CommitmentDetail
                key={selected.id}
                commitment={selected}
                viewerId={overview.viewerId}
                nudgeCooldownUntil={overview.nudgeCooldownUntil}
                pending={pending}
                onCheckIn={(date, note, shareNote) => run('check-in', () => addCheckIn({ commitmentId: selected.id, date, note: note.trim(), shareNote }))}
                onComment={(body) => run('comment', () => addComment(selected.id, body.trim()))}
                onNudge={(templateId) => run('nudge', () => sendNudge(overview.connection.id ?? '', selected.id, templateId))}
                onSuggest={(priority) => run('suggest', () => suggestPriority(selected.id, priority))}
                onReward={(reward) => run('reward', () => setCommitmentReward(selected.id, reward.trim()))}
                onUnshare={() => {
                  if (window.confirm(`Stop sharing “${selected.title}” with ${connected.displayName}? Your private history will be kept.`)) {
                    void run('unshare', () => revokeCommitmentShare(selected.id));
                  }
                }}
                onKeepCommitmentNotePrivate={() => run('note-sharing', () => setCommitmentNoteSharing(selected.id, false))}
                onKeepCheckInNotePrivate={() => selected.lastCheckInId
                  ? run('note-sharing', () => setCheckInNoteSharing(selected.lastCheckInId!, false))
                  : Promise.resolve(false)}
              />
              </div>
            ) : (
              <Card className="hidden h-fit border-dashed shadow-none lg:block"><CardContent className="py-12 text-center text-sm text-slate-500">Select a commitment to see its check-ins and comments.</CardContent></Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
