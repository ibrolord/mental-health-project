import { useCallback, useEffect, useRef, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import {
  Alert,
  AccessibilityInfo,
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
import { LocalSafetyActions } from '@/components/LocalSafetyActions';
import { Colors } from '@/lib/constants';
import {
  readContextSelections,
  storeContextSelections,
} from '@/lib/chat-context-preference';
import { useDataContext } from '@/lib/hooks/use-data-context';
import { UNIFIED_LIBRARY } from '@/lib/library/content';
import {
  hasExplicitUrgentSafetyLanguage,
  LOCAL_SAFETY_MESSAGE,
} from '@/lib/local-safety';
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
  'Help me reframe a hard thought',
  'I need one small plan',
  'Help me plan what to say',
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
  const [localSafetyOpen, setLocalSafetyOpen] = useState(false);
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
  const activeSaveOperationRef = useRef(0);
  const messageGenerationRef = useRef(0);
  const selectionsRef = useRef(selections);
  const contextSelectionGenerationRef = useRef(0);
  const contextSelectionPersistenceRef = useRef<Promise<void>>(Promise.resolve());
  const contextSelectionRequestRef = useRef(new Map<AiContextSelectionKey, number>());
  const consentRequestRef = useRef<Promise<boolean> | null>(null);
  const activeRequestGenerationRef = useRef<number | null>(null);
  const healthEntryHandledRef = useRef<string | null>(null);
  const ownerRef = useRef(ownerKey);
  ownerRef.current = ownerKey;
  selectionsRef.current = selections;
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
    messageGenerationRef.current += 1;
    activeSaveOperationRef.current += 1;
    contextSelectionGenerationRef.current += 1;
    contextSelectionRequestRef.current.clear();
    consentRequestRef.current = null;
    setMessages([]);
    setInput('');
    setLoading(false);
    setSaveState('idle');
    setReportedResponseIds([]);
    setSelections(createEmptyAiContextSelections());
    setUserContext(null);
    setContextStatus('idle');
    setContextExpanded(false);
    setLocalSafetyOpen(false);
    setContextError('');
    setHealthSummaryEnabled(false);
    setHealthSummary(null);
    setHealthStatus('idle');
    setHealthError('');
    requestRef.current = false;
    activeRequestGenerationRef.current = null;
    saveRef.current = false;

    if (!ownerKey || authLoading) return;
    let active = true;
    const hydrationGeneration = contextSelectionGenerationRef.current;
    void Promise.all([
      readContextSelections(ownerKey),
      hasAiDataSharingConsent(ownerKey),
    ]).then(([saved, consented]) => {
      if (
        !active
        || ownerRef.current !== ownerKey
        || contextSelectionGenerationRef.current !== hydrationGeneration
        || !consented
      ) return;
      selectionsRef.current = saved;
      setSelections(saved);
    }).catch(() => {
      if (
        active
        && ownerRef.current === ownerKey
        && contextSelectionGenerationRef.current === hydrationGeneration
      ) {
        setContextError('Could not load your context choices.');
      }
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
    const expectedOwner = ownerKey;
    const requestGeneration = (contextSelectionRequestRef.current.get(key) ?? 0) + 1;
    contextSelectionRequestRef.current.set(key, requestGeneration);
    if (enabled) {
      const consentRequest = consentRequestRef.current
        ?? ensureAiDataSharingConsent(expectedOwner);
      consentRequestRef.current = consentRequest;
      const consented = await consentRequest.finally(() => {
        if (consentRequestRef.current === consentRequest) {
          consentRequestRef.current = null;
        }
      });
      if (!consented) return;
    }
    if (contextSelectionRequestRef.current.get(key) !== requestGeneration) return;
    if (ownerRef.current !== expectedOwner) return;
    const next = { ...selectionsRef.current, [key]: enabled };
    selectionsRef.current = next;
    setSelections(next);
    setContextError('');
    const generation = contextSelectionGenerationRef.current + 1;
    contextSelectionGenerationRef.current = generation;
    const persistence = contextSelectionPersistenceRef.current
      .catch(() => undefined)
      .then(async () => {
        if (
          ownerRef.current !== expectedOwner
          || contextSelectionGenerationRef.current !== generation
        ) return;
        await storeContextSelections(expectedOwner, selectionsRef.current);
      });
    contextSelectionPersistenceRef.current = persistence;
    try {
      await persistence;
    } catch {
      if (
        ownerRef.current === expectedOwner
        && contextSelectionGenerationRef.current === generation
      ) {
        setContextError('Could not save your context choices.');
      }
    }
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
    if (!trimmed) return;
    if (hasExplicitUrgentSafetyLanguage(trimmed)) {
      messageGenerationRef.current += 1;
      setMessages((current) => [
        ...current,
        { role: 'user', content: trimmed },
        { role: 'assistant', content: LOCAL_SAFETY_MESSAGE },
      ]);
      setInput('');
      setSaveState('idle');
      setLocalSafetyOpen(true);
      AccessibilityInfo.announceForAccessibility(LOCAL_SAFETY_MESSAGE);
      return;
    }
    if (
      loading ||
      requestRef.current ||
      saveRef.current ||
      (hasSelectedAiContext(selections) && contextStatus !== 'ready') ||
      (healthSummaryEnabled && healthStatus !== 'ready')
    ) {
      return;
    }
    const requestGeneration = messageGenerationRef.current + 1;
    messageGenerationRef.current = requestGeneration;
    activeRequestGenerationRef.current = requestGeneration;
    requestRef.current = true;
    const releaseRequest = () => {
      if (activeRequestGenerationRef.current !== requestGeneration) return false;
      activeRequestGenerationRef.current = null;
      requestRef.current = false;
      return true;
    };
    try {
      if (!ownerKey || !(await ensureAiDataSharingConsent(ownerKey))) {
        releaseRequest();
        return;
      }
      if (
        healthSummaryEnabled &&
        (!healthSummary || !(await confirmAppleHealthAiShare(healthSummary)))
      ) {
        releaseRequest();
        return;
      }
      if (messageGenerationRef.current !== requestGeneration) {
        releaseRequest();
        return;
      }
    } catch {
      releaseRequest();
      if (messageGenerationRef.current === requestGeneration) {
        Alert.alert(
          'Could not confirm sharing',
          'Nothing was sent. Please try again.'
        );
      }
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
      if (messageGenerationRef.current === requestGeneration) {
        setMessages([
          ...nextMessages,
          {
            role: 'assistant',
            content: response.response.trim(),
            responseId: response.responseId,
            reportToken: response.reportToken,
          },
        ]);
      }
    } catch (reason) {
      if (messageGenerationRef.current === requestGeneration) {
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
      }
    } finally {
      if (releaseRequest()) setLoading(false);
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
    const saveOperation = activeSaveOperationRef.current + 1;
    activeSaveOperationRef.current = saveOperation;
    const saveGeneration = messageGenerationRef.current;
    const saveOwner = ownerKey;
    setSaveState('saving');
    try {
      const { error } = await supabase
        .from('chat_history')
        .insert({ ...context, messages, saved: true } as never);
      if (error) throw error;
      if (activeSaveOperationRef.current === saveOperation) {
        setSaveState(
          messageGenerationRef.current === saveGeneration && ownerRef.current === saveOwner
            ? 'saved'
            : 'idle'
        );
      }
    } catch {
      if (activeSaveOperationRef.current === saveOperation) {
        setSaveState('idle');
        Alert.alert('Not saved', 'Try saving this conversation again.');
      }
    } finally {
      if (activeSaveOperationRef.current === saveOperation) {
        saveRef.current = false;
      }
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

  const contextSummary =
    contextStatus === 'ready' ? summarizeUserContext(userContext ?? undefined) : [];
  if (healthStatus === 'ready') contextSummary.push('Apple Health summary');
  const interactionDisabled =
    loading ||
    saveState === 'saving' ||
    (hasSelectedAiContext(selections) && contextStatus !== 'ready') ||
    (healthSummaryEnabled && healthStatus !== 'ready');
  const urgentInput = hasExplicitUrgentSafetyLanguage(input.trim());
  const sendDisabled = !input.trim() || (!urgentInput && interactionDisabled);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <View style={styles.topBar}>
        <View style={styles.topUtilityRow}>
          <Text style={styles.topEyebrow}>AI SUPPORT</Text>
          <View style={styles.topActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose app context for this chat"
              accessibilityValue={{ text: contextSummary.length > 0 ? `${contextSummary.length} sources selected` : 'No app context selected' }}
              accessibilityState={{ expanded: contextExpanded }}
              onPress={() => setContextExpanded((current) => !current)}
              style={styles.headerAction}
            >
              <Feather name="lock" size={17} color={Colors.primary} />
              <Text style={styles.headerActionText}>
                {contextSummary.length > 0 ? `${contextSummary.length} on` : 'Context'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open voice support"
              onPress={() => router.push('/voice')}
              style={styles.headerAction}
            >
              <Feather name="mic" size={17} color={Colors.primary} />
              <Text style={styles.headerActionText}>Voice</Text>
            </Pressable>
          </View>
        </View>
        <Text style={styles.topTitle}>Talk it through.</Text>
      </View>

      <View style={styles.supportBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ground me now"
          onPress={() => router.push('/ground')}
          style={({ pressed }) => [styles.supportAction, pressed && styles.pressed]}
        >
          <Feather name="compass" size={15} color={Colors.primary} />
          <Text style={styles.supportActionText}>Ground now</Text>
        </Pressable>
        <View style={styles.supportDivider} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Find urgent and local support"
          onPress={() => router.push('/resources')}
          style={({ pressed }) => [styles.supportAction, pressed && styles.pressed]}
        >
          <Feather name="life-buoy" size={15} color={Colors.primary} />
          <Text style={styles.supportActionText}>Find support</Text>
        </Pressable>
      </View>

      {localSafetyOpen ? (
        <LocalSafetyActions onDismiss={() => setLocalSafetyOpen(false)} />
      ) : null}

      {contextExpanded ? (
        <View style={styles.contextPanel}>
          <View style={styles.contextHeader}>
          <View style={styles.contextTitleRow}>
            <Feather name="lock" size={16} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.contextTitle}>What this chat can use</Text>
              <Text style={styles.contextStatus}>
                {contextStatus === 'loading'
                  ? 'Loading selected context'
                  : contextStatus === 'error'
                    ? contextError
                    : contextSummary.length > 0
                      ? contextSummary.join(' · ')
                      : 'No app context selected'}
              </Text>
            </View>
          </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close context choices"
              onPress={() => setContextExpanded(false)}
              style={styles.contextClose}
            >
              <Feather name="x" size={18} color={Colors.primary} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.contextOptions}
            contentContainerStyle={{ paddingBottom: 4 }}
            nestedScrollEnabled
          >
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
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: disclosureOpen }}
              onPress={() => setDisclosureOpen((current) => !current)}
              style={({ pressed }) => [
                styles.disclosure,
                pressed && styles.pressed,
              ]}
            >
              <Feather name="info" size={15} color={Colors.textSecondary} />
              <Text style={styles.disclosureText}>About AI support and privacy</Text>
              <Feather
                name={disclosureOpen ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={Colors.textSecondary}
              />
            </Pressable>
            {disclosureOpen ? (
              <Text style={styles.disclosureDetail}>
                Messages and selected context are sent through MHtoolkit to Gemini,
                Claude, or OpenAI.
              </Text>
            ) : null}
          </ScrollView>
        </View>
      ) : null}

      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEyebrow}>AI-GUIDED CONVERSATION</Text>
            <Text style={styles.emptyTitle}>What is on your mind?</Text>
            <Text style={styles.emptyText}>
              Start anywhere. You can ask for one practical next step.
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
          accessibilityLabel="Message to MHtoolkit AI"
          style={styles.input}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={8_000}
          placeholder="Message MHtoolkit AI"
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
      <Text style={styles.aiLimit}>
        AI can make mistakes. For urgent help, use Find support.
      </Text>
    </KeyboardAvoidingView>
  );
}

const UNIFIED_LIBRARY_BY_ID = Object.fromEntries(
  UNIFIED_LIBRARY.map((item) => [item.id, item])
) as Record<string, { title: string }>;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    minHeight: 78,
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
  },
  topUtilityRow: {
    minHeight: 40,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  topEyebrow: {
    color: Colors.accent,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  topTitle: {
    color: Colors.text,
    fontFamily: 'Georgia',
    fontSize: 25,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  topActions: { flexDirection: 'row', gap: 6 },
  headerAction: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    backgroundColor: Colors.primaryLight,
  },
  headerActionText: { color: Colors.primary, fontSize: 11, fontWeight: '700' },
  supportBar: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
  },
  supportAction: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  supportActionText: { color: Colors.primary, fontSize: 12, fontWeight: '700' },
  supportDivider: { width: StyleSheet.hairlineWidth, height: 22, backgroundColor: Colors.borderStrong },
  aiLimit: {
    color: Colors.textSecondary,
    fontSize: 11,
    paddingHorizontal: 20,
    paddingTop: 5,
    paddingBottom: 8,
    backgroundColor: Colors.card,
  },
  contextPanel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceMuted,
    marginHorizontal: 16,
    marginTop: 6,
    overflow: 'hidden',
  },
  contextHeader: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  contextClose: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  contextTitle: { color: Colors.text, fontSize: 13, fontWeight: '700' },
  contextStatus: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  contextOptions: { maxHeight: 330, borderTopWidth: 1, borderTopColor: Colors.border },
  contextOption: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  contextOptionTitle: { color: Colors.text, fontSize: 13, fontWeight: '700' },
  contextOptionDescription: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  disclosure: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  disclosureText: { flex: 1, color: Colors.textSecondary, fontSize: 11, fontWeight: '600' },
  disclosureDetail: {
    color: Colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  pressed: { opacity: 0.76 },
  messages: { flex: 1 },
  messagesContent: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 },
  empty: { flex: 1, alignItems: 'flex-start', justifyContent: 'flex-start', paddingTop: 24, paddingBottom: 18 },
  emptyEyebrow: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  emptyTitle: {
    color: Colors.text,
    fontFamily: 'Georgia',
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '700',
    marginTop: 10,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'left',
    marginTop: 5,
  },
  prompts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 8,
    marginTop: 14,
  },
  prompt: {
    width: '100%',
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  promptText: { color: Colors.text, fontSize: 13, textAlign: 'left' },
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
  report: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 },
  reportText: {
    color: Colors.textSecondary,
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  saveButton: {
    minHeight: 44,
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
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
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
