import { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  AppButton,
  AppCard,
  ChoiceChip,
  appUiStyles,
} from '@/components/AppUI';
import { Colors } from '@/lib/constants';

type SafetyRegion = 'canada' | 'us' | 'elsewhere';

function openAction(url: string) {
  void Linking.openURL(url).catch(() => {
    Alert.alert(
      'Could not open this action',
      'Use your phone app or open Find support for another option.'
    );
  });
}

export function LocalSafetyActions({
  onDismiss,
}: {
  onDismiss?: () => void;
}) {
  const router = useRouter();
  const [region, setRegion] = useState<SafetyRegion | null>(null);

  return (
    <AppCard style={styles.card}>
      <View style={styles.header}>
        <View style={styles.icon}>
          <Feather name="life-buoy" size={18} color={Colors.danger} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>Reach someone now</Text>
          <Text style={appUiStyles.muted}>
            If you or someone else may be in immediate danger, call local
            emergency services.
          </Text>
        </View>
        {onDismiss ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close urgent support options"
            onPress={onDismiss}
            style={styles.dismiss}
          >
            <Feather name="x" size={19} color={Colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.label}>Choose your region</Text>
      <View style={styles.chips}>
        <ChoiceChip
          label="Canada"
          selected={region === 'canada'}
          onPress={() => setRegion('canada')}
        />
        <ChoiceChip
          label="United States"
          selected={region === 'us'}
          onPress={() => setRegion('us')}
        />
        <ChoiceChip
          label="Elsewhere"
          selected={region === 'elsewhere'}
          onPress={() => setRegion('elsewhere')}
        />
      </View>

      {region === 'canada' || region === 'us' ? (
        <View style={styles.actions}>
          <AppButton
            label="Call 988"
            icon="phone"
            onPress={() => openAction('tel:988')}
            style={styles.action}
          />
          <AppButton
            label="Text 988"
            icon="message-square"
            variant="secondary"
            onPress={() => openAction('sms:988')}
            style={styles.action}
          />
        </View>
      ) : region === 'elsewhere' ? (
        <AppButton
          label="Find local crisis support"
          icon="map-pin"
          onPress={() =>
            router.push({ pathname: '/resources', params: { category: 'country' } })
          }
        />
      ) : null}

      <View style={styles.secondaryActions}>
        <AppButton
          label="Open my safety plan"
          icon="shield"
          variant="quiet"
          onPress={() =>
            router.push({ pathname: '/plans', params: { view: 'safety' } })
          }
          style={styles.secondaryAction}
        />
        <AppButton
          label="View all support"
          icon="arrow-right"
          variant="quiet"
          onPress={() => router.push('/resources')}
          style={styles.secondaryAction}
        />
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderColor: '#e3b5a9',
    backgroundColor: Colors.dangerLight,
    marginHorizontal: 12,
    marginTop: 10,
    padding: 14,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fffef8',
  },
  copy: { flex: 1 },
  title: { color: Colors.text, fontSize: 17, lineHeight: 22, fontWeight: '700' },
  dismiss: {
    width: 44,
    height: 44,
    marginRight: -10,
    marginTop: -8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 7,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  action: { flex: 1 },
  secondaryActions: { gap: 8, marginTop: 12 },
  secondaryAction: { justifyContent: 'flex-start' },
});
