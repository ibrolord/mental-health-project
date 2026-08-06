'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import { useDataContext } from '@/lib/hooks/use-data-context';
import { apiRequest } from '@/lib/api/client';
import { hasAiDataSharingConsent, resetAiDataSharingConsent } from '@/lib/ai-consent';
import { clearStoredAcquisitionAttribution } from '@/lib/acquisition';
import { clearFullContextPreference } from '@/lib/ai/full-context-preference';
import { clearGoToActions } from '@/lib/go-to-actions-storage';
import { PushNotificationSettings } from '@/components/push-notification-settings';
import { PrivacyActivity } from '@/components/privacy-activity';
import { VisitBriefBuilder } from '@/components/visit-brief-builder';

export default function SettingsPage() {
  const router = useRouter();
  const { user, signOut, isAnonymous, loading: authLoading } = useAuth();
  const { query } = useDataContext();
  const consentSubjectId = query ? `${query.column}:${query.value}` : '';
  const [loading, setLoading] = useState(false);
  const [aiConsentGranted, setAiConsentGranted] = useState(false);

  const clearLocalPrivacyState = (ownerKey: string): boolean => {
    const results = [
      () => clearStoredAcquisitionAttribution(),
      () => resetAiDataSharingConsent(ownerKey),
      () => clearFullContextPreference(ownerKey),
      () => clearGoToActions(ownerKey),
    ].map((operation) => {
      try {
        return operation();
      } catch {
        return false;
      }
    });
    return results.every(Boolean);
  };

  useEffect(() => {
    setAiConsentGranted(hasAiDataSharingConsent(consentSubjectId));
  }, [consentSubjectId]);

  const handleExportData = async () => {
    if (!query) return;

    try {
      setLoading(true);
      const exportData = await apiRequest('/api/data/export', {});

      // Create JSON file
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `mental-health-data-${new Date().toISOString().split('T')[0]}.json`;
      a.click();

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Failed to export data');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAllData = async () => {
    if (!query) return;

    const confirmed = confirm(
      'Are you sure you want to delete ALL your data? This action cannot be undone.\n\n' +
      'This will permanently delete:\n' +
      '- Check-ins, assessments, goals, habits, journal entries, and chat history\n' +
      '- Life plans, focus sessions, reminders, and push subscriptions\n' +
      '- Library state, partner links, and affirmation history\n' +
      '- AI response reports and acquisition attribution\n\n' +
      'Type "DELETE" in the next prompt to confirm.'
    );

    if (!confirmed) return;

    const confirmation = prompt('Type DELETE to confirm:');
    if (confirmation !== 'DELETE') {
      alert('Deletion cancelled');
      return;
    }

    try {
      setLoading(true);

      const result = await apiRequest('/api/data/delete', {});
      if (!result?.deleted) {
        throw new Error(result?.error || 'Deletion failed');
      }
      const localCleanupComplete = clearLocalPrivacyState(consentSubjectId);
      setAiConsentGranted(false);
      alert(
        localCleanupComplete
          ? 'All data deleted successfully'
          : 'Online data was deleted, but this browser could not remove all local privacy settings. Sign out and clear site data before continuing.'
      );

      router.push('/');
    } catch (error) {
      console.error('Error deleting data:', error);
      alert('Failed to delete data');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (isAnonymous || !user) return;

    const confirmed = confirm(
      'Are you sure you want to delete your account?\n\n' +
      'This will permanently delete:\n' +
      '- Your account\n' +
      '- All your data\n\n' +
      'This action cannot be undone. Type "DELETE ACCOUNT" to confirm.'
    );

    if (!confirmed) return;

    const confirmation = prompt('Type DELETE ACCOUNT to confirm:');
    if (confirmation !== 'DELETE ACCOUNT') {
      alert('Account deletion cancelled');
      return;
    }

    try {
      setLoading(true);

      const result = await apiRequest('/api/account/delete', {});
      if (!result?.deleted) {
        throw new Error(result?.error || 'Failed to delete account');
      }

      const localCleanupComplete = clearLocalPrivacyState(consentSubjectId);
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
      const { data: clearedSession, error: sessionError } = await supabase.auth.getSession();
      if (signOutError || sessionError || clearedSession.session) {
        throw new Error(
          'Your account was deleted, but this browser session could not be cleared. Close this tab and contact support before continuing.'
        );
      }
      if (!localCleanupComplete) {
        throw new Error(
          'Your account was deleted and this browser session was cleared, but local privacy settings could not be fully removed. Clear site data before continuing.'
        );
      }
      alert('Your account and associated data have been deleted.');
      router.push('/');
    } catch (error) {
      console.error('Error deleting account:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete account');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeAiConsent = () => {
    const confirmed = confirm(
      'Revoke AI consent? AI chat, voice support, and AI affirmations will ask again before sending text, audio, or personal context to third-party AI providers.'
    );
    if (!confirmed) return;
    resetAiDataSharingConsent(consentSubjectId);
    setAiConsentGranted(false);
    alert('AI data sharing consent was revoked.');
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Settings</h1>
          <p className="text-muted-foreground">Manage your account and privacy</p>
        </div>

        {/* Account Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent>
            {authLoading ? (
              <p role="status" className="text-sm text-muted-foreground">
                Checking your account status…
              </p>
            ) : isAnonymous ? (
              <div>
                <p className="text-foreground mb-4">
                  You are using MHtoolkit anonymously. Create an account to keep
                  this profile across devices, or sign in to an existing account.
                </p>
                <p className="mb-4 text-sm text-muted-foreground">
                  If this anonymous profile already has saved data, MHtoolkit will
                  stop before switching identities so nothing is silently stranded.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => router.push('/auth/signup')}>
                    Create Account
                  </Button>
                  <Button
                    onClick={() => router.push('/auth/login')}
                    variant="outline"
                  >
                    Sign In
                  </Button>
                </div>
              </div>
            ) : user ? (
              <div>
                <p className="text-foreground mb-2">
                  <strong>Email:</strong> {user.email || 'Connected account'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Your data is synced across devices
                </p>
                <Button onClick={signOut} variant="outline" className="mt-4">
                  Sign Out
                </Button>
              </div>
            ) : (
              <div>
                <p className="mb-4 text-sm text-muted-foreground">
                  We could not load your account status. Your saved data has not
                  been changed.
                </p>
                <Button
                  onClick={() => window.location.reload()}
                  variant="outline"
                >
                  Try Again
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Data Export */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Export Your Data</CardTitle>
            <CardDescription>
              Download all your mental health data in JSON format
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              This includes your private journal, moods, assessments, goals,
              habits, life plans, focus sessions, reminders, library state, and
              chat history.
            </p>
            <Button onClick={handleExportData} disabled={loading}>
              {loading ? 'Exporting...' : 'Export Data (JSON)'}
            </Button>
          </CardContent>
        </Card>

        <VisitBriefBuilder
          key={`visit-brief-${user?.id ?? 'signed-out'}`}
          ownerId={user?.id ?? null}
        />

        <PrivacyActivity
          key={`privacy-activity-${user?.id ?? 'signed-out'}`}
          ownerId={user?.id ?? null}
        />

        <div className="mb-6">
          <PushNotificationSettings />
        </div>

        {/* Privacy Policy */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Privacy & Data Protection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-foreground">
            <div>
              <h3 className="font-semibold mb-2">🔒 Your Privacy Matters</h3>
              <ul className="list-disc list-inside space-y-1">
                <li>All data is encrypted at rest using industry-standard encryption</li>
                <li>We never sell your data or share it for advertising</li>
                <li>Optional AI features send selected chat, voice, and personalization data to AI providers only after consent</li>
                <li>No advertising trackers; acquisition reporting uses allowlisted campaign labels only</li>
                <li>Anonymous usage requires no personal information</li>
              </ul>
              <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-3">
                <p className="font-medium text-orange-900">
                  AI data sharing consent: {aiConsentGranted ? 'Granted' : 'Not granted yet'}
                </p>
                {aiConsentGranted && (
                  <Button className="mt-3" variant="outline" onClick={handleRevokeAiConsent}>
                    Revoke AI Consent
                  </Button>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">📊 What We Store</h3>
              <ul className="list-disc list-inside space-y-1">
                <li>Mood entries and assessment results</li>
                <li>Goals, habits, life plans, focus sessions, and reminders</li>
                <li>Private journal entries and reflections</li>
                <li>Chat conversations with AI (stored securely)</li>
                <li>Affirmation history, library state, and AI response reports</li>
                <li>Optional browser push subscription details</li>
                <li>Allowlisted first-touch campaign labels after your first saved check-in</li>
                <li>Email address (only if you create an account)</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-2">✅ Your Rights</h3>
              <ul className="list-disc list-inside space-y-1">
                <li>Export all your data at any time</li>
                <li>Delete your data with one click</li>
                <li>Use the app completely anonymously</li>
                <li>Create an account or sign in after MHtoolkit verifies anonymous data will not be stranded</li>
              </ul>
            </div>

            <div className="bg-secondary border-l-4 border-blue-500 p-4 rounded">
              <p className="font-semibold mb-1">Important Note:</p>
              <p>
                This app is a self-help tool, not a replacement for professional therapy. We do
                not share your data with healthcare providers unless you explicitly choose to do so.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-900">Danger Zone</CardTitle>
            <CardDescription className="text-red-700">
              Irreversible actions - proceed with caution
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2 text-red-900">Delete All Data</h3>
              <p className="text-sm text-red-700 mb-3">
                Permanently delete all your moods, goals, habits, and chat history. This cannot be
                undone.
              </p>
              <Button
                variant="destructive"
                onClick={handleDeleteAllData}
                disabled={loading}
              >
                Delete All Data
              </Button>
            </div>

            {!isAnonymous && (
              <div className="pt-4 border-t border-red-200">
                <h3 className="font-semibold mb-2 text-red-900">Delete Account</h3>
                <p className="text-sm text-red-700 mb-3">
                  Permanently delete your account and all associated data. This cannot be undone.
                </p>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAccount}
                  disabled={loading}
                >
                  Delete Account
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
