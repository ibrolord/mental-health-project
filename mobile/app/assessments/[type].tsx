import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ASSESSMENTS } from '@/lib/assessments/definitions';
import { supabase } from '@/lib/supabase';
import { useDataContext } from '@/lib/hooks/use-data-context';
import { Colors } from '@/lib/constants';

export default function AssessmentTakeScreen() {
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type: string }>();
  const { context } = useDataContext();

  const assessmentKey = (type?.toUpperCase() || '') as keyof typeof ASSESSMENTS;
  const assessment = ASSESSMENTS[assessmentKey];

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [result, setResult] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  if (!assessment) {
    return (
      <View style={s.centered}>
        <Text style={s.errorText}>Assessment not found</Text>
        <TouchableOpacity style={s.btn} onPress={() => router.back()}>
          <Text style={s.btnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleAnswer = (value: number) => {
    const newResponses = { ...responses, [assessment.questions[currentQuestion].id]: value };
    setResponses(newResponses);

    if (currentQuestion < assessment.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      const score = Object.values(newResponses).reduce((sum, val) => sum + val, 0);
      const interpretation = assessment.interpret(score);
      setResult({ score, ...interpretation });
    }
  };

  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    await supabase.from('assessments').insert({
      ...context,
      type: assessment.type,
      score: result.score,
      max_score: assessment.maxScore,
      responses,
    } as any);
    setSaving(false);
    router.replace('/(tabs)');
  };

  if (result) {
    return (
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <View style={s.card}>
          <Text style={s.resultScore}>{result.score}/{assessment.maxScore}</Text>
          <Text style={s.resultLevel}>{result.level}</Text>
          <Text style={s.resultMessage}>{result.message}</Text>

          <View style={s.suggestionsBox}>
            <Text style={s.suggestionsTitle}>What to do next:</Text>
            {result.suggestions.map((s: string, i: number) => (
              <Text key={i} style={styles.suggestion}>• {s}</Text>
            ))}
          </View>

          <TouchableOpacity style={s.btn} onPress={handleSave} disabled={saving}>
            <Text style={s.btnText}>{saving ? 'Saving...' : 'Save Result'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.btnOutline} onPress={() => router.replace('/(tabs)')}>
            <Text style={s.btnOutlineText}>Go to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  const question = assessment.questions[currentQuestion];
  const progress = ((currentQuestion + 1) / assessment.questions.length) * 100;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Progress */}
      <View style={s.progressRow}>
        <Text style={s.progressText}>Question {currentQuestion + 1} of {assessment.questions.length}</Text>
        <Text style={s.progressText}>{Math.round(progress)}%</Text>
      </View>
      <View style={s.progressBar}>
        <View style={[s.progressFill, { width: `${progress}%` }]} />
      </View>

      <View style={s.card}>
        <Text style={s.questionTitle}>{assessment.name}</Text>
        <Text style={s.questionText}>{question.text}</Text>

        {question.options.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={s.optionBtn}
            onPress={() => handleAnswer(option.value)}
          >
            <Text style={s.optionText}>{option.label}</Text>
          </TouchableOpacity>
        ))}

        {currentQuestion > 0 && (
          <TouchableOpacity style={s.btnOutline} onPress={() => setCurrentQuestion(currentQuestion - 1)}>
            <Text style={s.btnOutlineText}>Back</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  suggestion: { fontSize: 14, color: Colors.text, marginBottom: 6, lineHeight: 20 },
});

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  errorText: { fontSize: 20, fontWeight: '600', color: Colors.text, marginBottom: 16 },
  card: { backgroundColor: Colors.card, borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressText: { fontSize: 13, color: Colors.textSecondary },
  progressBar: { height: 8, backgroundColor: Colors.border, borderRadius: 4, marginBottom: 20, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 4 },
  questionTitle: { fontSize: 18, fontWeight: '600', color: Colors.text, marginBottom: 16 },
  questionText: { fontSize: 17, fontWeight: '500', color: Colors.text, marginBottom: 24, lineHeight: 24 },
  optionBtn: { borderWidth: 2, borderColor: Colors.border, borderRadius: 12, padding: 16, marginBottom: 10 },
  optionText: { fontSize: 15, color: Colors.text },
  resultScore: { fontSize: 48, fontWeight: '700', color: Colors.primary, textAlign: 'center', marginBottom: 8 },
  resultLevel: { fontSize: 22, fontWeight: '600', color: Colors.text, textAlign: 'center', marginBottom: 12 },
  resultMessage: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  suggestionsBox: { backgroundColor: '#eff6ff', borderLeftWidth: 4, borderLeftColor: Colors.primary, padding: 16, borderRadius: 8, marginBottom: 24 },
  suggestionsTitle: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: 10 },
  btn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  btnOutline: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  btnOutlineText: { color: Colors.text, fontWeight: '500', fontSize: 15 },
});
