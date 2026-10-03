import { useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { AppButton, AppCard, AppScreen, ListRow, PageHeader, SupportAction } from '@/components/AppUI';
import { GuidedPractice } from '@/components/GuidedPractice';
import { VisualFocus } from '@/components/VisualFocus';
import { useRouter } from 'expo-router';
import { BODY_PRACTICES, type BodyPractice } from '@/lib/body-practices';
import { Colors, Typography } from '@/lib/constants';

export default function BodyPracticesScreen() {
  const router = useRouter();
  const focused = useIsFocused();
  const [selected, setSelected] = useState<BodyPractice['id'] | 'visual-focus' | null>(null);
  const practice = BODY_PRACTICES.find((item) => item.id === selected);
  return <AppScreen>
    {!selected ? <PageHeader eyebrow="A little room to settle" title="Body practices" description="Choose what feels comfortable. You can stop at any time." action={<SupportAction onPress={() => router.push('/resources')} />} /> : null}
    {selected ? <AppButton label="All body practices" icon="arrow-left" variant="quiet" onPress={() => setSelected(null)} /> : null}
    {!selected ? <>
      <AppCard quiet>
        {BODY_PRACTICES.map((item) => <ListRow key={item.id} title={item.title} description={`${Math.ceil(item.steps.reduce((total, step) => total + step.seconds, 0) / 60)} min · ${item.description}`} icon={item.id === 'muscle-release' ? 'activity' : 'wind'} onPress={() => setSelected(item.id)} />)}
        <ListRow title="Visual focus" description="30 seconds · A moving or still visual anchor, not EMDR therapy" icon="eye" onPress={() => setSelected('visual-focus')} />
      </AppCard>
      <Text style={styles.note}>These practices work offline. Session progress is not saved when you leave.</Text>
      <AppButton label="Prefer sensory grounding?" variant="quiet" onPress={() => router.push('/ground')} />
    </> : null}
    {selected === 'visual-focus' && focused ? <>
      <VisualFocus />
      <AppButton label="About EMDR treatment" variant="quiet" icon="external-link" onPress={() => openSource('https://www.ptsd.va.gov/understand_tx/emdr.asp')} />
    </> : null}
    {practice ? <View style={{ gap: 16 }}>
      <AppCard quiet>
        <Text style={styles.title}>{practice.title}</Text>
        <Text style={styles.note}>{practice.description}</Text>
        <Text style={styles.note}>{practice.note}</Text>
      </AppCard>
      {focused ? <GuidedPractice key={practice.id} steps={practice.steps} startLabel="Begin practice" pauseInstruction="Release any tension and breathe normally. Resume only when comfortable." /> : null}
      <AppButton label="Stop and return" icon="square" variant="secondary" onPress={() => setSelected(null)} />
      <AppButton label={practice.source.label} variant="quiet" icon="external-link" onPress={() => openSource(practice.source.url)} />
    </View> : null}
  </AppScreen>;
}

function openSource(url: string) {
  void Linking.openURL(url).catch(() => Alert.alert('Could not open the source', 'Try again when you are online.'));
}

const styles = StyleSheet.create({
  title: { ...Typography.displaySmall, color: Colors.text },
  note: { ...Typography.body, color: Colors.textSecondary, marginTop: 12, marginBottom: 12 },
});
