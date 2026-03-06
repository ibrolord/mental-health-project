import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useDataContext } from '@/lib/hooks/use-data-context';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/lib/constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  areRemindersEnabled,
  setRemindersEnabled,
  getReminderTimes,
  setReminderTimes,
} from '@/lib/notifications';

const HOUR_OPTIONS = [
  { label: '7 AM', value: 7 },
  { label: '8 AM', value: 8 },
  { label: '9 AM', value: 9 },
  { label: '10 AM', value: 10 },
  { label: '12 PM', value: 12 },
  { label: '2 PM', value: 14 },
  { label: '5 PM', value: 17 },
  { label: '8 PM', value: 20 },
  { label: '9 PM', value: 21 },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut, isAnonymous } = useAuth();
  const { query } = useDataContext();
  const [loading, setLoading] = useState(false);
  const [remindersOn, setRemindersOn] = useState(true);
  const [selectedTimes, setSelectedTimes] = useState<number[]>([9, 14, 20]);

  useEffect(() => {
    (async () => {
      setRemindersOn(await areRemindersEnabled());
      setSelectedTimes(await getReminderTimes());
    })();
  }, []);

  const toggleReminders = async (val: boolean) => {
    setRemindersOn(val);
    await setRemindersEnabled(val);
  };

  const toggleTime = async (hour: number) => {
    let next: number[];
    if (selectedTimes.includes(hour)) {
      next = selectedTimes.filter((h) => h !== hour);
    } else {
      next = [...selectedTimes, hour].sort((a, b) => a - b);
    }
    if (next.length === 0) return; // Must keep at least one
    setSelectedTimes(next);
    await setReminderTimes(next);
  };

  const handleExport = async () => {
    if (!query) return;
    setLoading(true);
    try {
      const [moods, assessments, goals, habits, chatHistory] = await Promise.all([
        supabase.from('moods').select('*').eq(query.column, query.value),
        supabase.from('assessments').select('*').eq(query.column, query.value),
        supabase.from('goals').select('*').eq(query.column, query.value),
        supabase.from('habits').select('*').eq(query.column, query.value),
        supabase.from('chat_history').select('*').eq(query.column, query.value),
      ]);

      const data = JSON.stringify({
        exported_at: new Date().toISOString(),
        user_type: isAnonymous ? 'anonymous' : 'authenticated',
        moods: moods.data || [],
        assessments: assessments.data || [],
        goals: goals.data || [],
        habits: habits.data || [],
        chat_history: chatHistory.data || [],
      }, null, 2);

      const path = `${FileSystem.documentDirectory}mental-health-data.json`;
      await FileSystem.writeAsStringAsync(path, data);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to export data');
    }
    setLoading(false);
  };

  const handleDeleteAll = async () => {
    if (!query) return;
    Alert.alert(
      'Delete All Data?',
      'This will permanently delete all your moods, assessments, goals, habits, and chat history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            await Promise.all([
              supabase.from('moods').delete().eq(query.column, query.value),
              supabase.from('assessments').delete().eq(query.column, query.value),
              supabase.from('goals').delete().eq(query.column, query.value),
              supabase.from('habits').delete().eq(query.column, query.value),
              supabase.from('chat_history').delete().eq(query.column, query.value),
              supabase.from('user_affirmation_history').delete().eq(query.column, query.value),
            ]);
            Alert.alert('Done', 'All data deleted.');
            setLoading(false);
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Account */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Account</Text>
        {isAnonymous ? (
          <>
            <Text style={s.bodyText}>You are using the app anonymously.</Text>
            <TouchableOpacity style={s.btn} onPress={() => router.push('/auth/signup')}>
              <Text style={s.btnText}>Create Account to Sync Data</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={s.bodyText}>Email: {user?.email}</Text>
            <Text style={[s.bodyText, { marginTop: 4 }]}>Your data is synced across devices.</Text>
            <TouchableOpacity style={s.btnOutline} onPress={signOut}>
              <Text style={s.btnOutlineText}>Sign Out</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Notifications */}
      <View style={s.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <Text style={s.cardTitle}>Mood Reminders</Text>
          <Switch
            value={remindersOn}
            onValueChange={toggleReminders}
            trackColor={{ false: '#d1d5db', true: Colors.primary }}
            thumbColor="#fff"
          />
        </View>
        <Text style={s.bodyText}>Get gentle reminders to check in with your mood throughout the day.</Text>

        {remindersOn && (
          <View style={{ marginTop: 14 }}>
            <Text style={[s.bodyText, { fontWeight: '500', marginBottom: 8 }]}>Reminder times:</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {HOUR_OPTIONS.map((opt) => {
                const selected = selectedTimes.includes(opt.value);
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => toggleTime(opt.value)}
                    style={[
                      s.timePill,
                      selected && { backgroundColor: Colors.primary, borderColor: Colors.primary },
                    ]}
                  >
                    <Text style={[s.timePillText, selected && { color: '#fff' }]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </View>

      {/* Export */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Export Your Data</Text>
        <Text style={s.bodyText}>Download all your mental health data in JSON format.</Text>
        <TouchableOpacity style={s.btnOutline} onPress={handleExport} disabled={loading}>
          <Text style={s.btnOutlineText}>{loading ? 'Exporting...' : 'Export Data (JSON)'}</Text>
        </TouchableOpacity>
      </View>

      {/* Privacy */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Privacy & Data Protection</Text>
        <Text style={s.privacyItem}>All data is encrypted at rest</Text>
        <Text style={s.privacyItem}>We never sell or share your data</Text>
        <Text style={s.privacyItem}>Anonymous usage requires no personal info</Text>
        <Text style={s.privacyItem}>Export or delete your data anytime</Text>
      </View>

      {/* Danger Zone */}
      <View style={[s.card, { backgroundColor: Colors.dangerLight, borderWidth: 1, borderColor: '#fecaca' }]}>
        <Text style={[s.cardTitle, { color: Colors.danger }]}>Danger Zone</Text>
        <Text style={[s.bodyText, { color: '#991b1b' }]}>Permanently delete all your data. This cannot be undone.</Text>
        <TouchableOpacity style={s.dangerBtn} onPress={handleDeleteAll} disabled={loading}>
          <Text style={s.dangerBtnText}>Delete All Data</Text>
        </TouchableOpacity>
      </View>

      {/* Disclaimer */}
      <View style={[s.card, { backgroundColor: '#eff6ff' }]}>
        <Text style={{ fontSize: 13, color: Colors.textSecondary, lineHeight: 20, textAlign: 'center' }}>
          This app is a self-help tool, not a replacement for professional therapy. If you're in crisis, call 988.
        </Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: Colors.card, borderRadius: 16, padding: 20, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: Colors.text, marginBottom: 10 },
  bodyText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  privacyItem: { fontSize: 14, color: Colors.textSecondary, marginBottom: 8, lineHeight: 20 },
  btn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  btnOutline: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  btnOutlineText: { color: Colors.text, fontWeight: '500', fontSize: 15 },
  dangerBtn: { backgroundColor: Colors.danger, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  dangerBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  timePill: { borderWidth: 1, borderColor: Colors.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  timePillText: { fontSize: 13, fontWeight: '500', color: Colors.text },
});
