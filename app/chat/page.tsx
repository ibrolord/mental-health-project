'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  LockKeyhole,
  Mic,
  Save,
  Send,
  Sparkles,
} from 'lucide-react';
import { formatISO, subDays } from 'date-fns';
import { VoiceChat } from '@/components/voice-chat';
import { useAiConsent } from '@/components/ai-consent-provider';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { hasAiDataSharingConsent } from '@/lib/ai-consent';
import {
  AI_CONTEXT_OPTIONS,
  createEmptyAiContextSelections,
  createFullAiContextSelections,
  hasSelectedAiContext,
  selectUserContext,
  summarizeUserContext,
  type AiContextSelectionKey,
  type AiContextSelections,
  type UserContext,
} from '@/lib/ai/context';
import {
  isCompleteConversation,
  isCurrentConversationOperation,
} from '@/lib/ai/conversation';
import {
  hasFullContextPreference,
  saveFullContextPreference,
} from '@/lib/ai/full-context-preference';
import { apiRequest } from '@/lib/api/client';
import { useDataContext } from '@/lib/hooks/use-data-context';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const CONTEXT_ORDER: AiContextSelectionKey[] = [
  'moodPattern',
  'moodNotes',
  'assessments',
  'goals',
  'habits',
  'journalEntries',
  'libraryNotes',
  'lifePlan',
  'focusSessions',
];

const QUICK_PROMPTS = [
  'I feel anxious',
  'Help me reframe a negative thought',
  'I need to make one small plan',
  'I need to talk',
];

function ContextToggle({
  contextKey,
  checked,
  onChange,
}: {
  contextKey: AiContextSelectionKey;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  const option = AI_CONTEXT_OPTIONS[contextKey];
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors',
        checked ? 'border-primary/35 bg-secondary' : 'border-border bg-card'
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border',
          checked
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border bg-background'
        )}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span>
        <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          {option.label}
          {option.sensitive && (
            <LockKeyhole
              className="h-3 w-3 text-muted-foreground"
              aria-label="Sensitive content"
            />
          )}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
          {option.description}
        </span>
      </span>
    </label>
  );
}

export default function ChatPage() {
  const { context, query, authLoading } = useDataContext();
  const requestAiConsent = useAiConsent();
  const queryKey = query ? `${query.column}:${query.value}` : null;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [error, setError] = useState('');
  const [selections, setSelections] = useState<AiContextSelections>(
    createEmptyAiContextSelections
  );
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [contextOwnerKey, setContextOwnerKey] = useState<string | null>(null);
  const [contextStatus, setContextStatus] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');
  const [contextExpanded, setContextExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const savingRef = useRef(false);
  const loadingRef = useRef(false);
  const activeSaveRef = useRef<number | null>(null);
  const saveSequenceRef = useRef(0);
  const conversationRevisionRef = useRef(0);
  const chatAbortRef = useRef<AbortController | null>(null);
  const previousQueryKeyRef = useRef(queryKey);
  const currentQueryKeyRef = useRef(queryKey);
  currentQueryKeyRef.current = queryKey;

  const conversationMatchesIdentity =
    previousQueryKeyRef.current === queryKey;
  const visibleMessages = conversationMatchesIdentity ? messages : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (previousQueryKeyRef.current === queryKey) return;
    previousQueryKeyRef.current = queryKey;
    conversationRevisionRef.current += 1;
    chatAbortRef.current?.abort();
    chatAbortRef.current = null;
    loadingRef.current = false;
    activeSaveRef.current = null;
    savingRef.current = false;
    setMessages([]);
    setInput('');
    setLoading(false);
    setVoiceMode(false);
    setShowSave(false);
    setSaving(false);
    setSaveStatus('');
    setError('');
    setSelections(createEmptyAiContextSelections());
    setUserContext(null);
    setContextOwnerKey(null);
    setContextStatus('idle');
    setContextExpanded(false);
  }, [queryKey]);

  useEffect(() => {
    if (authLoading || !queryKey) return;
    if (
      hasAiDataSharingConsent() &&
      hasFullContextPreference(queryKey)
    ) {
      setSelections(createFullAiContextSelections());
    }
  }, [authLoading, queryKey]);

  useEffect(() => {
    if (authLoading || !query || !queryKey) {
      setUserContext(null);
      setContextOwnerKey(null);
      setContextStatus('idle');
      return;
    }
    if (!hasSelectedAiContext(selections)) {
      setUserContext(null);
      setContextOwnerKey(null);
      setContextStatus('idle');
      return;
    }

    let active = true;
    setUserContext(null);
    setContextOwnerKey(null);
    setContextStatus('loading');
    setError('');

    const loadContext = async () => {
      try {
        const loaded: UserContext = {};
        const since = formatISO(subDays(new Date(), 7));
        const requests: Promise<void>[] = [];

        if (selections.moodPattern) {
          requests.push(
            (async () => {
              const result = await supabase
                .from('moods')
                .select('emoji, created_at')
                .eq(query.column, query.value)
                .gte('created_at', since)
                .order('created_at', { ascending: false })
                .limit(14);
              if (result.error) throw result.error;
              loaded.recentMoods = result.data ?? [];
            })()
          );
        }

        if (selections.moodNotes) {
          requests.push(
            (async () => {
              const result = await supabase
                .from('moods')
                .select('emoji, note, created_at')
                .eq(query.column, query.value)
                .gte('created_at', since)
                .not('note', 'is', null)
                .neq('note', '')
                .order('created_at', { ascending: false })
                .limit(7);
              if (result.error) throw result.error;
              loaded.moodNotes = (result.data ?? [])
                .filter(
                  (row): row is { emoji: string; note: string; created_at: string } =>
                    typeof row.note === 'string' && row.note.trim().length > 0
                )
                .map((row) => ({ ...row, note: row.note.trim().slice(0, 1_000) }));
            })()
          );
        }

        if (selections.assessments) {
          requests.push(
            (async () => {
              const result = await supabase
                .from('assessments')
                .select('type, score, max_score, created_at')
                .eq(query.column, query.value)
                .gte('created_at', since)
                .order('created_at', { ascending: false })
                .limit(5);
              if (result.error) throw result.error;
              loaded.assessments = result.data ?? [];
            })()
          );
        }

        if (selections.goals) {
          requests.push(
            (async () => {
              const result = await supabase
                .from('goals')
                .select('content, status, reflection, date')
                .eq(query.column, query.value)
                .gte('date', since.slice(0, 10))
                .order('date', { ascending: false })
                .limit(10);
              if (result.error) throw result.error;
              loaded.goals = (result.data ?? [])
                .filter((row) => row.content.trim().length > 0)
                .map((row) => ({
                  ...row,
                  content: row.content.trim().slice(0, 700),
                  reflection: row.reflection?.slice(0, 700) ?? undefined,
                }));
            })()
          );
        }

        if (selections.habits) {
          requests.push(
            (async () => {
              const result = await supabase
                .from('habits')
                .select('name, streak_count')
                .eq(query.column, query.value)
                .eq('is_active', true)
                .limit(20);
              if (result.error) throw result.error;
              loaded.habits = result.data ?? [];
            })()
          );
        }

        if (selections.journalEntries && query.column === 'user_id') {
          requests.push(
            (async () => {
              const result = await supabase
                .from('journal_entries')
                .select('title, content, entry_kind, created_at')
                .eq('user_id', query.value)
                .order('created_at', { ascending: false })
                .limit(3);
              if (result.error) throw result.error;
              loaded.journalEntries = (result.data ?? []).map((row) => ({
                ...row,
                title: row.title.slice(0, 200),
                content: row.content.slice(0, 2_000),
              }));
            })()
          );
        }

        if (selections.libraryNotes && query.column === 'user_id') {
          requests.push(
            (async () => {
              const result = await supabase
                .from('user_library_items')
                .select('content_id, media_type, custom_notes, updated_at')
                .eq('user_id', query.value)
                .neq('custom_notes', '')
                .order('updated_at', { ascending: false })
                .limit(5);
              if (result.error) throw result.error;

              const { UNIFIED_LIBRARY } = await import('@/lib/library/content');
              const titles = new Map(
                UNIFIED_LIBRARY.map((item) => [item.id, item.title])
              );
              loaded.libraryNotes = (result.data ?? [])
                .filter(
                  (row) =>
                    (row.media_type === 'book' ||
                      row.media_type === 'video' ||
                      row.media_type === 'story') &&
                    row.custom_notes.trim().length > 0
                )
                .map((row) => ({
                  content_id: row.content_id,
                  title: titles.get(row.content_id) ?? 'Saved library item',
                  media_type: row.media_type as 'book' | 'video' | 'story',
                  custom_notes: row.custom_notes.trim().slice(0, 1_200),
                  updated_at: row.updated_at,
                }));
            })()
          );
        }

        if (selections.lifePlan && query.column === 'user_id') {
          requests.push(
            (async () => {
              const result = await supabase
                .from('life_plan_items')
                .select(
                  'item_type, horizon, title, reflection, next_step, target_date, status'
                )
                .eq('user_id', query.value)
                .order('updated_at', { ascending: false })
                .limit(12);
              if (result.error) throw result.error;
              loaded.lifePlan = (result.data ?? []).map((row) => ({
                ...row,
                title: row.title.trim().slice(0, 200),
                reflection: row.reflection.trim().slice(0, 1_200),
                next_step: row.next_step.trim().slice(0, 500),
                target_date: row.target_date ?? undefined,
              }));
            })()
          );
        }

        if (selections.focusSessions && query.column === 'user_id') {
          requests.push(
            (async () => {
              const result = await supabase
                .from('focus_sessions')
                .select(
                  'task_label, focus_minutes, planned_cycles, completed_cycles, status, completed_at'
                )
                .eq('user_id', query.value)
                .order('updated_at', { ascending: false })
                .limit(10);
              if (result.error) throw result.error;
              loaded.focusSessions = (result.data ?? []).map((row) => ({
                ...row,
                task_label: row.task_label.trim().slice(0, 240),
                completed_at: row.completed_at ?? undefined,
              }));
            })()
          );
        }

        await Promise.all(requests);
        if (!active) return;
        setUserContext(loaded);
        setContextOwnerKey(queryKey);
        setContextStatus('ready');
      } catch (loadError) {
        if (!active) return;
        console.error('Failed to load selected AI context:', loadError);
        setUserContext(null);
        setContextOwnerKey(null);
        setContextStatus('error');
        setError(
          'The selected private context could not be loaded, so none of it will be sent.'
        );
      }
    };

    void loadContext();
    return () => {
      active = false;
    };
  }, [authLoading, query, queryKey, selections]);

  const effectiveContext =
    !authLoading && contextOwnerKey === queryKey
      ? selectUserContext(userContext, selections)
      : undefined;
  const contextSummary = summarizeUserContext(effectiveContext);
  const selectedContextCount = CONTEXT_ORDER.filter(
    (key) => selections[key]
  ).length;
  const collapsedContextSummary =
    contextStatus === 'loading'
      ? `Loading ${selectedContextCount} selected ${
          selectedContextCount === 1 ? 'category' : 'categories'
        }...`
      : contextStatus === 'error'
        ? 'Selected context could not be loaded'
        : selectedContextCount > 0
          ? `${selectedContextCount} ${
              selectedContextCount === 1 ? 'category' : 'categories'
            } selected`
          : 'Context is off';

  const fullContextEnabled = CONTEXT_ORDER.every((key) => selections[key]);

  const toggleFullContext = async (next: boolean) => {
    if (next && !(await requestAiConsent())) return;
    setSelections(
      next
        ? createFullAiContextSelections()
        : createEmptyAiContextSelections()
    );
    saveFullContextPreference(queryKey, next);
  };

  const toggleContext = async (
    key: AiContextSelectionKey,
    next: boolean
  ) => {
    if (next && !(await requestAiConsent())) return;
    setSelections((current) => ({ ...current, [key]: next }));
    saveFullContextPreference(queryKey, false);
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (
      !trimmed ||
      authLoading ||
      !conversationMatchesIdentity ||
      loadingRef.current ||
      savingRef.current ||
      contextStatus === 'loading'
    ) {
      return;
    }
    if (!(await requestAiConsent())) return;

    const nextUserMessage: Message = { role: 'user', content: trimmed };
    const nextMessages = [...messages, nextUserMessage];
    const restoreSaveAfterFailure =
      showSave && isCompleteConversation(messages);
    const operation = {
      ownerKey: currentQueryKeyRef.current,
      revision: conversationRevisionRef.current + 1,
    };
    conversationRevisionRef.current = operation.revision;
    const controller = new AbortController();
    chatAbortRef.current = controller;
    loadingRef.current = true;
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    setShowSave(false);
    setError('');
    setSaveStatus('');

    try {
      const result = await apiRequest(
        '/api/chat',
        {
          messages: nextMessages,
          userContext: effectiveContext,
        },
        { signal: controller.signal }
      );
      if (
        !isCurrentConversationOperation(
          operation,
          currentQueryKeyRef.current,
          conversationRevisionRef.current
        )
      ) {
        return;
      }
      if (typeof result.response !== 'string' || !result.response.trim()) {
        throw new Error('The AI service returned an empty response.');
      }
      conversationRevisionRef.current += 1;
      setMessages([
        ...nextMessages,
        { role: 'assistant', content: result.response },
      ]);
      setShowSave(true);
    } catch (sendError) {
      if (
        !isCurrentConversationOperation(
          operation,
          currentQueryKeyRef.current,
          conversationRevisionRef.current
        )
      ) {
        return;
      }
      console.error('Chat request failed:', sendError);
      conversationRevisionRef.current += 1;
      setMessages(messages);
      setInput(trimmed);
      setShowSave(restoreSaveAfterFailure);
      setError(
        'AI chat is temporarily unavailable. Your message was not saved. Try again in a moment.'
      );
    } finally {
      if (chatAbortRef.current === controller) {
        chatAbortRef.current = null;
        loadingRef.current = false;
        setLoading(false);
      }
    }
  };

  const save = async () => {
    if (
      !context?.user_id ||
      loadingRef.current ||
      savingRef.current ||
      !conversationMatchesIdentity ||
      !isCompleteConversation(visibleMessages)
    ) {
      return;
    }

    const saveId = ++saveSequenceRef.current;
    const operation = {
      ownerKey: currentQueryKeyRef.current,
      revision: conversationRevisionRef.current,
    };
    const snapshot = [...visibleMessages];
    activeSaveRef.current = saveId;
    savingRef.current = true;
    setSaving(true);
    setSaveStatus('');
    try {
      const result = await supabase
        .from('chat_history')
        .insert({ ...context, messages: snapshot, saved: true });
      if (
        activeSaveRef.current !== saveId ||
        !isCurrentConversationOperation(
          operation,
          currentQueryKeyRef.current,
          conversationRevisionRef.current
        )
      ) {
        return;
      }
      if (result.error) {
        setSaveStatus('This conversation could not be saved.');
        return;
      }
      setSaveStatus('Conversation saved privately.');
      setShowSave(false);
    } catch (saveError) {
      if (
        activeSaveRef.current !== saveId ||
        !isCurrentConversationOperation(
          operation,
          currentQueryKeyRef.current,
          conversationRevisionRef.current
        )
      ) {
        return;
      }
      console.error('Failed to save private conversation:', saveError);
      setSaveStatus('This conversation could not be saved.');
    } finally {
      if (activeSaveRef.current === saveId) {
        activeSaveRef.current = null;
        savingRef.current = false;
        setSaving(false);
      }
    }
  };

  const leaveVoiceMode = () => {
    setVoiceMode(false);
    setError('');
  };

  if (voiceMode && conversationMatchesIdentity) {
    return (
      <main className="px-4 py-8 md:px-8 md:py-12">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Voice support
              </p>
              <h1 className="mt-2 font-display text-4xl font-medium text-foreground">
                Talk it through.
              </h1>
            </div>
            <Button variant="outline" onClick={leaveVoiceMode}>
              Back to text
            </Button>
          </div>
          <VoiceChat
            userContext={effectiveContext}
            onClose={leaveVoiceMode}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 py-8 md:px-8 md:py-12">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Optional AI
            </div>
            <h1 className="font-display text-4xl font-medium leading-[1.05] tracking-[-0.02em] text-foreground md:text-5xl">
              Chat with the full picture.
            </h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              Turn on MHtoolkit context when you want a response grounded in your
              recent activity.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setVoiceMode(true)}
              className="gap-2"
              disabled={
                authLoading ||
                saving ||
                !conversationMatchesIdentity ||
                contextStatus === 'loading'
              }
            >
              <Mic className="h-4 w-4" aria-hidden="true" />
              Voice
            </Button>
            {conversationMatchesIdentity && showSave && (
              <Button
                variant="outline"
                onClick={() => void save()}
                className="gap-2"
                disabled={
                  loading ||
                  saving ||
                  !isCompleteConversation(visibleMessages)
                }
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                {saving ? 'Saving...' : 'Save privately'}
              </Button>
            )}
          </div>
        </header>

        <section className="app-panel mt-6 overflow-hidden">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <LockKeyhole
                className="mt-1 h-4 w-4 shrink-0 text-foreground"
                aria-hidden="true"
              />
              <div>
                <h2 className="font-display text-xl font-medium text-foreground">
                  Use my MHtoolkit context
                </h2>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={fullContextEnabled}
              aria-label={`Use my MHtoolkit context: ${
                fullContextEnabled ? 'On' : 'Off'
              }`}
              onClick={() => void toggleFullContext(!fullContextEnabled)}
              className={cn(
                'inline-flex min-h-10 shrink-0 self-start items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:self-auto',
                fullContextEnabled
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-foreground'
              )}
            >
              <span
                className={cn(
                  'h-2.5 w-2.5 rounded-full',
                  fullContextEnabled ? 'bg-primary-foreground' : 'bg-muted-foreground'
                )}
                aria-hidden="true"
              />
              {fullContextEnabled ? 'On' : 'Off'}
            </button>
          </div>

          <div className="border-t border-border bg-secondary/45 px-5 py-3">
            <p role="status" className="text-xs text-muted-foreground">
              {contextStatus === 'loading'
                ? 'Loading your context...'
                : contextStatus === 'error'
                  ? 'Context could not be loaded and will not be sent.'
                  : contextSummary.length > 0
                    ? `Ready: ${contextSummary.join(', ')}.`
                    : hasSelectedAiContext(selections)
                      ? 'No saved context found yet.'
                      : 'Your message will be sent without saved app context.'}
            </p>
          </div>

          <button
            type="button"
            aria-expanded={contextExpanded}
            aria-controls="chat-context-options"
            onClick={() => setContextExpanded((expanded) => !expanded)}
            className="flex w-full items-center justify-between gap-4 border-t border-border px-5 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">
                Customize context
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {collapsedContextSummary}
              </span>
            </span>
            <ChevronDown
              className={cn(
                'h-5 w-5 shrink-0 text-muted-foreground transition-transform',
                contextExpanded && 'rotate-180'
              )}
              aria-hidden="true"
            />
          </button>

          {contextExpanded && (
            <div
              id="chat-context-options"
              className="border-t border-border px-5 pb-5 pt-4"
            >
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {CONTEXT_ORDER.map((key) => (
                  <ContextToggle
                    key={key}
                    contextKey={key}
                    checked={selections[key]}
                    onChange={(next) => void toggleContext(key, next)}
                  />
                ))}
              </div>
            </div>
          )}
        </section>

        <Link
          href="/ground"
          className="mt-4 flex items-center justify-between gap-3 rounded-[var(--radius)] border border-primary/25 bg-primary px-5 py-4 text-primary-foreground transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span>
            <span className="block text-sm font-semibold">Need grounding right now?</span>
            <span className="mt-0.5 block text-xs text-primary-foreground/70">
              Open a guided grounding exercise.
            </span>
          </span>
          <span aria-hidden="true">→</span>
        </Link>

        <section className="app-panel mt-4 flex min-h-[32rem] flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 md:p-6">
            {visibleMessages.length === 0 ? (
              <div className="grid min-h-[25rem] place-items-center py-8 text-center">
                <div>
                  <h2 className="font-display text-2xl font-medium text-foreground">
                    What would help to talk through?
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This is supportive reflection, not therapy or medical advice.
                  </p>
                  <div className="mx-auto mt-6 grid max-w-lg gap-2 sm:grid-cols-2">
                    {QUICK_PROMPTS.map((prompt) => (
                      <Button
                        key={prompt}
                        variant="outline"
                        onClick={() => void send(prompt)}
                        disabled={
                          authLoading ||
                          loading ||
                          saving ||
                          !conversationMatchesIdentity ||
                          contextStatus === 'loading'
                        }
                        className="h-auto min-h-11 whitespace-normal py-2.5"
                      >
                        {prompt}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {visibleMessages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={cn(
                      'flex',
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed md:max-w-[78%]',
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'border border-border bg-secondary text-foreground'
                      )}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl border border-border bg-secondary px-4 py-3 text-sm text-muted-foreground">
                      Thinking...
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send(input);
            }}
            className="border-t border-border bg-card p-4"
          >
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="What is on your mind?"
                rows={2}
                maxLength={4_000}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void send(input);
                  }
                }}
              />
              <Button
                type="submit"
                disabled={
                  !input.trim() ||
                  authLoading ||
                  loading ||
                  saving ||
                  !conversationMatchesIdentity ||
                  contextStatus === 'loading'
                }
                className="h-11 gap-1.5"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                Send
              </Button>
            </div>
          </form>
        </section>

        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        )}
        {saveStatus && (
          <p role="status" className="mt-3 text-sm text-muted-foreground">
            {saveStatus}
          </p>
        )}

        <p className="mt-4 rounded-[var(--radius)] border border-border bg-secondary/60 p-4 text-center text-sm text-foreground">
          If you may hurt yourself or someone else, contact your local emergency
          service or nearest emergency department.{' '}
          <Link href="/resources#crisis" className="font-semibold underline">
            Find country-specific crisis support
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
