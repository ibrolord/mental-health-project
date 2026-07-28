import { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, StyleSheet, Alert } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useDataContext } from '@/lib/hooks/use-data-context';
import { Colors } from '@/lib/constants';
import { apiRequest } from '@/lib/api';
import { RequestTimeoutError } from '@/lib/request';
import { ensureAiDataSharingConsent } from '@/lib/ai-consent';
import { format, subDays } from 'date-fns';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  responseId?: string;
  reportToken?: string;
}
interface UserContext {
  recentMoods?: { emoji: string; note: string; created_at: string }[];
  assessments?: { type: string; score: number; max_score: number; created_at: string }[];
  goals?: { content: string; status: string; reflection?: string; date: string }[];
  habits?: { name: string; streak_count: number }[];
}

interface ChatApiResponse {
  response?: unknown;
  responseId?: string;
  reportToken?: string;
}

const quickPrompts = ['I feel anxious', 'Help me reframe a negative thought', 'Ground me', 'I need to talk'];

export default function ChatScreen() {
  const router = useRouter();
  const { context, query, authLoading } = useDataContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Thinking...');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [personalized, setPersonalized] = useState(false);
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [reportedResponseIds, setReportedResponseIds] = useState<string[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const fetchedRef = useRef(false);
  const requestInFlightRef = useRef(false);
  const saveInFlightRef = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  useEffect(() => {
    if (!loading) {
      setLoadingMessage('Thinking...');
      return;
    }

    const stillWorking = setTimeout(() => setLoadingMessage('Still working...'), 10_000);
    const takingLonger = setTimeout(
      () => setLoadingMessage('Taking longer than usual...'),
      25_000
    );

    return () => {
      clearTimeout(stillWorking);
      clearTimeout(takingLonger);
    };
  }, [loading]);

  useEffect(() => {
    if (!personalized) { setUserContext(null); fetchedRef.current = false; return; }
    if (authLoading || !query || fetchedRef.current) return;
    fetchedRef.current = true;
    (async () => {
      const ago = format(subDays(new Date(), 7), 'yyyy-MM-dd');
      const [m, a, g, h] = await Promise.all([
        supabase.from('moods').select('emoji, note, created_at').eq(query.column, query.value).gte('created_at', ago).order('created_at', { ascending: false }).limit(10),
        supabase.from('assessments').select('type, score, max_score, created_at').eq(query.column, query.value).order('created_at', { ascending: false }).limit(5),
        supabase.from('goals').select('content, status, reflection, date').eq(query.column, query.value).gte('date', ago).order('date', { ascending: false }),
        supabase.from('habits').select('name, streak_count').eq(query.column, query.value).eq('is_active', true),
      ]);
      const contextError = m.error || a.error || g.error || h.error;
      if (contextError) {
        console.error('Failed to load personalized chat context:', contextError);
        setPersonalized(false);
        setUserContext(null);
        return;
      }
      setUserContext({ recentMoods: m.data || [], assessments: a.data || [], goals: g.data || [], habits: h.data || [] });
    })();
  }, [personalized, authLoading, query]);

  const send = async (text: string) => {
    if (
      !text.trim() ||
      loading ||
      requestInFlightRef.current ||
      saveInFlightRef.current
    ) return;

    requestInFlightRef.current = true;
    try {
      const consented = await ensureAiDataSharingConsent();
      if (!consented) return;

      const newMsg: Message = { role: 'user', content: text };
      const msgs = [...messages, newMsg];
      setMessages(msgs);
      setInput('');
      setSaveState('idle');
      setLoading(true);
      try {
        const d = await apiRequest<ChatApiResponse>('/api/chat', {
          messages: msgs.map(({ role, content }) => ({ role, content })),
          userContext: personalized ? userContext : undefined,
        });
        if (typeof d.response !== 'string' || !d.response.trim()) {
          throw new Error('AI response was empty');
        }

        setMessages([...msgs, {
          role: 'assistant',
          content: d.response.trim(),
          responseId: d.responseId,
          reportToken: d.reportToken,
        }]);
      } catch (error) {
        const content = error instanceof RequestTimeoutError
          ? 'The AI response took too long. Please check your connection and try again.'
          : 'I could not reach the AI service. Please try again in a moment.';
        setMessages([...msgs, { role: 'assistant', content }]);
      } finally {
        setLoading(false);
      }
    } finally {
      requestInFlightRef.current = false;
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
        appVersion: Constants.expoConfig?.version || 'unknown',
      });
      setReportedResponseIds((current) => [...current, message.responseId!]);
      Alert.alert('Report Sent', 'Thank you. This response was sent for safety review.');
    } catch {
      Alert.alert('Unable to Send Report', 'Please try again or contact support.');
    }
  };

  const reportResponse = (message: Message) => {
    Alert.alert('Report AI Response', 'What is wrong with this response?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Safety Concern', style: 'destructive', onPress: () => submitReport(message, 'harmful') },
      {
        text: 'Other Issue',
        onPress: () => Alert.alert('Report AI Response', 'Choose a reason.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Incorrect', onPress: () => submitReport(message, 'incorrect') },
          { text: 'Offensive', onPress: () => submitReport(message, 'offensive') },
        ]),
      },
    ]);
  };

  const save = async () => {
    if (!context) {
      Alert.alert('Unable to Save', 'Your account session is still loading. Please try again.');
      return;
    }
    if (
      saveState === 'saving' ||
      saveState === 'saved' ||
      saveInFlightRef.current ||
      requestInFlightRef.current
    ) return;

    saveInFlightRef.current = true;
    setSaveState('saving');
    try {
      const { error } = await supabase
        .from('chat_history')
        .insert({ ...context, messages, saved: true } as any);
      if (error) throw error;

      setSaveState('saved');
      Alert.alert('Chat Saved', 'This conversation is now in your saved chat history.');
    } catch (error) {
      console.error('Failed to save chat:', error);
      setSaveState('idle');
      Alert.alert('Unable to Save', 'This chat was not saved. Please try again.');
    } finally {
      saveInFlightRef.current = false;
    }
  };

  const togglePersonalized = async () => {
    if (personalized) {
      setPersonalized(false);
      fetchedRef.current = false;
      return;
    }

    const consented = await ensureAiDataSharingConsent();
    if (!consented) return;
    setPersonalized(true);
    fetchedRef.current = false;
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' && (Platform as any).isPad ? 110 : 90}>
      {/* Voice Mode Button */}
      <TouchableOpacity style={s.voiceBar} onPress={() => router.push('/voice')}>
        <Text style={s.voiceBarText}>🎙️  Switch to Voice Mode</Text>
      </TouchableOpacity>

      <View style={s.aiDisclosure}>
        <Text style={s.aiDisclosureTitle}>AI data sharing</Text>
        <Text style={s.aiDisclosureText}>
          Chat sends your messages to Google Gemini, Anthropic Claude, or OpenAI through MHtoolkit to generate responses.
          Personalized Responses also include recent moods, assessments, goals, and habits if you turn it on.
        </Text>
      </View>

      {/* Personalized Toggle */}
      <TouchableOpacity style={s.toggleRow} onPress={togglePersonalized}>
        <View style={[s.toggleTrack, personalized && s.toggleTrackOn]}>
          <View style={[s.toggleThumb, personalized && s.toggleThumbOn]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.toggleLabel}>Personalized Responses</Text>
          <Text style={s.toggleSub}>Include recent moods, assessments, goals, and habits in AI requests</Text>
        </View>
      </TouchableOpacity>

      {/* Messages */}
      <ScrollView ref={scrollRef} style={s.messagesContainer} contentContainerStyle={s.messagesContent}>
        {messages.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyTitle}>How can I help?</Text>
            <Text style={s.emptySubtitle}>{"I'm here to listen."}</Text>
            <View style={s.promptsGrid}>
              {quickPrompts.map((p) => (
                <TouchableOpacity key={p} style={s.promptBtn} onPress={() => send(p)}>
                  <Text style={s.promptText}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          messages.map((msg, i) => (
            <View key={i} style={[s.msgRow, msg.role === 'user' && s.msgRowUser]}>
              <View style={[s.msgBubble, msg.role === 'user' ? s.msgBubbleUser : s.msgBubbleAssistant]}>
                <Text style={[s.msgText, msg.role === 'user' && { color: '#fff' }]}>{msg.content}</Text>
              </View>
              {msg.role === 'assistant' && msg.responseId && msg.reportToken && (
                <TouchableOpacity
                  style={s.reportBtn}
                  onPress={() => reportResponse(msg)}
                  disabled={reportedResponseIds.includes(msg.responseId)}
                >
                  <Text style={s.reportBtnText}>
                    {reportedResponseIds.includes(msg.responseId) ? 'Reported' : 'Report response'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
        {loading && (
          <View style={s.msgRow}>
            <View style={s.msgBubbleAssistant}>
              <Text style={s.msgText}>{loadingMessage}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Save button */}
      {messages.length > 0 && (
        <TouchableOpacity
          style={[s.saveBtn, (loading || saveState !== 'idle') && s.saveBtnDisabled]}
          onPress={save}
          disabled={loading || saveState !== 'idle'}
        >
          <Text style={s.saveBtnText}>
            {loading
              ? 'Waiting for response...'
              : saveState === 'saving'
                ? 'Saving...'
                : saveState === 'saved'
                  ? 'Saved'
                  : 'Save Chat'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Input */}
      <View style={s.inputRow}>
        <TextInput
          style={s.input}
          placeholder="What's on your mind?"
          value={input}
          onChangeText={setInput}
          multiline
          placeholderTextColor={Colors.textSecondary}
        />
        <TouchableOpacity
          style={[s.sendBtn, (!input.trim() || loading) && { opacity: 0.5 }]}
          onPress={() => send(input)}
          disabled={!input.trim() || loading || saveState === 'saving'}
        >
          <Text style={s.sendBtnText}>Send</Text>
        </TouchableOpacity>
      </View>

      {/* Disclaimer */}
      <View style={s.disclaimer}>
        <Text style={s.disclaimerText}>Not a replacement for therapy. Crisis? Call 988</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  voiceBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 10, backgroundColor: '#eff6ff', borderBottomWidth: 1, borderBottomColor: Colors.border },
  voiceBarText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  aiDisclosure: { padding: 12, backgroundColor: '#fff7ed', borderBottomWidth: 1, borderBottomColor: '#fed7aa' },
  aiDisclosureTitle: { fontSize: 13, fontWeight: '700', color: '#9a3412', marginBottom: 4 },
  aiDisclosureText: { fontSize: 12, color: '#9a3412', lineHeight: 18 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  toggleTrack: { width: 44, height: 24, borderRadius: 12, backgroundColor: '#d1d5db', justifyContent: 'center', paddingHorizontal: 2 },
  toggleTrackOn: { backgroundColor: Colors.primary },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  toggleThumbOn: { transform: [{ translateX: 20 }] },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: Colors.text },
  toggleSub: { fontSize: 12, color: Colors.textSecondary },
  messagesContainer: { flex: 1 },
  messagesContent: { padding: 16, paddingBottom: 8 },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 24, fontWeight: '600', color: Colors.text, marginBottom: 8 },
  emptySubtitle: { fontSize: 16, color: Colors.textSecondary, marginBottom: 24 },
  promptsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', maxWidth: 320 },
  promptBtn: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: Colors.card },
  promptText: { fontSize: 14, color: Colors.text },
  msgRow: { marginBottom: 12 },
  msgRowUser: { alignItems: 'flex-end' },
  msgBubble: { maxWidth: '80%', padding: 14, borderRadius: 16 },
  msgBubbleUser: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  msgBubbleAssistant: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderBottomLeftRadius: 4 },
  msgText: { fontSize: 15, lineHeight: 22, color: Colors.text },
  reportBtn: { alignSelf: 'flex-start', marginTop: 5, paddingVertical: 4, paddingHorizontal: 2 },
  reportBtnText: { fontSize: 12, color: Colors.textSecondary, textDecorationLine: 'underline' },
  saveBtn: { paddingVertical: 8, paddingHorizontal: 16, alignSelf: 'center' },
  saveBtnDisabled: { opacity: 0.55 },
  saveBtnText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  inputRow: { flexDirection: 'row', padding: 12, gap: 10, backgroundColor: Colors.card, borderTopWidth: 1, borderTopColor: Colors.border },
  input: { flex: 1, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 12, fontSize: 15, maxHeight: 100, color: Colors.text },
  sendBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 20, justifyContent: 'center' },
  sendBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  disclaimer: { padding: 8, backgroundColor: '#eff6ff' },
  disclaimerText: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center', fontWeight: '500' },
});
