'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutGrid, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  MORE_GROUPS,
  MORE_ITEMS,
  PRIMARY_NAV,
  isActiveRoute,
  isPublicRoute,
  type NavItem,
} from '@/lib/navigation';

function NavIcon({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Icon
      className={cn('h-[1.15rem] w-[1.15rem] shrink-0', active && 'stroke-[2.25]')}
      aria-hidden="true"
    />
  );
}

/** Grouped secondary destinations, shared by the desktop menu and the mobile sheet. */
function MorePanel({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {MORE_GROUPS.map((group) => (
        <div key={group.title}>
          <p className="mb-2 px-2 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {group.title}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActiveRoute(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-start gap-3 rounded-xl px-2 py-2 transition-colors',
                      'hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active && 'bg-secondary'
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border/70 bg-background text-foreground',
                        active && 'border-transparent bg-primary text-primary-foreground'
                      )}
                    >
                      <NavIcon item={item} active={active} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium leading-tight text-foreground">
                        {item.label}
                      </span>
                      <span className="block truncate text-xs leading-tight text-muted-foreground">
                        {item.blurb}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function Navigation() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const desktopMoreRef = useRef<HTMLLIElement>(null);

  const closeMore = useCallback(() => setMoreOpen(false), []);

  // Close whenever the route changes, so a tap inside the sheet doesn't leave
  // it hanging open over the page the user just navigated to.
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      // Only the desktop dropdown dismisses on outside click. The mobile sheet
      // is rendered outside this ref and has its own backdrop + close button.
      const target = event.target as Node;
      if (desktopMoreRef.current && !desktopMoreRef.current.contains(target)) {
        setMoreOpen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [moreOpen]);

  if (isPublicRoute(pathname)) return null;

  const moreActive = MORE_ITEMS.some((item) => isActiveRoute(pathname, item.href));

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="grid h-8 w-8 place-items-center rounded-[0.6rem] bg-primary text-[0.7rem] font-bold text-primary-foreground">
              MH
            </span>
            <span className="text-sm font-semibold tracking-[0.1em] text-foreground">
              MHTOOLKIT
            </span>
          </Link>

          <nav aria-label="Primary" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {PRIMARY_NAV.map((item) => {
                const active = isActiveRoute(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        active
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                      )}
                    >
                      <NavIcon item={item} active={active} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}

              <li className="relative" ref={desktopMoreRef}>
                <button
                  type="button"
                  onClick={() => setMoreOpen((open) => !open)}
                  aria-expanded={moreOpen}
                  aria-haspopup="true"
                  className={cn(
                    'flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    moreOpen || moreActive
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  )}
                >
                  <LayoutGrid className="h-[1.15rem] w-[1.15rem]" aria-hidden="true" />
                  More
                </button>

                {moreOpen && (
                  <div className="app-panel absolute right-0 top-[calc(100%+0.6rem)] w-[34rem] p-5">
                    <MorePanel pathname={pathname} onNavigate={closeMore} />
                  </div>
                )}
              </li>
            </ul>
          </nav>
        </div>
      </header>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 backdrop-blur-md md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1 py-1.5">
          {PRIMARY_NAV.map((item) => {
            const active = isActiveRoute(pathname, item.href);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-[3.25rem] flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    active ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  <span
                    className={cn(
                      'grid h-7 w-12 place-items-center rounded-full transition-colors',
                      active && 'bg-primary text-primary-foreground'
                    )}
                  >
                    <NavIcon item={item} active={active} />
                  </span>
                  <span className="text-[0.68rem] font-medium leading-none">
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}

          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-expanded={moreOpen}
              className={cn(
                'flex min-h-[3.25rem] w-full flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                moreActive ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              <span
                className={cn(
                  'grid h-7 w-12 place-items-center rounded-full transition-colors',
                  moreActive && 'bg-primary text-primary-foreground'
                )}
              >
                <LayoutGrid className="h-[1.15rem] w-[1.15rem]" aria-hidden="true" />
              </span>
              <span className="text-[0.68rem] font-medium leading-none">More</span>
            </button>
          </li>
        </ul>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={closeMore}
            className="absolute inset-0 bg-brand-ink/35 backdrop-blur-[2px]"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="More destinations"
            className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-border bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-medium text-foreground">More</h2>
              <button
                type="button"
                onClick={closeMore}
                aria-label="Close menu"
                className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <MorePanel pathname={pathname} onNavigate={closeMore} />
          </div>
        </div>
      )}
    </>
  );
}
