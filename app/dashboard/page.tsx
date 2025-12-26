'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MoodEmoji } from '@/lib/supabase/types';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { format, subDays, startOfDay } from 'date-fns';

export default function DashboardPage() {
  const router = useRouter();
  const { user, sessionId, isAuthenticated } = useAuth();
  
  const [todayMood, setTodayMood] = useState<MoodEmoji | null>(null);
  const [weekMoods, setWeekMoods] = useState<any[]>([]);
  const [affirmation, setAffirmation] = useState<string>('');

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
    if (!queryValue) return;
    try {
      await supabase.from('moods').insert({ ...context, emoji: mood } as any);
      setTodayMood(mood);
    } catch (e) {
      console.error('Save mood error:', e);
    }
  };

  const moodEmojis: MoodEmoji[] = ['😄', '🙂', '😐', '😞', '😢'];
  const moodLabels = ['Great', 'Good', 'Okay', 'Low', 'Very Low'];

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
                    className={`flex flex-col items-center p-2 rounded-lg transition-all ${
                      todayMood === emoji ? 'bg-blue-100 ring-2 ring-blue-500' : 'hover:bg-slate-100'
                    }`}
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
