'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

type DismissibleNoticeProps = {
  noticeKey: string;
  children: ReactNode;
  className?: string;
  dismissLabel?: string;
  title?: string;
};

export function DismissibleNotice({
  noticeKey,
  children,
  className,
  dismissLabel = 'Dismiss this notice',
  title,
}: DismissibleNoticeProps) {
  const { user, loading } = useAuth();
  const [visibility, setVisibility] = useState<'checking' | 'visible' | 'hidden'>(
    'checking'
  );

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setVisibility('visible');
      return;
    }

    let active = true;
    void supabase
      .from('dismissed_notices')
      .select('id')
      .eq('user_id', user.id)
      .eq('notice_key', noticeKey)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('Dismissed notice lookup failed:', error);
          setVisibility('visible');
          return;
        }
        setVisibility(data ? 'hidden' : 'visible');
      });

    return () => {
      active = false;
    };
  }, [loading, noticeKey, user]);

  const dismiss = async () => {
    setVisibility('hidden');
    if (!user) return;

    const { error } = await supabase.from('dismissed_notices').upsert(
      {
        user_id: user.id,
        notice_key: noticeKey,
        dismissed_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,notice_key' }
    );
    if (error) {
      console.error('Notice dismissal failed:', error);
      setVisibility('visible');
    }
  };

  if (visibility !== 'visible') return null;

  return (
    <aside
      className={cn(
        'relative',
        title && 'app-panel-quiet p-5 pr-14',
        className
      )}
    >
      <button
        type="button"
        onClick={() => void dismiss()}
        aria-label={dismissLabel}
        className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
      {title ? (
        <>
          <h2 className="font-display text-xl font-medium text-foreground">
            {title}
          </h2>
          <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {children}
          </div>
        </>
      ) : (
        children
      )}
    </aside>
  );
}
