import {
  Activity,
  AlarmClock,
  Apple,
  BookOpen,
  CalendarHeart,
  Circle,
  Coffee,
  Droplets,
  Focus,
  Home,
  Moon,
  NotebookPen,
  Play,
  Shield,
  Sparkles,
  Target,
  Timer,
  Users,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ICONS: Record<string, LucideIcon> = {
  activity: Activity,
  'alarm-clock': AlarmClock,
  apple: Apple,
  book: BookOpen,
  'calendar-heart': CalendarHeart,
  circle: Circle,
  coffee: Coffee,
  droplets: Droplets,
  focus: Focus,
  home: Home,
  moon: Moon,
  notebook: NotebookPen,
  play: Play,
  shield: Shield,
  sparkles: Sparkles,
  target: Target,
  timer: Timer,
  users: Users,
  wind: Wind,
};

export function HabitIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = ICONS[name] ?? Sparkles;
  return <Icon className={cn('h-5 w-5', className)} aria-hidden="true" />;
}
