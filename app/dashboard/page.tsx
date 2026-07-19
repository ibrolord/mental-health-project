'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MoodEmoji } from '@/lib/supabase/types';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { format, subDays, startOfDay } from 'date-fns';
import { queueActivationAttribution } from '@/lib/acquisition';
import { getLocalCheckInFields } from '@/lib/check-in';
import { ShareChallengeButton } from '@/components/launch/share-challenge-button';

export default function DashboardPage() {
  const router = useRouter();
  const { user, sessionId, isAuthenticated } = useAuth();
  
  const [todayMood, setTodayMood] = useState<MoodEmoji | null>(null);
  const [weekMoods, setWeekMoods] = useState<any[]>([]);
  const [affirmation, setAffirmation] = useState<string>('');
  const [savingMood, setSavingMood] = useState(false);

  const queryColumn = isAuthenticated ? 'user_id' : 'session_id';
  const queryValue = isAuthenticated ? user?.id : sessionId;
  const context = isAuthenticated 
    ? { user_id: user?.id, session_id: null } 
    : { user_id: null, session_id: sessionId };

  useEffect(() => {
    if (!queryValue) return;

    const loadData = async () => {
      try {
        const todayStart = startOfDay(new Date()).toISOString();
        const sevenDaysAgo = subDays(new Date(), 7).toISOString();

        const [moodRes, weekRes, affRes] = await Promise.all([
          supabase.from('moods').select('emoji').eq(queryColumn, queryValue).gte('created_at', todayStart).order('created_at', { ascending: false }).limit(1).single(),
          supabase.from('moods').select('emoji, created_at').eq(queryColumn, queryValue).gte('created_at', sevenDaysAgo).order('created_at', { ascending: true }),
          supabase.from('affirmations').select('content').limit(1).single()
        ]);

        if (moodRes.data) setTodayMood(moodRes.data.emoji as MoodEmoji);
        if (weekRes.data) setWeekMoods(weekRes.data);
        if (affRes.data) setAffirmation(affRes.data.content);
      } catch (e) {
        console.error('Dashboard load error:', e);
      }
    };

    loadData();
  }, [queryColumn, queryValue]);

  const saveMood = async (mood: MoodEmoji) => {
    if (!queryValue || !user?.id || savingMood) return;
    try {
      setSavingMood(true);
      const { error } = await supabase.from('moods').insert({
        ...context,
        emoji: mood,
        ...getLocalCheckInFields(),
      } as any);
      if (error) throw error;
      setTodayMood(mood);
      setWeekMoods((current) => [
        ...current.filter(
          (entry) =>
            format(new Date(entry.created_at), 'yyyy-MM-dd') !==
            format(new Date(), 'yyyy-MM-dd')
        ),
        { emoji: mood, created_at: new Date().toISOString() },
      ]);
      queueActivationAttribution(user.id);
    } catch (e) {
      console.error('Save mood error:', e);
    } finally {
      setSavingMood(false);
    }
  };

  const moodEmojis: MoodEmoji[] = ['😄', '🙂', '😐', '😞', '😢'];
  const moodLabels = ['Great', 'Good', 'Okay', 'Low', 'Very Low'];
  const challengeDays = new Set(
    weekMoods.map((entry) => format(new Date(entry.created_at), 'yyyy-MM-dd'))
  ).size;

  return (
    <main className="min-h-screen bg-slate-50 p-4 pt-20 md:p-8 md:pt-24">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Welcome back</h1>
          <p className="text-slate-600">Your mental health snapshot</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">How are you feeling?</CardTitle>
              <CardDescription>Track your mood for today</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between">
                {moodEmojis.map((emoji, index) => (
                  <button
                    key={emoji}
                    onClick={() => saveMood(emoji)}
                    disabled={savingMood}
                    className={`flex flex-col items-center p-2 rounded-lg transition-all ${
                      todayMood === emoji ? 'bg-blue-100 ring-2 ring-blue-500' : 'hover:bg-slate-100'
                    } disabled:cursor-wait disabled:opacity-60`}
                  >
                    <span className="text-2xl">{emoji}</span>
                    <span className="text-xs text-slate-600 mt-1">{moodLabels[index]}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">This Week</CardTitle>
              <CardDescription>Your mood over the last 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-end h-20">
                {Array.from({ length: 7 }).map((_, i) => {
                  const date = subDays(new Date(), 6 - i);
                  const dayMood = weekMoods.find(
                    (m) => format(new Date(m.created_at), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
                  );
                  return (
                    <div key={i} className="flex flex-col items-center">
                      <span className="text-xl">{dayMood?.emoji || '·'}</span>
                      <span className="text-xs text-slate-500 mt-1">{format(date, 'EEE')}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {todayMood && (
          <Card className="overflow-hidden border-[#bfd0c4] bg-[#edf4ea]">
            <CardContent className="flex flex-col gap-6 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#a84c34]">
                  7-day private check-in
                </p>
                <h2 className="mt-2 text-xl font-bold text-[#173d34]">
                  {Math.min(challengeDays, 7)} of 7 check-in days
                </h2>
                <div className="mt-4 flex gap-2" aria-label={`${Math.min(challengeDays, 7)} of 7 days complete`}>
                  {Array.from({ length: 7 }).map((_, index) => (
                    <span
                      key={index}
                      className={`h-2.5 w-8 rounded-full ${
                        index < challengeDays ? 'bg-[#c65f3d]' : 'bg-[#cbd8ce]'
                      }`}
                    />
                  ))}
                </div>
                <p className="mt-3 text-sm text-[#587169]">
                  Keep it light. A missed day does not reset your progress.
                </p>
              </div>
              <ShareChallengeButton />
            </CardContent>
          </Card>
        )}

        {affirmation && (
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100">
            <CardContent className="pt-6">
              <p className="text-center text-lg italic text-slate-700">&quot;{affirmation}&quot;</p>
              <p className="text-center text-sm text-slate-500 mt-2">Daily Affirmation</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {[
                { label: '📊 Track Mood', href: '/tracker' },
                { label: '💬 AI Chat', href: '/chat' },
                { label: '📋 Assessments', href: '/assessments' },
                { label: '🎯 Habits', href: '/habits' },
                { label: '✅ Goals', href: '/goals' },
                { label: '📚 Library', href: '/library' },
              ].map((link) => (
                <Button key={link.href} variant="outline" className="justify-start" onClick={() => router.push(link.href)}>
                  {link.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
