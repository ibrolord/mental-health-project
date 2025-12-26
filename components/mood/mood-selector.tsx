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
  sm: 'text-3xl',
  md: 'text-5xl',
  lg: 'text-6xl',
};

export function MoodSelector({ selected, onSelect, size = 'lg' }: MoodSelectorProps) {
  return (
    <div className="flex justify-center gap-4">
      {moods.map(({ emoji, label }) => (
        <button
          key={emoji}
          onClick={() => onSelect(emoji)}
          className={cn(
            'flex flex-col items-center gap-2 p-4 rounded-lg transition-all hover:scale-110',
            selected === emoji
              ? 'bg-primary/10 ring-2 ring-primary scale-110'
              : 'hover:bg-slate-100'
          )}
        >
          <span className={sizeClasses[size]}>{emoji}</span>
          <span className="text-sm text-slate-600">{label}</span>
        </button>
      ))}
    </div>
  );
}

