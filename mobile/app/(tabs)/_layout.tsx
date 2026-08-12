import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Radius } from '@/lib/constants';

export default function TabLayout() {
  const { fontScale } = useWindowDimensions();
  const hidesTabLabels = fontScale >= 1.35;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: Colors.card }}
      edges={['top', 'left', 'right']}
    >
      <Tabs
        screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarActiveBackgroundColor: Colors.primaryLight,
        tabBarHideOnKeyboard: true,
        tabBarAllowFontScaling: true,
        tabBarShowLabel: !hidesTabLabels,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 0,
        },
        tabBarIconStyle: { marginTop: 2 },
        tabBarItemStyle: {
          borderRadius: Radius.md,
          marginHorizontal: 3,
          marginVertical: 5,
        },
        tabBarStyle: {
          backgroundColor: Colors.card,
          borderTopColor: Colors.border,
          paddingTop: 2,
        },
        headerStyle: { backgroundColor: Colors.card },
        headerTintColor: Colors.text,
        headerShadowVisible: false,
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: '700',
        },
        }}
      >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tracker"
        options={{
          title: 'Mood',
          tabBarIcon: ({ color, size }) => (
            <Feather name="bar-chart-2" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Talk',
          tabBarIcon: ({ color, size }) => (
            <Feather name="message-circle" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="assessments"
        options={{
          title: 'Tools',
          tabBarIcon: ({ color, size }) => (
            <Feather name="briefcase" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'You',
          tabBarIcon: ({ color, size }) => (
            <Feather name="user" size={size} color={color} />
          ),
        }}
      />
      </Tabs>
    </SafeAreaView>
  );
}
