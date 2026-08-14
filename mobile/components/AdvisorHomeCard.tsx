import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { AdvisorRecommendation } from '@/lib/advisor-core';
import { Colors, Radius, Spacing, Typography } from '@/lib/constants';

type AdvisorHomeCardProps = {
  recommendation: AdvisorRecommendation;
  showChangeSignal: boolean;
  busy: boolean;
  pendingFeedback: boolean;
  onStart: () => void;
  onTryAnother: () => void;
  onAnswerFeedback: (helpful: boolean | null) => void;
};

const SOURCE_LABELS: Record<string, string> = {
  'Mood check-in': 'Mood',
  'Mood check-ins': 'Mood',
  Goal: 'Goal',
  Goals: 'Goal',
  Habit: 'Habit',
  Habits: 'Habit',
  'Apple Health summary': 'Apple Health',
};

function headingFromAction(action: string): string {
  return action.trim().split(/[.!?]/, 1)[0] || 'Take one small step';
}

export function AdvisorHomeCard({
  recommendation,
  showChangeSignal,
  busy,
  pendingFeedback,
  onStart,
  onTryAnother,
  onAnswerFeedback,
}: AdvisorHomeCardProps) {
  const [whyExpanded, setWhyExpanded] = useState(false);
  const sourceLabels = recommendation.sourceLabels.map(
    (label) => SOURCE_LABELS[label] ?? label
  );
  const provenance = sourceLabels.length
    ? `Based on ${Array.from(new Set(sourceLabels)).join(' · ')}`
    : 'General guidance · no personal context used';
  const observations = recommendation.observations.slice(0, 3);
  const changeLine =
    showChangeSignal && recommendation.changeSignal?.severity === 'notable'
      ? recommendation.changeSignal.line
      : null;

  return (
    <View style={styles.card}>
      <View pointerEvents="none" style={styles.artwork}>
        <Image
          accessible={false}
          source={require('../assets/today-botanical.png')}
          resizeMode="cover"
          style={StyleSheet.absoluteFillObject}
        />
      </View>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>FOR RIGHT NOW</Text>
        {changeLine ? (
          <Text accessibilityLabel={`Notable change: ${changeLine}`} style={styles.changeLine}>
            {changeLine}
          </Text>
        ) : null}
        <Text accessibilityRole="header" style={styles.heading}>
          {headingFromAction(recommendation.action)}
        </Text>
        <Text style={styles.sourceLine}>{provenance}</Text>

        {pendingFeedback ? (
          <View accessibilityRole="summary" style={styles.completionPrompt}>
            <Text style={styles.promptTitle}>Was this suggestion useful?</Text>
            <View style={styles.promptActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Yes, this suggestion was useful"
                disabled={busy}
                onPress={() => onAnswerFeedback(true)}
                style={({ pressed }) => [
                  styles.answerButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.answerButtonText}>Yes</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="This recommendation did not help"
                disabled={busy}
                onPress={() => onAnswerFeedback(false)}
                style={({ pressed }) => [
                  styles.answerButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.answerButtonText}>Not for me</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Skip recommendation feedback"
                disabled={busy}
                onPress={() => onAnswerFeedback(null)}
                style={({ pressed }) => [
                  styles.answerButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.answerButtonText}>Skip</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${recommendation.resourceLabel}: ${recommendation.action}`}
            accessibilityState={{ disabled: busy, busy }}
            disabled={busy}
            onPress={onStart}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>{recommendation.resourceLabel}</Text>
            <Feather accessible={false} name="arrow-right" size={17} color={Colors.card} />
          </Pressable>
        )}

        {recommendation.kind === 'standard' || observations.length ? (
          <View style={styles.quietActions}>
            {recommendation.kind === 'standard' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Try another Advisor recommendation"
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                onPress={onTryAnother}
                style={({ pressed }) => [styles.quietButton, pressed && styles.pressed]}
              >
                <Text style={styles.quietButtonText}>Try something else</Text>
              </Pressable>
            ) : null}
            {observations.length ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={whyExpanded ? 'Hide why this was suggested' : 'Why this was suggested'}
                accessibilityState={{ expanded: whyExpanded }}
                onPress={() => setWhyExpanded((current) => !current)}
                style={({ pressed }) => [styles.quietButton, pressed && styles.pressed]}
              >
                <Text style={styles.quietButtonText}>Why this?</Text>
                <Feather
                  accessible={false}
                  name={whyExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={Colors.primary}
                />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {whyExpanded && observations.length ? (
          <View accessibilityRole="summary" style={styles.whyPanel}>
            {observations.map((observation, index) => (
              <Text
                key={`${index}:${observation}`}
                style={[styles.whyText, index > 0 && styles.whyTextSpacing]}
              >
                {observation}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 210,
    overflow: 'hidden',
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceParchment,
    marginBottom: Spacing.xl,
  },
  artwork: { ...StyleSheet.absoluteFillObject },
  content: { minHeight: 210, padding: Spacing.md, justifyContent: 'center' },
  eyebrow: { color: Colors.accent, ...Typography.eyebrow, marginBottom: Spacing.xs },
  changeLine: {
    maxWidth: '86%',
    color: Colors.textSecondary,
    ...Typography.caption,
    lineHeight: 18,
    marginBottom: Spacing.xs,
  },
  heading: {
    maxWidth: '76%',
    color: Colors.text,
    fontFamily: 'Georgia',
    fontSize: 23,
    fontWeight: '700',
    lineHeight: 29,
  },
  primaryButton: {
    minHeight: 44,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    marginTop: Spacing.sm,
  },
  primaryButtonText: { color: Colors.card, ...Typography.label, flexShrink: 1 },
  quietActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.xs },
  quietButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xxs,
    paddingHorizontal: Spacing.xs,
  },
  quietButtonText: { color: Colors.primary, ...Typography.label, flexShrink: 1 },
  sourceLine: {
    maxWidth: '86%',
    color: Colors.textSecondary,
    ...Typography.caption,
    lineHeight: 18,
    marginTop: Spacing.xxs,
  },
  whyPanel: { maxWidth: '86%' },
  whyText: { color: Colors.textSecondary, ...Typography.bodySmall, lineHeight: 19 },
  whyTextSpacing: { marginTop: Spacing.xs },
  completionPrompt: { marginTop: Spacing.sm },
  promptTitle: { color: Colors.text, ...Typography.cardTitle },
  promptActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.xs },
  answerButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  answerButtonText: { color: Colors.primary, ...Typography.label },
  pressed: { opacity: 0.72 },
});
