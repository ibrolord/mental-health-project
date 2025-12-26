'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

export function Navigation() {
  const pathname = usePathname();

  // Don't show nav on landing, onboarding, or auth pages
  if (pathname === '/' || pathname.startsWith('/onboarding') || pathname.startsWith('/auth')) {
    return null;
  }

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: '🏠' },
    { href: '/tracker', label: 'Mood', icon: '📊' },
    { href: '/goals', label: 'Goals', icon: '✅' },
    { href: '/chat', label: 'Mental Health Chat', icon: '💬' },
    { href: '/assessments', label: 'Assess', icon: '📋' },
    { href: '/habits', label: 'Habits', icon: '🎯' },
    { href: '/library', label: 'Library', icon: '📚' },
    { href: '/affirmations', label: 'Affirm', icon: '✨' },
    { href: '/settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/dashboard" className="text-xl font-bold text-primary">
            Mental Health
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={pathname === item.href ? 'default' : 'ghost'}
                  size="sm"
                  className={cn(
                    'gap-2',
                    pathname === item.href && 'bg-primary text-primary-foreground'
                  )}
                >
                  <span>{item.icon}</span>
                  <span className="hidden lg:inline">{item.label}</span>
                </Button>
              </Link>
            ))}
          </div>

          {/* Mobile menu */}
          <div className="md:hidden">
            <Link href="/settings">
              <Button variant="ghost" size="sm">
                ⚙️
              </Button>
            </Link>
          </div>
        </div>

        {/* Mobile bottom nav */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 py-2">
          <div className="flex justify-around">
            {navItems.slice(0, 5).map((item) => (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={pathname === item.href ? 'default' : 'ghost'}
                  size="sm"
                  className="flex flex-col h-auto py-2"
                >
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-xs mt-1">{item.label}</span>
                </Button>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}

