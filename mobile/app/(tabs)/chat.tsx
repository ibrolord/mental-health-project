import { useCallback, useEffect, useRef, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatISO, subDays } from 'date-fns';
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
} from '@/lib/ai-context';
import {
  ensureAiDataSharingConsent,
  hasAiDataSharingConsent,
} from '@/lib/ai-consent';
import { confirmAppleHealthAiShare } from '@/lib/apple-health-ai-consent';
import {
  createAppleHealthAiSummary,
  createAppleHealthOverview,
  type AppleHealthAiSummary,
} from '@/lib/apple-health-core';
import { appleHealthPreference } from '@/lib/apple-health-preference';
import { loadAppleHealthSnapshot } from '@/lib/apple-health';
import { apiRequest } from '@/lib/api';
import { Colors } from '@/lib/constants';
import {
  hasFullContextPreference,
  saveFullContextPreference,
} from '@/lib/full-context-preference';
import {
  readContextSelections,
  storeContextSelections,
} from '@/lib/chat-context-preference';
import { useDataContext } from '@/lib/hooks/use-data-context';
import { UNIFIED_LIBRARY } from '@/lib/library/content';
import { RequestTimeoutError } from '@/lib/request';
import { supabase } from '@/lib/supabase';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  responseId?: string;
  reportToken?: string;
}

interface ChatApiResponse {
  response?: unknown;
  responseId?: string;
  reportToken?: string;
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
  'I need one small plan',
  'I need to talk',
];
const APPLE_HEALTH_AI_ENABLED =
  process.env.EXPO_PUBLIC_HEALTH_AI_ENABLED === 'true';

export default function ChatScreen() {
  const router = useRouter();
  const { health, healthRequest } = useLocalSearchParams<{
    health?: string | string[];
    healthRequest?: string | string[];
  }>();
  const { context, query, authLoading } = useDataContext();
  const ownerKey = query ? `${query.column}:${query.value}` : null;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Thinking...');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>(
    'idle'
  );
  const [reportedResponseIds, setReportedResponseIds] = useState<string[]>([]);
  const [selections, setSelections] = useState<AiContextSelections>(
    createEmptyAiContextSelections
  );
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [contextStatus, setContextStatus] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');
  const [contextExpanded, setContextExpanded] = useState(false);
  const [disclosureOpen, setDisclosureOpen] = useState(false);
  const [contextError, setContextError] = useState('');
  const [healthSummaryEnabled, setHealthSummaryEnabled] = useState(false);
  const [healthSummary, setHealthSummary] = useState<AppleHealthAiSummary | null>(
    null
  );
  const [healthStatus, setHealthStatus] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');
  const [healthError, setHealthError] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const requestRef = useRef(false);
  const saveRef = useRef(false);
  const healthEntryHandledRef = useRef<string | null>(null);
  const ownerRef = useRef(ownerKey);
  ownerRef.current = ownerKey;
  const healthEntryRequested =
    health === '1' || (Array.isArray(health) && health.includes('1'));

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [loading, messages]);

  useEffect(() => {
    if (!loading) {
      setLoadingMessage('Thinking...');
      return;
    }
    const first = setTimeout(
      () => setLoadingMessage('Still working...'),
      10_000
    );
    const second = setTimeout(
      () => setLoadingMessage('Taking longer than usual...'),
      25_000
    );
    return () => {
      clearTimeout(first);
      clearTimeout(second);
    };
  }, [loading]);

  useEffect(() => {
    setMessages([]);
    setInput('');
    setLoading(false);
    setSaveState('idle');
    setReportedResponseIds([]);
    setSelections(createEmptyAiContextSelections());
    setUserContext(null);
    setContextStatus('idle');
    setContextExpanded(false);
    setContextError('');
    setHealthSummaryEnabled(false);
    setHealthSummary(null);
    setHealthStatus('idle');
    setHealthError('');
    requestRef.current = false;
    saveRef.current = false;

    if (!ownerKey || authLoading) return;
    let active = true;
    void Promise.all([
      readContextSelections(ownerKey),
      hasFullContextPreference(ownerKey),
      hasAiDataSharingConsent(ownerKey),
    ]).then(([saved, full, consented]) => {
      if (!active || ownerRef.current !== ownerKey || !consented) return;
      setSelections(full ? createFullAiContextSelections() : saved);
    });
    return () => {
      active = false;
    };
  }, [authLoading, ownerKey]);

  useEffect(() => {
    if (authLoading || !query || !ownerKey || !hasSelectedAiContext(selections)) {
      setUserContext(null);
      setContextStatus('idle');
      setContextError('');
      return;
    }

    let active = true;
    const expectedOwner = ownerKey;
    setUserContext(null);
    setContextStatus('loading');
    setContextError('');
    const since = formatISO(subDays(new Date(), 7));

    const load = async () => {
      try {
        const loaded: UserContext = {};
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
                  (
                    row
                  ): row is {
                    emoji: string;
                    note: string;
                    created_at: string;
                  } => typeof row.note === 'string' && row.note.trim().length > 0
                )
                .map((row) => ({
                  ...row,
                  note: row.note.trim().slice(0, 1_000),
                }));
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
                .filter(({ content: value }) => value.trim().length > 0)
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
        if (selections.journalEntries) {
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
                title: row.title.slice(0, 300),
                content: row.content.slice(0, 4_000),
              }));
            })()
          );
        }
        if (selections.libraryNotes) {
          requests.push(
            (async () => {
              const result = await supabase
                .from('user_library_items')
                .select(
                  'content_id, media_type, custom_notes, updated_at'
                )
                .eq('user_id', query.value)
                .neq('custom_notes', '')
                .order('updated_at', { ascending: false })
                .limit(5);
              if (result.error) throw result.error;
              loaded.libraryNotes = (result.data ?? []).map((row) => {
                const item = UNIFIED_LIBRARY_BY_ID[row.content_id];
                return {
                  content_id: row.content_id,
                  title: item?.title ?? 'Library item',
                  media_type: row.media_type as 'book' | 'video' | 'story',
                  custom_notes: row.custom_notes.slice(0, 2_000),
                  updated_at: row.updated_at,
                };
              });
            })()
          );
        }
        if (selections.lifePlan) {
          requests.push(
            (async () => {
              const result = await supabase
                .from('life_plan_items')
                .select(
                  'item_type, horizon, title, reflection, next_step, target_date, status'
                )
                .eq('user_id', query.value)
                .neq('status', 'archived')
                .order('updated_at', { ascending: false })
                .limit(10);
              if (result.error) throw result.error;
              loaded.lifePlan = (result.data ?? []).map((row) => ({
                ...row,
                title: row.title.slice(0, 500),
                reflection: row.reflection.slice(0, 1_000),
                next_step: row.next_step.slice(0, 700),
                target_date: row.target_date ?? undefined,
              }));
            })()
          );
        }
        if (selections.focusSessions) {
          requests.push(
            (async () => {
              const result = await supabase
                .from('focus_sessions')
                .select(
                  'task_label, focus_minutes, planned_cycles, completed_cycles, status, completed_at'
                )
                .eq('user_id', query.value)
                .order('created_at', { ascending: false })
                .limit(10);
              if (result.error) throw result.error;
              loaded.focusSessions = (result.data ?? []).map((row) => ({
                ...row,
                task_label: row.task_label.slice(0, 500),
                completed_at: row.completed_at ?? undefined,
              }));
            })()
          );
        }

        await Promise.all(requests);
        if (!active || ownerRef.current !== expectedOwner) return;
        setUserContext(loaded);
        setContextStatus('ready');
      } catch {
        if (!active || ownerRef.current !== expectedOwner) return;
        setUserContext(null);
        setContextStatus('error');
        setContextError('Selected context could not be loaded.');
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [authLoading, ownerKey, query, selections]);

  useEffect(() => {
    if (
      Platform.OS !== 'ios' ||
      !APPLE_HEALTH_AI_ENABLED ||
      !healthSummaryEnabled ||
      !ownerKey ||
      (selections.moodPattern && contextStatus !== 'ready')
    ) {
      setHealthSummary(null);
      const moodContextFailed =
        healthSummaryEnabled &&
        selections.moodPattern &&
        contextStatus === 'error';
      setHealthStatus(
        !healthSummaryEnabled
          ? 'idle'
          : moodContextFailed
            ? 'error'
            : 'loading'
      );
      setHealthError(
        moodContextFailed
          ? 'Mood context is unavailable. Turn off Mood pattern or try again.'
          : ''
      );
      return;
    }

    let active = true;
    const expectedOwner = ownerKey;
    setHealthSummary(null);
    setHealthStatus('loading');
    setHealthError('');

    void Promise.all([
      appleHealthPreference.read(expectedOwner),
      loadAppleHealthSnapshot(),
    ])
      .then(([enabled, snapshot]) => {
        if (!active || ownerRef.current !== expectedOwner) return;
        if (!enabled) {
          setHealthStatus('error');
          setHealthError('Set up Apple Health in Settings first.');
          return;
        }
        const moods = selections.moodPattern
          ? (userContext?.recentMoods ?? [])
          : [];
        const summary = createAppleHealthAiSummary(
          createAppleHealthOverview(snapshot, moods)
        );
        if (summary.thirtyDay.coverageDays === 0) {
          setHealthStatus('error');
          setHealthError('No permitted Apple Health data was found.');
          return;
        }
        setHealthSummary(summary);
        setHealthStatus('ready');
      })
      .catch(() => {
        if (!active || ownerRef.current !== expectedOwner) return;
        setHealthStatus('error');
        setHealthError('Apple Health summary could not be loaded.');
      });

    return () => {
      active = false;
    };
  }, [
    contextStatus,
    healthSummaryEnabled,
    ownerKey,
    selections.moodPattern,
    userContext?.recentMoods,
  ]);

  const setContextSelection = async (
    key: AiContextSelectionKey,
    enabled: boolean
  ) => {
    if (!ownerKey) return;
    if (enabled && !(await ensureAiDataSharingConsent(ownerKey))) return;
    const next = { ...selections, [key]: enabled };
    setSelections(next);
    await Promise.all([
      storeContextSelections(ownerKey, next),
      saveFullContextPreference(ownerKey, false),
    ]);
  };

  const setFullContext = async (enabled: boolean) => {
    if (!ownerKey) return;
    if (enabled && !(await ensureAiDataSharingConsent(ownerKey))) return;
    const next = enabled
      ? createFullAiContextSelections()
      : createEmptyAiContextSelections();
    setSelections(next);
    await Promise.all([
      storeContextSelections(ownerKey, next),
      saveFullContextPreference(ownerKey, enabled),
    ]);
  };

  const setAppleHealthContext = useCallback(async (enabled: boolean) => {
    if (
      !ownerKey ||
      Platform.OS !== 'ios' ||
      !APPLE_HEALTH_AI_ENABLED
    ) return;
    if (!enabled) {
      setHealthSummaryEnabled(false);
      setHealthSummary(null);
      setHealthStatus('idle');
      setHealthError('');
      return;
    }
    try {
      if (!(await ensureAiDataSharingConsent(ownerKey))) return;
      if (!(await appleHealthPreference.read(ownerKey))) {
        Alert.alert(
          'Set up Apple Health first',
          'Enable read-only Apple Health context in Settings before using a summary in chat.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => router.push('/settings') },
          ]
        );
        return;
      }
      setHealthSummaryEnabled(true);
    } catch {
      Alert.alert(
        'Apple Health unavailable',
        'Apple Health setup could not be checked. Please try again.'
      );
    }
  }, [ownerKey, router]);

  useEffect(() => {
    if (
      !healthEntryRequested ||
      !ownerKey ||
      Platform.OS !== 'ios' ||
      !APPLE_HEALTH_AI_ENABLED
    ) return;

    const requestToken = Array.isArray(healthRequest)
      ? healthRequest[0]
      : healthRequest;
    const requestKey = `${ownerKey}:apple-health:${requestToken ?? 'direct'}`;
    if (healthEntryHandledRef.current === requestKey) return;
    healthEntryHandledRef.current = requestKey;
    setContextExpanded(true);
    void setAppleHealthContext(true);
  }, [healthEntryRequested, healthRequest, ownerKey, setAppleHealthContext]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (
      !trimmed ||
      loading ||
      requestRef.current ||
      saveRef.current ||
      (hasSelectedAiContext(selections) && contextStatus !== 'ready') ||
      (healthSummaryEnabled && healthStatus !== 'ready')
    ) {
      return;
    }
    requestRef.current = true;
    try {
      if (!ownerKey || !(await ensureAiDataSharingConsent(ownerKey))) {
        requestRef.current = false;
        return;
      }
      if (
        healthSummaryEnabled &&
        (!healthSummary || !(await confirmAppleHealthAiShare(healthSummary)))
      ) {
        requestRef.current = false;
        return;
      }
    } catch {
      requestRef.current = false;
      Alert.alert(
        'Could not confirm sharing',
        'Nothing was sent. Please try again.'
      );
      return;
    }
    const newMessage: Message = { role: 'user', content: trimmed };
    const nextMessages = [...messages, newMessage];
    setMessages(nextMessages);
    setInput('');
    setSaveState('idle');
    setLoading(true);
    try {
      const selectedContext = selectUserContext(userContext, selections);
      const requestContext =
        healthSummaryEnabled && healthSummary
          ? { ...selectedContext, appleHealthSummary: healthSummary }
          : selectedContext;
      const response = await apiRequest<ChatApiResponse>('/api/chat', {
        messages: nextMessages.map(({ role, content: value }) => ({
          role,
          content: value,
        })),
        userContext: requestContext,
      });
      if (typeof response.response !== 'string' || !response.response.trim()) {
        throw new Error('AI response was empty');
      }
      setMessages([
        ...nextMessages,
        {
          role: 'assistant',
          content: response.response.trim(),
          responseId: response.responseId,
          reportToken: response.reportToken,
        },
      ]);
    } catch (reason) {
      setMessages([
        ...nextMessages,
        {
          role: 'assistant',
          content:
            reason instanceof RequestTimeoutError
              ? 'The response took too long. Check your connection and try again.'
              : 'The AI service could not respond. Please try again shortly.',
        },
      ]);
    } finally {
      requestRef.current = false;
      setLoading(false);
    }
  };

  const save = async () => {
    if (
      !context.user_id ||
      saveRef.current ||
      requestRef.current ||
      saveState !== 'idle'
    ) {
      return;
    }
    saveRef.current = true;
    setSaveState('saving');
    try {
      const { error } = await supabase
        .from('chat_history')
        .insert({ ...context, messages, saved: true } as never);
      if (error) throw error;
      setSaveState('saved');
    } catch {
      setSaveState('idle');
      Alert.alert('Not saved', 'Try saving this conversation again.');
    } finally {
      saveRef.current = false;
    }
  };

  const submitReport = async (
    message: Message,
    reason: 'harmful' | 'incorrect' | 'offensive'
  ) => {
    if (!message.responseId || !message.reportToken) return;
    try {
      await apiRequest('/api/ai-reports', {
        reportToken: message.reportToken,
        responseId: message.responseId,
        response: message.content,
        reason,
        platform: Platform.OS,
        appVersion: Constants.expoConfig?.version ?? 'unknown',
      });
      setReportedResponseIds((values) => [...values, message.responseId!]);
    } catch {
      Alert.alert('Report not sent', 'Try again or contact support.');
    }
  };

  const reportResponse = (message: Message) => {
    Alert.alert('Report response', 'Choose a reason.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Safety concern',
        style: 'destructive',
        onPress: () => void submitReport(message, 'harmful'),
      },
      {
        text: 'Incorrect',
        onPress: () => void submitReport(message, 'incorrect'),
      },
      {
        text: 'Offensive',
        onPress: () => void submitReport(message, 'offensive'),
      },
    ]);
  };

  const allContext = CONTEXT_ORDER.every((key) => selections[key]);
  const contextSummary =
    contextStatus === 'ready' ? summarizeUserContext(userContext ?? undefined) : [];
  if (healthStatus === 'ready') contextSummary.push('Apple Health summary');
  const interactionDisabled =
    loading ||
    saveState === 'saving' ||
    (hasSelectedAiContext(selections) && contextStatus !== 'ready') ||
    (healthSummaryEnabled && healthStatus !== 'ready');
  const sendDisabled = !input.trim() || interactionDisabled;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/voice')}
          style={styles.topAction}
        >
          <Feather name="mic" size={17} color={Colors.primary} />
          <Text style={styles.topActionText}>Voice</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/ground')}
          style={styles.topAction}
        >
          <Feather name="compass" size={17} color={Colors.primary} />
          <Text style={styles.topActionText}>Ground</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/resources')}
          style={styles.topAction}
        >
          <Feather name="life-buoy" size={17} color={Colors.primary} />
          <Text style={styles.topActionText}>Find help</Text>
        </Pressable>
      </View>

      <View style={styles.contextPanel}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: contextExpanded }}
          onPress={() => setContextExpanded((current) => !current)}
          style={styles.contextHeader}
        >
          <View style={styles.contextTitleRow}>
            <Feather name="lock" size={16} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.contextTitle}>Context for this chat</Text>
              <Text style={styles.contextStatus}>
                {contextStatus === 'loading'
                  ? 'Loading selected context'
                  : contextStatus === 'error'
                    ? contextError
                    : contextSummary.length > 0
                      ? contextSummary.join(' · ')
                      : 'Off by default'}
              </Text>
            </View>
          </View>
          <Feather
            name={contextExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={Colors.primary}
          />
        </Pressable>

        {contextExpanded ? (
          <ScrollView
            style={styles.contextOptions}
            contentContainerStyle={{ paddingBottom: 4 }}
            nestedScrollEnabled
          >
            <View style={styles.fullContextRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.contextOptionTitle}>
                  Use all my app context
                </Text>
                <Text style={styles.contextOptionDescription}>
                  You can still turn individual items off. Apple Health stays separate.
                </Text>
              </View>
              <Switch
                value={allContext}
                onValueChange={(next) => void setFullContext(next)}
                trackColor={{ false: Colors.border, true: Colors.sage }}
                thumbColor="#fffef8"
              />
            </View>
            {Platform.OS === 'ios' && APPLE_HEALTH_AI_ENABLED ? (
              <View style={styles.contextOption}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contextOptionTitle}>
                    Apple Health summary
                  </Text>
                  <Text style={styles.contextOptionDescription}>
                    Averages only. Raw samples stay on-device. Confirm every send.
                  </Text>
                  {healthSummaryEnabled && healthStatus !== 'ready' ? (
                    <Text
                      accessibilityRole={healthStatus === 'error' ? 'alert' : undefined}
                      style={[
                        styles.contextOptionDescription,
                        healthStatus === 'error' && { color: Colors.danger },
                      ]}
                    >
                      {healthStatus === 'loading'
                        ? 'Preparing summary...'
                        : healthError}
                    </Text>
                  ) : null}
                </View>
                <Switch
                  accessibilityLabel="Include Apple Health summary"
                  value={healthSummaryEnabled}
                  onValueChange={(next) => void setAppleHealthContext(next)}
                  trackColor={{ false: Colors.border, true: Colors.sage }}
                  thumbColor="#fffef8"
                />
              </View>
            ) : null}
            {CONTEXT_ORDER.map((key) => {
              const option = AI_CONTEXT_OPTIONS[key];
              return (
                <View key={key} style={styles.contextOption}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contextOptionTitle}>
                      {option.label}
                    </Text>
                    <Text style={styles.contextOptionDescription}>
                      {option.description}
                    </Text>
                  </View>
                  <Switch
                    accessibilityLabel={`Include ${option.label}`}
                    value={selections[key]}
                    onValueChange={(next) =>
                      void setContextSelection(key, next)
                    }
                    trackColor={{ false: Colors.border, true: Colors.sage }}
                    thumbColor="#fffef8"
                  />
                </View>
              );
            })}
          </ScrollView>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: disclosureOpen }}
        onPress={() => setDisclosureOpen((current) => !current)}
        style={styles.disclosure}
      >
        <Text style={styles.disclosureText}>
          AI guidance can be wrong. You control the context.
        </Text>
        <Feather
          name={disclosureOpen ? 'x' : 'info'}
          size={16}
          color={Colors.textSecondary}
        />
      </Pressable>
      {disclosureOpen ? (
        <Text style={styles.disclosureDetail}>
          Messages and selected context are processed by an AI provider through
          MHtoolkit. Do not use chat for emergencies or medical decisions.
        </Text>
      ) : null}

      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.aiMark}>
              <Feather name="message-circle" size={23} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>What is on your mind?</Text>
            <Text style={styles.emptyText}>
              Talk it through or ask for one practical next step.
            </Text>
            <View style={styles.prompts}>
              {QUICK_PROMPTS.map((prompt) => (
                <Pressable
                  key={prompt}
                  accessibilityRole="button"
                  disabled={interactionDisabled}
                  onPress={() => void send(prompt)}
                  style={styles.prompt}
                >
                  <Text style={styles.promptText}>{prompt}</Text>
                </Pressable>
              ))}
              {healthSummaryEnabled && healthStatus === 'ready' ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={interactionDisabled}
                  onPress={() =>
                    void send('Reflect on my recent Apple Health patterns.')
                  }
                  style={styles.prompt}
                >
                  <Text style={styles.promptText}>
                    Reflect on my Health patterns
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : (
          messages.map((message, index) => (
            <View
              key={`${message.role}:${index}`}
              style={[
                styles.messageRow,
                message.role === 'user' && styles.userRow,
              ]}
            >
              <View
                style={[
                  styles.bubble,
                  message.role === 'user'
                    ? styles.userBubble
                    : styles.assistantBubble,
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    message.role === 'user' && { color: '#fffef8' },
                  ]}
                >
                  {message.content}
                </Text>
              </View>
              {message.role === 'assistant' &&
              message.responseId &&
              message.reportToken ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={reportedResponseIds.includes(message.responseId)}
                  onPress={() => reportResponse(message)}
                  style={styles.report}
                >
                  <Text style={styles.reportText}>
                    {reportedResponseIds.includes(message.responseId)
                      ? 'Reported'
                      : 'Report response'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ))
        )}
        {loading ? (
          <View style={styles.messageRow}>
            <View style={[styles.bubble, styles.assistantBubble]}>
              <Text style={styles.messageText}>{loadingMessage}</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {messages.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          disabled={loading || saveState !== 'idle'}
          onPress={() => void save()}
          style={styles.saveButton}
        >
          <Feather
            name={saveState === 'saved' ? 'check' : 'save'}
            size={14}
            color={Colors.primary}
          />
          <Text style={styles.saveText}>
            {saveState === 'saving'
              ? 'Saving...'
              : saveState === 'saved'
                ? 'Saved'
                : 'Save chat'}
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={8_000}
          placeholder="Message MHtoolkit"
          placeholderTextColor={Colors.textSecondary}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send message"
          disabled={sendDisabled}
          onPress={() => void send(input)}
          style={[styles.sendButton, sendDisabled && { opacity: 0.42 }]}
        >
          <Feather name="arrow-up" size={20} color="#fffef8" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const UNIFIED_LIBRARY_BY_ID = Object.fromEntries(
  UNIFIED_LIBRARY.map((item) => [item.id, item])
) as Record<string, { title: string }>;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  topAction: {
    minWidth: 0,
    minHeight: 44,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 14,
    paddingHorizontal: 8,
    backgroundColor: Colors.primaryLight,
  },
  topActionText: { color: Colors.primary, fontSize: 12, fontWeight: '700' },
  contextPanel: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    marginHorizontal: 12,
    marginTop: 10,
    overflow: 'hidden',
  },
  contextHeader: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  contextTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  contextTitle: { color: Colors.text, fontSize: 13, fontWeight: '700' },
  contextStatus: {
    color: Colors.textSecondary,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
  },
  contextOptions: { maxHeight: 330, borderTopWidth: 1, borderTopColor: Colors.border },
  fullContextRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    backgroundColor: Colors.primaryLight,
  },
  contextOption: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  contextOptionTitle: { color: Colors.text, fontSize: 12, fontWeight: '700' },
  contextOptionDescription: {
    color: Colors.textSecondary,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
  },
  disclosure: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 13,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,254,248,0.62)',
  },
  disclosureText: { flex: 1, color: Colors.textSecondary, fontSize: 11 },
  disclosureDetail: {
    color: Colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    backgroundColor: 'rgba(255,254,248,0.62)',
    marginHorizontal: 12,
    paddingHorizontal: 13,
    paddingBottom: 11,
  },
  messages: { flex: 1 },
  messagesContent: { flexGrow: 1, padding: 15, paddingTop: 10, paddingBottom: 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  aiMark: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 23,
    lineHeight: 28,
    fontWeight: '700',
    marginTop: 14,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 5,
  },
  prompts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
  },
  prompt: {
    width: '48%',
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  promptText: { color: Colors.text, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  messageRow: { marginBottom: 11, alignItems: 'flex-start' },
  userRow: { alignItems: 'flex-end' },
  bubble: { maxWidth: '84%', borderRadius: 16, padding: 13 },
  userBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 5,
  },
  assistantBubble: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomLeftRadius: 5,
  },
  messageText: { color: Colors.text, fontSize: 14, lineHeight: 21 },
  report: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 3 },
  reportText: {
    color: Colors.textSecondary,
    fontSize: 10,
    textDecorationLine: 'underline',
  },
  saveButton: {
    minHeight: 35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  saveText: { color: Colors.primary, fontSize: 11, fontWeight: '700' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 9,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    padding: 11,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 46,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    backgroundColor: Colors.background,
    color: Colors.text,
    fontSize: 14,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
