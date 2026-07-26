import { Linking, View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ASSESSMENTS } from '@/lib/assessments/definitions';
import { Colors } from '@/lib/constants';

const assessmentList = [
  { ...ASSESSMENTS.GAD7, icon: 'A', bg: '#eff6ff', border: '#bfdbfe' },
  { ...ASSESSMENTS.PHQ9, icon: 'D', bg: '#ecfdf5', border: '#a7f3d0' },
  { ...ASSESSMENTS.CBI, icon: 'B', bg: '#fffbeb', border: '#fde68a' },
];

export default function AssessmentsScreen() {
  const router = useRouter();

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.hero}>
        <Text style={s.kicker}>PUBLISHED SELF-REPORT TOOLS</Text>
        <Text style={s.title}>Check a pattern, not a label.</Text>
        <Text style={s.subtitle}>
          Each tool uses its published wording, response scale, and scoring method. Results can
          support a conversation with a qualified professional, but they cannot diagnose you.
        </Text>
      </View>

      {assessmentList.map((a) => (
        <TouchableOpacity
          key={a.type}
          style={[s.card, { backgroundColor: a.bg, borderColor: a.border }]}
          onPress={() => router.push(`/assessments/${a.type.toLowerCase()}`)}
        >
          <View style={s.cardIcon}>
            <Text style={s.cardIconText}>{a.icon}</Text>
          </View>
          <Text style={s.measureType}>{a.measureType.toUpperCase()}</Text>
          <Text style={s.cardTitle}>{a.shortName}</Text>
          <Text style={s.cardDesc}>{a.description}</Text>
          <View style={s.metaRow}>
            <Text style={s.cardMeta}>{a.timeframe}</Text>
            <Text style={s.cardMeta}>
              {a.functioningQuestion
                ? `${a.questions.length} scored + 1 impact`
                : `${a.questions.length} questions`}
            </Text>
          </View>
          <View style={s.takeBtn}>
            <Text style={s.takeBtnText}>Start {a.type === 'CBI' ? 'measure' : 'screener'}</Text>
          </View>
          <TouchableOpacity onPress={() => Linking.openURL(a.citationUrl)}>
            <Text style={s.sourceLink}>View published source</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      ))}

      <View style={s.infoCard}>
        <Text style={s.infoTitle}>What a score cannot tell you</Text>
        <Text style={s.infoText}>
          A score cannot diagnose a condition, identify its cause, or decide which treatment is
          right. Seek professional care whenever symptoms concern you or interfere with daily life,
          regardless of the number.
        </Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f1e8' },
  content: { padding: 16, paddingBottom: 40 },
  hero: { backgroundColor: '#173f38', borderRadius: 24, padding: 22, marginBottom: 20 },
  kicker: { color: '#a7f3d0', fontSize: 11, fontWeight: '700', letterSpacing: 1.1 },
  title: { fontSize: 30, fontWeight: '700', color: '#fff', marginTop: 8, lineHeight: 37 },
  subtitle: { fontSize: 14, color: '#d1fae5', marginTop: 10, lineHeight: 21 },
  card: { borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1 },
  cardIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#173f38', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  cardIconText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  measureType: { fontSize: 10, fontWeight: '700', letterSpacing: 0.9, color: Colors.textSecondary, marginBottom: 5 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  cardDesc: { fontSize: 14, color: Colors.textSecondary, marginBottom: 12 },
  sourceLink: { fontSize: 12, color: '#287264', lineHeight: 18, marginTop: 12, textAlign: 'center', fontWeight: '600' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(15,23,42,0.08)', paddingVertical: 12, marginTop: 4 },
  cardMeta: { fontSize: 13, color: Colors.textSecondary },
  takeBtn: { backgroundColor: '#173f38', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
  takeBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  infoCard: { borderRadius: 16, padding: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.border },
  infoTitle: { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  infoText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },
});
