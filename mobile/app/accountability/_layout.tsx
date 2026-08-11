import { Stack } from 'expo-router';

export default function AccountabilityLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Together' }}>
      <Stack.Screen name="index" options={{ title: 'Together' }} />
      <Stack.Screen name="invite" options={{ title: 'Invite a partner' }} />
      <Stack.Screen name="join" options={{ title: 'Join an invite' }} />
      <Stack.Screen name="create" options={{ title: 'Share a commitment' }} />
      <Stack.Screen name="[commitmentId]" options={{ title: 'Commitment' }} />
    </Stack>
  );
}
