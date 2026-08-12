'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Leaf } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MoodEmoji } from '@/lib/supabase/types';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { format, subDays, startOfDay } from 'date-fns';
import { saveCheckInWithAttribution } from '@/lib/acquisition';
import {
  getLatestCheckInForDate,
  getLocalCheckInFields,
  getSevenDayHistoryStart,
} from '@/lib/check-in';
import { ShareChallengeButton } from '@/components/launch/share-challenge-button';
import { DismissibleNotice } from '@/components/dismissible-notice';
import {
  chooseRandomAffirmation,
  type AffirmationDisplayRecord,
} from '@/lib/affirmations';
import { loadAffirmationCatalog } from '@/lib/affirmations-client';
import { GoToActions } from '@/components/go-to-actions';
import { WeeklyInsight } from '@/components/weekly-insight';
import {
  loadWeeklyOwnerSummary,
  type WeeklyOwnerSummary,
  type WeeklySummaryRpc,
} from '@/lib/weekly-insights';
import { UNIFIED_LIBRARY } from '@/lib/library/content';
import {
  composeSavedCollection,
  parsePracticeProgressRow,
  type PracticeProgressRow,
  type SavedLibraryStateRow,
  type SavedLibraryViewItem,
} from '@/lib/product-state';

export default function DashboardPage() {
  const router = useRouter();
  const { user, sessionId, isAuthenticated, loading: authLoading } = useAuth();
  
  const [todayMood, setTodayMood] = useState<MoodEmoji | null>(null);
  const [weekMoods, setWeekMoods] = useState<
    Array<{ emoji: MoodEmoji; created_at: string }>
  >([]);
  const [affirmation, setAffirmation] =
    useState<AffirmationDisplayRecord | null>(null);
  const [savingMood, setSavingMood] = useState(false);
  const [lowEnergyMode, setLowEnergyMode] = useState(false);
  const [moodStatus, setMoodStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [weeklySummary, setWeeklySummary] =
    useState<WeeklyOwnerSummary | null>(null);
  const [weeklySummaryOwnerId, setWeeklySummaryOwnerId] =
    useState<string | null>(null);
  const [resumeProgress, setResumeProgress] =
    useState<PracticeProgressRow | null>(null);
  const [savedItem, setSavedItem] = useState<SavedLibraryViewItem | null>(null);
  const [productStateOwnerId, setProductStateOwnerId] =
    useState<string | null>(null);
  const [moodStateOwnerKey, setMoodStateOwnerKey] =
    useState<string | null>(null);

  const queryColumn = isAuthenticated ? 'user_id' : 'session_id';
  const queryValue = isAuthenticated ? user?.id : sessionId;
  const moodOwnerKey = queryValue ? `${queryColumn}:${queryValue}` : null;
  const currentMoodOwnerKeyRef = useRef(moodOwnerKey);
  const moodLoadRevisionRef = useRef(0);
  currentMoodOwnerKeyRef.current = moodOwnerKey;

  useEffect(() => {
    const loadRevision = ++moodLoadRevisionRef.current;
    const ownerKey = moodOwnerKey;
    setTodayMood(null);
    setWeekMoods([]);
    setMoodStateOwnerKey(null);
    setSavingMood(false);
    setMoodStatus(null);
    if (!queryValue || !ownerKey) return;

    const loadData = async () => {
      try {
        const todayStart = startOfDay(new Date()).toISOString();
        const sevenDaysAgo = getSevenDayHistoryStart();

        const [moodRes, weekRes, affRes] = await Promise.all([
          supabase.from('moods').select('emoji').eq(queryColumn, queryValue).gte('created_at', todayStart).order('created_at', { ascending: false }).limit(1).single(),
          supabase.from('moods').select('emoji, created_at').eq(queryColumn, queryValue).gte('created_at', sevenDaysAgo).order('created_at', { ascending: false }),
          loadAffirmationCatalog(),
        ]);

        if (
          currentMoodOwnerKeyRef.current !== ownerKey ||
          moodLoadRevisionRef.current !== loadRevision
        ) {
          return;
        }

        setTodayMood((moodRes.data?.emoji as MoodEmoji | undefined) ?? null);
        setWeekMoods(
          (weekRes.data ?? []).map((entry) => ({
            emoji: entry.emoji as MoodEmoji,
            created_at: entry.created_at,
          }))
        );
        setMoodStateOwnerKey(ownerKey);
        if (affRes.records.length > 0) {
          setAffirmation(chooseRandomAffirmation(affRes.records));
        }
      } catch (e) {
        if (
          currentMoodOwnerKeyRef.current === ownerKey &&
          moodLoadRevisionRef.current === loadRevision
        ) {
          console.error('Dashboard load error:', e);
        }
      }
    };

    void loadData();
  }, [moodOwnerKey, queryColumn, queryValue]);

  useEffect(() => {
    const ownerId = user?.id ?? null;
    setWeeklySummary(null);
    setWeeklySummaryOwnerId(null);
    if (!ownerId) return;

    let active = true;
    const rpc: WeeklySummaryRpc = async (args) => {
      const result = await supabase.rpc('weekly_owner_summary', args);
      return { data: result.data, error: result.error };
    };
    void loadWeeklyOwnerSummary(rpc)
      .then((summary) => {
        if (active && user?.id === ownerId) {
          setWeeklySummary(summary);
          setWeeklySummaryOwnerId(ownerId);
        }
      })
      .catch(() => {
        if (active && user?.id === ownerId) {
          setWeeklySummary(null);
          setWeeklySummaryOwnerId(ownerId);
        }
      });

    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    const ownerId = user?.id ?? null;
    setResumeProgress(null);
    setSavedItem(null);
    setProductStateOwnerId(null);
    if (!ownerId) return;

    let active = true;
    void Promise.all([
      supabase
        .from('practice_progress')
        .select('*')
        .eq('user_id', ownerId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('user_library_items')
        .select('content_id, media_type, is_saved, priority, updated_at')
        .eq('user_id', ownerId)
        .or('is_saved.eq.true,priority.eq.next')
        .order('updated_at', { ascending: false }),
    ]).then(([progressResult, libraryResult]) => {
      if (!active || user?.id !== ownerId) return;
      setResumeProgress(parsePracticeProgressRow(progressResult.data));
      if (!libraryResult.error) {
        const collection = composeSavedCollection(
          UNIFIED_LIBRARY,
          (libraryResult.data ?? []) as SavedLibraryStateRow[],
          []
        );
        setSavedItem(collection.upNext[0] ?? collection.saved[0] ?? null);
      }
      setProductStateOwnerId(ownerId);
    });

    return () => {
      active = false;
    };
  }, [user?.id]);

  const saveMood = async (mood: MoodEmoji) => {
    if (savingMood) return;
    if (!moodOwnerKey) {
      setMoodStatus({
        type: 'error',
        message: 'Your private profile is not ready. Refresh and try again.',
      });
      return;
    }
    const ownerKey = moodOwnerKey;
    const ownerRevision = moodLoadRevisionRef.current;
    const operationIsCurrent = () =>
      currentMoodOwnerKeyRef.current === ownerKey &&
      moodLoadRevisionRef.current === ownerRevision;
    try {
      setSavingMood(true);
      setMoodStatus(null);
      if (!user?.id) throw new Error('Your private profile is not ready.');
      await saveCheckInWithAttribution(user.id, {
        emoji: mood,
        ...getLocalCheckInFields(),
      });
      if (!operationIsCurrent()) return;
      setTodayMood(mood);
      setWeekMoods((current) => [
        ...current.filter(
          (entry) =>
            format(new Date(entry.created_at), 'yyyy-MM-dd') !==
            format(new Date(), 'yyyy-MM-dd')
        ),
        { emoji: mood, created_at: new Date().toISOString() },
      ]);
      setMoodStateOwnerKey(ownerKey);
      setMoodStatus({ type: 'success', message: 'Check-in saved.' });
    } catch (e) {
      if (operationIsCurrent()) {
        console.error('Save mood error:', e);
        setMoodStatus({
          type: 'error',
          message: 'Your check-in was not saved. Please try again.',
        });
      }
    } finally {
      if (operationIsCurrent()) {
        setSavingMood(false);
      }
    }
  };

  const moodEmojis: MoodEmoji[] = ['😄', '🙂', '😐', '😞', '😢'];
  const moodLabels = ['Great', 'Good', 'Okay', 'Low', 'Very Low'];
  const visibleTodayMood =
    moodStateOwnerKey === moodOwnerKey ? todayMood : null;
  const visibleWeekMoods =
    moodStateOwnerKey === moodOwnerKey ? weekMoods : [];
  const visibleWeeklySummary =
    weeklySummaryOwnerId === user?.id ? weeklySummary : null;
  const visibleResumeProgress =
    productStateOwnerId === user?.id ? resumeProgress : null;
  const visibleSavedItem =
    productStateOwnerId === user?.id ? savedItem : null;
  const challengeDays = new Set(
    visibleWeekMoods.map((entry) =>
      format(new Date(entry.created_at), 'yyyy-MM-dd')
    )
  ).size;

  return (
    <main className="min-h-screen px-4 py-8 md:px-8 md:py-12">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Today
            </p>
            <h1 className="mt-2 font-display text-4xl font-medium leading-[1.05] tracking-[-0.02em] text-foreground md:text-5xl">
              {lowEnergyMode ? 'Keep it simple.' : 'Welcome back.'}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {lowEnergyMode
                ? 'Choose one thing. You can stop there.'
                : 'Check in, notice the pattern, and choose one next step.'}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            aria-pressed={lowEnergyMode}
            onClick={() => setLowEnergyMode((current) => !current)}
          >
            {lowEnergyMode ? 'Show full view' : 'Use low-energy view'}
          </Button>
        </header>

        <div className={`grid grid-cols-1 gap-4 ${lowEnergyMode ? '' : 'md:grid-cols-2'}`}>
          <section className="app-panel p-5">
            <h2 className="font-display text-2xl font-medium text-foreground">
              How are you feeling?
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose what feels closest.
            </p>
            <div className="mt-5">
              <div className="flex justify-between gap-1">
                {moodEmojis.map((emoji, index) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => saveMood(emoji)}
                    disabled={savingMood || authLoading || !moodOwnerKey}
                    aria-label={`Feeling ${moodLabels[index]}`}
                    aria-pressed={visibleTodayMood === emoji}
                    className={`flex min-w-0 flex-1 flex-col items-center rounded-xl p-2 transition-all ${
                      visibleTodayMood === emoji
                        ? 'bg-secondary ring-2 ring-primary'
                        : 'hover:bg-secondary'
                    } disabled:cursor-wait disabled:opacity-60`}
                  >
                    <span className="text-2xl">{emoji}</span>
                    <span className="mt-1 text-[0.65rem] text-muted-foreground sm:text-xs">
                      {moodLabels[index]}
                    </span>
                  </button>
                ))}
              </div>
              {authLoading ? (
                <p role="status" className="mt-3 text-sm text-muted-foreground">
                  Getting your check-in ready…
                </p>
              ) : !moodOwnerKey ? (
                <p role="alert" className="mt-3 text-sm text-destructive">
                  Your private profile could not be loaded. Refresh and try again.
                </p>
              ) : moodStatus ? (
                <p
                  role={moodStatus.type === 'error' ? 'alert' : 'status'}
                  className={`mt-3 text-sm ${
                    moodStatus.type === 'error'
                      ? 'text-destructive'
                      : 'text-primary'
                  }`}
                >
                  {moodStatus.message}
                </p>
              ) : null}
            </div>
          </section>

          {!lowEnergyMode && <section className="app-panel p-5">
            <h2 className="font-display text-2xl font-medium text-foreground">
              Last 7 days
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your recent check-in rhythm.
            </p>
            {visibleWeekMoods.length === 0 ? (
              <div className="mt-5 grid min-h-24 place-items-center rounded-xl border border-dashed border-border bg-secondary/40 px-4 text-center">
                <p className="max-w-xs text-sm text-muted-foreground">
                  Your pattern will appear after a few check-ins.
                </p>
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-7 gap-1.5">
                {Array.from({ length: 7 }).map((_, i) => {
                  const date = subDays(new Date(), 6 - i);
                  const dayMood = getLatestCheckInForDate(visibleWeekMoods, date);
                  return (
                    <div key={i} className="flex min-w-0 flex-col items-center gap-1.5">
                      <span
                        className="grid aspect-square w-full max-w-10 place-items-center rounded-xl border border-border bg-background text-lg"
                        aria-label={
                          dayMood
                            ? `${format(date, 'EEEE')}: ${dayMood.emoji}`
                            : `${format(date, 'EEEE')}: no check-in`
                        }
                      >
                        {dayMood?.emoji ?? (
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-border"
                            aria-hidden="true"
                          />
                        )}
                      </span>
                      <span className="text-[0.65rem] text-muted-foreground">
                        {format(date, 'EEEEE')}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>}
        </div>

        {!lowEnergyMode ? (
          <section
            aria-labelledby="together-heading"
            className="relative overflow-hidden rounded-3xl border border-emerald-900/15 bg-[linear-gradient(115deg,#e7f0e5_0%,#f5f1e5_72%)] p-6"
          >
            <div className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full border border-emerald-900/10 bg-white/35" />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/80 text-emerald-950 shadow-sm">
                <Leaf aria-hidden="true" className="h-7 w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                  Accountability partner
                </p>
                <h2
                  id="together-heading"
                  className="mt-1 font-display text-3xl font-medium tracking-[-0.02em] text-foreground"
                >
                  Do it together
                </h2>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                  {isAuthenticated
                    ? 'Share one commitment, check in, and celebrate progress.'
                    : 'Invite someone you trust and share only what you choose.'}
                </p>
              </div>
              <Button
                type="button"
                onClick={() => router.push('/accountability')}
                className="w-full gap-2 sm:w-auto"
              >
                {isAuthenticated ? 'Open Together' : 'Set up Together'}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Button>
            </div>
          </section>
        ) : null}

        {visibleWeeklySummary && !lowEnergyMode ? (
          <WeeklyInsight summary={visibleWeeklySummary} />
        ) : null}

        {!lowEnergyMode && (visibleResumeProgress || visibleSavedItem) ? (
          <section className="grid gap-3 sm:grid-cols-2" aria-label="Continue and saved">
            {visibleResumeProgress ? (
              <button
                type="button"
                onClick={() => router.push(visibleResumeProgress.route)}
                className="app-panel p-5 text-left transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">
                  Continue
                </p>
                <h2 className="mt-2 font-display text-xl font-medium text-foreground">
                  Resume meditation
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Return to your paused practice.
                </p>
              </button>
            ) : null}
            {visibleSavedItem ? (
              <button
                type="button"
                onClick={() => router.push('/saved')}
                className="app-panel p-5 text-left transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">
                  Saved for later
                </p>
                <h2 className="mt-2 font-display text-xl font-medium text-foreground">
                  {visibleSavedItem.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Open your saved space.
                </p>
              </button>
            ) : null}
          </section>
        ) : null}

        {visibleTodayMood && !lowEnergyMode && (
          <DismissibleNotice
            noticeKey="dashboard-seven-day-challenge-v1"
            dismissLabel="Hide the seven-day check-in card"
          >
            <section className="app-panel-quiet flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                  7-day private check-in
                </p>
                <h2 className="mt-2 font-display text-2xl font-medium text-foreground">
                  {Math.min(challengeDays, 7)} of 7 check-in days
                </h2>
                <div
                  className="mt-4 flex gap-2"
                  aria-label={`${Math.min(challengeDays, 7)} of 7 days complete`}
                >
                  {Array.from({ length: 7 }).map((_, index) => (
                    <span
                      key={index}
                      className={`h-2.5 w-8 rounded-full ${
                        index < challengeDays ? 'bg-accent' : 'bg-border'
                      }`}
                    />
                  ))}
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Missed days do not erase progress.
                </p>
              </div>
              <ShareChallengeButton />
            </section>
          </DismissibleNotice>
        )}

        {affirmation && !lowEnergyMode && (
          <DismissibleNotice
            noticeKey="dashboard-affirmation-v1"
            dismissLabel="Hide today's affirmation"
          >
            <section className="app-panel-quiet p-6 pr-14 text-center">
              <p className="font-display text-xl italic text-foreground">
                &quot;{affirmation.content}&quot;
              </p>
              {affirmation.kind === 'quote' && affirmation.attribution_name && (
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {affirmation.attribution_name}
                </p>
              )}
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {affirmation.kind === 'quote'
                  ? 'Sourced quotation'
                  : 'Daily affirmation'}
              </p>
              {affirmation.kind === 'quote' &&
                affirmation.source_url &&
                affirmation.source_title && (
                  <a
                    href={affirmation.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-xs font-semibold text-emerald-800 underline underline-offset-4"
                  >
                    {affirmation.source_title}
                  </a>
                )}
            </section>
          </DismissibleNotice>
        )}

        {lowEnergyMode ? (
          <section className="app-panel p-5">
            <h2 className="font-display text-2xl font-medium text-foreground">
              Choose one
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                { label: 'Ground me', href: '/ground' },
                { label: 'One small step', href: '/habits' },
                { label: 'Write a note', href: '/journal' },
              ].map((link) => (
                <Button
                  key={link.href}
                  variant="outline"
                  className="justify-start"
                  onClick={() => router.push(link.href)}
                >
                  {link.label}
                </Button>
              ))}
            </div>
          </section>
        ) : (
          <GoToActions key={moodOwnerKey ?? 'pending'} ownerKey={moodOwnerKey} />
        )}
      </div>
    </main>
  );
}
