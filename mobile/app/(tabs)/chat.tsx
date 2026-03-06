import { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useDataContext } from '@/lib/hooks/use-data-context';
import { Colors } from '@/lib/constants';
import { apiRequest } from '@/lib/api';
import { format, subDays } from 'date-fns';

interface Message { role: 'user' | 'assistant'; content: string; }
interface UserContext {
  recentMoods?: Array<{ emoji: string; note: string; created_at: string }>;
  assessments?: Array<{ type: string; score: number; interpretation: string; created_at: string }>;
  goals?: Array<{ content: string; status: string; reflection?: string; date: string }>;
  habits?: Array<{ name: string; current_streak: number }>;
}

const quickPrompts = ['I feel anxious', 'Help me reframe a negative thought', 'Ground me', 'I need to talk'];

export default function ChatScreen() {
  const router = useRouter();
  const { context, query, authLoading } = useDataContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [personalized, setPersonalized] = useState(false);
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  useEffect(() => {
    if (!personalized) { setUserContext(null); fetchedRef.current = false; return; }
    if (authLoading || !query || fetchedRef.current) return;
    fetchedRef.current = true;
    (async () => {
      const ago = format(subDays(new Date(), 7), 'yyyy-MM-dd');
      const [m, a, g, h] = await Promise.all([
        supabase.from('moods').select('emoji, note, created_at').eq(query.column, query.value).gte('created_at', ago).order('created_at', { ascending: false }).limit(10),
        supabase.from('assessments').select('type, score, interpretation, created_at').eq(query.column, query.value).order('created_at', { ascending: false }).limit(5),
        supabase.from('goals').select('content, status, reflection, date').eq(query.column, query.value).gte('date', ago).order('date', { ascending: false }),
        supabase.from('habits').select('name, current_streak').eq(query.column, query.value).eq('is_active', true),
      ]);
      setUserContext({ recentMoods: m.data || [], assessments: a.data || [], goals: g.data || [], habits: h.data || [] });
    })();
  }, [personalized, authLoading, query]);

  const send = async (text: string) => {
    if (!text.trim()) return;
    const newMsg: Message = { role: 'user', content: text };
    const msgs = [...messages, newMsg];
    setMessages(msgs);
    setInput('');
    setLoading(true);
    try {
      const d = await apiRequest('/api/chat', {
        messages: msgs,
        userContext: personalized ? userContext : undefined,
      });
      if (d.response) {
        setMessages([...msgs, { role: 'assistant', content: d.response }]);
      }
    } catch {
      setMessages([...msgs, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    }
    setLoading(false);
  };

  const save = async () => {
    if (context) {
      await supabase.from('chat_history').insert({ ...context, messages, saved: true } as any);
    }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      {/* Voice Mode Button */}
      <TouchableOpacity style={s.voiceBar} onPress={() => router.push('/voice')}>
        <Text style={s.voiceBarText}>🎙️  Switch to Voice Mode</Text>
      </TouchableOpacity>

      {/* Personalized Toggle */}
      <TouchableOpacity style={s.toggleRow} onPress={() => { setPersonalized((p) => !p); fetchedRef.current = false; }}>
        <View style={[s.toggleTrack, personalized && s.toggleTrackOn]}>
          <View style={[s.toggleThumb, personalized && s.toggleThumbOn]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.toggleLabel}>Personalized Responses</Text>
          <Text style={s.toggleSub}>Use my data for context</Text>
        </View>
      </TouchableOpacity>

      {/* Messages */}
      <ScrollView ref={scrollRef} style={s.messagesContainer} contentContainerStyle={s.messagesContent}>
        {messages.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyTitle}>How can I help?</Text>
            <Text style={s.emptySubtitle}>I'm here to listen.</Text>
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
            </View>
          ))
        )}
        {loading && (
          <View style={s.msgRow}>
            <View style={s.msgBubbleAssistant}>
              <Text style={s.msgText}>Thinking...</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Save button */}
      {messages.length > 0 && (
        <TouchableOpacity style={s.saveBtn} onPress={save}>
          <Text style={s.saveBtnText}>Save Chat</Text>
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
          disabled={!input.trim() || loading}
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
  saveBtn: { paddingVertical: 8, paddingHorizontal: 16, alignSelf: 'center' },
  saveBtnText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  inputRow: { flexDirection: 'row', padding: 12, gap: 10, backgroundColor: Colors.card, borderTopWidth: 1, borderTopColor: Colors.border },
  input: { flex: 1, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 12, fontSize: 15, maxHeight: 100, color: Colors.text },
  sendBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 20, justifyContent: 'center' },
  sendBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  disclaimer: { padding: 8, backgroundColor: '#eff6ff' },
  disclaimerText: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center', fontWeight: '500' },
});
