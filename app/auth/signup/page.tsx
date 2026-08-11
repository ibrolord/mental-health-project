'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth-context';

export default function SignupPage() {
  const { isAnonymous, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [nextPath, setNextPath] = useState('/dashboard');

  useEffect(() => {
    const candidate = new URLSearchParams(window.location.search).get('next');
    if (candidate?.startsWith('/') && !candidate.startsWith('//')) setNextPath(candidate);
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Use at least 8 characters for your password.');
      return;
    }
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await signUp(email.trim(), password, nextPath);
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Account setup did not complete.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{sent ? 'Check your email' : 'Keep your progress'}</CardTitle>
          <CardDescription>
            {sent
              ? isAnonymous
                ? 'Verify your address, then create your password to finish.'
                : 'Verify your address, then sign in to use Together across devices.'
              : 'Add a verified email to your current private profile.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-700">
                We sent a verification link to <strong>{email}</strong>. Your existing MHtoolkit data stays with this profile.
              </p>
              {!isAnonymous && <Link className={buttonVariants({ className: 'w-full' })} href={`/auth/login?next=${encodeURIComponent(nextPath)}`}>Back to sign in</Link>}
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              {error && (
                <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="signup-email">Email</Label>
                <Input id="signup-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signup-password">Password</Label>
                <Input id="signup-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signup-confirmation">Confirm password</Label>
                <Input id="signup-confirmation" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={8} required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Setting up account...' : 'Create account'}
              </Button>
              <p className="text-center text-sm text-slate-600">
                Already registered? <Link className="text-primary hover:underline" href={`/auth/login?next=${encodeURIComponent(nextPath)}`}>Sign in</Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
