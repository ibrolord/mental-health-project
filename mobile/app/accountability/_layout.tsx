import { Stack } from 'expo-router';
import { AppBackButton } from '@/components/AppBackButton';

export default function AccountabilityLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={togetherScreenOptions('Together', '/(tabs)')} />
      <Stack.Screen name="invite" options={togetherScreenOptions('Invite a partner')} />
      <Stack.Screen name="join" options={togetherScreenOptions('Join an invite')} />
      <Stack.Screen name="create" options={togetherScreenOptions('Share a commitment')} />
      <Stack.Screen name="[commitmentId]" options={togetherScreenOptions('Commitment')} />
    </Stack>
  );
}

function togetherScreenOptions(
  title: string,
  fallback: '/(tabs)' | '/accountability' = '/accountability'
) {
  return {
    headerBackTitle: 'Back',
    headerLeft: () => <AppBackButton fallback={fallback} />,
    headerStyle: { backgroundColor: '#fffef8' },
    headerTintColor: '#163a32',
    title,
  };
}
