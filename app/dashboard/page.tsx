'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  const [moodStatus, setMoodStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

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
      await saveCheckInWithAttribution({
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
  const challengeDays = new Set(
    weekMoods.map((entry) => format(new Date(entry.created_at), 'yyyy-MM-dd'))
  ).size;

  return (
    <main className="min-h-screen px-4 py-8 md:px-8 md:py-12">
      <div className="mx-auto max-w-4xl space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Today
          </p>
          <h1 className="mt-2 font-display text-4xl font-medium leading-[1.05] tracking-[-0.02em] text-foreground md:text-5xl">
            Welcome back.
          </h1>
          <p className="mt-2 text-muted-foreground">
            Check in, notice the pattern, and choose one next step.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                    aria-pressed={todayMood === emoji}
                    className={`flex min-w-0 flex-1 flex-col items-center rounded-xl p-2 transition-all ${
                      todayMood === emoji
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

          <section className="app-panel p-5">
            <h2 className="font-display text-2xl font-medium text-foreground">
              Last 7 days
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your recent check-in rhythm.
            </p>
            {weekMoods.length === 0 ? (
              <div className="mt-5 grid min-h-24 place-items-center rounded-xl border border-dashed border-border bg-secondary/40 px-4 text-center">
                <p className="max-w-xs text-sm text-muted-foreground">
                  Your pattern will appear after a few check-ins.
                </p>
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-7 gap-1.5">
                {Array.from({ length: 7 }).map((_, i) => {
                  const date = subDays(new Date(), 6 - i);
                  const dayMood = getLatestCheckInForDate(weekMoods, date);
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
          </section>
        </div>

        {todayMood && (
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

        {affirmation && (
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

        <section className="app-panel p-5">
          <h2 className="font-display text-2xl font-medium text-foreground">
            Quick actions
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            {[
              { label: 'Track mood', href: '/tracker' },
              { label: 'Lock In', href: '/focus' },
              { label: 'Habits', href: '/habits' },
              { label: 'Journal', href: '/journal' },
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
      </div>
    </main>
  );
}
