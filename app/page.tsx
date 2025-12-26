'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        </div>
      </main>
    );
  }

  const handleStartAnonymous = () => {
    router.push('/onboarding');
  };

  const handleSignIn = () => {
    router.push('/auth/login');
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-slate-900 mb-4">
            Your free mental health support space
          </h1>
          <p className="text-xl text-slate-600 mb-2">
            Private. Simple. Always here.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <Card className="border-2 border-primary shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="pt-6">
              <div className="text-center mb-6">
                <div className="text-4xl mb-4">🔒</div>
                <h2 className="text-2xl font-semibold mb-2">Start Without Signup</h2>
                <p className="text-slate-600 mb-6">
                  Begin your journey privately. No email, no commitment. Your data stays with you.
                </p>
                <Button
                  size="lg"
                  className="w-full"
                  onClick={handleStartAnonymous}
                >
                  Get Started Anonymously
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="pt-6">
              <div className="text-center mb-6">
                <div className="text-4xl mb-4">👤</div>
                <h2 className="text-2xl font-semibold mb-2">Sign In</h2>
                <p className="text-slate-600 mb-6">
                  Already have an account? Sign in to access your data across devices.
                </p>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full"
                  onClick={handleSignIn}
                >
                  Sign In to Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-4 gap-6 max-w-3xl mx-auto">
          <div className="text-center">
            <div className="text-3xl mb-2">📊</div>
            <h3 className="font-semibold mb-1">Track Your Mood</h3>
            <p className="text-sm text-slate-600">Daily check-ins and trends</p>
          </div>
          <div className="text-center">
            <div className="text-3xl mb-2">💬</div>
            <h3 className="font-semibold mb-1">AI Support</h3>
            <p className="text-sm text-slate-600">CBT-informed guidance</p>
          </div>
          <div className="text-center">
            <div className="text-3xl mb-2">✅</div>
            <h3 className="font-semibold mb-1">Organize Life</h3>
            <p className="text-sm text-slate-600">Goals and priorities</p>
          </div>
          <div className="text-center">
            <div className="text-3xl mb-2">📚</div>
            <h3 className="font-semibold mb-1">Learn & Grow</h3>
            <p className="text-sm text-slate-600">Book summaries</p>
          </div>
        </div>
      </div>
    </main>
  );
}

