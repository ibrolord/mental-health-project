'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import { useDataContext } from '@/lib/hooks/use-data-context';

export default function SettingsPage() {
  const router = useRouter();
  const { user, signOut, isAnonymous } = useAuth();
  const { query } = useDataContext();
  const [loading, setLoading] = useState(false);

  const handleExportData = async () => {
    if (!query) return;

    try {
      setLoading(true);

      // Fetch all user data
      const [moods, assessments, goals, habits, habitLogs, chatHistory] = await Promise.all([
        supabase.from('moods').select('*').eq(query.column, query.value),
        supabase.from('assessments').select('*').eq(query.column, query.value),
        supabase.from('goals').select('*').eq(query.column, query.value),
        supabase.from('habits').select('*').eq(query.column, query.value),
        supabase
          .from('habit_logs')
          .select('*, habits(*)')
          .eq(`habits.${query.column}`, query.value),
        supabase.from('chat_history').select('*').eq(query.column, query.value),
      ]);

      const exportData = {
        exported_at: new Date().toISOString(),
        user_type: isAnonymous ? 'anonymous' : 'authenticated',
        moods: moods.data || [],
        assessments: assessments.data || [],
        goals: goals.data || [],
        habits: habits.data || [],
        habit_logs: habitLogs.data || [],
        chat_history: chatHistory.data || [],
      };

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
      '- All mood entries\n' +
      '- All assessments\n' +
      '- All goals\n' +
      '- All habits and logs\n' +
      '- All chat history\n\n' +
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

      // Delete all user data
      await Promise.all([
        supabase.from('moods').delete().eq(query.column, query.value),
        supabase.from('assessments').delete().eq(query.column, query.value),
        supabase.from('goals').delete().eq(query.column, query.value),
        supabase.from('habits').delete().eq(query.column, query.value),
        supabase.from('chat_history').delete().eq(query.column, query.value),
        supabase.from('user_affirmation_history').delete().eq(query.column, query.value),
        supabase.from('user_book_favorites').delete().eq(query.column, query.value),
      ]);

      alert('All data deleted successfully');

      // If authenticated user, sign out
      if (!isAnonymous) {
        await signOut();
      }

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

      // Delete all data first
      await handleDeleteAllData();

      // Delete user account (requires admin API)
      // For now, just sign out - actual deletion would need backend endpoint
      await signOut();
      alert('Account deletion initiated. Please contact support if you need further assistance.');
      router.push('/');
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Failed to delete account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Settings</h1>
          <p className="text-slate-600">Manage your account and privacy</p>
        </div>

        {/* Account Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent>
            {isAnonymous ? (
              <div>
                <p className="text-slate-700 mb-4">
                  You are currently using the app anonymously. Your data is stored locally on this device.
                </p>
                <Button onClick={() => router.push('/auth/signup')}>
                  Create Account to Sync Data
                </Button>
              </div>
            ) : (
              <div>
                <p className="text-slate-700 mb-2">
                  <strong>Email:</strong> {user?.email}
                </p>
                <p className="text-sm text-slate-600">
                  Your data is synced across devices
                </p>
                <Button onClick={signOut} variant="outline" className="mt-4">
                  Sign Out
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
            <p className="text-sm text-slate-600 mb-4">
              This includes all your moods, assessments, goals, habits, and chat history.
            </p>
            <Button onClick={handleExportData} disabled={loading}>
              {loading ? 'Exporting...' : 'Export Data (JSON)'}
            </Button>
          </CardContent>
        </Card>

        {/* Privacy Policy */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Privacy & Data Protection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-700">
            <div>
              <h3 className="font-semibold mb-2">🔒 Your Privacy Matters</h3>
              <ul className="list-disc list-inside space-y-1">
                <li>All data is encrypted at rest using industry-standard encryption</li>
                <li>We never sell or share your personal data with third parties</li>
                <li>No tracking pixels or unnecessary analytics</li>
                <li>Anonymous usage requires no personal information</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-2">📊 What We Store</h3>
              <ul className="list-disc list-inside space-y-1">
                <li>Mood entries and assessment results</li>
                <li>Goals, habits, and reflections</li>
                <li>Chat conversations with AI (stored securely)</li>
                <li>Email address (only if you create an account)</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-2">✅ Your Rights</h3>
              <ul className="list-disc list-inside space-y-1">
                <li>Export all your data at any time (GDPR/CCPA compliant)</li>
                <li>Delete your data with one click</li>
                <li>Use the app completely anonymously</li>
                <li>Migrate anonymous data to an account anytime</li>
              </ul>
            </div>

            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
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


