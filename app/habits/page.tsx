'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { format, subDays } from 'date-fns';

interface Habit {
  id: string;
  name: string;
  description: string | null;
  streak_count: number;
}

export default function HabitsPage() {
  const { user, sessionId, isAuthenticated } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<Record<string, boolean>>({});
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitDesc, setNewHabitDesc] = useState('');

  const queryColumn = isAuthenticated ? 'user_id' : 'session_id';
  const queryValue = isAuthenticated ? user?.id : sessionId;
  const context = isAuthenticated 
    ? { user_id: user?.id, session_id: null } 
    : { user_id: null, session_id: sessionId };

  useEffect(() => {
    if (!queryValue) return;

    const loadHabits = async () => {
      try {
        const { data: habitsData } = await supabase
          .from('habits')
          .select('id, name, description, streak_count')
          .eq(queryColumn, queryValue)
          .eq('is_active', true)
          .order('created_at', { ascending: true });

        if (habitsData && habitsData.length > 0) {
          setHabits(habitsData);
          const today = format(new Date(), 'yyyy-MM-dd');
          const { data: logsData } = await supabase
            .from('habit_logs')
            .select('habit_id, completed')
            .in('habit_id', habitsData.map((h) => h.id))
            .eq('log_date', today);

          if (logsData) {
            const logsMap: Record<string, boolean> = {};
            logsData.forEach((log) => { logsMap[log.habit_id] = log.completed; });
            setLogs(logsMap);
          }
        }
      } catch (e) { console.error('Load habits error:', e); }
    };

    loadHabits();
  }, [queryColumn, queryValue]);

  const addHabit = async () => {
    if (!newHabitName.trim() || !queryValue) return;
    try {
      const { data, error } = await supabase
        .from('habits')
        .insert({ ...context, name: newHabitName, description: newHabitDesc || null, frequency: 'daily' } as any)
        .select()
        .single();

      if (!error && data) {
        setHabits([...habits, data]);
        setNewHabitName('');
        setNewHabitDesc('');
        setShowAddHabit(false);
      }
    } catch (e) { console.error('Add habit error:', e); }
  };

  const toggleHabit = async (habitId: string) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const isCompleted = logs[habitId];
    const newCompleted = !isCompleted;

    try {
      if (isCompleted !== undefined) {
        await supabase.from('habit_logs').update({ completed: newCompleted } as any).eq('habit_id', habitId).eq('log_date', today);
      } else {
        await supabase.from('habit_logs').insert({ habit_id: habitId, completed: newCompleted, log_date: today } as any);
      }
      setLogs({ ...logs, [habitId]: newCompleted });
    } catch (e) { console.error('Toggle habit error:', e); }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 pt-20 md:p-8 md:pt-24">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Habit Tracker</h1>
            <p className="text-slate-600">Build positive habits, one day at a time</p>
          </div>
          <Button onClick={() => setShowAddHabit(!showAddHabit)}>
            {showAddHabit ? 'Cancel' : '+ New Habit'}
          </Button>
        </div>

        {showAddHabit && (
          <Card>
            <CardHeader><CardTitle>Create New Habit</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="habitName">Habit Name</Label>
                <Input id="habitName" value={newHabitName} onChange={(e) => setNewHabitName(e.target.value)} placeholder="e.g., Meditate for 10 minutes" />
              </div>
              <div>
                <Label htmlFor="habitDesc">Description (optional)</Label>
                <Textarea id="habitDesc" value={newHabitDesc} onChange={(e) => setNewHabitDesc(e.target.value)} placeholder="Why is this habit important to you?" />
              </div>
              <Button onClick={addHabit} disabled={!newHabitName.trim()}>Create Habit</Button>
            </CardContent>
          </Card>
        )}

        {habits.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-slate-500 mb-4">No habits yet. Start building positive routines!</p>
              <Button onClick={() => setShowAddHabit(true)}>Create Your First Habit</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {habits.map((habit) => {
              const isCompleted = logs[habit.id] || false;
              return (
                <Card key={habit.id} className={isCompleted ? 'border-green-200 bg-green-50' : ''}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => toggleHabit(habit.id)}
                          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                            isCompleted ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 hover:border-green-400'
                          }`}
                        >
                          {isCompleted && '✓'}
                        </button>
                        <div>
                          <h3 className={`font-medium ${isCompleted ? 'text-green-700' : 'text-slate-900'}`}>{habit.name}</h3>
                          {habit.description && <p className="text-sm text-slate-500">{habit.description}</p>}
                        </div>
                      </div>
                      <div className="text-center">
                        <span className="text-2xl font-bold text-orange-500">🔥 {habit.streak_count}</span>
                        <p className="text-xs text-slate-500">day streak</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="py-4">
            <h3 className="font-medium text-blue-900">💡 Habit Tips</h3>
            <ul className="text-sm text-blue-700 mt-2 space-y-1">
              <li>• Start small - 2 minutes is better than nothing</li>
              <li>• Stack habits - attach new ones to existing routines</li>
              <li>• Track progress - seeing streaks is motivating</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
