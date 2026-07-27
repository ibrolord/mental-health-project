'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Check,
  Copy,
  HeartHandshake,
  Loader2,
  Lock,
  LogOut,
  ShieldCheck,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import {
  DEFAULT_SCOPES,
  NEVER_SHARED,
  SCOPE_COPY,
  createInvite,
  fetchSnapshot,
  listInvites,
  listSharingWith,
  listSupporting,
  revokeInvite,
  revokeLink,
  updateScopes,
  type PartnerInvite,
  type PartnerLink,
  type PartnerScopes,
  type PartnerSnapshot,
  type ScopeKey,
} from '@/lib/partners';

const SCOPE_ORDER: ScopeKey[] = [
  'share_checkins',
  'share_goals',
  'share_habits',
  'share_mood_trend',
];

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

function SnapshotCard({ link, onLeave }: { link: PartnerLink; onLeave: () => void }) {
  const [snapshot, setSnapshot] = useState<PartnerSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    !snapshot.scopes.mood_trend;

  return (
    <div className="app-panel p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">
          {link.partner_label ?? 'Someone you support'}
        </h3>
        <span className="text-[0.65rem] uppercase tracking-[0.08em] text-muted-foreground">
          Last 7 days
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
        <dl className="mt-4 grid grid-cols-3 gap-3">
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
                <span className="text-sm text-muted-foreground">
                  /{snapshot.goals.total}
                </span>
              </dd>
            </div>
          )}
          {snapshot.habits && (
            <div>
              <dt className="text-xs text-muted-foreground">Habit days</dt>
              <dd className="font-display text-2xl text-foreground">
                {snapshot.habits.logged_days}
              </dd>
            </div>
          )}
        </dl>
      )}

      {snapshot?.mood_trend && snapshot.mood_trend.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="mb-1.5 text-xs text-muted-foreground">Mood trend</p>
          <div className="flex gap-1.5 text-lg">
            {snapshot.mood_trend.map((point) => (
              <span key={point.day} title={point.day}>
                {point.emoji}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Partners can end the arrangement from their side too. The database
          trigger restricts them to revoking, never to widening scopes. */}
      <button
        type="button"
        onClick={onLeave}
        className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
        Stop following
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

  const canUse = Boolean(user) && !isAnonymous;

  const refresh = useCallback(async () => {
    if (!user || isAnonymous) return;
    try {
      const [nextInvites, nextSharing, nextSupporting] = await Promise.all([
        listInvites(),
        listSharingWith(user.id),
        listSupporting(user.id),
      ]);
      setInvites(nextInvites);
      setSharingWith(nextSharing);
      setSupporting(nextSupporting);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [user, isAnonymous]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    setCopied(false);
    try {
      const { url } = await createInvite(scopes, label);
      setGeneratedUrl(url);
      setLabel('');
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedUrl) return;
    await navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleScopeChange = async (link: PartnerLink, key: ScopeKey, next: boolean) => {
    const updated: PartnerScopes = {
      share_goals: link.share_goals,
      share_habits: link.share_habits,
      share_checkins: link.share_checkins,
      share_mood_trend: link.share_mood_trend,
      [key]: next,
    };
    setSharingWith((current) =>
      current.map((item) => (item.id === link.id ? { ...item, ...updated } : item))
    );
    try {
      await updateScopes(link.id, updated);
    } catch (err) {
      setError((err as Error).message);
      await refresh();
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

        {/* The privacy promise sits above the flow, not buried under it. */}
        <section className="mt-8 rounded-[var(--radius)] border border-border bg-secondary/60 p-5">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-foreground" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-foreground">
              What a partner can never see
            </h2>
          </div>
          <ul className="mt-3 flex flex-wrap gap-2">
            {NEVER_SHARED.map((item) => (
              <li
                key={item}
                className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground"
              >
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Partners only ever receive counts, never the content behind them. This
            is enforced in the database, not just in the app.
          </p>
        </section>

        {!canUse ? (
          <section className="app-panel mt-8 p-6">
            <h2 className="font-display text-xl font-medium text-foreground">
              An account is needed for this one
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Everything else in MHtoolkit works anonymously and always will.
              Accountability partners are the exception, because two people have to
              stay connected across devices.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/auth/signup"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                Create an account
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex items-center rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Sign in
              </Link>
            </div>
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
                  {SCOPE_ORDER.map((key) => (
                    <ScopeToggle
                      key={key}
                      scopeKey={key}
                      checked={scopes[key]}
                      onChange={(next) => setScopes((s) => ({ ...s, [key]: next }))}
                    />
                  ))}
                </div>
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

            {invites.length > 0 && (
              <section className="mt-8">
                <h2 className="font-display text-xl font-medium text-foreground">
                  Waiting to be accepted
                </h2>
                <ul className="mt-3 space-y-2">
                  {invites.map((invite) => (
                    <li
                      key={invite.id}
                      className="app-panel flex items-center justify-between gap-3 p-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {invite.invitee_label ?? 'Unnamed invite'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Expires{' '}
                          {new Date(invite.expires_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await revokeInvite(invite.id);
                          await refresh();
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Cancel
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="mt-10">
              <h2 className="font-display text-xl font-medium text-foreground">
                Sharing with
              </h2>
              {sharingWith.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Nobody yet. Nothing about you is shared until someone accepts an
                  invite.
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {sharingWith.map((link) => (
                    <li key={link.id} className="app-panel p-5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-foreground">
                          {link.partner_label ?? 'Your partner'}
                        </p>
                        <button
                          type="button"
                          onClick={async () => {
                            await revokeLink(link.id);
                            await refresh();
                          }}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          Stop sharing
                        </button>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {SCOPE_ORDER.map((key) => (
                          <ScopeToggle
                            key={key}
                            scopeKey={key}
                            checked={link[key]}
                            onChange={(next) => handleScopeChange(link, key, next)}
                          />
                        ))}
                      </div>
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
              {supporting.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  When someone shares their progress with you, it appears here.
                </p>
              ) : (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {supporting.map((link) => (
                    <SnapshotCard
                      key={link.id}
                      link={link}
                      onLeave={async () => {
                        await revokeLink(link.id);
                        await refresh();
                      }}
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
