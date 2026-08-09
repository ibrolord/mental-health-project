import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AppState,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  AppButton,
  AppCard,
  AppInput,
  AppScreen,
  PageHeader,
  SectionHeader,
  appUiStyles,
} from '@/components/AppUI';
import { Colors } from '@/lib/constants';
import { useDataContext } from '@/lib/hooks/use-data-context';
import { emptyJournalDraft, prepareJournalDraft } from '@/lib/journal';
import {
  completedReflectionSteps,
  REFLECTION_RESPONSE_LIMIT,
  REFLECTION_TEMPLATES,
  reflectionTemplateById,
  serializeReflectionResponses,
  validateReflectionResponses,
  type ReflectionDraftWriteToken,
  type ReflectionTemplate,
  type ReflectionTemplateId,
} from '@/lib/reflections';
import { reflectionDraftStorage } from '@/lib/reflection-draft-storage';
import { supabase } from '@/lib/supabase';

type FeatherName = ComponentProps<typeof Feather>['name'];
type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type DraftState = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

const TEMPLATE_ICONS: Record<ReflectionTemplateId, FeatherName> = {
  'balanced-thought': 'git-branch',
  'solve-one-thing': 'check-square',
  'make-room': 'compass',
  'compassionate-reset': 'heart',
  'good-moments': 'sun',
  'express-and-close': 'book-open',
  'weekly-patterns': 'activity',
};

const PRIMARY_TEMPLATES = REFLECTION_TEMPLATES.filter(
  (template) => template.primary
);
const MORE_TEMPLATES = REFLECTION_TEMPLATES.filter(
  (template) => !template.primary
);
function draftStatusCopy(state: DraftState): string | null {
  if (state === 'loading') return 'Checking for a private draft...';
  if (state === 'saving') return 'Saving encrypted draft...';
  if (state === 'saved') return 'Encrypted draft saved on this device.';
  if (state === 'error') {
    return 'This device could not save the draft. Your words remain on this screen.';
  }
  return null;
}

export default function ReflectScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { context, authLoading } = useDataContext();
  const [activeId, setActiveId] = useState<ReflectionTemplateId | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [showMore, setShowMore] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [draftState, setDraftState] = useState<DraftState>('loading');
  const [draftReady, setDraftReady] = useState(false);
  const [stateOwnerId, setStateOwnerId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const ownerIdRef = useRef(context.user_id);
  const ownerGenerationRef = useRef(0);
  const mountedRef = useRef(true);
  const draftWriteSequenceRef = useRef(0);
  const pendingDraftWriteRef = useRef<Promise<void> | null>(null);
  const nextDraftSnapshotIdRef = useRef(0);
  const queuedDraftSnapshotIdsRef = useRef(new Set<number>());
  const latestDraftRef = useRef<{
    snapshotId: number;
    ownerId: string;
    ownerGeneration: number;
    writeToken: ReflectionDraftWriteToken;
    templateId: ReflectionTemplateId;
    stepIndex: number;
    responses: Record<string, string>;
  } | null>(null);
  const persistDraftSnapshotRef = useRef<
    (snapshot: NonNullable<typeof latestDraftRef.current>) => Promise<void>
  >(async () => {});
  const flushDraftRef = useRef<() => Promise<void>>(async () => {});
  ownerIdRef.current = context.user_id;

  const stateMatchesOwner = stateOwnerId === context.user_id;
  const activeTemplate = stateMatchesOwner
    ? reflectionTemplateById(activeId)
    : null;

  useEffect(() => {
    const ownerId = context.user_id;
    const previousSnapshot = latestDraftRef.current;
    latestDraftRef.current = null;
    if (previousSnapshot) {
      void persistDraftSnapshotRef.current(previousSnapshot);
    }
    const ownerGeneration = ++ownerGenerationRef.current;
    let active = true;

    setStateOwnerId(null);
    setActiveId(null);
    setStepIndex(0);
    setResponses({});
    setSaveState('idle');
    setDraftReady(false);
    setDraftState(authLoading ? 'loading' : 'idle');
    setError('');
    if (authLoading || !ownerId) {
      return () => {
        active = false;
      };
    }

    setDraftState('loading');
    void reflectionDraftStorage
      .read(ownerId)
      .then((draft) => {
        if (
          !active ||
          ownerIdRef.current !== ownerId ||
          ownerGenerationRef.current !== ownerGeneration
        ) {
          return;
        }
        const requestedTemplate = reflectionTemplateById(
          typeof params.mode === 'string'
            ? (params.mode as ReflectionTemplateId)
            : null
        );
        const restoreDraft = () => {
          if (!draft) return;
          setActiveId(draft.templateId);
          setStepIndex(draft.stepIndex);
          setResponses(draft.responses);
          setStateOwnerId(ownerId);
          setDraftState('saved');
          setDraftReady(true);
        };
        const startRequestedTemplate = () => {
          if (!requestedTemplate) return;
          setActiveId(requestedTemplate.id);
          setStepIndex(0);
          setResponses({});
          setStateOwnerId(ownerId);
          setDraftState('idle');
          setDraftReady(true);
        };

        if (
          draft &&
          requestedTemplate &&
          draft.templateId !== requestedTemplate.id
        ) {
          setStateOwnerId(ownerId);
          setDraftState('saved');
          setDraftReady(true);
          Alert.alert(
            'You have a reflection draft',
            `Resume it, or start ${requestedTemplate.title.toLowerCase()} and replace it.`,
            [
              {
                text: 'Not now',
                style: 'cancel',
              },
              {
                text: 'Resume draft',
                onPress: restoreDraft,
              },
              {
                text: `Start ${requestedTemplate.title}`,
                style: 'destructive',
                onPress: () => {
                  setDraftReady(false);
                  void reflectionDraftStorage
                    .clear(ownerId)
                    .then(() => {
                      if (
                        ownerIdRef.current === ownerId &&
                        ownerGenerationRef.current === ownerGeneration
                      ) {
                        startRequestedTemplate();
                      }
                    })
                    .catch(() => {
                      if (
                        ownerIdRef.current === ownerId &&
                        ownerGenerationRef.current === ownerGeneration
                      ) {
                        restoreDraft();
                        setError('The existing draft could not be replaced.');
                      }
                    });
                },
              },
            ]
          );
          return;
        }

        if (draft) {
          restoreDraft();
        } else {
          if (requestedTemplate) setActiveId(requestedTemplate.id);
          setStateOwnerId(ownerId);
          setDraftState('idle');
          setDraftReady(true);
        }
      })
      .catch(() => {
        if (
          !active ||
          ownerIdRef.current !== ownerId ||
          ownerGenerationRef.current !== ownerGeneration
        ) {
          return;
        }
        setStateOwnerId(ownerId);
        setDraftState('error');
        setDraftReady(true);
      });

    return () => {
      active = false;
    };
  }, [authLoading, context.user_id, params.mode]);

  persistDraftSnapshotRef.current = async (snapshot) => {
    if (queuedDraftSnapshotIdsRef.current.has(snapshot.snapshotId)) {
      await pendingDraftWriteRef.current?.catch(() => {});
      return;
    }
    queuedDraftSnapshotIdsRef.current.add(snapshot.snapshotId);
    const sequence = ++draftWriteSequenceRef.current;
    if (
      mountedRef.current &&
      ownerIdRef.current === snapshot.ownerId &&
      ownerGenerationRef.current === snapshot.ownerGeneration
    ) {
      setDraftState('saving');
    }

    const previous = pendingDraftWriteRef.current;
    const operation = (previous ? previous.catch(() => {}) : Promise.resolve()).then(
      () =>
        reflectionDraftStorage.write(
          snapshot.ownerId,
          {
            templateId: snapshot.templateId,
            stepIndex: snapshot.stepIndex,
            responses: snapshot.responses,
          },
          snapshot.writeToken
        )
    );
    const trackedOperation = operation.then(() => undefined);
    pendingDraftWriteRef.current = trackedOperation;

    try {
      const didWrite = await operation;
      if (
        didWrite &&
        mountedRef.current &&
        sequence === draftWriteSequenceRef.current &&
        ownerIdRef.current === snapshot.ownerId &&
        ownerGenerationRef.current === snapshot.ownerGeneration
      ) {
        setDraftState('saved');
      }
    } catch {
      if (
        mountedRef.current &&
        sequence === draftWriteSequenceRef.current &&
        ownerIdRef.current === snapshot.ownerId &&
        ownerGenerationRef.current === snapshot.ownerGeneration
      ) {
        setDraftState('error');
      }
    } finally {
      if (pendingDraftWriteRef.current === trackedOperation) {
        pendingDraftWriteRef.current = null;
      }
    }
  };

  flushDraftRef.current = async () => {
    const snapshot = latestDraftRef.current;
    if (snapshot) {
      await persistDraftSnapshotRef.current(snapshot);
      return;
    }
    await pendingDraftWriteRef.current?.catch(() => {});
  };

  useEffect(() => {
    const ownerId = context.user_id;
    if (
      !draftReady ||
      !ownerId ||
      stateOwnerId !== ownerId ||
      !activeTemplate ||
      saveState === 'saving' ||
      saveState === 'saved'
    ) {
      return;
    }

    latestDraftRef.current = {
      snapshotId: ++nextDraftSnapshotIdRef.current,
      ownerId,
      ownerGeneration: ownerGenerationRef.current,
      writeToken: reflectionDraftStorage.captureWriteToken(ownerId),
      templateId: activeTemplate.id,
      stepIndex,
      responses: { ...responses },
    };
    const timeout = setTimeout(() => {
      void flushDraftRef.current();
    }, 350);

    return () => clearTimeout(timeout);
  }, [
    activeTemplate,
    context.user_id,
    draftReady,
    responses,
    saveState,
    stateOwnerId,
    stepIndex,
  ]);

  useEffect(() => {
    mountedRef.current = true;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'inactive' || nextState === 'background') {
        void flushDraftRef.current();
      }
    });
    return () => {
      mountedRef.current = false;
      subscription.remove();
      void flushDraftRef.current();
    };
  }, []);

  const resetReflection = () => {
    latestDraftRef.current = null;
    setActiveId(null);
    setStepIndex(0);
    setResponses({});
    setSaveState('idle');
    setDraftState('idle');
    setDraftReady(Boolean(context.user_id && !authLoading));
    setError('');
  };

  const begin = (template: ReflectionTemplate) => {
    if (
      authLoading ||
      !context.user_id ||
      stateOwnerId !== context.user_id ||
      !draftReady
    ) {
      setError('Your private profile is still loading. Please try again.');
      return;
    }
    setActiveId(template.id);
    setStepIndex(0);
    setResponses({});
    setSaveState('idle');
    setError('');
  };

  const discardDraft = () => {
    const ownerId = context.user_id;
    if (!ownerId) return;
    Alert.alert(
      'Discard this draft?',
      'Your answers will be removed from this device.',
      [
        { text: 'Keep writing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            latestDraftRef.current = null;
            setDraftReady(false);
            void reflectionDraftStorage
              .clear(ownerId)
              .then(() => {
                if (ownerIdRef.current === ownerId) resetReflection();
              })
              .catch(() => {
                if (ownerIdRef.current === ownerId) {
                  setDraftReady(true);
                  setError('The encrypted draft could not be removed. Please try again.');
                }
              });
          },
        },
      ]
    );
  };

  const updateResponse = (stepId: string, value: string) => {
    setResponses((current) => ({ ...current, [stepId]: value }));
    if (saveState !== 'idle') setSaveState('idle');
    if (error) setError('');
  };

  const changeStep = (nextStep: number) => {
    if (!activeTemplate) return;
    setStepIndex(Math.max(0, Math.min(activeTemplate.steps.length - 1, nextStep)));
    if (error) setError('');
  };

  const saveReflection = async () => {
    const ownerId = context.user_id;
    if (!activeTemplate || !ownerId || authLoading) {
      setSaveState('error');
      setError('Your private profile is still loading. Please try again.');
      return;
    }

    const validationError = validateReflectionResponses(activeTemplate, responses);
    if (validationError) {
      setSaveState('error');
      setError(validationError);
      return;
    }

    const content = serializeReflectionResponses(activeTemplate, responses);
    const prepared = prepareJournalDraft({
      ...emptyJournalDraft(),
      title: activeTemplate.title,
      content,
      prompt: activeTemplate.summary,
      entryKind: 'guided',
      tags: ['guided reflection', ...activeTemplate.tags].join(', '),
    });
    const ownerGeneration = ownerGenerationRef.current;

    setSaveState('saving');
    setError('');
    try {
      const result = await supabase
        .from('journal_entries')
        .insert({ ...prepared, user_id: ownerId })
        .select('id')
        .single();

      if (
        ownerIdRef.current !== ownerId ||
        ownerGenerationRef.current !== ownerGeneration
      ) {
        return;
      }
      if (result.error || !result.data) {
        setSaveState('error');
        setError('This reflection could not be saved. Your responses are still here.');
        return;
      }

      try {
        latestDraftRef.current = null;
        await reflectionDraftStorage.clear(ownerId);
        if (
          ownerIdRef.current !== ownerId ||
          ownerGenerationRef.current !== ownerGeneration
        ) {
          return;
        }
        setDraftState('idle');
      } catch {
        if (
          ownerIdRef.current !== ownerId ||
          ownerGenerationRef.current !== ownerGeneration
        ) {
          return;
        }
        setDraftState('error');
        setError('Saved to your journal, but the device draft could not be cleared.');
      }
      setSaveState('saved');
    } catch {
      if (
        ownerIdRef.current !== ownerId ||
        ownerGenerationRef.current !== ownerGeneration
      ) {
        return;
      }
      setSaveState('error');
      setError('This reflection could not be saved. Your responses are still here.');
    }
  };

  if (activeTemplate) {
    return (
      <ReflectionRunner
        template={activeTemplate}
        stepIndex={stepIndex}
        responses={responses}
        saveState={saveState}
        draftState={draftState}
        error={error}
        onDiscard={discardDraft}
        onChooseAnother={resetReflection}
        onOpenJournal={() => router.push('/journal')}
        onStepChange={changeStep}
        onResponseChange={updateResponse}
        onSave={() => void saveReflection()}
      />
    );
  }

  const catalogueStatus = draftStatusCopy(draftState);
  const profileReady = Boolean(
    context.user_id &&
      stateOwnerId === context.user_id &&
      draftReady &&
      !authLoading
  );

  return (
    <AppScreen>
      <PageHeader
        eyebrow="Guided reflection"
        title="Reflect without getting stuck."
        description="Choose a short structure, write what feels useful, and finish with a direction."
        icon="edit-3"
      />

      <SectionHeader
        title="What would help you think clearly?"
        description="Start with one of these focused reflections."
      />
      {PRIMARY_TEMPLATES.map((template) => (
        <TemplateCard
          key={template.id}
          template={template}
          disabled={!profileReady}
          onSelect={begin}
        />
      ))}

      <AppButton
        label={showMore ? 'Hide more reflections' : 'Show more reflections'}
        icon={showMore ? 'chevron-up' : 'chevron-down'}
        variant="secondary"
        onPress={() => setShowMore((current) => !current)}
        style={styles.moreButton}
      />
      {showMore
        ? MORE_TEMPLATES.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              disabled={!profileReady}
              onSelect={begin}
              quiet
            />
          ))
        : null}

      {catalogueStatus ? (
        <Text
          style={[
            styles.statusText,
            draftState === 'error' && appUiStyles.error,
          ]}
        >
          {catalogueStatus}
        </Text>
      ) : null}
      {error ? <Text style={[appUiStyles.error, styles.error]}>{error}</Text> : null}

      <AppCard quiet style={styles.privacyCard}>
        <View style={styles.noteHeader}>
          <Feather name="lock" size={17} color={Colors.primary} />
          <Text style={styles.noteTitle}>Private by default</Text>
        </View>
        <Text style={appUiStyles.muted}>
          Drafts are encrypted on this device. Nothing is sent to AI automatically.
        </Text>
      </AppCard>

      <AppCard quiet>
        <View style={styles.noteHeader}>
          <Feather name="info" size={17} color={Colors.primary} />
          <Text style={styles.noteTitle}>A reflection tool</Text>
        </View>
        <Text style={appUiStyles.muted}>
          These prompts organize your own words. They do not diagnose a condition or
          replace professional care.
        </Text>
        <AppButton
          label="Read the evidence guide"
          icon="arrow-right"
          variant="quiet"
          onPress={() => router.push('/research')}
          style={styles.evidenceButton}
        />
      </AppCard>
    </AppScreen>
  );
}

function TemplateCard({
  template,
  disabled,
  onSelect,
  quiet = false,
}: {
  template: ReflectionTemplate;
  disabled: boolean;
  onSelect: (template: ReflectionTemplate) => void;
  quiet?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Begin ${template.title}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => onSelect(template)}
      style={({ pressed }) => [
        styles.templateCard,
        quiet && styles.quietTemplateCard,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <View style={styles.templateIcon}>
        <Feather
          name={TEMPLATE_ICONS[template.id]}
          size={19}
          color={Colors.primary}
        />
      </View>
      <View style={styles.templateCopy}>
        <View style={styles.templateMeta}>
          <Text style={styles.skill}>{template.skill}</Text>
          <Text style={styles.duration}>{template.duration}</Text>
        </View>
        <Text style={styles.templateTitle}>{template.title}</Text>
        <Text style={styles.templateSummary}>{template.summary}</Text>
      </View>
      <Feather name="arrow-right" size={19} color={Colors.textSecondary} />
    </Pressable>
  );
}

function ReflectionRunner({
  template,
  stepIndex,
  responses,
  saveState,
  draftState,
  error,
  onDiscard,
  onChooseAnother,
  onOpenJournal,
  onStepChange,
  onResponseChange,
  onSave,
}: {
  template: ReflectionTemplate;
  stepIndex: number;
  responses: Record<string, string>;
  saveState: SaveState;
  draftState: DraftState;
  error: string;
  onDiscard: () => void;
  onChooseAnother: () => void;
  onOpenJournal: () => void;
  onStepChange: (index: number) => void;
  onResponseChange: (stepId: string, value: string) => void;
  onSave: () => void;
}) {
  if (saveState === 'saved') {
    return (
      <AppScreen contentStyle={styles.savedScreen}>
        <AppCard style={styles.savedCard}>
          <View style={styles.savedIcon}>
            <Feather name="check" size={27} color={Colors.primary} />
          </View>
          <Text style={styles.savedEyebrow}>SAVED TO JOURNAL</Text>
          <Text style={styles.savedTitle}>Your reflection is in your journal.</Text>
          <Text style={styles.savedDescription}>
            Your words stay in your journal. Partners only see enabled activity counts.
          </Text>
          {error ? <Text style={[appUiStyles.error, styles.error]}>{error}</Text> : null}
          <AppButton
            label="Open journal"
            icon="book-open"
            onPress={onOpenJournal}
            style={styles.savedButton}
          />
          <AppButton
            label="Choose another"
            variant="secondary"
            onPress={onChooseAnother}
            style={styles.savedSecondaryButton}
          />
        </AppCard>
      </AppScreen>
    );
  }

  const step = template.steps[stepIndex];
  const completeCount = completedReflectionSteps(template, responses);
  const lastStep = stepIndex === template.steps.length - 1;
  const statusCopy = draftStatusCopy(draftState);

  return (
    <AppScreen>
      <AppButton
        label="Discard draft"
        icon="x"
        variant="quiet"
        disabled={saveState === 'saving'}
        onPress={onDiscard}
        style={styles.discardButton}
      />

      <AppCard quiet style={styles.runnerHeader}>
        <View style={styles.runnerTop}>
          <View style={styles.runnerIdentity}>
            <View style={styles.runnerIcon}>
              <Feather
                name={TEMPLATE_ICONS[template.id]}
                size={19}
                color="#fffef8"
              />
            </View>
            <View style={styles.runnerTitleCopy}>
              <Text style={styles.skill}>{template.skill}</Text>
              <Text style={styles.runnerTitle}>{template.title}</Text>
            </View>
          </View>
          <Text style={styles.stepCount}>
            {stepIndex + 1} / {template.steps.length}
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${((stepIndex + 1) / template.steps.length) * 100}%` },
            ]}
          />
        </View>
      </AppCard>

      <AppCard>
        <Text style={appUiStyles.label}>{step.label}</Text>
        <Text style={styles.prompt}>{step.prompt}</Text>
        <View style={styles.responseGroup}>
          <AppInput
            accessibilityLabel={step.label}
            value={responses[step.id] ?? ''}
            onChangeText={(value) => onResponseChange(step.id, value)}
            maxLength={REFLECTION_RESPONSE_LIMIT}
            multiline
            autoFocus
            placeholder={step.placeholder}
            inputStyle={styles.responseInput}
          />
        </View>
        <View style={styles.responseMeta}>
          <Text style={styles.metaText}>
            {completeCount} of {template.steps.length} answered
          </Text>
          <Text style={styles.metaText}>
            {(responses[step.id] ?? '').length.toLocaleString()} /{' '}
            {REFLECTION_RESPONSE_LIMIT.toLocaleString()}
          </Text>
        </View>

        {statusCopy ? (
          <Text
            style={[
              styles.draftStatus,
              draftState === 'error' && appUiStyles.error,
            ]}
          >
            {statusCopy}
          </Text>
        ) : null}
        {error ? <Text style={[appUiStyles.error, styles.error]}>{error}</Text> : null}

        <View style={styles.actionRow}>
          <AppButton
            label="Back"
            icon="arrow-left"
            variant="secondary"
            disabled={stepIndex === 0 || saveState === 'saving'}
            onPress={() => onStepChange(stepIndex - 1)}
            style={styles.actionButton}
          />
          {lastStep ? (
            <AppButton
              label="Save to journal"
              icon="save"
              loading={saveState === 'saving'}
              onPress={onSave}
              style={styles.actionButton}
            />
          ) : (
            <AppButton
              label="Next"
              icon="arrow-right"
              disabled={saveState === 'saving'}
              onPress={() => onStepChange(stepIndex + 1)}
              style={styles.actionButton}
            />
          )}
        </View>
      </AppCard>

      <Text style={styles.runnerNote}>
        Skip any question that is not useful. Your encrypted draft stays on this
        device until you save or discard it.
      </Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  templateCard: {
    minHeight: 116,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#163a32',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  quietTemplateCard: {
    backgroundColor: 'rgba(255,254,248,0.66)',
    shadowOpacity: 0,
    elevation: 0,
  },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.48 },
  templateIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateCopy: { flex: 1 },
  templateMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  skill: {
    color: Colors.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.65,
    textTransform: 'uppercase',
  },
  duration: { color: Colors.textSecondary, fontSize: 10 },
  templateTitle: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginTop: 5,
  },
  templateSummary: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  moreButton: { alignSelf: 'flex-start', marginTop: 4, marginBottom: 12 },
  statusText: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  error: { marginTop: 12 },
  privacyCard: { marginTop: 10 },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 7,
  },
  noteTitle: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  evidenceButton: { alignSelf: 'flex-start', marginTop: 14 },
  discardButton: { alignSelf: 'flex-start', marginBottom: 12 },
  runnerHeader: { padding: 16 },
  runnerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  runnerIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11 },
  runnerIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  runnerTitleCopy: { flex: 1 },
  runnerTitle: {
    color: Colors.text,
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '700',
    marginTop: 4,
  },
  stepCount: { color: Colors.textSecondary, fontSize: 11, marginTop: 4 },
  progressTrack: {
    height: 6,
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: Colors.background,
    marginTop: 17,
  },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: Colors.accent },
  prompt: {
    color: Colors.text,
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginTop: 10,
  },
  responseGroup: { marginTop: 20, marginBottom: 0 },
  responseInput: { minHeight: 180, lineHeight: 22 },
  responseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 7,
  },
  metaText: { color: Colors.textSecondary, fontSize: 10 },
  draftStatus: {
    color: Colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 14,
  },
  actionRow: { flexDirection: 'row', gap: 9, marginTop: 20 },
  actionButton: { flex: 1 },
  runnerNote: {
    color: Colors.textSecondary,
    fontSize: 11,
    lineHeight: 17,
    paddingHorizontal: 4,
    marginTop: 2,
  },
  savedScreen: { justifyContent: 'center' },
  savedCard: { alignItems: 'center', paddingVertical: 34 },
  savedIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedEyebrow: {
    color: Colors.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginTop: 18,
  },
  savedTitle: {
    color: Colors.text,
    fontSize: 27,
    lineHeight: 33,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },
  savedDescription: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 320,
    marginTop: 9,
  },
  savedButton: { alignSelf: 'stretch', marginTop: 24 },
  savedSecondaryButton: { alignSelf: 'stretch', marginTop: 9 },
});
