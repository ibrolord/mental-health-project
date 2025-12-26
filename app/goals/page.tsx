'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase/client';
import { useDataContext } from '@/lib/hooks/use-data-context';
import { format } from 'date-fns';

type Framework = 'simple' | 'eisenhower' | 'ivy_lee' | '1-3-5' | 'abcde';

interface Goal {
  id: string;
  content: string;
  status: 'pending' | 'completed' | 'cancelled';
  framework: Framework;
  priority: string | null;
  eisenhower_quadrant: string | null;
}

export default function GoalsPage() {
  const { context, query } = useDataContext();
  const [framework, setFramework] = useState<Framework>('simple');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [newGoal, setNewGoal] = useState('');
  const [loading, setLoading] = useState(true);
  const [showReflection, setShowReflection] = useState(false);
  const [reflection, setReflection] = useState('');

  useEffect(() => {
    loadGoals();
  }, []);

  const loadGoals = async () => {
    if (!query) return;

    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data } = await supabase
        .from('goals')
        .select('*')
        .eq(query.column, query.value)
        .eq('date', today)
        .order('created_at', { ascending: true });

      if (data) {
        setGoals(data);
        if (data.length > 0) {
          setFramework(data[0].framework as Framework);
        }
      }
    } catch (error) {
      console.error('Error loading goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const addGoal = async (priority?: string, eisenhower_quadrant?: string) => {
    if (!newGoal.trim()) return;

    try {
      const { data, error } = await supabase
        .from('goals')
        .insert({
          ...context,
          content: newGoal,
          framework,
          priority: priority || null,
          eisenhower_quadrant: eisenhower_quadrant || null,
          date: format(new Date(), 'yyyy-MM-dd'),
        } as any)
        .select()
        .single();

      if (!error && data) {
        setGoals([...goals, data]);
        setNewGoal('');
      }
    } catch (error) {
      console.error('Error adding goal:', error);
    }
  };

  const toggleGoal = async (goalId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';

    try {
      await supabase
        .from('goals')
        .update({
          status: newStatus,
          completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
        } as any)
        .eq('id', goalId);

      setGoals(goals.map((g) => (g.id === goalId ? { ...g, status: newStatus as any } : g)));
    } catch (error) {
      console.error('Error toggling goal:', error);
    }
  };

  const saveReflection = async () => {
    // Save reflection to first goal or create a dedicated reflection entry
    // For simplicity, we'll update all today's goals with the same reflection
    try {
      const goalIds = goals.map((g) => g.id);
      await supabase
        .from('goals')
        .update({ reflection } as any)
        .in('id', goalIds);

      alert('Reflection saved!');
      setShowReflection(false);
    } catch (error) {
      console.error('Error saving reflection:', error);
    }
  };

  const getFrameworkInstructions = () => {
    switch (framework) {
      case 'eisenhower':
        return 'Organize tasks by urgency and importance into four quadrants.';
      case 'ivy_lee':
        return 'List your top 6 tasks in order of importance. Focus on #1 until done.';
      case '1-3-5':
        return 'Plan 1 big task, 3 medium tasks, and 5 small tasks.';
      case 'abcde':
        return 'Prioritize: A=Critical, B=Should do, C=Nice to have, D=Delegate, E=Eliminate.';
      default:
        return 'Set 1-3 priorities for today.';
    }
  };

  const renderFrameworkInput = () => {
    if (framework === 'eisenhower') {
      const quadrants = ['urgent-important', 'not-urgent-important', 'urgent-not-important', 'not-urgent-not-important'];
      const labels = ['Urgent & Important', 'Important but Not Urgent', 'Urgent but Not Important', 'Neither'];

      return (
        <div className="space-y-4">
          {quadrants.map((quad, i) => (
            <div key={quad}>
              <Label className="text-sm font-medium mb-2 block">{labels[i]}</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add task..."
                  value={newGoal}
                  onChange={(e) => setNewGoal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      addGoal(undefined, quad);
                    }
                  }}
                />
                <Button onClick={() => addGoal(undefined, quad)}>Add</Button>
              </div>
              <div className="mt-2 space-y-2">
                {goals
                  .filter((g) => g.eisenhower_quadrant === quad)
                  .map((goal) => (
                    <div key={goal.id} className="flex items-center gap-2 p-2 border rounded">
                      <input
                        type="checkbox"
                        checked={goal.status === 'completed'}
                        onChange={() => toggleGoal(goal.id, goal.status)}
                        className="w-4 h-4"
                      />
                      <span className={goal.status === 'completed' ? 'line-through text-slate-500' : ''}>
                        {goal.content}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (framework === '1-3-5') {
      const priorities = ['big', 'medium', 'small'];
      const labels = ['1 Big Task', '3 Medium Tasks', '5 Small Tasks'];
      const limits = [1, 3, 5];

      return (
        <div className="space-y-4">
          {priorities.map((priority, i) => (
            <div key={priority}>
              <Label className="text-sm font-medium mb-2 block">{labels[i]}</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add task..."
                  value={newGoal}
                  onChange={(e) => setNewGoal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const count = goals.filter((g) => g.priority === priority).length;
                      if (count < limits[i]) {
                        addGoal(priority);
                      }
                    }
                  }}
                />
                <Button
                  onClick={() => {
                    const count = goals.filter((g) => g.priority === priority).length;
                    if (count < limits[i]) {
                      addGoal(priority);
                    }
                  }}
                  disabled={goals.filter((g) => g.priority === priority).length >= limits[i]}
                >
                  Add
                </Button>
              </div>
              <div className="mt-2 space-y-2">
                {goals
                  .filter((g) => g.priority === priority)
                  .map((goal) => (
                    <div key={goal.id} className="flex items-center gap-2 p-2 border rounded">
                      <input
                        type="checkbox"
                        checked={goal.status === 'completed'}
                        onChange={() => toggleGoal(goal.id, goal.status)}
                        className="w-4 h-4"
                      />
                      <span className={goal.status === 'completed' ? 'line-through text-slate-500' : ''}>
                        {goal.content}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (framework === 'abcde') {
      const priorities = ['A', 'B', 'C', 'D', 'E'];
      const labels = ['A - Critical', 'B - Should Do', 'C - Nice to Have', 'D - Delegate', 'E - Eliminate'];

      return (
        <div className="space-y-4">
          {priorities.map((priority, i) => (
            <div key={priority}>
              <Label className="text-sm font-medium mb-2 block">{labels[i]}</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add task..."
                  value={newGoal}
                  onChange={(e) => setNewGoal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      addGoal(priority);
                    }
                  }}
                />
                <Button onClick={() => addGoal(priority)}>Add</Button>
              </div>
              <div className="mt-2 space-y-2">
                {goals
                  .filter((g) => g.priority === priority)
                  .map((goal) => (
                    <div key={goal.id} className="flex items-center gap-2 p-2 border rounded">
                      <input
                        type="checkbox"
                        checked={goal.status === 'completed'}
                        onChange={() => toggleGoal(goal.id, goal.status)}
                        className="w-4 h-4"
                      />
                      <span className={goal.status === 'completed' ? 'line-through text-slate-500' : ''}>
                        {goal.content}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      );
    }

    // Simple and Ivy Lee (numbered list)
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Add a goal..."
            value={newGoal}
            onChange={(e) => setNewGoal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const limit = framework === 'ivy_lee' ? 6 : 3;
                if (goals.length < limit) {
                  addGoal();
                }
              }
            }}
          />
          <Button
            onClick={() => addGoal()}
            disabled={framework === 'ivy_lee' ? goals.length >= 6 : goals.length >= 3}
          >
            Add
          </Button>
        </div>
        <div className="space-y-2">
          {goals.map((goal, i) => (
            <div key={goal.id} className="flex items-center gap-2 p-3 border rounded">
              <span className="text-sm font-medium text-slate-500 w-6">{i + 1}.</span>
              <input
                type="checkbox"
                checked={goal.status === 'completed'}
                onChange={() => toggleGoal(goal.id, goal.status)}
                className="w-4 h-4"
              />
              <span className={`flex-1 ${goal.status === 'completed' ? 'line-through text-slate-500' : ''}`}>
                {goal.content}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const completedCount = goals.filter((g) => g.status === 'completed').length;
  const totalCount = goals.length;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Life Organizer</h1>
          <p className="text-slate-600">Plan your day with intention</p>
        </div>

        {/* Framework Selector */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Choose Your Planning Framework</CardTitle>
            <CardDescription>{getFrameworkInstructions()}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {(['simple', 'eisenhower', 'ivy_lee', '1-3-5', 'abcde'] as Framework[]).map((fw) => (
                <Button
                  key={fw}
                  variant={framework === fw ? 'default' : 'outline'}
                  onClick={() => setFramework(fw)}
                  disabled={goals.length > 0}
                >
                  {fw === '1-3-5' ? '1-3-5' : fw.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                </Button>
              ))}
            </div>
            {goals.length > 0 && (
              <p className="text-sm text-slate-500 mt-2">
                Clear today's goals to change framework
              </p>
            )}
          </CardContent>
        </Card>

        {/* Goals Input */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Today's Goals ({format(new Date(), 'MMMM dd, yyyy')})</CardTitle>
            {totalCount > 0 && (
              <CardDescription>
                {completedCount} of {totalCount} completed
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>{renderFrameworkInput()}</CardContent>
        </Card>

        {/* Evening Reflection */}
        <Card>
          <CardHeader>
            <CardTitle>Evening Reflection</CardTitle>
            <CardDescription>Reflect on your day</CardDescription>
          </CardHeader>
          <CardContent>
            {!showReflection ? (
              <Button onClick={() => setShowReflection(true)}>Add Reflection</Button>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="reflection">What did you learn today?</Label>
                  <Textarea
                    id="reflection"
                    placeholder="Reflect on what went well, what was challenging, and what you learned..."
                    value={reflection}
                    onChange={(e) => setReflection(e.target.value)}
                    rows={4}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={saveReflection}>Save Reflection</Button>
                  <Button variant="outline" onClick={() => setShowReflection(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

