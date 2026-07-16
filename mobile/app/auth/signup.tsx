import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/lib/constants';

export default function SignupScreen() {
  const router = useRouter();

  return (
    <View style={s.container}>
      <Text style={s.title}>Account Creation Unavailable</Text>
      <Text style={s.subtitle}>
        We are upgrading email verification before accepting new accounts. You can continue using MHtoolkit anonymously without losing access on this device.
      </Text>

      <TouchableOpacity style={s.btn} onPress={() => router.replace('/auth/login')}>
        <Text style={s.btnText}>Sign In to an Existing Account</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={{ marginTop: 16 }}>
        <Text style={s.link}>Continue anonymously</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 24, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  subtitle: { fontSize: 16, color: Colors.textSecondary, marginBottom: 32 },
  btn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  link: { color: Colors.primary, textAlign: 'center', fontSize: 15 },
});
