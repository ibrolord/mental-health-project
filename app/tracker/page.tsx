'use client';

import { useEffect, useRef, useState } from 'react';
import {
  eachDayOfInterval,
  format,
  subDays,
} from 'date-fns';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  InlineMoodCheckIn,
  type TrackerMoodEntry,
} from '@/components/mood/inline-mood-check-in';
import { SleepDiary } from '@/components/sleep-diary';
import { Button } from '@/components/ui/button';
import { useDataContext } from '@/lib/hooks/use-data-context';
import {
  advanceOwnerGeneration,
  createOwnerGeneration,
  escapeMoodCsvCell,
  getMoodExportLabels,
  getMoodMetadataLabels,
  isCurrentOwnerGeneration,
  parseMoodMetadata,
  type OwnerGeneration,
} from '@/lib/mood-check-in';
import { supabase } from '@/lib/supabase/client';
import type { MoodEmoji } from '@/lib/supabase/types';

const moodToValue: Record<MoodEmoji, number> = {
  '😄': 5,
  '🙂': 4,
  '😐': 3,
  '😞': 2,
  '😢': 1,
};

const moodLabels: Record<MoodEmoji, string> = {
  '😄': 'Great',
  '🙂': 'Good',
  '😐': 'Okay',
  '😞': 'Low',
  '😢': 'Very low',
};

interface MoodLoadState {
  owner: OwnerGeneration;
  entries: TrackerMoodEntry[];
  loading: boolean;
  loadError: boolean;
}

export default function TrackerPage() {
  const { query, user, authLoading } = useDataContext();
  const ownerKey = query ? `${query.column}:${query.value}` : null;
  const ownerGenerationRef = useRef(createOwnerGeneration(ownerKey));
  ownerGenerationRef.current = advanceOwnerGeneration(
    ownerGenerationRef.current,
    ownerKey
  );
  const ownerGeneration = ownerGenerationRef.current;
  const [moodState, setMoodState] = useState<MoodLoadState>({
    owner: ownerGeneration,
    entries: [],
    loading: Boolean(query),
    loadError: false,
  });
  const stateMatchesOwner = isCurrentOwnerGeneration(
    moodState.owner,
    ownerGeneration
  );
  const moods = stateMatchesOwner ? moodState.entries : [];
  const loading = Boolean(query) && (!stateMatchesOwner || moodState.loading);
  const loadError = stateMatchesOwner && moodState.loadError;

  useEffect(() => {
    const operationOwner = ownerGeneration;
    if (!query) {
      setMoodState({
        owner: operationOwner,
        entries: [],
        loading: false,
        loadError: false,
      });
      return;
    }

    setMoodState({
      owner: operationOwner,
      entries: [],
      loading: true,
      loadError: false,
    });

    const loadMoods = async () => {
      const rangeStart = format(subDays(new Date(), 29), 'yyyy-MM-dd');
      const rangeEnd = format(new Date(), 'yyyy-MM-dd');

      try {
        const { data, error } = await supabase
          .from('moods')
          .select('*')
          .eq(query.column, query.value)
          .gte('local_date', rangeStart)
          .lte('local_date', rangeEnd)
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (!isCurrentOwnerGeneration(ownerGenerationRef.current, operationOwner)) {
          return;
        }
        setMoodState({
          owner: operationOwner,
          entries: (data ?? []) as TrackerMoodEntry[],
          loading: false,
          loadError: false,
        });
      } catch (error) {
        console.error('Error loading moods:', error);
        if (!isCurrentOwnerGeneration(ownerGenerationRef.current, operationOwner)) {
          return;
        }
        setMoodState({
          owner: operationOwner,
          entries: [],
          loading: false,
          loadError: true,
        });
      }
    };

    void loadMoods();
  }, [ownerGeneration, query]);

  const today = format(new Date(), 'yyyy-MM-dd');
  const todayEntry = moods.find((mood) => mood.local_date === today) ?? null;

  const handleEntryChange = (
    previousId: string | null,
    entry: TrackerMoodEntry | null
  ) => {
    const operationOwner = ownerGeneration;
    setMoodState((currentState) => {
      if (
        !isCurrentOwnerGeneration(ownerGenerationRef.current, operationOwner) ||
        !isCurrentOwnerGeneration(currentState.owner, operationOwner)
      ) {
        return currentState;
      }
      const current = currentState.entries;
      const withoutPrevious = previousId
        ? current.filter((mood) => mood.id !== previousId)
        : current;
      const entries = entry
        ? [entry, ...withoutPrevious.filter((mood) => mood.id !== entry.id)].sort(
            (a, b) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
        : withoutPrevious;
      return { ...currentState, entries };
    });
  };

  const chartData = eachDayOfInterval({
    start: subDays(new Date(), 29),
    end: new Date(),
  }).map((day) => {
    const localDate = format(day, 'yyyy-MM-dd');
    const dayMoods = moods.filter((mood) => mood.local_date === localDate);
    const mood = dayMoods.length
      ? dayMoods.reduce((sum, entry) => sum + moodToValue[entry.emoji], 0) /
        dayMoods.length
      : null;

    return {
      date: format(day, 'MMM d'),
      mood,
    };
  });

  const hasChartData = chartData.some(({ mood }) => mood !== null);

  const exportMoods = () => {
    const csv = [
      ['Date', 'Mood', 'Context', 'Emotion, support, and legacy tags'],
      ...moods.map((mood) => [
        format(new Date(mood.created_at), 'yyyy-MM-dd HH:mm'),
        moodLabels[mood.emoji],
        mood.note || '',
        getMoodExportLabels(mood.tags).join('; '),
      ]),
    ]
      .map((row) => row.map((cell) => escapeMoodCsvCell(cell)).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `mood-history-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-10">
      <div className="mx-auto max-w-4xl">
        <header>
          <h1 className="font-display text-[2rem] font-medium leading-[1.05] tracking-[-0.02em] text-[#14402F] md:text-4xl">
            Mood Tracker
          </h1>
          <p className="mt-1.5 text-sm text-[#5A6B62] md:text-base">
            Notice patterns without turning reflection into homework.
          </p>
        </header>

        <div className="mt-5 md:mt-6">
          <InlineMoodCheckIn
            owner={query}
            ownerGeneration={ownerGeneration.generation}
            initialEntry={todayEntry}
            loading={authLoading || loading}
            onEntryChange={handleEntryChange}
          />
        </div>

        {loadError && (
          <p role="alert" className="mt-3 text-sm font-medium text-destructive">
            Your mood history could not be loaded. Refresh and try again.
          </p>
        )}
        {!authLoading && !user?.id && (
          <p role="alert" className="mt-3 text-sm font-medium text-destructive">
            Your private profile could not be loaded. Refresh and try again.
          </p>
        )}

        <section className="app-panel mt-4 rounded-[1.35rem] border-[#E4DFD2] bg-[#FDFBF5] p-4 sm:mt-5 sm:p-5">
          <div className="px-1">
            <h2 className="text-sm font-semibold text-[#14402F] sm:text-base">
              30-day mood trend
            </h2>
          </div>

          {hasChartData ? (
            <div className="mt-3 h-32 w-full rounded-xl bg-[#F5F1E7] px-1 py-3 sm:h-40 sm:px-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 10, bottom: 0, left: 10 }}>
                  <CartesianGrid vertical={false} stroke="#DED8CA" strokeDasharray="3 5" />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    minTickGap={48}
                    tick={{ fill: '#5A6B62', fontSize: 11 }}
                  />
                  <YAxis
                    domain={[1, 5]}
                    hide
                  />
                  <Tooltip
                    cursor={{ stroke: '#9BB7A6', strokeDasharray: '3 3' }}
                    contentStyle={{
                      background: '#FDFBF5',
                      border: '1px solid #D7D1C4',
                      borderRadius: 12,
                      color: '#14402F',
                      fontSize: 12,
                    }}
                    labelFormatter={(label) => label}
                    formatter={(value) => {
                      const rounded = Math.round(Number(value)) as 1 | 2 | 3 | 4 | 5;
                      const label = ['Very low', 'Low', 'Okay', 'Good', 'Great'][rounded - 1];
                      return [label, 'Mood'];
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="mood"
                    connectNulls
                    stroke="#1E5C43"
                    strokeWidth={3}
                    dot={{ r: 3, fill: '#FDFBF5', stroke: '#14402F', strokeWidth: 2 }}
                    activeDot={{ r: 5, fill: '#FDFBF5', stroke: '#14402F', strokeWidth: 3 }}
                    animationDuration={350}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-3 grid min-h-28 place-items-center rounded-xl border border-dashed border-[#D7D1C4] bg-[#F5F1E7] px-5 text-center sm:min-h-36">
              <p className="max-w-sm text-sm text-[#5A6B62]">
                Your trend appears after a few check-ins.
              </p>
            </div>
          )}

        <details className="group mt-3 border-t border-[#E4DFD2]">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-1 text-sm font-semibold text-[#14402F] outline-none hover:text-[#1E5C43] focus-visible:ring-2 focus-visible:ring-[#14402F] [&::-webkit-details-marker]:hidden">
            <span>Mood history</span>
            <span className="font-normal text-[#5A6B62] group-open:hidden">View</span>
            <span className="hidden font-normal text-[#5A6B62] group-open:inline">Hide</span>
          </summary>
          <div className="border-t border-[#E4DFD2] px-1 pb-1 pt-4">
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-medium text-[#14402F]">
                Recent check-ins
              </h2>
              <p className="mt-1 text-sm text-[#5A6B62]">Your last 30 days.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={exportMoods}
              disabled={moods.length === 0}
            >
              Export CSV
            </Button>
          </div>

          {loading ? (
            <p role="status" className="py-10 text-center text-sm text-[#5A6B62]">
              Loading check-ins…
            </p>
          ) : moods.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#5A6B62]">
              No check-ins yet.
            </p>
          ) : (
            <div className="mt-5 divide-y divide-[#E4DFD2]">
              {moods.map((mood) => {
                const metadataLabels = getMoodMetadataLabels(mood.tags);
                const visibleTags = parseMoodMetadata(mood.tags).visibleTags;
                return (
                  <article key={mood.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                    <div
                      className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#F1ECDF] text-2xl"
                      aria-hidden="true"
                    >
                      {mood.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="font-semibold text-[#14402F]">
                          {moodLabels[mood.emoji]}
                        </h3>
                        <time
                          dateTime={mood.created_at}
                          className="text-xs text-[#5A6B62]"
                        >
                          {format(new Date(mood.created_at), 'MMM d · h:mm a')}
                        </time>
                      </div>
                      {metadataLabels.length > 0 && (
                        <p className="mt-1 text-sm text-[#1E5C43]">
                          {metadataLabels.join(' · ')}
                        </p>
                      )}
                      {mood.note && (
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#354F43]">
                          {mood.note}
                        </p>
                      )}
                      {visibleTags.length > 0 && (
                        <p className="mt-2 text-xs text-[#5A6B62]">
                          {visibleTags.join(' · ')}
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

          </div>
        </details>
        </section>

        <details className="group app-panel mt-4 overflow-hidden rounded-[1.1rem] border-[#E4DFD2] bg-[#FDFBF5]">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 text-sm font-semibold text-[#14402F] outline-none hover:bg-[#F5F1E7] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#14402F] [&::-webkit-details-marker]:hidden">
            <span>Sleep diary</span>
            <span className="font-normal text-[#5A6B62] group-open:hidden">View</span>
            <span className="hidden font-normal text-[#5A6B62] group-open:inline">Hide</span>
          </summary>
          <div className="border-t border-[#E4DFD2] p-4 sm:p-5">
            <SleepDiary />
          </div>
        </details>
      </div>
    </main>
  );
}
