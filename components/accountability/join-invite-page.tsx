'use client';

import Link from 'next/link';
import { CheckCircle2, Link2, Loader2, ShieldCheck, UserRoundPlus, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

import { acceptJoinInvite, getAccountabilityErrorMessage, loadJoinInvite } from './accountability-client';
import { getAccessState } from './accountability-state';
import type { JoinInvitePreview } from './accountability-types';

export function JoinInvitePage({ token }: { token: string | null }): React.ReactElement {
  const router = useRouter();
  const { user, loading: authLoading, isAnonymous } = useAuth();
  const userId = user?.id ?? null;
  const access = getAccessState({ loading: authLoading, userPresent: Boolean(user), isAnonymous });
  const [preview, setPreview] = useState<JoinInvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestKey = access === 'ready' && userId ? `${userId}:${token ?? ''}` : null;
  const currentRequestKey = useRef(requestKey);
  currentRequestKey.current = requestKey;
  const [loadedRequestKey, setLoadedRequestKey] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (access !== 'ready' || !requestKey) return;
    if (!token) {
      setError('This invitation link is incomplete. Ask your partner for a new link.');
      setLoading(false);
      setLoadedRequestKey(requestKey);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await loadJoinInvite(token);
      if (currentRequestKey.current === requestKey) setPreview(next);
    } catch (cause) {
      if (currentRequestKey.current === requestKey) setError(getAccountabilityErrorMessage(cause));
    } finally {
      if (currentRequestKey.current === requestKey) {
        setLoadedRequestKey(requestKey);
        setLoading(false);
      }
    }
  }, [access, requestKey, token]);

  useEffect(() => {
    setPreview(null);
    setError(null);
    setJoining(false);
    setLoadedRequestKey(null);
    if (access === 'ready') void load();
    else setLoading(access === 'loading');
  }, [access, load, requestKey]);

  if (access === 'loading' || (access === 'ready' && (loading || loadedRequestKey !== requestKey))) {
    return <div role="status" aria-label="Checking Together invitation" className="flex items-center justify-center gap-3 py-16 text-slate-600"><Loader2 className="h-5 w-5 animate-spin" />Checking your invitation…</div>;
  }

  if (access === 'signed-out' || access === 'anonymous') {
    const anonymous = access === 'anonymous';
    const next = token ? `/partner/join?token=${encodeURIComponent(token)}` : '/partner/join';
    const authHref = `${anonymous ? '/auth/signup' : '/auth/login'}?next=${encodeURIComponent(next)}`;
    return (
      <Card className="mx-auto max-w-lg border-blue-100 shadow-sm">
        <CardHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><ShieldCheck className="h-5 w-5" /></div>
          <CardTitle>{anonymous ? 'Make your account permanent first' : 'Sign in to join'}</CardTitle>
          <CardDescription>Your invitation stays untouched until you sign in with a permanent account.</CardDescription>
        </CardHeader>
        <CardContent><Link className={cn(buttonVariants(), 'inline-flex')} href={authHref}>{anonymous ? 'Create permanent account' : 'Sign in'}</Link></CardContent>
      </Card>
    );
  }

  if (error || !preview) {
    return (
      <Card className="mx-auto max-w-lg" role="alert">
        <CardHeader><div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600"><XCircle className="h-5 w-5" /></div><CardTitle>Invitation unavailable</CardTitle><CardDescription>{error ?? 'This invitation could not be found.'}</CardDescription></CardHeader>
        <CardContent className="flex gap-2"><Button onClick={() => void load()}>Try again</Button><Link className={cn(buttonVariants({ variant: 'outline' }), 'inline-flex')} href="/accountability">Go to Together</Link></CardContent>
      </Card>
    );
  }

  if (preview.status !== 'available') {
    const message = preview.status === 'used' ? 'This invitation has already been used.' : preview.status === 'expired' ? 'This invitation has expired.' : 'This invitation was cancelled.';
    return <Card className="mx-auto max-w-lg"><CardHeader><CardTitle>Invitation unavailable</CardTitle><CardDescription>{message} Ask {preview.inviterName} to create a new one.</CardDescription></CardHeader><CardContent><Link className={cn(buttonVariants({ variant: 'outline' }), 'inline-flex')} href="/accountability">Go to Together</Link></CardContent></Card>;
  }

  return (
    <Card className="mx-auto max-w-lg border-blue-100 shadow-sm">
      <CardHeader>
        <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><UserRoundPlus className="h-5 w-5" /></div>
        <CardTitle>Join {preview.inviterName} on Together?</CardTitle>
        <CardDescription>You will be their one accountability partner. You will see only commitments they explicitly share.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><p className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-4 w-4" />Private by default</p><p className="mt-1 text-emerald-800">Moods, assessments, AI chat, and private reflections are never part of Together.</p></div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={joining}
            className="gap-2"
            onClick={() => {
              const actionRequestKey = requestKey;
              if (!token || joining || !actionRequestKey) return;
              setJoining(true);
              setError(null);
              void acceptJoinInvite(token)
                .then(() => {
                  if (currentRequestKey.current === actionRequestKey) router.push('/accountability');
                })
                .catch((cause) => {
                  if (currentRequestKey.current === actionRequestKey) {
                    setError(getAccountabilityErrorMessage(cause));
                  }
                })
                .finally(() => {
                  if (currentRequestKey.current === actionRequestKey) setJoining(false);
                });
            }}
          >
            {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Accept invitation
          </Button>
          <Link className={cn(buttonVariants({ variant: 'ghost' }), 'inline-flex')} href="/accountability">Not now</Link>
        </div>
      </CardContent>
    </Card>
  );
}
