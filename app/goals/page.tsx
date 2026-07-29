'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase/client';
import { useDataContext } from '@/lib/hooks/use-data-context';
import { format } from 'date-fns';
import {
  appendUniqueGoal,
  collapseDuplicateGoals,
  createSingleFlight,
  goalIdentityKey,
} from '@/lib/goals/deduplication';

type Framework = 'simple' | 'eisenhower' | 'ivy_lee' | '1-3-5' | 'abcde';

interface Goal {
  id: string;
  content: string;
  status: 'pending' | 'completed' | 'cancelled';
  framework: Framework;
  priority: string | null;
  eisenhower_quadrant: string | null;
}

const EISENHOWER_QUADRANTS = [
  { id: 'urgent-important', label: 'Do First', subtitle: 'Urgent & Important — Crisis, deadlines, problems', color: 'bg-red-50 border-red-200', headerColor: 'bg-red-500', icon: '🔥' },
  { id: 'not-urgent-important', label: 'Schedule', subtitle: 'Important, Not Urgent — Planning, growth, prevention', color: 'bg-secondary border-border', headerColor: 'bg-primary', icon: '📅' },
  { id: 'urgent-not-important', label: 'Delegate', subtitle: 'Urgent, Not Important — Interruptions, some meetings', color: 'bg-yellow-50 border-yellow-200', headerColor: 'bg-yellow-500', icon: '👋' },
  { id: 'not-urgent-not-important', label: 'Eliminate', subtitle: 'Neither — Time wasters, distractions', color: 'bg-secondary/50 border-border', headerColor: 'bg-slate-400', icon: '🗑️' },
];

const PRIORITIES_135 = [
  { id: 'big', label: '1 Big Thing', subtitle: 'The ONE task that will make the biggest impact today. If you only accomplish this, the day is a success.', limit: 1, color: 'bg-purple-50 border-purple-200', headerColor: 'bg-purple-500', icon: '🎯' },
  { id: 'medium', label: '3 Medium Tasks', subtitle: 'Important tasks that support your main goal or need to get done today.', limit: 3, color: 'bg-secondary border-border', headerColor: 'bg-primary', icon: '📋' },
  { id: 'small', label: '5 Small Tasks', subtitle: 'Quick wins, admin tasks, or things you can knock out in under 15 minutes.', limit: 5, color: 'bg-green-50 border-green-200', headerColor: 'bg-green-500', icon: '✅' },
];

const PRIORITIES_ABCDE = [
  { id: 'A', label: 'A — Must Do', subtitle: 'Critical tasks with serious consequences if not done. These are your "have to" items — non-negotiable.', color: 'bg-red-50 border-red-200', headerColor: 'bg-red-500', icon: '🚨' },
  { id: 'B', label: 'B — Should Do', subtitle: 'Important tasks with mild consequences. These are "ought to" items — do after A tasks.', color: 'bg-orange-50 border-orange-200', headerColor: 'bg-orange-500', icon: '⚠️' },
  { id: 'C', label: 'C — Nice to Do', subtitle: 'Tasks with no real consequences if skipped. Pleasant but not essential.', color: 'bg-yellow-50 border-yellow-200', headerColor: 'bg-yellow-500', icon: '💡' },
  { id: 'D', label: 'D — Delegate', subtitle: 'Tasks someone else can do. Free up your time for A and B tasks.', color: 'bg-secondary border-border', headerColor: 'bg-primary', icon: '🤝' },
  { id: 'E', label: 'E — Eliminate', subtitle: 'Tasks that don\'t need to be done at all. Remove them from your list entirely.', color: 'bg-secondary/50 border-border', headerColor: 'bg-slate-400', icon: '🗑️' },
];

export default function GoalsPage() {
  const { context, query } = useDataContext();
  const [framework, setFramework] = useState<Framework>('simple');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [goalError, setGoalError] = useState<string | null>(null);
  const [showReflection, setShowReflection] = useState(false);
  const [reflection, setReflection] = useState('');
  const [simpleInput, setSimpleInput] = useState('');
  const [quadrantInputs, setQuadrantInputs] = useState<Record<string, string>>({});
  const [priorityInputs, setPriorityInputs] = useState<Record<string, string>>({});
  const [librarySourceTitle, setLibrarySourceTitle] = useState('');
  const appliedLibraryActionRef = useRef(false);
  const goalIdsByKeyRef = useRef(new Map<string, string[]>());
  const runGoalInsertRef = useRef(createSingleFlight());

  const loadGoals = useCallback(async () => {
    if (!query) {
      setGoals([]);
      goalIdsByKeyRef.current = new Map();
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq(query.column, query.value)
      .eq('date', format(new Date(), 'yyyy-MM-dd'))
      .order('created_at', { ascending: true });

    if (error) {
      setGoalError('Could not load your goals. Please try again.');
    } else if (data) {
      const collapsed = collapseDuplicateGoals(data as Goal[]);
      goalIdsByKeyRef.current = collapsed.idsByKey;
      setGoals(collapsed.goals);
    }
    setLoading(false);
  }, [query]);

  useEffect(() => {
    void loadGoals();
  }, [loadGoals]);

  useEffect(() => {
    if (appliedLibraryActionRef.current || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('source') !== 'library') return;

    const content = params.get('content')?.trim().slice(0, 500) ?? '';
    if (!content) return;
    appliedLibraryActionRef.current = true;
    setFramework('simple');
    setSimpleInput(content);
    setLibrarySourceTitle(
      params.get('itemTitle')?.slice(0, 200) ??
        params.get('bookTitle')?.slice(0, 200) ??
        'the library'
    );
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  useEffect(() => {
    if (librarySourceTitle && !simpleInput.trim()) {
      setLibrarySourceTitle('');
    }
  }, [librarySourceTitle, simpleInput]);

  const addGoal = async (content: string, priority?: string, quadrant?: string) => {
    const normalizedContent = content.trim().replace(/\s+/g, ' ');
    if (!normalizedContent || (!context.user_id && !context.session_id)) return false;

    setGoalError(null);
    const date = format(new Date(), 'yyyy-MM-dd');
    const identity = {
      id: 'pending',
      content: normalizedContent,
      framework,
      priority: priority || null,
      eisenhower_quadrant: quadrant || null,
    };
    const identityKey = goalIdentityKey(identity);

    const saved = await runGoalInsertRef.current(async () => {
      if (goalIdsByKeyRef.current.has(identityKey)) {
        setGoalError('That goal is already in this section.');
        return false;
      }

      setAdding(true);
      try {
        const { data, error } = await supabase
          .from('goals')
          .insert({
            ...context,
            content: normalizedContent,
            framework,
            priority: priority || null,
            eisenhower_quadrant: quadrant || null,
            date,
          } as any)
          .select()
          .single();

        if (error || !data) {
          if (error?.code === '23505') {
            await loadGoals();
            setGoalError('That goal is already in this section.');
          } else {
            setGoalError('Could not add that goal. Please try again.');
          }
          return false;
        }

        goalIdsByKeyRef.current.set(identityKey, [data.id]);
        setGoals((current) => appendUniqueGoal(current, data as Goal));
        return true;
      } catch {
        setGoalError('Could not add that goal. Please try again.');
        return false;
      } finally {
        setAdding(false);
      }
    });

    return saved ?? false;
  };

  const toggleGoal = async (id: string, status: string) => {
    if (!query) return;
    const goal = goals.find((item) => item.id === id);
    if (!goal) return;
    const ids = goalIdsByKeyRef.current.get(goalIdentityKey(goal)) ?? [id];
    const newStatus = status === 'completed' ? 'pending' : 'completed';
    const { error } = await supabase.from('goals').update({ status: newStatus, completed_at: newStatus === 'completed' ? new Date().toISOString() : null } as any).in('id', ids).eq(query.column, query.value);
    if (error) {
      setGoalError('Could not update that goal. Please try again.');
      return;
    }
    setGoals((current) => current.map(g => g.id === id ? { ...g, status: newStatus as Goal['status'] } : g));
  };

  const deleteGoal = async (id: string) => {
    if (!query) return;
    const goal = goals.find((item) => item.id === id);
    if (!goal) return;
    const identityKey = goalIdentityKey(goal);
    const ids = goalIdsByKeyRef.current.get(identityKey) ?? [id];
    const { error } = await supabase.from('goals').delete().in('id', ids).eq(query.column, query.value);
    if (error) {
      setGoalError('Could not delete that goal. Please try again.');
      return;
    }
    goalIdsByKeyRef.current.delete(identityKey);
    setGoals((current) => current.filter(g => g.id !== id));
  };

  const saveReflection = async () => {
    const ids = [...goalIdsByKeyRef.current.values()].flat();
    if (ids.length > 0) await supabase.from('goals').update({ reflection } as any).in('id', ids);
    alert('Saved!'); setShowReflection(false);
  };

  const submitGoal = (
    content: string,
    priority?: string,
    quadrant?: string,
    onSaved?: () => void
  ) => {
    if (adding || !content.trim()) return;
    void addGoal(content, priority, quadrant).then((saved) => {
      if (saved) onSaved?.();
    });
  };

  const frameworkGoals = goals.filter(g => g.framework === framework);
  const getCount = (fw: Framework) => fw === 'eisenhower' ? goals.filter(g => g.eisenhower_quadrant).length : goals.filter(g => g.framework === fw).length;

  const renderGoalItem = (g: Goal, showNumber?: number) => (
    <div key={g.id} className={`flex items-center gap-3 p-3 bg-card rounded-lg border shadow-sm group transition-all hover:shadow-md ${g.status === 'completed' ? 'opacity-60' : ''}`}>
      {showNumber !== undefined && <span className={`text-xl font-bold w-6 ${g.status === 'completed' ? 'text-green-500' : 'text-slate-300'}`}>{showNumber}</span>}
      <input type="checkbox" checked={g.status === 'completed'} onChange={() => toggleGoal(g.id, g.status)} className="w-5 h-5 rounded cursor-pointer accent-blue-500" />
      <span className={`flex-1 ${g.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>{g.content}</span>
      <button onClick={() => deleteGoal(g.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xl transition-opacity">×</button>
    </div>
  );

  const renderEisenhower = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {EISENHOWER_QUADRANTS.map(q => {
        const list = goals.filter(g => g.eisenhower_quadrant === q.id);
        const val = quadrantInputs[q.id] || '';
        return (
          <div key={q.id} className={`rounded-xl border-2 ${q.color} overflow-hidden shadow-sm`}>
            <div className={`${q.headerColor} text-white px-4 py-3`}>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{q.icon}</span>
                <div><h3 className="font-bold text-lg">{q.label}</h3><p className="text-xs opacity-90">{q.subtitle}</p></div>
              </div>
            </div>
            <div className="p-4">
              <div className="flex gap-2 mb-3">
                <Input placeholder="Add task..." value={val} disabled={adding} onChange={e => setQuadrantInputs((current) => ({ ...current, [q.id]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitGoal(val, undefined, q.id, () => setQuadrantInputs((current) => ({ ...current, [q.id]: '' }))); }}} className="bg-card" />
                <Button
                  size="sm"
                  disabled={adding || !val.trim()}
                  onClick={() =>
                    submitGoal(val, undefined, q.id, () =>
                      setQuadrantInputs((current) => ({ ...current, [q.id]: '' }))
                    )
                  }
                >
                  {adding ? 'Adding…' : '+'}
                </Button>
              </div>
              <div className="space-y-2 min-h-[60px]">
                {list.length === 0 ? <p className="text-muted-foreground text-sm italic text-center py-2">No tasks yet</p> : list.map(g => renderGoalItem(g))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const render135 = () => (
    <div className="space-y-4">
      {PRIORITIES_135.map(p => {
        const list = frameworkGoals.filter(g => g.priority === p.id);
        const val = priorityInputs[p.id] || '';
        const atLimit = list.length >= p.limit;
        return (
          <div key={p.id} className={`rounded-xl border-2 ${p.color} overflow-hidden shadow-sm`}>
            <div className={`${p.headerColor} text-white px-4 py-3`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{p.icon}</span>
                  <div><h3 className="font-bold text-lg">{p.label}</h3><p className="text-xs opacity-90 max-w-md">{p.subtitle}</p></div>
                </div>
                <span className="bg-card/20 px-3 py-1 rounded-full text-sm font-bold">{list.length}/{p.limit}</span>
              </div>
            </div>
            <div className="p-4">
              {!atLimit && (
                <div className="flex gap-2 mb-3">
                  <Input placeholder="Add task..." value={val} disabled={adding} onChange={e => setPriorityInputs((current) => ({ ...current, [p.id]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitGoal(val, p.id, undefined, () => setPriorityInputs((current) => ({ ...current, [p.id]: '' }))); }}} className="bg-card" />
                  <Button
                    disabled={adding || !val.trim()}
                    onClick={() =>
                      submitGoal(val, p.id, undefined, () =>
                        setPriorityInputs((current) => ({ ...current, [p.id]: '' }))
                      )
                    }
                  >
                    {adding ? 'Adding…' : 'Add'}
                  </Button>
                </div>
              )}
              {atLimit && <p className="text-sm text-green-600 bg-green-50 p-2 rounded mb-3">✓ Section complete!</p>}
              <div className="space-y-2">
                {list.length === 0 ? <p className="text-muted-foreground text-sm italic text-center py-2">No tasks yet</p> : list.map(g => renderGoalItem(g))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderABCDE = () => (
    <div className="space-y-4">
      {PRIORITIES_ABCDE.map(p => {
        const list = frameworkGoals.filter(g => g.priority === p.id);
        const val = priorityInputs[p.id] || '';
        return (
          <div key={p.id} className={`rounded-xl border-2 ${p.color} overflow-hidden shadow-sm`}>
            <div className={`${p.headerColor} text-white px-4 py-3`}>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{p.icon}</span>
                <div><h3 className="font-bold text-lg">{p.label}</h3><p className="text-xs opacity-90 max-w-lg">{p.subtitle}</p></div>
              </div>
            </div>
            <div className="p-4">
              <div className="flex gap-2 mb-3">
                <Input placeholder="Add task..." value={val} disabled={adding} onChange={e => setPriorityInputs((current) => ({ ...current, [p.id]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitGoal(val, p.id, undefined, () => setPriorityInputs((current) => ({ ...current, [p.id]: '' }))); }}} className="bg-card" />
                <Button
                  disabled={adding || !val.trim()}
                  onClick={() =>
                    submitGoal(val, p.id, undefined, () =>
                      setPriorityInputs((current) => ({ ...current, [p.id]: '' }))
                    )
                  }
                >
                  {adding ? 'Adding…' : 'Add'}
                </Button>
              </div>
              <div className="space-y-2">
                {list.length === 0 ? <p className="text-muted-foreground text-sm italic text-center py-2">No tasks yet</p> : list.map(g => renderGoalItem(g))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderIvyLee = () => {
    const limit = 6;
    return (
      <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50 overflow-hidden shadow-sm">
        <div className="bg-indigo-500 text-white px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">📋</span>
              <div>
                <h3 className="font-bold text-lg">Ivy Lee Method</h3>
                <p className="text-xs opacity-90 max-w-md">Write down your 6 most important tasks for tomorrow. Work on them in order — don't start #2 until #1 is done. Move unfinished tasks to tomorrow's list.</p>
              </div>
            </div>
            <span className="bg-card/20 px-3 py-1 rounded-full text-sm font-bold">{frameworkGoals.length}/{limit}</span>
          </div>
        </div>
        <div className="p-4">
          {frameworkGoals.length < limit && (
            <div className="flex gap-2 mb-3">
              <Input placeholder="Add task..." value={simpleInput} disabled={adding} onChange={e => setSimpleInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitGoal(simpleInput, undefined, undefined, () => setSimpleInput('')); }}} className="bg-card" />
              <Button disabled={adding || !simpleInput.trim()} onClick={() => submitGoal(simpleInput, undefined, undefined, () => setSimpleInput(''))}>{adding ? 'Adding…' : 'Add'}</Button>
            </div>
          )}
          {frameworkGoals.length >= limit && <p className="text-sm text-indigo-600 bg-indigo-100 p-2 rounded mb-3">✓ You have your 6 tasks. Now focus on #1!</p>}
          <div className="space-y-2">
            {frameworkGoals.length === 0 ? <p className="text-muted-foreground text-sm italic text-center py-4">Add your 6 most important tasks in priority order</p> : frameworkGoals.map((g, i) => (
              <div key={g.id} className={`flex items-center gap-3 p-3 bg-card rounded-lg border shadow-sm group transition-all hover:shadow-md ${g.status === 'completed' ? 'opacity-60' : ''} ${i === 0 && g.status !== 'completed' ? 'ring-2 ring-indigo-400 ring-offset-2' : ''}`}>
                <span className={`text-xl font-bold w-6 ${g.status === 'completed' ? 'text-green-500' : 'text-indigo-400'}`}>{i + 1}</span>
                <input type="checkbox" checked={g.status === 'completed'} onChange={() => toggleGoal(g.id, g.status)} className="w-5 h-5 rounded cursor-pointer accent-indigo-500" />
                <span className={`flex-1 ${g.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>{g.content}</span>
                {i === 0 && g.status !== 'completed' && <span className="bg-indigo-500 text-white text-xs px-2 py-1 rounded-full font-medium">FOCUS HERE</span>}
                <button onClick={() => deleteGoal(g.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xl transition-opacity">×</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderSimple = () => {
    const limit = 3;
    return (
      <div className="rounded-xl border-2 border-border bg-card overflow-hidden shadow-sm">
        <div className="bg-slate-600 text-white px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">📝</span>
              <div>
                <h3 className="font-bold text-lg">Simple Priorities</h3>
                <p className="text-xs opacity-90 max-w-md">What are the 1-3 most important things you need to accomplish today? Keep it simple and focused.</p>
              </div>
            </div>
            <span className="bg-card/20 px-3 py-1 rounded-full text-sm font-bold">{frameworkGoals.length}/{limit}</span>
          </div>
        </div>
        <div className="p-4">
          {frameworkGoals.length < limit && (
            <div className="flex gap-2 mb-3">
              <Input placeholder="What's your priority?" value={simpleInput} disabled={adding} onChange={e => setSimpleInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitGoal(simpleInput, undefined, undefined, () => setSimpleInput('')); }}} />
              <Button disabled={adding || !simpleInput.trim()} onClick={() => submitGoal(simpleInput, undefined, undefined, () => setSimpleInput(''))}>{adding ? 'Adding…' : 'Add'}</Button>
            </div>
          )}
          <div className="space-y-2">
            {frameworkGoals.length === 0 ? <p className="text-muted-foreground text-sm italic text-center py-4">What are your top priorities today?</p> : frameworkGoals.map((g, i) => renderGoalItem(g, i + 1))}
          </div>
        </div>
      </div>
    );
  };

  const render = () => {
    switch (framework) {
      case 'eisenhower': return renderEisenhower();
      case '1-3-5': return render135();
      case 'abcde': return renderABCDE();
      case 'ivy_lee': return renderIvyLee();
      default: return renderSimple();
    }
  };

  const completed = goals.filter(g => g.status === 'completed').length;

  if (loading) return <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-8 px-4 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" /></main>;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8"><h1 className="text-4xl font-bold text-foreground mb-2">✅ Life Organizer</h1><p className="text-muted-foreground">Plan your day with intention</p></div>

        {librarySourceTitle && (
          <Card className="mb-6 border-emerald-200 bg-emerald-50">
            <CardContent className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-800">
                  From {librarySourceTitle}
                </p>
                <p className="mt-1 font-semibold text-emerald-950">{simpleInput}</p>
                <p className="mt-1 text-sm text-emerald-900/75">
                  Review this suggestion before adding it to today&apos;s priorities.
                </p>
              </div>
              <Button
                onClick={() => {
                  void addGoal(simpleInput).then((saved) => {
                    if (saved) {
                      setSimpleInput('');
                      setLibrarySourceTitle('');
                    }
                  });
                }}
                disabled={adding || !simpleInput.trim() || goals.filter((goal) => goal.framework === 'simple').length >= 3}
              >
                Add to today
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader><CardTitle>Choose Your Planning Framework</CardTitle><CardDescription>{framework === 'eisenhower' ? 'Prioritize by urgency and importance using Dwight Eisenhower\'s decision matrix' : framework === 'ivy_lee' ? 'The 100-year-old productivity method used by executives — simple and effective' : framework === '1-3-5' ? 'A realistic daily planning method: 1 big thing, 3 medium tasks, 5 small tasks' : framework === 'abcde' ? 'Brian Tracy\'s method: rank tasks by consequences and tackle them in order' : 'Keep it simple with 1-3 key priorities'}</CardDescription></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {(['simple', 'eisenhower', 'ivy_lee', '1-3-5', 'abcde'] as Framework[]).map(fw => {
                const n = getCount(fw);
                return <Button key={fw} variant={framework === fw ? 'default' : 'outline'} onClick={() => setFramework(fw)} className={`relative ${framework === fw ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}>{fw === 'simple' ? '📝 Simple' : fw === 'eisenhower' ? '📊 Eisenhower' : fw === 'ivy_lee' ? '📋 Ivy Lee' : fw === '1-3-5' ? '🎯 1-3-5' : '🔤 ABCDE'}{n > 0 && <span className="absolute -top-2 -right-2 bg-primary text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">{n}</span>}</Button>;
              })}
            </div>
          </CardContent>
        </Card>

        {goals.length > 0 && <div className="mb-6"><div className="flex justify-between text-sm mb-2"><span className="font-medium">Today's Progress</span><span>{completed}/{goals.length}</span></div><div className="h-3 bg-secondary rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-green-400 to-green-500 transition-all" style={{ width: `${(completed / goals.length) * 100}%` }} /></div></div>}

        <Card className="mb-6"><CardHeader><CardTitle>📅 Today's Goals ({format(new Date(), 'MMMM dd, yyyy')})</CardTitle></CardHeader><CardContent>{goalError && <p role="alert" className="mb-3 text-sm text-red-600">{goalError}</p>}{render()}</CardContent></Card>

        <Card><CardHeader><CardTitle>🌙 Evening Reflection</CardTitle><CardDescription>Take a moment to reflect on your day</CardDescription></CardHeader><CardContent>{!showReflection ? <Button variant="outline" onClick={() => setShowReflection(true)}>✏️ Add Reflection</Button> : <div className="space-y-4"><Textarea placeholder="What went well today? What did you learn? What would you do differently?" value={reflection} onChange={e => setReflection(e.target.value)} rows={4} /><div className="flex gap-2"><Button onClick={saveReflection}>💾 Save</Button><Button variant="outline" onClick={() => setShowReflection(false)}>Cancel</Button></div></div>}</CardContent></Card>
      </div>
    </main>
  );
}
