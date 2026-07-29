'use client';

import { useEffect, useRef, useState } from 'react';
import { AudioLines, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SoundscapeId = 'off' | 'brown' | 'rain' | 'ocean';

const SOUNDSCAPES: Record<
  SoundscapeId,
  { label: string; description: string }
> = {
  off: { label: 'Quiet', description: 'No added sound' },
  brown: {
    label: 'Low noise',
    description: 'A soft, low-filtered neutral texture',
  },
  rain: {
    label: 'Soft rain',
    description: 'A light rain-like neutral texture',
  },
  ocean: {
    label: 'Slow tide',
    description: 'A low, slowly swelling neutral texture',
  },
};

type OptionalSoundscapeProps = {
  className?: string;
  description?: string;
  options?: SoundscapeId[];
  safetyNote?: string;
  title?: string;
  onChange?: (soundscape: SoundscapeId) => void;
};

export function OptionalSoundscape({
  className,
  description = 'Choose a background sound, or keep it quiet.',
  options = ['off', 'brown', 'rain', 'ocean'],
  safetyNote,
  title = 'Optional sound',
  onChange,
}: OptionalSoundscapeProps) {
  const [soundscape, setSoundscape] = useState<SoundscapeId>('off');
  const [error, setError] = useState('');
  const audioContextRef = useRef<AudioContext | null>(null);
  const requestIdRef = useRef(0);
  const visibleOptions: SoundscapeId[] = options.includes('off')
    ? options
    : ['off', ...options];

  const stopSound = async () => {
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context && context.state !== 'closed') await context.close();
  };

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
      const context = audioContextRef.current;
      audioContextRef.current = null;
      if (context && context.state !== 'closed') void context.close();
    };
  }, []);

  const chooseSoundscape = async (next: SoundscapeId) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setError('');
    let nextContext: AudioContext | null = null;

    try {
      await stopSound();
      if (requestIdRef.current !== requestId) return;

      if (next === 'off') {
        setSoundscape('off');
        onChange?.('off');
        return;
      }

      const AudioContextClass =
        window.AudioContext ??
        (
          window as typeof window & {
            webkitAudioContext?: typeof AudioContext;
          }
        ).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error('Web Audio is not supported in this browser.');
      }

      const context = new AudioContextClass();
      nextContext = context;
      audioContextRef.current = context;
      const frameCount = context.sampleRate * 3;
      const buffer = context.createBuffer(1, frameCount, context.sampleRate);
      const samples = buffer.getChannelData(0);
      let brown = 0;

      for (let index = 0; index < frameCount; index += 1) {
        const white = Math.random() * 2 - 1;
        if (next === 'brown' || next === 'ocean') {
          brown = (brown + 0.02 * white) / 1.02;
          samples[index] = brown * 3.5;
        } else {
          samples[index] = white * 0.55;
        }
      }

      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      source.buffer = buffer;
      source.loop = true;
      filter.type = next === 'rain' ? 'highpass' : 'lowpass';
      filter.frequency.value = next === 'rain' ? 1_700 : 650;
      gain.gain.value = next === 'rain' ? 0.055 : 0.075;
      source.connect(filter).connect(gain).connect(context.destination);

      if (next === 'ocean') {
        const oscillator = context.createOscillator();
        const oscillatorGain = context.createGain();
        oscillator.frequency.value = 0.09;
        oscillatorGain.gain.value = 0.03;
        oscillator
          .connect(oscillatorGain)
          .connect(gain.gain);
        oscillator.start();
      }

      source.start();
      await context.resume();
      if (requestIdRef.current !== requestId) {
        if (audioContextRef.current === context) {
          audioContextRef.current = null;
        }
        if (context.state !== 'closed') await context.close();
        return;
      }
      setSoundscape(next);
      onChange?.(next);
    } catch (soundError) {
      if (audioContextRef.current === nextContext) {
        audioContextRef.current = null;
      }
      if (nextContext && nextContext.state !== 'closed') {
        await nextContext.close();
      }
      if (requestIdRef.current !== requestId) return;
      setSoundscape('off');
      onChange?.('off');
      setError(
        soundError instanceof Error
          ? soundError.message
          : 'Sound could not start in this browser.'
      );
    }
  };

  return (
    <aside className={cn('app-panel p-5', className)}>
      <div className="flex items-center gap-2">
        <AudioLines className="h-4 w-4 text-foreground" aria-hidden="true" />
        <h2 className="font-display text-xl font-medium text-foreground">
          {title}
        </h2>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>
      <div className="mt-4 space-y-2">
        {visibleOptions.map((id) => {
          const sound = SOUNDSCAPES[id];
          return (
            <button
              key={id}
              type="button"
              aria-pressed={soundscape === id}
              onClick={() => void chooseSoundscape(id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                soundscape === id
                  ? 'border-primary/35 bg-secondary'
                  : 'border-border bg-background hover:bg-secondary/60'
              )}
            >
              {id === 'off' ? (
                <VolumeX className="h-4 w-4 shrink-0" aria-hidden="true" />
              ) : (
                <Volume2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              <span>
                <span className="block text-sm font-medium text-foreground">
                  {sound.label}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {sound.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {safetyNote && (
        <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
          {safetyNote}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-xs text-destructive">
          {error}
        </p>
      )}
    </aside>
  );
}
