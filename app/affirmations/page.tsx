'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase/client';
import { useDataContext } from '@/lib/hooks/use-data-context';
import { subDays } from 'date-fns';

interface Affirmation {
  id: string;
  content: string;
  category: string;
}

export default function AffirmationsPage() {
  const { context, query } = useDataContext();
  const [currentAffirmation, setCurrentAffirmation] = useState<Affirmation | null>(null);
  const [viewedCount, setViewedCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const MAX_DAILY_VIEWS = 3;

  useEffect(() => {
    loadTodaysAffirmation();
  }, []);

  const loadTodaysAffirmation = async () => {
    if (!query) return;

    try {
      setLoading(true);

      // Check how many affirmations viewed today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: history } = await supabase
        .from('user_affirmation_history')
        .select('affirmation_id, shown_at')
        .eq(query.column, query.value)
        .gte('shown_at', todayStart.toISOString());

      if (history && history.length > 0) {
        setViewedCount(history.length);

        // Load most recent affirmation
        const lastShown = history[history.length - 1] as { affirmation_id: string; shown_at: string };
        const { data: affirmation } = await supabase
          .from('affirmations')
          .select('*')
          .eq('id', lastShown.affirmation_id)
          .single();

        if (affirmation) {
          setCurrentAffirmation(affirmation);
        }
      } else {
        setViewedCount(0);
        // Show first affirmation of the day
        await loadNewAffirmation();
      }
    } catch (error) {
      console.error('Error loading affirmation:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadNewAffirmation = async () => {
    if (viewedCount >= MAX_DAILY_VIEWS || !query) return;

    try {
      setLoading(true);

      // Get user's recent mood to tailor affirmation
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();
      const { data: recentMoods } = await supabase
        .from('moods')
        .select('emoji')
        .eq(query.column, query.value)
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(7);

      // Get a random affirmation (optionally filtered by mood)
      let queryBuilder = supabase.from('affirmations').select('*');

      if (recentMoods && recentMoods.length > 0) {
        const avgMood = (recentMoods[0] as { emoji: string }).emoji; // Use most recent mood for simplicity
        queryBuilder = queryBuilder.contains('mood_tags', [avgMood]);
      }

      const { data: affirmations } = await queryBuilder;

      if (affirmations && affirmations.length > 0) {
        const randomIndex = Math.floor(Math.random() * affirmations.length);
        const affirmation = affirmations[randomIndex] as Affirmation;

        setCurrentAffirmation(affirmation);

        // Record that user viewed this affirmation
        await supabase.from('user_affirmation_history').insert({
          ...context,
          affirmation_id: affirmation.id,
        } as any);

        setViewedCount(viewedCount + 1);
      }
    } catch (error) {
      console.error('Error loading new affirmation:', error);
    } finally {
      setLoading(false);
    }
  };

  const generatePersonalizedAffirmation = async () => {
    if (!query) return;

    try {
      setGenerating(true);

      // Get recent mood history
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();
      const { data: moods } = await supabase
        .from('moods')
        .select('emoji, note')
        .eq(query.column, query.value)
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(7);

      // Get recent assessments
      const { data: assessments } = await supabase
        .from('assessments')
        .select('type, score, max_score')
        .eq(query.column, query.value)
        .order('created_at', { ascending: false })
        .limit(3);

      // Get recent goals
      const { data: goals } = await supabase
        .from('goals')
        .select('content, status')
        .eq(query.column, query.value)
        .order('created_at', { ascending: false })
        .limit(5);

      // Call API to generate personalized affirmation
      const response = await fetch('/api/affirmations/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moods,
          assessments,
          goals,
        }),
      });

      const data = await response.json();

      if (data.affirmation) {
        setCurrentAffirmation({
          id: 'personalized',
          content: data.affirmation,
          category: 'personalized',
        });
      }
    } catch (error) {
      console.error('Error generating personalized affirmation:', error);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-8 px-4 flex items-center justify-center">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Daily Affirmations</h1>
          <p className="text-slate-600">
            You can view {MAX_DAILY_VIEWS} affirmations per day ({viewedCount}/
            {MAX_DAILY_VIEWS} today)
          </p>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-12 pb-12">
            {currentAffirmation ? (
              <div className="text-center">
                <div className="text-6xl mb-6">✨</div>
                <blockquote className="text-2xl font-medium text-slate-800 italic mb-6">
                  "{currentAffirmation.content}"
                </blockquote>
                <div className="text-sm text-slate-500">
                  Category: {currentAffirmation.category}
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-600">
                <p>No affirmation loaded yet.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Button
            className="w-full"
            size="lg"
            onClick={loadNewAffirmation}
            disabled={viewedCount >= MAX_DAILY_VIEWS || loading}
          >
            {viewedCount >= MAX_DAILY_VIEWS
              ? 'Daily Limit Reached'
              : 'Show Another Affirmation'}
          </Button>

          <Button
            className="w-full"
            size="lg"
            variant="outline"
            onClick={generatePersonalizedAffirmation}
            disabled={generating}
          >
            {generating ? 'Generating...' : 'Generate Personalized Affirmation (AI)'}
          </Button>
        </div>

        <Card className="mt-8 bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-2">Why limit affirmations?</h3>
            <p className="text-sm text-slate-700">
              Affirmations are most effective when given time to resonate. Viewing too many at
              once can dilute their impact. We limit it to 3 per day to help you focus and
              reflect on each one.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

