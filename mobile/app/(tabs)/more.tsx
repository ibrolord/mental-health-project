import { Feather } from '@expo/vector-icons';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useState, type ComponentProps } from 'react';
import { useRouter } from 'expo-router';
import {
  AppScreen,
  PageHeader,
  appUiStyles,
} from '@/components/AppUI';
import { Colors } from '@/lib/constants';

type FeatherName = ComponentProps<typeof Feather>['name'];
type Route =
  | '/goals'
  | '/habits'
  | '/plans'
  | '/planner'
  | '/focus'
  | '/ground'
  | '/meditate'
  | '/yoga'
  | '/mind-games'
  | '/journal'
  | '/reflect'
  | '/saved'
  | '/affirmations'
  | '/library'
  | '/partner'
  | '/accountability'
  | '/resources'
  | '/research'
  | '/voice'
  | '/support'
  | '/settings';

const GROUPS: {
  title: string;
  description: string;
  icon: FeatherName;
  items: {
    label: string;
    description: string;
    icon: FeatherName;
    route: Route;
  }[];
}[] = [
  {
    title: 'Plan and progress',
    description: 'Goals, routines, and focused action',
    icon: 'trending-up',
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
        label: 'My plans',
        description: 'Activity, safety, and staying well',
        icon: 'clipboard',
        route: '/plans',
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
    description: 'Grounding, movement, and private reflection',
    icon: 'sun',
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
        label: 'Yoga',
        description: 'Gentle chair and floor movement',
        icon: 'activity',
        route: '/yoga',
      },
      {
        label: 'Mind games',
        description: 'Six offline attention exercises',
        icon: 'grid',
        route: '/mind-games',
      },
      {
        label: 'Guided reflection',
        description: 'Structured private prompts',
        icon: 'book-open',
        route: '/reflect',
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
    description: 'Guidance, people, and trusted support',
    icon: 'compass',
    items: [
      {
        label: 'Library',
        description: 'Books, talks, and real stories',
        icon: 'book-open',
        route: '/library',
      },
      {
        label: 'Saved',
        description: 'Resources and important markers',
        icon: 'bookmark',
        route: '/saved',
      },
      {
        label: 'Accountability',
        description: 'Share counts and celebrate progress',
        icon: 'users',
        route: '/partner',
      },
      {
        label: 'Together',
        description: 'Shared commitments with someone you trust',
        icon: 'heart',
        route: '/accountability',
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
  const [openGroup, setOpenGroup] = useState<string | null>('Calm and reflect');

  return (
    <AppScreen>
      <PageHeader
        eyebrow="MHtoolkit"
        title="Find the right tool."
        description="Open a section, choose one next step, and leave the rest for later."
        icon="grid"
      />
      {GROUPS.map((group) => (
        <View key={group.title} style={styles.group}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: openGroup === group.title }}
            accessibilityLabel={`${group.title}, ${group.items.length} tools`}
            accessibilityHint={
              openGroup === group.title
                ? 'Collapses this group'
                : 'Expands this group'
            }
            onPress={() => {
              setOpenGroup((current) =>
                current === group.title ? null : group.title
              );
            }}
            style={({ pressed }) => [
              styles.groupHeader,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.groupIcon}>
              <Feather name={group.icon} size={19} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.groupTitle}>{group.title}</Text>
              <Text style={styles.groupDescription}>{group.description}</Text>
            </View>
            <View style={styles.groupCount}>
              <Text style={styles.groupCountText}>{group.items.length}</Text>
            </View>
            <Feather
              name={openGroup === group.title ? 'chevron-up' : 'chevron-down'}
              size={19}
              color={Colors.sage}
            />
          </Pressable>
          {openGroup === group.title ? (
            <View style={styles.groupItems}>
              {group.items.map((item, index) => (
                <Pressable
                  key={item.route}
                  accessibilityRole="button"
                  onPress={() => router.push(item.route)}
                  style={({ pressed }) => [
                    styles.row,
                    index === group.items.length - 1 && styles.lastRow,
                    pressed && styles.pressed,
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
          ) : null}
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
    marginBottom: 12,
    shadowColor: '#163a32',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  groupHeader: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  groupIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupTitle: {
    color: Colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  groupDescription: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  groupCount: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupCountText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  groupItems: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  row: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  lastRow: { borderBottomWidth: 0 },
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
  pressed: { opacity: 0.72 },
});
