import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  ClipboardList,
  Flame,
  HeartHandshake,
  Home,
  LifeBuoy,
  MessageCircle,
  PenLine,
  Settings,
  SmilePlus,
  Sparkles,
  Target,
} from 'lucide-react';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown under the label in the More sheet. Keep to a short phrase. */
  blurb: string;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

/**
 * Primary destinations. Exactly five, because this is also the mobile bottom
 * bar and a sixth item makes the touch targets too narrow to hit reliably.
 * Everything else lives in MORE_GROUPS and is reachable from the More sheet.
 *
 * Previously the bottom bar was `navItems.slice(0, 5)` over a flat list of
 * ten, which silently made Habits, Library, Affirmations and Settings
 * unreachable on mobile web. Do not reintroduce a slice here.
 */
export const PRIMARY_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Today', icon: Home, blurb: 'Your snapshot' },
  { href: '/tracker', label: 'Mood', icon: SmilePlus, blurb: 'Check in' },
  { href: '/goals', label: 'Goals', icon: Target, blurb: 'What matters now' },
  { href: '/chat', label: 'Chat', icon: MessageCircle, blurb: 'Talk it through' },
];

export const MORE_GROUPS: NavGroup[] = [
  {
    title: 'Reflect',
    items: [
      { href: '/journal', label: 'Journal', icon: PenLine, blurb: 'Private writing' },
      {
        href: '/assessments',
        label: 'Assess',
        icon: ClipboardList,
        blurb: 'Published screeners',
      },
    ],
  },
  {
    title: 'Grow',
    items: [
      { href: '/habits', label: 'Habits', icon: Flame, blurb: 'Daily streaks' },
      {
        href: '/partner',
        label: 'Partner',
        icon: HeartHandshake,
        blurb: 'Share progress with someone',
      },
    ],
  },
  {
    title: 'Support',
    items: [
      {
        href: '/resources',
        label: 'Resources',
        icon: LifeBuoy,
        blurb: 'Therapists and support groups',
      },
      { href: '/library', label: 'Library', icon: BookOpen, blurb: 'Book guides' },
      {
        href: '/affirmations',
        label: 'Affirmations',
        icon: Sparkles,
        blurb: 'Daily encouragement',
      },
    ],
  },
  {
    title: 'Account',
    items: [
      { href: '/settings', label: 'Settings', icon: Settings, blurb: 'Privacy and data' },
    ],
  },
];

export const MORE_ITEMS: NavItem[] = MORE_GROUPS.flatMap((group) => group.items);

/** Every in-app destination, used for active-state and title lookups. */
export const ALL_NAV_ITEMS: NavItem[] = [...PRIMARY_NAV, ...MORE_ITEMS];

/**
 * Routes that render their own full-bleed layout and must not get the
 * signed-in app chrome.
 */
const PUBLIC_PREFIXES = ['/onboarding', '/auth'];
const PUBLIC_EXACT = ['/', '/privacy', '/support'];

export function isPublicRoute(pathname: string): boolean {
  return (
    PUBLIC_EXACT.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

/** True when `href` is the current page or an ancestor of it. */
export function isActiveRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
