'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Brain,
  Check,
  Eye,
  ListRestart,
  Play,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DismissibleNotice } from '@/components/dismissible-notice';
import {
  MIND_GAMES,
  createDigitSequence,
  scoreColorResponse,
  shuffledVisualGrid,
  type MindGameId,
} from '@/lib/wellbeing/games';
import { cn } from '@/lib/utils';

const COLORS = [
  { name: 'red', className: 'text-red-600' },
  { name: 'blue', className: 'text-blue-600' },
  { name: 'green', className: 'text-emerald-600' },
  { name: 'orange', className: 'text-orange-600' },
] as const;

function newColorPrompt() {
  const word = COLORS[Math.floor(Math.random() * COLORS.length)].name;
  const ink = COLORS[Math.floor(Math.random() * COLORS.length)];
  return { word, ink };
}

export default function MindGamesPage() {
  const [activeId, setActiveId] = useState<MindGameId>('sensory-orient');
  const active = MIND_GAMES.find((game) => game.id === activeId) ?? MIND_GAMES[0];

  return (
    <main className="px-4 py-8 md:px-8 md:py-12">
      <div className="mx-auto max-w-5xl">
        <header className="max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <Brain className="h-3.5 w-3.5" aria-hidden="true" />
            Mind games
          </div>
          <h1 className="font-display text-4xl font-medium leading-[1.05] tracking-[-0.02em] text-foreground md:text-5xl">
            A short task for the attention you have now.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Five local-only exercises for orienting, attention, working memory, and
            mental flexibility. Scores stay in this page and are never interpreted
            clinically.
          </p>
        </header>

        <div className="mt-8 grid gap-5 lg:grid-cols-[0.72fr_1.28fr]">
          <nav aria-label="Mind games" className="space-y-2">
            {MIND_GAMES.map((game) => (
              <button
                key={game.id}
                type="button"
                onClick={() => setActiveId(game.id)}
                aria-current={activeId === game.id ? 'page' : undefined}
                className={cn(
                  'w-full rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  activeId === game.id
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-foreground hover:bg-secondary'
                )}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{game.title}</span>
                  <span
                    className={cn(
                      'text-xs',
                      activeId === game.id
                        ? 'text-primary-foreground/65'
                        : 'text-muted-foreground'
                    )}
                  >
                    {game.duration}
                  </span>
                </span>
                <span
                  className={cn(
                    'mt-1 block text-xs',
                    activeId === game.id
                      ? 'text-primary-foreground/70'
                      : 'text-muted-foreground'
                  )}
                >
                  {game.skill}
                </span>
              </button>
            ))}
          </nav>

          <section className="app-panel overflow-hidden">
            <div className="border-b border-border bg-secondary/55 p-5 md:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {active.skill}
              </p>
              <h2 className="mt-2 font-display text-3xl font-medium text-foreground">
                {active.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {active.description}
              </p>
            </div>
            <div className="min-h-[25rem] p-5 md:p-7">
              <GameSurface key={active.id} gameId={active.id} />
            </div>
            <p className="border-t border-border px-5 py-3 text-xs leading-relaxed text-muted-foreground">
              {active.evidenceNote}
            </p>
          </section>
        </div>

        <DismissibleNotice
          noticeKey="mind-games-limits-v1"
          className="mt-6"
          title="Practice, not a brain score"
        >
          Research suggests trained-task gains are usually narrow and average
          real-life transfer may be small. These exercises do not diagnose,
          rehabilitate, or prove cognitive improvement. They are cached for offline
          use after your first visit.{' '}
          <a href="/research#mind-games" className="font-medium underline">
            Review the evidence
          </a>
          .
        </DismissibleNotice>
      </div>
    </main>
  );
}

function GameSurface({ gameId }: { gameId: MindGameId }) {
  if (gameId === 'sensory-orient') return <SensoryOrient />;
  if (gameId === 'color-switch') return <ColorSwitch />;
  if (gameId === 'sequence-hold') return <SequenceHold />;
  if (gameId === 'visual-sweep') return <VisualSweep />;
  return <CategorySprint />;
}

const SENSORY_STEPS = [
  { count: 5, sense: 'see', prompt: 'Look around slowly. Name five things you can see.' },
  {
    count: 4,
    sense: 'feel',
    prompt: 'Name four body or touch sensations, without forcing them to change.',
  },
  { count: 3, sense: 'hear', prompt: 'Name three sounds, including quiet ones.' },
  {
    count: 2,
    sense: 'smell',
    prompt: 'Name two smells, or two smells you remember as safe or neutral.',
  },
  {
    count: 1,
    sense: 'taste',
    prompt: 'Name one taste, or take one comfortable sip of water.',
  },
] as const;

function SensoryOrient() {
  const [step, setStep] = useState(0);
  const complete = step >= SENSORY_STEPS.length;
  const current = SENSORY_STEPS[Math.min(step, SENSORY_STEPS.length - 1)];

  if (complete) {
    return (
      <div className="grid min-h-[21rem] place-items-center text-center">
        <div>
          <Check className="mx-auto h-8 w-8 text-accent" aria-hidden="true" />
          <h3 className="mt-4 font-display text-3xl text-foreground">
            Notice where you are now.
          </h3>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            You do not need to feel fully calm for orienting to count. Choose whether
            to repeat, move, contact someone, or return to your next step.
          </p>
          <Button className="mt-6" variant="outline" onClick={() => setStep(0)}>
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
            Repeat
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-[21rem] place-items-center text-center">
      <div>
        <p className="font-display text-7xl text-primary">{current.count}</p>
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Things you can {current.sense}
        </p>
        <p className="mx-auto mt-5 max-w-lg font-display text-2xl leading-relaxed text-foreground">
          {current.prompt}
        </p>
        <Button className="mt-7" onClick={() => setStep((value) => value + 1)}>
          Next sense
        </Button>
      </div>
    </div>
  );
}

function ColorSwitch() {
  const [prompt, setPrompt] = useState(newColorPrompt);
  const [round, setRound] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [feedback, setFeedback] = useState('');
  const complete = round >= 10;

  const answer = (value: string) => {
    if (complete) return;
    const isCorrect = scoreColorResponse(prompt.word, prompt.ink.name, value);
    setCorrect((count) => count + (isCorrect ? 1 : 0));
    setFeedback(isCorrect ? 'Correct' : `The ink was ${prompt.ink.name}.`);
    setRound((value) => value + 1);
    setPrompt(newColorPrompt());
  };

  const restart = () => {
    setPrompt(newColorPrompt());
    setRound(0);
    setCorrect(0);
    setFeedback('');
  };

  return (
    <div className="grid min-h-[21rem] place-items-center text-center">
      <div className="w-full max-w-lg">
        {complete ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Ten rounds complete
            </p>
            <p className="mt-4 font-display text-5xl text-foreground">
              {correct}/10
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              This is a practice result, not a measure of your cognitive health.
            </p>
            <Button className="mt-6" variant="outline" onClick={restart}>
              <ListRestart className="mr-2 h-4 w-4" aria-hidden="true" />
              New round
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Choose the ink color, not the word.
            </p>
            <p
              className={cn(
                'my-10 font-display text-6xl font-semibold uppercase',
                prompt.ink.className
              )}
            >
              {prompt.word}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {COLORS.map((color) => (
                <Button
                  key={color.name}
                  type="button"
                  variant="outline"
                  onClick={() => answer(color.name)}
                  className="capitalize"
                >
                  {color.name}
                </Button>
              ))}
            </div>
            <p className="mt-4 min-h-5 text-xs text-muted-foreground" aria-live="polite">
              {feedback || `Round ${round + 1} of 10`}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function SequenceHold() {
  const [sequence, setSequence] = useState<string[]>([]);
  const [visible, setVisible] = useState(false);
  const [answer, setAnswer] = useState('');
  const [level, setLevel] = useState(3);
  const [feedback, setFeedback] = useState('Press start when you are ready.');
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    []
  );

  const start = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    const next = createDigitSequence(level);
    setSequence(next);
    setAnswer('');
    setVisible(true);
    setFeedback('Hold the sequence in mind.');
    timerRef.current = window.setTimeout(() => {
      setVisible(false);
      setFeedback('Enter the digits in the same order.');
    }, 2_000);
  };

  const check = () => {
    const clean = answer.replace(/\D/g, '');
    const isCorrect = clean === sequence.join('');
    setFeedback(
      isCorrect
        ? 'Correct. The next sequence is one digit longer.'
        : `The sequence was ${sequence.join(' ')}. Try the same length again.`
    );
    if (isCorrect) setLevel((value) => Math.min(8, value + 1));
    setSequence([]);
    setVisible(false);
    setAnswer('');
  };

  return (
    <div className="grid min-h-[21rem] place-items-center text-center">
      <div className="w-full max-w-md">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {level} digits
        </p>
        {visible ? (
          <p className="my-12 font-display text-5xl tracking-[0.25em] text-foreground">
            {sequence.join(' ')}
          </p>
        ) : sequence.length > 0 ? (
          <div className="my-8">
            <Input
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && answer.trim()) check();
              }}
              inputMode="numeric"
              autoComplete="off"
              aria-label="Sequence answer"
              className="mx-auto max-w-xs text-center text-2xl tracking-[0.2em]"
            />
            <Button className="mt-3" onClick={check} disabled={!answer.trim()}>
              Check sequence
            </Button>
          </div>
        ) : (
          <Button className="my-10" onClick={start}>
            <Play className="mr-2 h-4 w-4" aria-hidden="true" />
            Show sequence
          </Button>
        )}
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {feedback}
        </p>
      </div>
    </div>
  );
}

function VisualSweep() {
  const [grid, setGrid] = useState(() => shuffledVisualGrid(30, 'Q', 'O'));
  const [round, setRound] = useState(1);
  const [feedback, setFeedback] = useState('Find the Q among the O characters.');

  const choose = (value: string) => {
    if (value === 'Q') {
      setFeedback('Found. Slow your eyes before the next grid.');
      setRound((value) => value + 1);
      setGrid(shuffledVisualGrid(30, 'Q', 'O'));
    } else {
      setFeedback('That was an O. Keep scanning without rushing.');
    }
  };

  return (
    <div className="grid min-h-[21rem] place-items-center text-center">
      <div className="w-full max-w-md">
        <div className="mb-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>Round {round}</span>
          <span>Target: Q</span>
        </div>
        <div className="grid grid-cols-6 gap-2" aria-label="Visual search grid">
          {grid.map((value, index) => (
            <button
              key={`${round}-${index}`}
              type="button"
              onClick={() => choose(value)}
              aria-label={`Grid position ${index + 1}: ${value}`}
              className="grid aspect-square place-items-center rounded-lg border border-border bg-background font-mono text-lg text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {value}
            </button>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground" aria-live="polite">
          {feedback}
        </p>
      </div>
    </div>
  );
}

const CATEGORIES = [
  'foods you enjoy',
  'places that feel neutral or safe',
  'things found in a kitchen',
  'animals',
  'songs you know',
];

function CategorySprint() {
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [seconds, setSeconds] = useState(60);
  const [running, setRunning] = useState(false);
  const [answer, setAnswer] = useState('');
  const entries = useMemo(
    () =>
      answer
        .split(/[,\n]/)
        .map((value) => value.trim())
        .filter(Boolean),
    [answer]
  );

  useEffect(() => {
    if (!running || seconds <= 0) return;
    const timer = window.setInterval(
      () => setSeconds((value) => Math.max(0, value - 1)),
      1_000
    );
    return () => window.clearInterval(timer);
  }, [running, seconds]);

  useEffect(() => {
    if (seconds === 0) setRunning(false);
  }, [seconds]);

  const restart = () => {
    setCategory(CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)]);
    setSeconds(60);
    setRunning(false);
    setAnswer('');
  };

  return (
    <div className="grid min-h-[21rem] place-items-center">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Name {category}
          </p>
          <span className="font-mono text-sm tabular-nums text-foreground">
            {seconds}s
          </span>
        </div>
        <Textarea
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          disabled={!running || seconds === 0}
          placeholder="Separate each answer with a comma or new line"
          className="mt-4 min-h-40"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {entries.length} item{entries.length === 1 ? '' : 's'}
          </p>
          {!running && seconds === 60 ? (
            <Button onClick={() => setRunning(true)}>
              <Play className="mr-2 h-4 w-4" aria-hidden="true" />
              Start
            </Button>
          ) : (
            <Button variant="outline" onClick={restart}>
              <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
              New category
            </Button>
          )}
        </div>
        {seconds === 0 && (
          <p className="mt-4 rounded-xl bg-secondary px-4 py-3 text-sm text-foreground">
            Time. The count is not a cognitive score; notice whether a short verbal
            task helped you reorient.
          </p>
        )}
      </div>
    </div>
  );
}
