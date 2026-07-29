import { useEffect, useRef, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  AppButton,
  AppCard,
  AppInput,
  AppScreen,
  PageHeader,
  Stat,
  appUiStyles,
} from '@/components/AppUI';
import {
  MIND_GAMES,
  createDigitSequence,
  scoreColorResponse,
  shuffledVisualGrid,
  type MindGame,
} from '@/lib/wellbeing/games';
import { Colors } from '@/lib/constants';

function useCountdown(initial: number) {
  const [seconds, setSeconds] = useState(initial);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running || seconds <= 0) return;
    const interval = setInterval(
      () => setSeconds((current) => Math.max(0, current - 1)),
      1000
    );
    return () => clearInterval(interval);
  }, [running, seconds]);

  useEffect(() => {
    if (seconds === 0) setRunning(false);
  }, [seconds]);

  return {
    seconds,
    running,
    start: () => setRunning(true),
    pause: () => setRunning(false),
    reset: () => {
      setRunning(false);
      setSeconds(initial);
    },
  };
}

function SensoryOrient() {
  const steps = [
    ['see', 5],
    ['feel', 4],
    ['hear', 3],
    ['smell', 2],
    ['taste', 1],
  ] as const;
  const [step, setStep] = useState(0);
  const [items, setItems] = useState<string[]>([]);
  const [entry, setEntry] = useState('');
  const active = steps[step];
  const complete = step >= steps.length;

  const add = () => {
    if (!active || !entry.trim()) return;
    const nextItems = [...items, entry.trim()];
    setEntry('');
    if (nextItems.length >= active[1]) {
      setItems([]);
      setStep((current) => current + 1);
    } else {
      setItems(nextItems);
    }
  };

  return (
    <AppCard>
      {complete ? (
        <>
          <Text style={styles.gameTitle}>You completed the sensory scan.</Text>
          <Text style={[appUiStyles.muted, { marginTop: 7 }]}>
            Notice one detail in the room that feels most present now.
          </Text>
          <AppButton
            label="Start again"
            icon="rotate-ccw"
            onPress={() => {
              setStep(0);
              setItems([]);
              setEntry('');
            }}
            style={{ marginTop: 16 }}
          />
        </>
      ) : (
        <>
          <Text style={appUiStyles.label}>
            {step + 1} of {steps.length}
          </Text>
          <Text style={styles.gameTitle}>
            Name {active[1]} {active[0] === 'see' ? 'things you see' : `things you ${active[0]}`}
          </Text>
          <Text style={[appUiStyles.muted, { marginTop: 7 }]}>
            {items.length} of {active[1]} named. Plain descriptions are enough.
          </Text>
          <AppInput
            value={entry}
            onChangeText={setEntry}
            placeholder={`Something you ${active[0]}`}
            returnKeyType="done"
            onSubmitEditing={add}
            style={{ marginTop: 15 }}
          />
          <AppButton
            label="Add"
            icon="plus"
            disabled={!entry.trim()}
            onPress={add}
          />
        </>
      )}
    </AppCard>
  );
}

const COLOR_ROUNDS = [
  { word: 'GREEN', ink: 'Clay', color: Colors.accent },
  { word: 'BLUE', ink: 'Green', color: '#2f765c' },
  { word: 'CLAY', ink: 'Blue', color: '#466b78' },
  { word: 'GREEN', ink: 'Blue', color: '#466b78' },
  { word: 'BLUE', ink: 'Clay', color: Colors.accent },
] as const;

function ColorSwitch() {
  const timer = useCountdown(60);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const current = COLOR_ROUNDS[round % COLOR_ROUNDS.length];

  const answer = (value: string) => {
    if (!timer.running) return;
    if (scoreColorResponse(current.word, current.ink, value)) {
      setScore((value) => value + 1);
    }
    setAttempts((value) => value + 1);
    setRound((value) => value + 1);
  };

  const reset = () => {
    timer.reset();
    setRound(0);
    setScore(0);
    setAttempts(0);
  };

  return (
    <AppCard>
      <View style={styles.stats}>
        <Stat label="Seconds" value={timer.seconds} />
        <Stat label="Correct" value={score} />
        <Stat label="Tried" value={attempts} />
      </View>
      <Text style={[appUiStyles.muted, { marginTop: 12 }]}>
        Tap the ink color, not the written word.
      </Text>
      <Text style={[styles.colorWord, { color: current.color }]}>
        {current.word}
      </Text>
      <View style={styles.answerRow}>
        {['Green', 'Blue', 'Clay'].map((color) => (
          <AppButton
            key={color}
            label={color}
            variant="secondary"
            disabled={!timer.running}
            onPress={() => answer(color)}
            style={{ flex: 1 }}
          />
        ))}
      </View>
      <View style={styles.controls}>
        <AppButton
          label={timer.running ? 'Pause' : timer.seconds === 60 ? 'Start' : 'Continue'}
          icon={timer.running ? 'pause' : 'play'}
          onPress={timer.running ? timer.pause : timer.start}
          style={{ flex: 1 }}
        />
        <AppButton label="Reset" icon="rotate-ccw" variant="quiet" onPress={reset} />
      </View>
    </AppCard>
  );
}

function SequenceHold() {
  const [length, setLength] = useState(3);
  const [sequence, setSequence] = useState(() => createDigitSequence(3));
  const [visible, setVisible] = useState(false);
  const [answer, setAnswer] = useState('');
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState('');
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    },
    []
  );

  const show = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    const next = createDigitSequence(length);
    setSequence(next);
    setAnswer('');
    setStatus('');
    setVisible(true);
    hideTimerRef.current = setTimeout(() => setVisible(false), 1800);
  };

  const submit = () => {
    const correct = answer.replace(/\D/g, '') === sequence.join('');
    setStatus(correct ? 'Correct.' : `The sequence was ${sequence.join(' ')}`);
    if (correct) {
      setScore((value) => value + 1);
      setLength((value) => Math.min(9, value + 1));
    } else {
      setLength((value) => Math.max(3, value - 1));
    }
  };

  return (
    <AppCard>
      <View style={styles.stats}>
        <Stat label="Sequence length" value={length} />
        <Stat label="Correct rounds" value={score} />
      </View>
      <View style={styles.sequenceBox}>
        <Text style={styles.sequenceText}>
          {visible ? sequence.join('  ') : 'Ready when you are'}
        </Text>
      </View>
      <AppButton
        label={visible ? 'Memorize' : 'Show a sequence'}
        icon="eye"
        disabled={visible}
        onPress={show}
      />
      {!visible ? (
        <>
          <AppInput
            label="Enter the digits"
            value={answer}
            onChangeText={setAnswer}
            placeholder="Example: 419"
            keyboardType="number-pad"
            style={{ marginTop: 14 }}
          />
          <AppButton
            label="Check"
            variant="secondary"
            disabled={answer.replace(/\D/g, '').length !== sequence.length}
            onPress={submit}
          />
        </>
      ) : null}
      {status ? (
        <Text style={[appUiStyles.muted, { marginTop: 12 }]}>{status}</Text>
      ) : null}
    </AppCard>
  );
}

function VisualSweep() {
  const timer = useCountdown(60);
  const [grid, setGrid] = useState(() =>
    shuffledVisualGrid(25, 'target', 'distractor')
  );
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);

  const choose = (item: string) => {
    if (!timer.running) return;
    if (item === 'target') {
      setScore((value) => value + 1);
      setGrid(shuffledVisualGrid(25, 'target', 'distractor'));
    } else {
      setMisses((value) => value + 1);
    }
  };

  return (
    <AppCard>
      <View style={styles.stats}>
        <Stat label="Seconds" value={timer.seconds} />
        <Stat label="Found" value={score} />
        <Stat label="Misses" value={misses} />
      </View>
      <Text style={[appUiStyles.muted, { marginTop: 12 }]}>
        Find the one square among the circles.
      </Text>
      <View style={styles.visualGrid}>
        {grid.map((item, index) => (
          <Pressable
            key={`${item}-${index}-${score}`}
            accessibilityRole="button"
            accessibilityLabel={item === 'target' ? 'Square' : 'Circle'}
            disabled={!timer.running}
            onPress={() => choose(item)}
            style={({ pressed }) => [
              styles.visualCell,
              pressed && styles.pressed,
            ]}
          >
            <Feather
              name={item === 'target' ? 'square' : 'circle'}
              size={24}
              color={timer.running ? Colors.primary : Colors.border}
            />
          </Pressable>
        ))}
      </View>
      <View style={styles.controls}>
        <AppButton
          label={timer.running ? 'Pause' : timer.seconds === 60 ? 'Start' : 'Continue'}
          icon={timer.running ? 'pause' : 'play'}
          onPress={timer.running ? timer.pause : timer.start}
          style={{ flex: 1 }}
        />
        <AppButton
          label="Reset"
          icon="rotate-ccw"
          variant="quiet"
          onPress={() => {
            timer.reset();
            setScore(0);
            setMisses(0);
            setGrid(shuffledVisualGrid(25, 'target', 'distractor'));
          }}
        />
      </View>
    </AppCard>
  );
}

const CATEGORIES = [
  'foods you enjoy',
  'places you would like to visit',
  'things found in a kitchen',
  'songs you know',
  'people who have helped you',
] as const;

function CategorySprint() {
  const timer = useCountdown(60);
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [entry, setEntry] = useState('');
  const [items, setItems] = useState<string[]>([]);

  const add = () => {
    const clean = entry.trim();
    if (!clean || !timer.running) return;
    setItems((current) => [...current, clean]);
    setEntry('');
  };

  const reset = () => {
    timer.reset();
    setEntry('');
    setItems([]);
    setCategoryIndex((current) => (current + 1) % CATEGORIES.length);
  };

  return (
    <AppCard>
      <View style={styles.stats}>
        <Stat label="Seconds" value={timer.seconds} />
        <Stat label="Named" value={items.length} />
      </View>
      <Text style={styles.categoryTitle}>{CATEGORIES[categoryIndex]}</Text>
      <Text style={[appUiStyles.muted, { marginTop: 5 }]}>
        Name examples at a comfortable pace. There is no target score.
      </Text>
      <View style={styles.entryRow}>
        <TextInput
          value={entry}
          onChangeText={setEntry}
          placeholder="Add one"
          placeholderTextColor={Colors.textSecondary}
          editable={timer.running}
          returnKeyType="done"
          onSubmitEditing={add}
          style={styles.inlineInput}
        />
        <AppButton
          label="Add"
          disabled={!timer.running || !entry.trim()}
          onPress={add}
        />
      </View>
      {items.length > 0 ? (
        <Text style={styles.items} numberOfLines={3}>
          {items.join(' · ')}
        </Text>
      ) : null}
      <View style={styles.controls}>
        <AppButton
          label={timer.running ? 'Pause' : timer.seconds === 60 ? 'Start' : 'Continue'}
          icon={timer.running ? 'pause' : 'play'}
          onPress={timer.running ? timer.pause : timer.start}
          style={{ flex: 1 }}
        />
        <AppButton label="New round" icon="rotate-ccw" variant="quiet" onPress={reset} />
      </View>
    </AppCard>
  );
}

function GameRunner({ game }: { game: MindGame }) {
  if (game.id === 'sensory-orient') return <SensoryOrient />;
  if (game.id === 'color-switch') return <ColorSwitch />;
  if (game.id === 'sequence-hold') return <SequenceHold />;
  if (game.id === 'visual-sweep') return <VisualSweep />;
  return <CategorySprint />;
}

export default function MindGamesScreen() {
  const [selected, setSelected] = useState<MindGame | null>(null);

  return (
    <AppScreen>
      <PageHeader
        eyebrow="Offline mind games"
        title="Give attention one clear job."
        description="Five short activities for grounding and cognitive practice. Scores stay on this screen."
        icon="grid"
      />

      {selected ? (
        <>
          <AppButton
            label="Choose another game"
            icon="arrow-left"
            variant="quiet"
            onPress={() => setSelected(null)}
            style={{ alignSelf: 'flex-start', marginBottom: 12 }}
          />
          <AppCard quiet>
            <Text style={appUiStyles.label}>{selected.skill}</Text>
            <Text style={styles.selectedTitle}>{selected.title}</Text>
            <Text style={[appUiStyles.muted, { marginTop: 7 }]}>
              {selected.description}
            </Text>
          </AppCard>
          <GameRunner key={selected.id} game={selected} />
        </>
      ) : (
        MIND_GAMES.map((game) => (
          <Pressable
            key={game.id}
            accessibilityRole="button"
            onPress={() => setSelected(game)}
            style={({ pressed }) => [
              styles.gameCard,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.gameIcon}>
              <Feather
                name={
                  game.id === 'sensory-orient'
                    ? 'compass'
                    : game.id === 'color-switch'
                      ? 'shuffle'
                      : game.id === 'sequence-hold'
                        ? 'hash'
                        : game.id === 'visual-sweep'
                          ? 'search'
                          : 'list'
                }
                size={19}
                color={Colors.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.gameMeta}>
                <Text style={styles.skill}>{game.skill}</Text>
                <Text style={styles.duration}>{game.duration}</Text>
              </View>
              <Text style={styles.cardTitle}>{game.title}</Text>
              <Text style={styles.cardDescription}>{game.description}</Text>
            </View>
            <Feather name="chevron-right" size={20} color={Colors.textSecondary} />
          </Pressable>
        ))
      )}

      <AppCard quiet style={{ marginTop: 10 }}>
        <View style={styles.noteHeader}>
          <Feather name="info" size={17} color={Colors.primary} />
          <Text style={styles.noteTitle}>Practice, not diagnosis</Text>
        </View>
        <Text style={appUiStyles.muted}>
          These activities do not measure intelligence or promise broad cognitive
          improvement. Stop if one increases distress.
        </Text>
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  gameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 15,
    marginBottom: 10,
  },
  pressed: { opacity: 0.76 },
  gameIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skill: { color: Colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  duration: { color: Colors.textSecondary, fontSize: 10 },
  cardTitle: { color: Colors.text, fontSize: 16, fontWeight: '700', marginTop: 4 },
  cardDescription: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  selectedTitle: {
    color: Colors.text,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '700',
    marginTop: 7,
  },
  gameTitle: {
    color: Colors.text,
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '700',
    marginTop: 7,
  },
  stats: { flexDirection: 'row', gap: 12 },
  colorWord: {
    textAlign: 'center',
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: 2,
    marginVertical: 30,
  },
  answerRow: { flexDirection: 'row', gap: 7 },
  controls: { flexDirection: 'row', gap: 9, marginTop: 16 },
  sequenceBox: {
    minHeight: 92,
    borderRadius: 15,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 18,
    padding: 12,
  },
  sequenceText: {
    color: Colors.text,
    fontSize: 27,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  visualGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 17,
    justifyContent: 'center',
  },
  visualCell: {
    width: '20%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTitle: {
    color: Colors.text,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '700',
    marginTop: 18,
    textTransform: 'capitalize',
  },
  entryRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  inlineInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    color: Colors.text,
    paddingHorizontal: 13,
  },
  items: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 7,
  },
  noteTitle: { color: Colors.text, fontSize: 15, fontWeight: '700' },
});
