'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { VoiceChat } from '@/components/voice-chat';
import { supabase } from '@/lib/supabase/client';
import { useDataContext } from '@/lib/hooks/use-data-context';
import { format, subDays } from 'date-fns';

interface Message { role: 'user' | 'assistant'; content: string; }
interface UserContext {
  recentMoods?: Array<{ emoji: string; note: string; created_at: string }>;
  assessments?: Array<{ type: string; score: number; interpretation: string; created_at: string }>;
  goals?: Array<{ content: string; status: string; reflection?: string; date: string }>;
  habits?: Array<{ name: string; current_streak: number }>;
}

const quickPrompts = ['I feel anxious', 'Help me reframe a negative thought', 'Ground me', 'I need to talk'];

export default function ChatPage() {
  const { context, query, loading: authLoading } = useDataContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [personalized, setPersonalized] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fetchedRef = useRef(false);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    if (!personalized) { setUserContext(null); setStatus('idle'); fetchedRef.current = false; return; }
    if (authLoading || !query || fetchedRef.current) return;
    
    fetchedRef.current = true;
    setStatus('loading');
    
    (async () => {
      try {
        const ago = format(subDays(new Date(), 7), 'yyyy-MM-dd');
        const [m, a, g, h] = await Promise.all([
          supabase.from('moods').select('emoji, note, created_at').eq(query.column, query.value).gte('created_at', ago).order('created_at', { ascending: false }).limit(10),
          supabase.from('assessments').select('type, score, interpretation, created_at').eq(query.column, query.value).order('created_at', { ascending: false }).limit(5),
          supabase.from('goals').select('content, status, reflection, date').eq(query.column, query.value).gte('date', ago).order('date', { ascending: false }),
          supabase.from('habits').select('name, current_streak').eq(query.column, query.value).eq('is_active', true),
        ]);
        setUserContext({ recentMoods: m.data || [], assessments: a.data || [], goals: g.data || [], habits: h.data || [] });
      } catch (e) { console.error(e); }
      setStatus('done');
    })();
  }, [personalized, authLoading, query]);

  const send = async (text: string) => {
    if (!text.trim()) return;
    const newMsg: Message = { role: 'user', content: text };
    const msgs = [...messages, newMsg];
    setMessages(msgs); setInput(''); setLoading(true);
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: msgs, userContext: personalized ? userContext : undefined }) });
      const d = await res.json();
      if (d.response) { setMessages([...msgs, { role: 'assistant', content: d.response }]); setShowSave(true); }
    } catch { setMessages([...msgs, { role: 'assistant', content: 'Sorry, something went wrong.' }]); }
    setLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); send(input); };
  const handleVoiceTranscript = (text: string) => { send(text); };
  const save = async () => { if (context) { await supabase.from('chat_history').insert({ ...context, messages, saved: true } as any); alert('Saved!'); } };

  const hasData = userContext && ((userContext.recentMoods?.length || 0) + (userContext.assessments?.length || 0) + (userContext.goals?.length || 0) + (userContext.habits?.length || 0) > 0);
  const summary = [
    userContext?.recentMoods?.length ? userContext.recentMoods.length + ' moods' : null,
    userContext?.assessments?.length ? userContext.assessments.length + ' assessments' : null,
    userContext?.goals?.length ? userContext.goals.length + ' goals' : null,
    userContext?.habits?.length ? userContext.habits.length + ' habits' : null,
  ].filter(Boolean).join(', ');

  const toggle = () => { setPersonalized(p => !p); fetchedRef.current = false; };

  if (voiceMode) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6 flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 mb-2">🎙️ Voice Therapy</h1>
              <p className="text-slate-600">Have a natural voice conversation with your AI therapist</p>
            </div>
            <Button variant="outline" onClick={() => setVoiceMode(false)}>
              Back to Text
            </Button>
          </div>
          <VoiceChat userContext={personalized ? userContext : undefined} onClose={() => setVoiceMode(false)} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex justify-between items-start">
          <div><h1 className="text-4xl font-bold text-slate-900 mb-2">💬 AI Chat</h1><p className="text-slate-600">Talk through what's on your mind</p></div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setVoiceMode(true)} className="gap-2">
              🎙️ Voice Mode
            </Button>
            {showSave && <Button variant="outline" onClick={save}>Save</Button>}
          </div>
        </div>

        <Card className="mb-4"><CardContent className="pt-4"><div className="flex items-center justify-between"><button type="button" onClick={toggle} className="flex items-center gap-3 text-left"><div className={`relative w-11 h-6 rounded-full transition-colors ${personalized ? 'bg-blue-500' : 'bg-gray-300'}`}><div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${personalized ? 'translate-x-5' : ''}`} /></div><div><p className="font-medium">🔒 Personalized Responses</p><p className="text-sm text-slate-600">Use my data for context</p></div></button></div>{personalized && <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg"><p className="text-sm text-slate-700 mb-2">{status === 'loading' ? '⏳ Loading context...' : hasData ? `📊 Using: ${summary}` : '📭 No data yet'}</p><p className="text-xs text-slate-600">Your moods, assessments, goals, and habits help me provide better support. Turn off anytime for standard responses.</p></div>}</CardContent></Card>

        <Card className="mb-4 h-[550px] flex flex-col"><CardContent className="flex-1 overflow-y-auto pt-6">{messages.length === 0 ? (<div className="text-center py-12"><div><h2 className="text-2xl font-semibold mb-2">How can I help?</h2><p className="text-slate-600 mb-6">I'm here to listen.</p><div className="grid grid-cols-2 gap-3 max-w-md mx-auto">{quickPrompts.map(p => <Button key={p} variant="outline" onClick={() => send(p)}>{p}</Button>)}</div></div></div>) : (<div className="space-y-4">{messages.map((msg, idx) => <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[80%] p-4 rounded-lg ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-white text-slate-900 border border-slate-200'}`}><p className="text-sm whitespace-pre-wrap">{msg.content}</p></div></div>)}{loading && <div className="flex justify-start"><div className="max-w-[80%] p-4 rounded-lg bg-white border border-slate-200"><p className="text-sm text-slate-600">Thinking...</p></div></div>}<div ref={messagesEndRef} /></div>)}</CardContent></Card>

        <Card><CardContent className="pt-6"><form onSubmit={handleSubmit} className="flex gap-2"><Textarea value={input} onChange={e => setInput(e.target.value)} placeholder="What's on your mind?" rows={2} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e as any); } }} /><Button type="submit" disabled={!input.trim() || loading}>Send</Button></form></CardContent></Card>

        <p className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-center"><strong>⚠️ Not a replacement for therapy. Crisis? Call <a href="tel:988" className="underline font-bold">988</a></strong></p>
      </div>
    </main>
  );
}
