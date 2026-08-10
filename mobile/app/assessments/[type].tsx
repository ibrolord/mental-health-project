import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ASSESSMENTS,
  hasPositivePhq9SafetyResponse,
} from '@/lib/assessments/definitions';
import type { Assessment } from '@/lib/assessments/types';
import { supabase } from '@/lib/supabase';
import { useDataContext } from '@/lib/hooks/use-data-context';
import { Colors } from '@/lib/constants';
import { goBackOrReplace } from '@/lib/navigation';

type AssessmentResult = ReturnType<Assessment['interpret']> & {
  score: number;
};

function SafetySupport() {
  return (
    <View style={s.crisisBox}>
      <Text style={s.crisisTitle}>Please pause and check your safety</Text>
      <Text style={s.crisisText}>
        You reported thoughts of being better off dead or hurting yourself. This answer does not
        show whether you intend to act, so it should be followed up directly with a qualified
        professional.
      </Text>
      <Text style={s.crisisStrong}>
        If you may act on these thoughts or cannot stay safe, call your local emergency number now
        or go to the nearest emergency department. In the U.S. or Canada, call or text 988.
      </Text>
      <View style={s.crisisActions}>
        <TouchableOpacity style={s.crisisPrimary} onPress={() => Linking.openURL('tel:988')}>
          <Text style={s.crisisPrimaryText}>Call 988</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.crisisSecondary} onPress={() => Linking.openURL('sms:988')}>
          <Text style={s.crisisSecondaryText}>Text 988</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function AssessmentTakeScreen() {
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type: string }>();
  const { context } = useDataContext();
  const assessmentKey = (type?.toUpperCase() || '') as keyof typeof ASSESSMENTS;
  const assessment = ASSESSMENTS[assessmentKey];

  const [started, setStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!assessment) {
    return (
      <View style={s.centered}>
        <Text style={s.errorText}>Assessment not found</Text>
        <TouchableOpacity
          style={s.btn}
          onPress={() => goBackOrReplace(router, '/(tabs)/assessments')}
        >
          <Text style={s.btnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const functioningQuestion = assessment.functioningQuestion;
  const questions = functioningQuestion
    ? [...assessment.questions, functioningQuestion]
    : assessment.questions;
  const question = questions[currentQuestion];
  const selectedValue = question ? responses[question.id] : undefined;
  const showSafetySupport = hasPositivePhq9SafetyResponse(assessment, responses);
  const functioningResponse = functioningQuestion
    ? functioningQuestion.options.find(
        (option) => option.value === responses[functioningQuestion.id]
      )?.label
    : undefined;

  const handleNext = () => {
    if (!question || selectedValue === undefined) return;
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion((current) => current + 1);
      return;
    }

    const score = assessment.calculateScore(responses);
    setResult({ score, ...assessment.interpret(score) });
  };

  const handleBack = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion((current) => current - 1);
    } else {
      setStarted(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;

    setSaving(true);
    setSaveError(null);
    const { error } = await supabase.from('assessments').insert({
      ...context,
      type: assessment.type,
      score: result.score,
      max_score: assessment.maxScore,
      responses,
    } as any);

    if (error) {
      console.error('Error saving assessment:', error);
      setSaveError('Your result was not saved. Try again or continue without saving.');
      setSaving(false);
      return;
    }

    router.replace('/(tabs)');
  };

  if (!started) {
    return (
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <TouchableOpacity
          onPress={() => goBackOrReplace(router, '/(tabs)/assessments')}
          style={s.backLink}
        >
          <Text style={s.backLinkText}>Back to assessments</Text>
        </TouchableOpacity>

        <View style={s.card}>
          <Text style={s.eyebrow}>{assessment.measureType}</Text>
          <Text style={s.introTitle}>{assessment.name}</Text>
          <Text style={s.introDescription}>{assessment.description}</Text>

          <View style={s.facts}>
            <View style={s.fact}>
              <Text style={s.factLabel}>RECALL PERIOD</Text>
              <Text style={s.factValue}>{assessment.timeframe}</Text>
            </View>
            <View style={s.fact}>
              <Text style={s.factLabel}>LENGTH</Text>
              <Text style={s.factValue}>
                {assessment.functioningQuestion
                  ? `${assessment.questions.length} scored + 1 impact`
                  : `${assessment.questions.length} questions`}
              </Text>
            </View>
          </View>

          <Text style={s.sectionTitle}>Use the same frame for every answer</Text>
          <Text style={s.instructions}>{assessment.instructions}</Text>

          <View style={s.disclaimerBox}>
            <Text style={s.disclaimerTitle}>Before you begin</Text>
            <Text style={s.disclaimerText}>
              This tool cannot diagnose a condition, identify the cause of symptoms, or recommend
              treatment. A qualified professional considers your history, functioning, physical
              health, medications, and context. You choose whether to save the result. Seek a
              doctor&apos;s advice in addition to using this app and before making medical decisions.
            </Text>
          </View>

          <Text style={s.scoreMeaning}>{assessment.scoreMeaning}</Text>
          <TouchableOpacity onPress={() => Linking.openURL(assessment.citationUrl)}>
            <Text style={s.sourceLink}>Read the published source</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.btn} onPress={() => setStarted(true)}>
            <Text style={s.btnText}>Begin</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if (result) {
    return (
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <View style={s.card}>
          <Text style={s.eyebrow}>YOUR RESULT</Text>
          <Text style={s.resultScore}>
            {result.score}/{assessment.maxScore}
          </Text>
          <Text style={s.resultLevel}>{result.level}</Text>

          <Text style={s.sectionTitle}>What this score means</Text>
          <Text style={s.resultMessage}>{result.message}</Text>

          {showSafetySupport && <SafetySupport />}

          {functioningResponse && (
            <View style={s.functioningBox}>
              <Text style={s.functioningTitle}>Daily-life impact</Text>
              <Text style={s.functioningValue}>{functioningResponse}</Text>
              <Text style={s.functioningText}>
                This context answer is part of the published form but is not included in the total
                score.
              </Text>
            </View>
          )}

          <View style={s.suggestionsBox}>
            <Text style={s.suggestionsTitle}>Reasonable next steps</Text>
            {result.suggestions.map((item) => (
              <Text key={item} style={s.suggestion}>
                {'\u2022'} {item}
              </Text>
            ))}
          </View>

          <View style={s.sourceBox}>
            <Text style={s.sourceTitle}>Important limitation</Text>
            <Text style={s.sourceText}>
              Screening scores are one piece of information. They do not diagnose, rule out other
              causes, or replace an assessment by a doctor or licensed mental health professional.
            </Text>
            <TouchableOpacity onPress={() => Linking.openURL(assessment.citationUrl)}>
              <Text style={s.sourceLink}>Published source</Text>
            </TouchableOpacity>
          </View>

          {saveError && <Text style={s.saveError}>{saveError}</Text>}

          <TouchableOpacity style={s.btn} onPress={handleSave} disabled={saving}>
            <Text style={s.btnText}>{saving ? 'Saving...' : 'Save result'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.btnOutline} onPress={() => router.replace('/(tabs)')}>
            <Text style={s.btnOutlineText}>Continue without saving</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  const progress = ((currentQuestion + 1) / questions.length) * 100;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.progressRow}>
        <Text style={s.progressText}>
          Question {currentQuestion + 1} of {questions.length}
        </Text>
        <Text style={s.progressText}>{Math.round(progress)}%</Text>
      </View>
      <View style={s.progressBar}>
        <View style={[s.progressFill, { width: `${progress}%` }]} />
      </View>

      <View style={s.card}>
        <Text style={s.instructionsSmall}>
          {question.contextLabel ?? assessment.instructions}
        </Text>
        <Text style={s.questionText}>{question.text}</Text>

        {question.options.map((option) => {
          const isSelected = selectedValue === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[s.optionBtn, isSelected && s.optionBtnSelected]}
              onPress={() =>
                setResponses((current) => ({ ...current, [question.id]: option.value }))
              }
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
            >
              <Text style={[s.optionText, isSelected && s.optionTextSelected]}>
                {option.label}
              </Text>
              <View style={[s.radio, isSelected && s.radioSelected]}>
                {isSelected && <Text style={s.radioCheck}>✓</Text>}
              </View>
            </TouchableOpacity>
          );
        })}

        {showSafetySupport && <SafetySupport />}

        <View style={s.navRow}>
          <TouchableOpacity
            style={[s.btnOutline, s.navButton]}
            accessibilityRole="button"
            accessibilityLabel="Previous assessment question"
            onPress={handleBack}
          >
            <Text style={s.btnOutlineText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.btn, s.navButton, selectedValue === undefined && s.btnDisabled]}
            onPress={handleNext}
            disabled={selectedValue === undefined}
          >
            <Text style={s.btnText}>
              {currentQuestion === questions.length - 1 ? 'See result' : 'Next'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f1e8' },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  errorText: { fontSize: 20, fontWeight: '600', color: Colors.text, marginBottom: 16 },
  backLink: { marginBottom: 16 },
  backLinkText: { color: '#173f38', fontSize: 15, fontWeight: '600' },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    padding: 22,
    shadowColor: '#173f38',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  eyebrow: {
    color: '#287264',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  introTitle: { fontSize: 29, fontWeight: '700', color: Colors.text, lineHeight: 36 },
  introDescription: {
    color: Colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  facts: { flexDirection: 'row', gap: 10, marginVertical: 22 },
  fact: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 12, padding: 12 },
  factLabel: { color: Colors.textSecondary, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  factValue: { color: Colors.text, fontSize: 14, fontWeight: '600', marginTop: 5 },
  sectionTitle: { color: Colors.text, fontSize: 17, fontWeight: '700', marginTop: 18 },
  instructions: { color: Colors.text, fontSize: 17, lineHeight: 25, marginTop: 8 },
  instructionsSmall: {
    color: '#287264',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    marginBottom: 14,
  },
  disclaimerBox: {
    backgroundColor: '#fff7ed',
    borderLeftWidth: 4,
    borderLeftColor: '#b45309',
    padding: 14,
    borderRadius: 10,
    marginTop: 22,
  },
  disclaimerTitle: { fontSize: 15, fontWeight: '700', color: '#78350f', marginBottom: 6 },
  disclaimerText: { fontSize: 13, color: '#78350f', lineHeight: 19 },
  scoreMeaning: { color: Colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 20 },
  sourceLink: { fontSize: 13, color: '#287264', fontWeight: '600', marginTop: 10 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressText: { fontSize: 13, color: Colors.textSecondary },
  progressBar: {
    height: 8,
    backgroundColor: '#dbe4df',
    borderRadius: 4,
    marginBottom: 20,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#287264', borderRadius: 4 },
  questionText: {
    fontSize: 22,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 24,
    lineHeight: 30,
  },
  optionBtn: {
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionBtnSelected: { borderColor: '#173f38', backgroundColor: '#ecfdf5' },
  optionText: { fontSize: 15, color: Colors.text, fontWeight: '500', flex: 1 },
  optionTextSelected: { color: '#173f38' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: '#cbd5e1' },
  radioSelected: {
    borderColor: '#173f38',
    backgroundColor: '#173f38',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCheck: { color: '#fff', fontSize: 12, fontWeight: '700' },
  resultScore: { fontSize: 52, fontWeight: '700', color: '#173f38', marginTop: 4 },
  resultLevel: { fontSize: 21, fontWeight: '600', color: Colors.text, marginTop: 6 },
  resultMessage: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22, marginTop: 8 },
  crisisBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 2,
    borderColor: '#b91c1c',
    padding: 16,
    borderRadius: 14,
    marginTop: 22,
  },
  crisisTitle: { fontSize: 16, fontWeight: '700', color: '#7f1d1d', marginBottom: 8 },
  crisisText: { fontSize: 14, color: '#7f1d1d', lineHeight: 20 },
  crisisStrong: { fontSize: 14, color: '#7f1d1d', lineHeight: 20, fontWeight: '600', marginTop: 8 },
  crisisActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  crisisPrimary: { backgroundColor: '#991b1b', borderRadius: 9, paddingVertical: 10, paddingHorizontal: 18 },
  crisisPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  crisisSecondary: { borderWidth: 1, borderColor: '#991b1b', borderRadius: 9, paddingVertical: 10, paddingHorizontal: 18 },
  crisisSecondaryText: { color: '#991b1b', fontSize: 14, fontWeight: '700' },
  suggestionsBox: { backgroundColor: '#eff6ff', padding: 16, borderRadius: 12, marginTop: 22 },
  functioningBox: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    padding: 16,
    borderRadius: 12,
    marginTop: 22,
  },
  functioningTitle: { fontSize: 16, fontWeight: '700', color: '#14532d' },
  functioningValue: { fontSize: 18, fontWeight: '600', color: '#14532d', marginTop: 7 },
  functioningText: { fontSize: 13, color: '#166534', lineHeight: 19, marginTop: 5 },
  suggestionsTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 10 },
  suggestion: { fontSize: 14, color: Colors.text, marginBottom: 7, lineHeight: 20 },
  sourceBox: { backgroundColor: '#f8fafc', padding: 14, borderRadius: 12, marginTop: 18 },
  sourceTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 6 },
  sourceText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  saveError: { color: '#991b1b', backgroundColor: '#fef2f2', padding: 12, borderRadius: 10, marginTop: 16 },
  btn: {
    backgroundColor: '#173f38',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  btnOutline: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  btnOutlineText: { color: Colors.text, fontWeight: '500', fontSize: 15 },
  navRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  navButton: { flex: 1 },
});
