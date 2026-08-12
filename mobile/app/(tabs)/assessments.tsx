import { useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  AppScreen,
  DisclosureCard,
  ListRow,
  PageHeader,
  SectionHeader,
} from '@/components/AppUI';
import { Colors, Radius, Spacing, Typography } from '@/lib/constants';

type FeatherName = ComponentProps<typeof Feather>['name'];
type ToolRoute =
  | '/ground'
  | '/meditate'
  | '/yoga'
  | '/focus'
  | '/mind-games'
  | '/goals'
  | '/habits'
  | '/plans'
  | '/planner'
  | '/journal'
  | '/reflect'
  | '/affirmations'
  | '/library'
  | '/saved'
  | '/assessments/gad7'
  | '/assessments/phq9'
  | '/assessments/cbi';

const GROUPS: {
  title: string;
  description: string;
  icon: FeatherName;
  items: { title: string; description: string; icon: FeatherName; route: ToolRoute }[];
}[] = [
  {
    title: 'Calm and focus',
    description: 'Grounding, meditation, movement, and attention',
    icon: 'sun',
    items: [
      { title: 'Ground me now', description: 'One guided step at a time', icon: 'compass', route: '/ground' },
      { title: 'Meditation', description: 'Breathing and guided practices', icon: 'wind', route: '/meditate' },
      { title: 'Yoga', description: 'Gentle chair and floor movement', icon: 'activity', route: '/yoga' },
      { title: 'Focus mode', description: 'Time blocks with real breaks', icon: 'clock', route: '/focus' },
      { title: 'Attention games', description: 'Offline exercises, including math', icon: 'grid', route: '/mind-games' },
    ],
  },
  {
    title: 'Plan and reflect',
    description: 'Goals, routines, plans, and private writing',
    icon: 'flag',
    items: [
      { title: 'Goals', description: 'Milestones and next steps', icon: 'check-circle', route: '/goals' },
      { title: 'Habits and routines', description: 'Build or change a pattern', icon: 'repeat', route: '/habits' },
      { title: 'My plans', description: 'Activity, safety, and staying well', icon: 'clipboard', route: '/plans' },
      { title: 'Life planner', description: 'Time-bound dreams and priorities', icon: 'map', route: '/planner' },
      { title: 'Private journal', description: 'Freeform and guided notes', icon: 'edit-3', route: '/journal' },
      { title: 'Guided reflection', description: 'Research-informed prompts', icon: 'book-open', route: '/reflect' },
    ],
  },
  {
    title: 'Learn and assess',
    description: 'Published screeners and practical resources',
    icon: 'book-open',
    items: [
      { title: 'Anxiety pattern', description: 'GAD-7 · past 2 weeks', icon: 'activity', route: '/assessments/gad7' },
      { title: 'Depression pattern', description: 'PHQ-9 · past 2 weeks', icon: 'activity', route: '/assessments/phq9' },
      { title: 'Burnout pattern', description: 'Copenhagen Burnout Inventory', icon: 'activity', route: '/assessments/cbi' },
      { title: 'Library', description: 'Books, talks, stories, and templates', icon: 'book', route: '/library' },
      { title: 'Saved', description: 'Your resources and markers', icon: 'bookmark', route: '/saved' },
      { title: 'Affirmations', description: 'Affirmations and sourced quotes', icon: 'sunrise', route: '/affirmations' },
    ],
  },
];

export default function ToolsScreen() {
  const router = useRouter();
  const [openGroup, setOpenGroup] = useState(GROUPS[0].title);

  return (
    <AppScreen>
      <PageHeader
        eyebrow="Your toolkit"
        title="Choose what fits."
        description="Start with one practice. The rest can wait."
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Start grounding now"
        onPress={() => router.push('/ground')}
        style={({ pressed }) => [styles.featured, pressed && styles.pressed]}
      >
        <View style={styles.featuredIcon}>
          <Feather name="compass" size={22} color={Colors.card} />
        </View>
        <View style={styles.featuredCopy}>
          <Text style={styles.featuredEyebrow}>NEED SOMETHING NOW?</Text>
          <Text style={styles.featuredTitle}>Steady myself</Text>
          <Text style={styles.featuredDescription}>Begin a short grounding practice.</Text>
        </View>
        <Feather name="arrow-right" size={20} color={Colors.card} />
      </Pressable>

      <SectionHeader title="Browse" description="Open one group at a time" />
      {GROUPS.map((group) => (
        <DisclosureCard
          key={group.title}
          title={group.title}
          description={group.description}
          icon={group.icon}
          expanded={openGroup === group.title}
          onToggle={() => setOpenGroup((current) => current === group.title ? '' : group.title)}
        >
          <View style={styles.rows}>
            {group.items.map((item) => (
              <ListRow
                key={item.route}
                title={item.title}
                description={item.description}
                icon={item.icon}
                onPress={() => router.push(item.route)}
              />
            ))}
          </View>
        </DisclosureCard>
      ))}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  featured: {
    minHeight: 104,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
  },
  featuredIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredCopy: { flex: 1, minWidth: 0 },
  featuredEyebrow: { color: '#dce8e1', ...Typography.eyebrow, fontSize: 10 },
  featuredTitle: { color: Colors.card, ...Typography.cardTitle, fontSize: 20, marginTop: Spacing.xxs },
  featuredDescription: { color: '#dce8e1', ...Typography.bodySmall, marginTop: Spacing.xxs },
  rows: { marginTop: -Spacing.sm },
  pressed: { opacity: 0.78 },
});
