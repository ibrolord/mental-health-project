'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { subDays } from 'date-fns';
import { ExternalLink, Quote, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DismissibleNotice } from '@/components/dismissible-notice';
import { useAiConsent } from '@/components/ai-consent-provider';
import { apiRequest } from '@/lib/api/client';
import {
  chooseRandomAffirmation,
  type AffirmationDisplayRecord,
} from '@/lib/affirmations';
import { loadAffirmationCatalog } from '@/lib/affirmations-client';
import { useDataContext } from '@/lib/hooks/use-data-context';
import { supabase } from '@/lib/supabase/client';

export default function AffirmationsPage() {
  const { context, query } = useDataContext();
  const requestAiConsent = useAiConsent();
  const [currentAffirmation, setCurrentAffirmation] =
    useState<AffirmationDisplayRecord | null>(null);
  const [viewedCount, setViewedCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const loadingRef = useRef(false);
  const currentAffirmationIdRef = useRef<string | null>(null);
  const fallbackIdsShownRef = useRef(new Set<string>());
  const fallbackViewCountRef = useRef(0);
  const ownerKey = query ? `${query.column}:${query.value}` : null;
  const currentOwnerKeyRef = useRef(ownerKey);
  const loadRevisionRef = useRef(0);
  const generationRevisionRef = useRef(0);
  currentOwnerKeyRef.current = ownerKey;

  useEffect(() => {
    loadRevisionRef.current += 1;
    generationRevisionRef.current += 1;
    loadingRef.current = false;
    currentAffirmationIdRef.current = null;
    fallbackIdsShownRef.current.clear();
    fallbackViewCountRef.current = 0;
    setCurrentAffirmation(null);
    setViewedCount(0);
    setLoading(false);
    setGenerating(false);
    setError('');
  }, [ownerKey]);

  const loadNewAffirmation = useCallback(async () => {
    if (!query || !ownerKey || loadingRef.current) return;
    const requestOwnerKey = ownerKey;
    const requestQuery = query;
    const requestContext = context;
    const requestRevision = ++loadRevisionRef.current;
    const isCurrentRequest = () =>
      currentOwnerKeyRef.current === requestOwnerKey &&
      loadRevisionRef.current === requestRevision;

    loadingRef.current = true;
    setLoading(true);
    setError('');

    const selectAndRecord = async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const historyResult = await supabase
        .from('user_affirmation_history')
        .select('affirmation_id')
        .eq(requestQuery.column, requestQuery.value)
        .gte('shown_at', todayStart.toISOString());
      if (!isCurrentRequest()) return;
      if (historyResult.error) throw historyResult.error;

      const sevenDaysAgo = subDays(new Date(), 7).toISOString();
      const moodResult = await supabase
        .from('moods')
        .select('emoji')
        .eq(requestQuery.column, requestQuery.value)
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(1);
      if (!isCurrentRequest()) return;
      if (moodResult.error) throw moodResult.error;

      const recentMood = moodResult.data?.[0]?.emoji;
      let affirmationResult = await loadAffirmationCatalog(recentMood);
      if (!isCurrentRequest()) return;

      const history = historyResult.data ?? [];
      const shownIds = new Set([
        ...history.map((item) => item.affirmation_id),
        ...fallbackIdsShownRef.current,
      ]);
      const moodMatchedSetIsExhausted =
        recentMood &&
        affirmationResult.records.length > 0 &&
        affirmationResult.records.every((item) => shownIds.has(item.id));

      if (
        recentMood &&
        (affirmationResult.records.length === 0 ||
          moodMatchedSetIsExhausted)
      ) {
        affirmationResult = await loadAffirmationCatalog();
        if (!isCurrentRequest()) return;
      }

      const affirmation = chooseRandomAffirmation(affirmationResult.records, {
        excludeIds: shownIds,
        currentId: currentAffirmationIdRef.current,
      });
      if (!affirmation) {
        throw new Error('No affirmations are available right now.');
      }

      let persistedViewIncrement = 0;
      if (affirmation.historyEligible === false) {
        fallbackIdsShownRef.current.add(affirmation.id);
        fallbackViewCountRef.current += 1;
      } else {
        const insertResult = await supabase
          .from('user_affirmation_history')
          .insert({
            ...requestContext,
            affirmation_id: affirmation.id,
          } as any);
        if (!isCurrentRequest()) return;
        if (insertResult.error) throw insertResult.error;
        persistedViewIncrement = 1;
      }

      if (!isCurrentRequest()) return;
      currentAffirmationIdRef.current = affirmation.id;
      setCurrentAffirmation(affirmation);
      setViewedCount(
        history.length + fallbackViewCountRef.current + persistedViewIncrement
      );
    };

    try {
      if (typeof navigator !== 'undefined' && navigator.locks) {
        await navigator.locks.request(
          `mhtoolkit:affirmation:${query.column}:${query.value}`,
          selectAndRecord
        );
      } else {
        await selectAndRecord();
      }
    } catch (loadError) {
      console.error('Error loading a random affirmation:', loadError);
      if (isCurrentRequest()) {
        setError('A new affirmation could not be loaded. Please try again.');
      }
    } finally {
      if (isCurrentRequest()) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, [context, ownerKey, query]);

  useEffect(() => {
    void loadNewAffirmation();
  }, [loadNewAffirmation]);

  const generatePersonalizedAffirmation = async () => {
    if (!query || !ownerKey) return;
    if (!(await requestAiConsent())) return;
    const requestOwnerKey = ownerKey;
    const requestQuery = query;
    const requestRevision = ++generationRevisionRef.current;
    const isCurrentRequest = () =>
      currentOwnerKeyRef.current === requestOwnerKey &&
      generationRevisionRef.current === requestRevision;

    try {
      setGenerating(true);

      // Get recent mood history
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();
      const { data: moods } = await supabase
        .from('moods')
        .select('emoji')
        .eq(requestQuery.column, requestQuery.value)
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(7);
      if (!isCurrentRequest()) return;

      // Get recent assessments
      const { data: assessments } = await supabase
        .from('assessments')
        .select('type, score, max_score')
        .eq(requestQuery.column, requestQuery.value)
        .order('created_at', { ascending: false })
        .limit(3);
      if (!isCurrentRequest()) return;

      // Get recent goals
      const { data: goals } = await supabase
        .from('goals')
        .select('content, status')
        .eq(requestQuery.column, requestQuery.value)
        .order('created_at', { ascending: false })
        .limit(5);
      if (!isCurrentRequest()) return;

      // Call API to generate personalized affirmation
      const data = await apiRequest('/api/affirmations/generate', {
        moods,
        assessments,
        goals,
      });
      if (!isCurrentRequest()) return;

      if (data.affirmation) {
        currentAffirmationIdRef.current = 'personalized';
        setCurrentAffirmation({
          id: 'personalized',
          content: data.affirmation,
          category: 'personalized',
          kind: 'affirmation',
          attribution_name: null,
          source_title: null,
          source_url: null,
        });
      }
    } catch (error) {
      console.error('Error generating personalized affirmation:', error);
    } finally {
      if (isCurrentRequest()) setGenerating(false);
    }
  };

  if (loading && !currentAffirmation) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f1e8] px-4 py-10 pb-28 md:py-14">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-7">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">
            A line for today
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl text-slate-950 md:text-6xl">
            Daily words
          </h1>
          <p className="mt-3 max-w-2xl leading-7 text-slate-600">
            Draw a fresh affirmation or a sourced quotation. Keep what fits and
            leave what does not.
          </p>
        </header>

        <section className="relative overflow-hidden rounded-[2rem] border border-emerald-950/10 bg-[#173f38] px-6 py-10 text-white shadow-[0_24px_70px_rgba(23,63,56,0.18)] md:px-10 md:py-14">
          <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-amber-300/20 blur-2xl" />
          {currentAffirmation ? (
            <div className="relative">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">
                <Quote className="h-4 w-4" aria-hidden="true" />
                {currentAffirmation.kind === 'quote'
                  ? 'Sourced quotation'
                  : currentAffirmation.id === 'personalized'
                    ? 'Personalized affirmation'
                    : 'Daily affirmation'}
              </div>
              <blockquote className="mt-6 font-[family-name:var(--font-display)] text-3xl leading-tight md:text-5xl">
                &ldquo;{currentAffirmation.content}&rdquo;
              </blockquote>
              {currentAffirmation.kind === 'quote' &&
                currentAffirmation.attribution_name && (
                  <footer className="mt-7 border-t border-white/15 pt-5">
                    <p className="font-semibold text-amber-100">
                      {currentAffirmation.attribution_name}
                    </p>
                    {currentAffirmation.source_url &&
                      currentAffirmation.source_title && (
                        <a
                          href={currentAffirmation.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex items-center gap-1.5 text-sm text-emerald-100 underline decoration-emerald-200/40 underline-offset-4 hover:text-white"
                        >
                          {currentAffirmation.source_title}
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      )}
                  </footer>
                )}
              <div className="mt-7 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 capitalize">
                  {currentAffirmation.category.replaceAll('-', ' ')}
                </span>
                {viewedCount > 0 && (
                  <span className="text-emerald-100/80">
                    {viewedCount} shown today
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p className="relative text-emerald-50/80">No daily words loaded yet.</p>
          )}
        </section>

        {error && (
          <p
            role="alert"
            className="mb-4 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Button
            className="h-12 bg-emerald-950 text-white hover:bg-emerald-900"
            size="lg"
            onClick={() => void loadNewAffirmation()}
            disabled={loading}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            {loading ? 'Finding another...' : 'Show another'}
          </Button>

          <Button
            className="h-12 border-emerald-950/20 bg-white text-emerald-950 hover:bg-emerald-50"
            size="lg"
            variant="outline"
            onClick={generatePersonalizedAffirmation}
            disabled={generating}
          >
            <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
            {generating ? 'Generating...' : 'Personalize with AI'}
          </Button>
        </div>

        <DismissibleNotice
          noticeKey="affirmations-ai-data-v2"
          title="AI data sharing"
          className="mt-5 border-amber-200 bg-amber-50"
        >
          Personalized affirmations can use recent mood emojis, assessment scores,
          and goals after you consent. Mood notes are not sent.
        </DismissibleNotice>

        <aside className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600">
          A line should feel believable enough to use. Draw another whenever it
          does not fit.
        </aside>
      </div>
    </main>
  );
}
