'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function SignupPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-8 px-4 flex items-center justify-center">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Account Creation Unavailable</CardTitle>
          <CardDescription>
            We are upgrading email verification before accepting new accounts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-foreground">
            You can continue using MHtoolkit anonymously, or sign in if you already have an account.
          </p>
          <Button asChild className="w-full">
            <Link href="/auth/login">Sign In to an Existing Account</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/dashboard">Continue Anonymously</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
