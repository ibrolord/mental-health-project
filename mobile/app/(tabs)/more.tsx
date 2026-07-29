import { Feather } from '@expo/vector-icons';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ComponentProps } from 'react';
import { useRouter } from 'expo-router';
import {
  AppScreen,
  PageHeader,
  SectionHeader,
  appUiStyles,
} from '@/components/AppUI';
import { Colors } from '@/lib/constants';

type FeatherName = ComponentProps<typeof Feather>['name'];
type Route =
  | '/goals'
  | '/habits'
  | '/planner'
  | '/focus'
  | '/ground'
  | '/meditate'
  | '/mind-games'
  | '/journal'
  | '/affirmations'
  | '/library'
  | '/partner'
  | '/resources'
  | '/research'
  | '/voice'
  | '/support'
  | '/settings';

const GROUPS: {
  title: string;
  items: {
    label: string;
    description: string;
    icon: FeatherName;
    route: Route;
  }[];
}[] = [
  {
    title: 'Plan and progress',
    items: [
      {
        label: 'Goals',
        description: 'Priorities and next steps',
        icon: 'check-circle',
        route: '/goals',
      },
      {
        label: 'Habits and routines',
        description: 'Cues, streaks, and rewards',
        icon: 'repeat',
        route: '/habits',
      },
      {
        label: 'Life planner',
        description: 'Dreams, fears, and time-bound plans',
        icon: 'map',
        route: '/planner',
      },
      {
        label: 'Focus mode',
        description: 'Time blocks with real breaks',
        icon: 'clock',
        route: '/focus',
      },
    ],
  },
  {
    title: 'Calm and reflect',
    items: [
      {
        label: 'Ground me now',
        description: 'Immediate guided grounding',
        icon: 'compass',
        route: '/ground',
      },
      {
        label: 'Meditation',
        description: 'Breathing and guided practices',
        icon: 'wind',
        route: '/meditate',
      },
      {
        label: 'Mind games',
        description: 'Five offline attention exercises',
        icon: 'grid',
        route: '/mind-games',
      },
      {
        label: 'Private journal',
        description: 'Freeform and guided notes',
        icon: 'edit-3',
        route: '/journal',
      },
      {
        label: 'Affirmations',
        description: 'Random affirmations and sourced quotes',
        icon: 'sun',
        route: '/affirmations',
      },
    ],
  },
  {
    title: 'Learn and connect',
    items: [
      {
        label: 'Library',
        description: 'Books, talks, and real stories',
        icon: 'book-open',
        route: '/library',
      },
      {
        label: 'Accountability',
        description: 'Share counts and celebrate progress',
        icon: 'users',
        route: '/partner',
      },
      {
        label: 'Find support',
        description: 'Country directories and communities',
        icon: 'life-buoy',
        route: '/resources',
      },
      {
        label: 'Research',
        description: 'Evidence and limitations',
        icon: 'file-text',
        route: '/research',
      },
      {
        label: 'Voice support',
        description: 'Talk with the AI companion',
        icon: 'mic',
        route: '/voice',
      },
      {
        label: 'Support and FAQ',
        description: 'Contact, bug reports, and answers',
        icon: 'help-circle',
        route: '/support',
      },
      {
        label: 'Settings',
        description: 'Account, privacy, export, and deletion',
        icon: 'settings',
        route: '/settings',
      },
    ],
  },
];

export default function MoreScreen() {
  const router = useRouter();
  return (
    <AppScreen>
      <PageHeader
        eyebrow="MHtoolkit"
        title="Everything in one place."
        description="Choose a tool based on what you need right now."
        icon="grid"
      />
      {GROUPS.map((group) => (
        <View key={group.title}>
          <SectionHeader title={group.title} />
          <View style={styles.group}>
            {group.items.map((item) => (
              <Pressable
                key={item.route}
                accessibilityRole="button"
                onPress={() => router.push(item.route)}
                style={({ pressed }) => [
                  styles.row,
                  pressed && { opacity: 0.76 },
                ]}
              >
                <View style={styles.icon}>
                  <Feather name={item.icon} size={19} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{item.label}</Text>
                  <Text style={appUiStyles.muted}>{item.description}</Text>
                </View>
                <Feather name="chevron-right" size={19} color={Colors.sage} />
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  group: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    backgroundColor: Colors.card,
    marginBottom: 10,
  },
  row: {
    minHeight: 75,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    marginBottom: 2,
  },
});
