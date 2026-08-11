'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase/client';

function safeNextPath(): string {
  const candidate = new URLSearchParams(window.location.search).get('next');
  return candidate?.startsWith('/') && !candidate.startsWith('//') ? candidate : '/dashboard';
}

export default function CompleteSignupPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void supabase.auth.getUser().then(({ data, error: userError }) => {
      if (userError || !data.user?.email_confirmed_at || data.user.is_anonymous) {
        setError('Open the latest verification link from your email to continue.');
      } else {
        setReady(true);
      }
    });
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (password.length < 8) return setError('Use at least 8 characters for your password.');
    if (password !== confirmation) return setError('Passwords do not match.');
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) return setError(updateError.message);
    router.replace(safeNextPath());
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create your password</CardTitle>
          <CardDescription>Your verified profile and existing MHtoolkit data stay together.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-1.5">
              <Label htmlFor="complete-password">Password</Label>
              <Input id="complete-password" type="password" autoComplete="new-password" minLength={8} required disabled={!ready} value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="complete-confirmation">Confirm password</Label>
              <Input id="complete-confirmation" type="password" autoComplete="new-password" minLength={8} required disabled={!ready} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
            </div>
            <Button className="w-full" type="submit" disabled={!ready || loading}>{loading ? 'Saving password…' : 'Finish account setup'}</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
