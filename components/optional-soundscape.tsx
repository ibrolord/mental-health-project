'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioLines, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SoundscapeId = 'off' | 'brown' | 'rain' | 'ocean';

type SoundscapeDefinition = {
  label: string;
  description: string;
  source?: string;
  volume?: number;
};

const SOUNDSCAPES: Record<SoundscapeId, SoundscapeDefinition> = {
  off: { label: 'Quiet', description: 'No added sound' },
  brown: {
    label: 'Deep brown noise',
    description: 'A smooth, low-frequency sound bed',
    source: '/audio/focus/deep-brown.m4a',
    volume: 0.2,
  },
  rain: {
    label: 'Steady rain',
    description: 'A spacious rain texture with soft detail',
    source: '/audio/focus/steady-rain.m4a',
    volume: 0.18,
  },
  ocean: {
    label: 'Ocean wash',
    description: 'Slow, layered waves without abrupt peaks',
    source: '/audio/focus/ocean-wash.m4a',
    volume: 0.22,
  },
};

const CROSSFADE_MS = 450;

type OptionalSoundscapeProps = {
  className?: string;
  description?: string;
  options?: SoundscapeId[];
  safetyNote?: string;
  title?: string;
  onChange?: (soundscape: SoundscapeId) => void;
};

function disposeAudio(audio: HTMLAudioElement) {
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
}

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
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingAudioRef = useRef(new Set<HTMLAudioElement>());
  const fadeFramesRef = useRef(new Map<HTMLAudioElement, number>());
  const retiringAudioRef = useRef(new Set<HTMLAudioElement>());
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const visibleOptions: SoundscapeId[] = options.includes('off')
    ? options
    : ['off', ...options];

  const cancelFade = useCallback((audio: HTMLAudioElement) => {
    const frame = fadeFramesRef.current.get(audio);
    if (frame !== undefined) {
      window.cancelAnimationFrame(frame);
      fadeFramesRef.current.delete(audio);
    }
  }, []);

  const fadeAudio = useCallback(
    (
      audio: HTMLAudioElement,
      targetVolume: number,
      onComplete?: () => void
    ) => {
      cancelFade(audio);
      const startVolume = audio.volume;
      const startedAt = performance.now();
      const animate = (now: number) => {
        const progress = Math.max(
          0,
          Math.min(1, (now - startedAt) / CROSSFADE_MS)
        );
        const nextVolume = startVolume + (targetVolume - startVolume) * progress;
        audio.volume = Math.max(0, Math.min(1, nextVolume));
        if (progress < 1) {
          const frame = window.requestAnimationFrame(animate);
          fadeFramesRef.current.set(audio, frame);
          return;
        }
        fadeFramesRef.current.delete(audio);
        onComplete?.();
      };
      const frame = window.requestAnimationFrame(animate);
      fadeFramesRef.current.set(audio, frame);
    },
    [cancelFade]
  );

  const releaseAudio = useCallback((audio: HTMLAudioElement, fade: boolean) => {
    if (!fade) {
      cancelFade(audio);
      retiringAudioRef.current.delete(audio);
      disposeAudio(audio);
      return;
    }
    retiringAudioRef.current.add(audio);
    fadeAudio(audio, 0, () => {
      retiringAudioRef.current.delete(audio);
      disposeAudio(audio);
    });
  }, [cancelFade, fadeAudio]);

  const releaseRetiringAudio = useCallback(() => {
    for (const audio of [...retiringAudioRef.current]) {
      releaseAudio(audio, false);
    }
  }, [releaseAudio]);

  const releasePendingAudio = useCallback(() => {
    if (pendingAudioRef.current.size > 0) requestIdRef.current += 1;
    for (const audio of [...pendingAudioRef.current]) {
      pendingAudioRef.current.delete(audio);
      disposeAudio(audio);
    }
  }, []);

  useEffect(() => {
    const resumeIfInterrupted = () => {
      const audio = activeAudioRef.current;
      if (!audio || !audio.paused || document.hidden) return;
      void audio.play().catch(() => {
        if (mountedRef.current) {
          setError('Sound paused. Choose it again to resume.');
        }
      });
    };
    const handleVisibilityChange = () => {
      if (document.hidden) {
        releasePendingAudio();
        releaseRetiringAudio();
        return;
      }
      resumeIfInterrupted();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', resumeIfInterrupted);
    window.addEventListener('focus', resumeIfInterrupted);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', resumeIfInterrupted);
      window.removeEventListener('focus', resumeIfInterrupted);
    };
  }, [releasePendingAudio, releaseRetiringAudio]);

  useEffect(() => {
    mountedRef.current = true;
    const fadeFrames = fadeFramesRef.current;
    const pendingAudio = pendingAudioRef.current;
    const retiringAudio = retiringAudioRef.current;
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
      for (const [audio, frame] of fadeFrames) {
        window.cancelAnimationFrame(frame);
        disposeAudio(audio);
      }
      fadeFrames.clear();
      for (const audio of pendingAudio) disposeAudio(audio);
      pendingAudio.clear();
      retiringAudio.clear();
      const activeAudio = activeAudioRef.current;
      activeAudioRef.current = null;
      if (activeAudio) disposeAudio(activeAudio);
    };
  }, []);

  const chooseSoundscape = async (next: SoundscapeId) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setError('');

    if (next === 'off') {
      const previous = activeAudioRef.current;
      activeAudioRef.current = null;
      setSoundscape('off');
      onChange?.('off');
      releasePendingAudio();
      releaseRetiringAudio();
      if (previous) releaseAudio(previous, false);
      return;
    }

    const definition = SOUNDSCAPES[next];
    if (!definition.source) return;

    const nextAudio = new Audio(definition.source);
    nextAudio.loop = true;
    nextAudio.preload = 'auto';
    nextAudio.volume = 0;
    pendingAudioRef.current.add(nextAudio);

    try {
      await nextAudio.play();
      pendingAudioRef.current.delete(nextAudio);
      if (!mountedRef.current || requestIdRef.current !== requestId) {
        disposeAudio(nextAudio);
        return;
      }

      const previous = activeAudioRef.current;
      activeAudioRef.current = nextAudio;
      setSoundscape(next);
      onChange?.(next);
      fadeAudio(nextAudio, definition.volume ?? 0.2);
      if (previous) releaseAudio(previous, true);
    } catch (soundError) {
      pendingAudioRef.current.delete(nextAudio);
      disposeAudio(nextAudio);
      if (!mountedRef.current || requestIdRef.current !== requestId) return;
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
