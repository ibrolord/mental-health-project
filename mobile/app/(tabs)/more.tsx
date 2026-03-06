import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/lib/constants';

const menuItems = [
  { label: 'Voice Therapy', icon: '🎙️', desc: 'Talk to your AI therapist', route: '/voice' as const },
  { label: 'Goals', icon: '✅', desc: 'Plan your day with intention', route: '/goals' as const },
  { label: 'Habits', icon: '🎯', desc: 'Build positive habits', route: '/habits' as const },
  { label: 'Affirmations', icon: '✨', desc: 'Daily affirmations', route: '/affirmations' as const },
  { label: 'Library', icon: '📚', desc: 'Mental health book summaries', route: '/library' as const },
  { label: 'Settings', icon: '⚙️', desc: 'Account & privacy', route: '/settings' as const },
];

export default function MoreScreen() {
  const router = useRouter();

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title}>More</Text>
      {menuItems.map((item) => (
        <TouchableOpacity key={item.route} style={s.row} onPress={() => router.push(item.route)}>
          <Text style={s.icon}>{item.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.rowTitle}>{item.label}</Text>
            <Text style={s.rowDesc}>{item.desc}</Text>
          </View>
          <Text style={s.arrow}>›</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.text, marginBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.card, borderRadius: 14, padding: 18, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  icon: { fontSize: 28 },
  rowTitle: { fontSize: 17, fontWeight: '600', color: Colors.text },
  rowDesc: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  arrow: { fontSize: 24, color: Colors.textSecondary },
});
