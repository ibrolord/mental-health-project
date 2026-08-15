import { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  AppButton,
  AppCard,
  AppScreen,
  PageHeader,
  SectionHeader,
  appUiStyles,
} from '@/components/AppUI';
import { Colors } from '@/lib/constants';
import {
  FEEDBACK_EMAIL_URL,
  SUPPORT_EMAIL,
  SUPPORT_EMAIL_URL,
} from '@/lib/support';

const FAQS = [
  {
    question: 'Is MHtoolkit medical treatment or a diagnosis?',
    answer:
      'No. Published screeners keep their original scoring, but a score is not a diagnosis and still needs clinical context.',
  },
  {
    question: 'Why does one missed habit day not erase progress?',
    answer:
      'Formation time varies widely. MHtoolkit keeps current and best streaks plus total completions, so prior effort remains visible.',
  },
  {
    question: 'Do the mind games improve my brain?',
    answer:
      'No broad improvement is promised. They are short attention and working-memory tasks, not treatment or assessment.',
  },
  {
    question: 'Do sounds or special frequencies improve focus?',
    answer:
      'No special frequency is claimed. Local sounds are optional and preference-led.',
  },
  {
    question: 'What can an accountability partner see?',
    answer:
      'Only the categories you enable, and only as counts. Private text, assessment scores, mood notes, goal text, and habit names are blocked by the database.',
  },
  {
    question: 'Can I use MHtoolkit without a standard account?',
    answer:
      'Yes. Anonymous authenticated sessions receive the same owner-scoped privacy rules and are not automatically purged.',
  },
  {
    question: 'How do I export or delete my data?',
    answer:
      'Open Settings for a complete export or account deletion.',
  },
] as const;

export default function SupportScreen() {
  const router = useRouter();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const email = (subject?: string) => {
    const url = subject
      ? `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`
      : SUPPORT_EMAIL_URL;
    void Linking.openURL(url).catch(() =>
      Alert.alert('Email unavailable', `Contact ${SUPPORT_EMAIL}`)
    );
  };

  return (
    <AppScreen>
      <PageHeader
        eyebrow="Support"
        title="Answers and a real way to reach us."
        description="Get product help, report a problem, or review the evidence behind a feature."
        icon="life-buoy"
      />
      <View style={styles.contactGrid}>
        <Pressable
          accessibilityRole="button"
          onPress={() => email()}
          style={styles.contactCard}
        >
          <Feather name="mail" size={21} color={Colors.accent} />
          <Text style={styles.contactTitle}>Contact support</Text>
          <Text style={appUiStyles.muted}>{SUPPORT_EMAIL}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => email('MHtoolkit bug report')}
          style={styles.contactCard}
        >
          <Feather name="tool" size={21} color={Colors.accent} />
          <Text style={styles.contactTitle}>Report a bug</Text>
          <Text style={appUiStyles.muted}>
            Include device, app version, steps, and a screenshot.
          </Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send product feedback"
        accessibilityHint="Opens an email with feedback prompts"
        onPress={() => {
          void Linking.openURL(FEEDBACK_EMAIL_URL).catch(() =>
            Alert.alert('Email unavailable', `Contact ${SUPPORT_EMAIL}`)
          );
        }}
        style={[styles.contactCard, styles.feedbackCard]}
      >
        <Feather name="message-square" size={21} color={Colors.accent} />
        <View style={styles.feedbackCopy}>
          <Text style={[styles.contactTitle, styles.feedbackTitle]}>Send feedback</Text>
          <Text style={appUiStyles.muted}>
            Share an idea or tell us what could be better.
          </Text>
        </View>
        <Feather name="arrow-up-right" size={19} color={Colors.textSecondary} />
      </Pressable>
      <View style={styles.contactGrid}>
        <AppButton
          label="Research guide"
          icon="book-open"
          variant="secondary"
          onPress={() => router.push('/research')}
          style={{ flex: 1 }}
        />
        <AppButton
          label="Find support"
          icon="life-buoy"
          variant="secondary"
          onPress={() => router.push('/resources')}
          style={{ flex: 1 }}
        />
      </View>

      <SectionHeader title="Frequently asked questions" />
      <AppCard>
        {FAQS.map((faq, index) => {
          const open = openFaq === index;
          return (
            <View key={faq.question} style={styles.faq}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                onPress={() => setOpenFaq(open ? null : index)}
                style={styles.faqButton}
              >
                <Text style={styles.faqQuestion}>{faq.question}</Text>
                <Feather
                  name={open ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={Colors.primary}
                />
              </Pressable>
              {open ? <Text style={styles.faqAnswer}>{faq.answer}</Text> : null}
            </View>
          );
        })}
      </AppCard>
      <AppCard style={styles.urgent}>
        <Text style={styles.contactTitle}>Urgent support</Text>
        <Text style={appUiStyles.muted}>
          MHtoolkit does not provide crisis care. Use an official service for
          your country or contact local emergency services if someone is in
          immediate danger.
        </Text>
        <AppButton
          label="Open support directory"
          icon="arrow-right"
          onPress={() => router.push('/resources')}
          style={{ marginTop: 13, alignSelf: 'flex-start' }}
        />
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  contactGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  contactCard: {
    flex: 1,
    minHeight: 148,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 15,
  },
  feedbackCard: {
    minHeight: 86,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  feedbackCopy: { flex: 1 },
  feedbackTitle: { marginTop: 0 },
  contactTitle: {
    color: Colors.text,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 5,
  },
  faq: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  faqButton: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  faqQuestion: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },
  faqAnswer: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    paddingBottom: 15,
  },
  urgent: { backgroundColor: Colors.dangerLight, borderColor: '#efc5bc' },
});
