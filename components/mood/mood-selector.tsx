'use client';

import { MoodEmoji } from '@/lib/supabase/types';
import { cn } from '@/lib/utils';

interface MoodSelectorProps {
  selected: MoodEmoji | null;
  onSelect: (mood: MoodEmoji) => void;
  size?: 'sm' | 'md' | 'lg';
}

const moods: { emoji: MoodEmoji; label: string }[] = [
  { emoji: '😄', label: 'Great' },
  { emoji: '🙂', label: 'Good' },
  { emoji: '😐', label: 'Okay' },
  { emoji: '😞', label: 'Low' },
  { emoji: '😢', label: 'Very Low' },
];

const sizeClasses = {
  sm: 'text-2xl sm:text-3xl',
  md: 'text-3xl sm:text-5xl',
  lg: 'text-4xl sm:text-6xl',
};

export function MoodSelector({ selected, onSelect, size = 'lg' }: MoodSelectorProps) {
  return (
    <div className="grid w-full grid-cols-5 gap-1 sm:flex sm:justify-center sm:gap-4">
      {moods.map(({ emoji, label }) => (
        <button
          key={emoji}
          onClick={() => onSelect(emoji)}
          className={cn(
            'flex min-w-0 flex-col items-center gap-2 rounded-lg px-1 py-3 transition-all sm:p-4 sm:hover:scale-110',
            selected === emoji
              ? 'bg-primary/10 ring-2 ring-primary sm:scale-110'
              : 'hover:bg-slate-100'
          )}
        >
          <span className={sizeClasses[size]}>{emoji}</span>
          <span className="whitespace-nowrap text-xs text-slate-600 sm:text-sm">
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}

