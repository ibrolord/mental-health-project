'use client';

import { usePathname } from 'next/navigation';
import { isPublicRoute } from '@/lib/navigation';

/**
 * Wraps signed-in pages with the app surface and reserves room for the fixed
 * mobile bottom bar. Public/marketing routes render untouched so they keep
 * their own full-bleed layouts.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isPublicRoute(pathname)) return <>{children}</>;

  return (
    <div className="app-shell pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
      {children}
    </div>
  );
}
