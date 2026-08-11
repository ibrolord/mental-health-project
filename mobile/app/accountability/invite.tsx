import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/lib/constants';
import { accountabilityClient } from '@/lib/accountability/runtime';
import { accountabilityInviteUrl, saveAccountabilityInvite } from '@/lib/accountability/invite-storage';

export default function InvitePartnerScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [invitedEmail, setInvitedEmail] = useState('');

  const submit = async () => {
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      const connection = await accountabilityClient.createConnection({ inviteeEmail: email.trim().toLowerCase() });
      if (!connection.inviteToken) throw new Error('The invite link was not returned. Please cancel and try again.');
      const normalizedEmail = email.trim().toLowerCase();
      await saveAccountabilityInvite({ connectionId: connection.id, token: connection.inviteToken, partnerEmail: normalizedEmail, expiresAt: connection.inviteExpiresAt });
      setInvitedEmail(normalizedEmail);
      setInviteLink(accountabilityInviteUrl(connection.inviteToken));
    } catch (error) {
      Alert.alert('Invite not created', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{inviteLink ? 'Invite ready' : 'Invite someone you trust'}</Text>
          {inviteLink ? (
            <View style={styles.readyCard}>
              <Text style={styles.body}>Only {invitedEmail} can accept this invite.</Text>
              <Text selectable style={styles.linkText}>{inviteLink}</Text>
              <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => void Share.share({ message: `Join me on MHtoolkit Together: ${inviteLink}` })}><Text style={styles.buttonText}>Share invite</Text></TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" style={styles.doneButton} onPress={() => router.back()}><Text style={styles.doneButtonText}>Done</Text></TouchableOpacity>
            </View>
          ) : <>
          <Text style={styles.body}>They will only see commitments you explicitly share in Together. Your other MHtoolkit data stays private.</Text>
          <Text style={styles.label}>Partner email</Text>
          <TextInput
            accessibilityLabel="Partner email"
            accessibilityHint="Enter the email address your partner uses for MHtoolkit"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="partner@example.com"
            placeholderTextColor={Colors.textSecondary}
            returnKeyType="send"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            onSubmitEditing={() => void submit()}
          />
          <TouchableOpacity accessibilityRole="button" disabled={submitting || !email.trim()} style={[styles.button, (submitting || !email.trim()) && styles.disabled]} onPress={() => void submit()}>
            <Text style={styles.buttonText}>{submitting ? 'Creating invite…' : 'Create invite'}</Text>
          </TouchableOpacity>
          </>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: Colors.background, flex: 1 },
  content: { padding: 20 },
  title: { color: Colors.text, fontSize: 24, fontWeight: '700' },
  body: { color: Colors.textSecondary, fontSize: 15, lineHeight: 22, marginBottom: 28, marginTop: 8 },
  label: { color: Colors.text, fontSize: 14, fontWeight: '600', marginBottom: 7 },
  input: { backgroundColor: Colors.card, borderColor: Colors.border, borderRadius: 12, borderWidth: 1, color: Colors.text, fontSize: 16, padding: 14 },
  button: { alignItems: 'center', backgroundColor: Colors.primary, borderRadius: 12, marginTop: 18, paddingVertical: 15 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  readyCard: { marginTop: 18 },
  linkText: { backgroundColor: Colors.card, borderColor: Colors.border, borderRadius: 10, borderWidth: 1, color: Colors.textSecondary, fontSize: 12, lineHeight: 18, padding: 12 },
  doneButton: { alignItems: 'center', marginTop: 14, minHeight: 44, paddingVertical: 12 },
  doneButtonText: { color: Colors.primary, fontSize: 15, fontWeight: '700' },
});
