import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ASSESSMENTS } from '@/lib/assessments/definitions';
import { Colors } from '@/lib/constants';

const assessmentList = [
  { ...ASSESSMENTS.GAD7, icon: '😰', bg: '#eff6ff', border: '#bfdbfe' },
  { ...ASSESSMENTS.PHQ9, icon: '😔', bg: '#faf5ff', border: '#e9d5ff' },
  { ...ASSESSMENTS.CBI, icon: '😓', bg: '#fff7ed', border: '#fed7aa' },
  { ...ASSESSMENTS.PSS4, icon: '😬', bg: '#f0fdf4', border: '#bbf7d0' },
];

export default function AssessmentsScreen() {
  const router = useRouter();

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title}>Self-Assessments</Text>
      <Text style={s.subtitle}>Quick, clinically-backed assessments to help you understand where you are</Text>

      {assessmentList.map((a) => (
        <TouchableOpacity
          key={a.type}
          style={[s.card, { backgroundColor: a.bg, borderColor: a.border }]}
          onPress={() => router.push(`/assessments/${a.type.toLowerCase()}`)}
        >
          <Text style={s.cardIcon}>{a.icon}</Text>
          <Text style={s.cardTitle}>{a.name}</Text>
          <Text style={s.cardDesc}>{a.description}</Text>
          <Text style={s.cardMeta}>
            {a.questions.length} questions · {Math.ceil(a.questions.length * 0.5)} min
          </Text>
          <View style={s.takeBtn}>
            <Text style={s.takeBtnText}>Take Assessment</Text>
          </View>
        </TouchableOpacity>
      ))}

      <View style={[s.card, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Text style={{ fontSize: 28 }}>ℹ️</Text>
          <View style={{ flex: 1 }}>
            <Text style={[s.cardTitle, { marginBottom: 8 }]}>About These Assessments</Text>
            <Text style={s.infoText}>
              These assessments are screening tools, not diagnostic instruments. They can help you
              understand your symptoms, but they don't replace professional evaluation.
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 20 },
  card: { borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1 },
  cardIcon: { fontSize: 36, marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  cardDesc: { fontSize: 14, color: Colors.textSecondary, marginBottom: 12 },
  cardMeta: { fontSize: 13, color: Colors.textSecondary, marginBottom: 16 },
  takeBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  takeBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  infoText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },
});
