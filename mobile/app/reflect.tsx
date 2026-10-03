import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AppState,
  Alert,
  Linking,
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
import { useToolCompletion } from '@/lib/hooks/use-tool-completion';
import { ToolCompletionRetry } from '@/components/ToolCompletionRetry';
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
  'worry-time': 'clock',
  'coping-card': 'credit-card',
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
  const { context } = useDataContext();
  return <ReflectContent key={context.user_id ?? 'signed-out'} />;
}

function ReflectContent() {
  const completion = useToolCompletion('reflection');
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { context, authLoading } = useDataContext();
  const [activeId, setActiveId] = useState<ReflectionTemplateId | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [showMore, setShowMore] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const saveInFlightRef = useRef(false);
  const [draftState, setDraftState] = useState<DraftState>('loading');
  const [draftReady, setDraftReady] = useState(false);
  const [stateOwnerId, setStateOwnerId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [hydrationEpoch, setHydrationEpoch] = useState(0);
  const [needsReload, setNeedsReload] = useState(false);
  const hydrationTokenRef = useRef<ReflectionDraftWriteToken | null>(null);
  const ignoreRequestedModeRef = useRef(false);
  const ownerIdRef = useRef(context.user_id);
  const ownerGenerationRef = useRef(0);
  const mountedRef = useRef(true);
  const draftWriteSequenceRef = useRef(0);
  const pendingDraftWriteRef = useRef<Promise<void> | null>(null);
  const latestDraftRef = useRef<{
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

  const requireFreshDraft = (token = hydrationTokenRef.current) => {
    if (token && token.ownerId === ownerIdRef.current && reflectionDraftStorage.isWriteTokenCurrent(token)) {
      return true;
    }
    setDraftReady(false);
    setNeedsReload(true);
    setError('This reflection changed during sign-in or cleanup. Reload the saved draft before continuing.');
    return false;
  };

  const reloadDraft = () => {
    hydrationTokenRef.current = null;
    latestDraftRef.current = null;
    setDraftReady(false);
    setHydrationEpoch((current) => current + 1);
  };

  useEffect(() => {
    const ownerId = context.user_id;
    latestDraftRef.current = null;
    hydrationTokenRef.current = null;
    draftWriteSequenceRef.current += 1;
    const ownerGeneration = ++ownerGenerationRef.current;
    let active = true;

    setStateOwnerId(null);
    setActiveId(null);
    setStepIndex(0);
    setResponses({});
    setSaveState('idle');
    setDraftReady(false);
    setNeedsReload(false);
    setDraftState(authLoading ? 'loading' : 'idle');
    setError('');
    if (authLoading || !ownerId) {
      return () => {
        active = false;
      };
    }

    setDraftState('loading');
    void reflectionDraftStorage
      .readForEditing(ownerId)
      .then(({ draft, writeToken }) => {
        if (
          !active ||
          ownerIdRef.current !== ownerId ||
          ownerGenerationRef.current !== ownerGeneration
        ) {
          return;
        }
        if (!requireFreshDraft(writeToken)) return;
        hydrationTokenRef.current = writeToken;
        const requestedTemplate = reflectionTemplateById(
          !ignoreRequestedModeRef.current && typeof params.mode === 'string'
            ? (params.mode as ReflectionTemplateId)
            : null
        );
        const installDraft = (templateId: ReflectionTemplateId | null, index: number, answers: Record<string, string>) => {
          if (!active || ownerIdRef.current !== ownerId || ownerGenerationRef.current !== ownerGeneration) return;
          if (!requireFreshDraft(writeToken)) return;
          latestDraftRef.current = templateId ? {
            ownerId, ownerGeneration, writeToken, templateId, stepIndex: index, responses: { ...answers },
          } : null;
          setActiveId(templateId);
          setStepIndex(index);
          setResponses(answers);
          setStateOwnerId(ownerId);
          setDraftReady(true);
        };
        const restoreDraft = () => {
          if (!draft) return;
          installDraft(draft.templateId, draft.stepIndex, draft.responses);
          setDraftState('saved');
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
                  if (!active || !requireFreshDraft(writeToken)) return;
                  setDraftReady(false);
                  void reflectionDraftStorage
                    .clear(ownerId, writeToken)
                    .then(() => {
                      if (
                        ownerIdRef.current === ownerId &&
                        ownerGenerationRef.current === ownerGeneration
                      ) {
                        reloadDraft();
                      }
                    })
                    .catch(() => {
                      if (
                        ownerIdRef.current === ownerId &&
                        ownerGenerationRef.current === ownerGeneration
                      ) {
                        setNeedsReload(true);
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
          installDraft(requestedTemplate?.id ?? null, 0, {});
          setDraftState('idle');
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
        setDraftReady(false);
        setNeedsReload(true);
      });

    return () => {
      active = false;
    };
  }, [authLoading, context.user_id, params.mode, hydrationEpoch]);

  persistDraftSnapshotRef.current = async (snapshot) => {
    const sequence = ++draftWriteSequenceRef.current;
    if (
      mountedRef.current &&
      ownerIdRef.current === snapshot.ownerId &&
      ownerGenerationRef.current === snapshot.ownerGeneration
    ) {
      setDraftState('saving');
    }

    // Register synchronously. Storage is the ONLY queue, so auth can drain every
    // edit even if an earlier device write has not completed yet.
    const operation = reflectionDraftStorage.write(
      snapshot.ownerId,
      { templateId: snapshot.templateId, stepIndex: snapshot.stepIndex, responses: snapshot.responses },
      snapshot.writeToken
    );
    const trackedOperation = operation.then(() => undefined, () => undefined);
    pendingDraftWriteRef.current = trackedOperation;

    try {
      const didWrite = await operation;
      if (
        mountedRef.current &&
        sequence === draftWriteSequenceRef.current &&
        ownerIdRef.current === snapshot.ownerId &&
        ownerGenerationRef.current === snapshot.ownerGeneration
      ) {
        setDraftState(didWrite ? 'saved' : 'error');
        if (!didWrite) requireFreshDraft(snapshot.writeToken);
      }
    } catch {
      if (
        mountedRef.current &&
        sequence === draftWriteSequenceRef.current &&
        ownerIdRef.current === snapshot.ownerId &&
        ownerGenerationRef.current === snapshot.ownerGeneration
      ) {
        setDraftState('error');
        if (!reflectionDraftStorage.isWriteTokenCurrent(snapshot.writeToken)) requireFreshDraft(snapshot.writeToken);
      }
    } finally {
      if (pendingDraftWriteRef.current === trackedOperation) {
        pendingDraftWriteRef.current = null;
      }
    }
  };

  flushDraftRef.current = async () => {
    // Edits are already registered; lifecycle flushes never replay stale words.
    await pendingDraftWriteRef.current?.catch(() => {});
  };

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

  const editorToken = hydrationTokenRef.current;
  const editorGeneration = ownerGenerationRef.current;
  const canUseEditor = () => {
    // Native callbacks/dialogs from an older render cannot borrow a later
    // hydration's token, even when the account ID has not changed.
    if (!mountedRef.current || editorGeneration !== ownerGenerationRef.current ||
        editorToken !== hydrationTokenRef.current) return false;
    return requireFreshDraft(editorToken);
  };

  const resetReflection = () => {
    ignoreRequestedModeRef.current = true;
    setActiveId(null);
    setStepIndex(0);
    setResponses({});
    setSaveState('idle');
    setDraftState('idle');
    setError('');
    reloadDraft();
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
    if (!canUseEditor()) return;
    const snapshot = {
      ownerId: context.user_id, ownerGeneration: ownerGenerationRef.current,
      writeToken: hydrationTokenRef.current!, templateId: template.id, stepIndex: 0, responses: {},
    };
    latestDraftRef.current = snapshot;
    void persistDraftSnapshotRef.current(snapshot);
    setActiveId(template.id);
    setStepIndex(0);
    setResponses({});
    setSaveState('idle');
    setError('');
  };

  const discardDraft = () => {
    const ownerId = context.user_id;
    const writeToken = editorToken;
    if (!ownerId || !writeToken || !canUseEditor()) return;
    Alert.alert(
      'Discard this draft?',
      'Your answers will be removed from this device.',
      [
        { text: 'Keep writing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            if (!canUseEditor()) return;
            latestDraftRef.current = null;
            setDraftReady(false);
            void reflectionDraftStorage
              .clear(ownerId, writeToken)
              .then(() => {
                if (mountedRef.current && ownerIdRef.current === ownerId &&
                    ownerGenerationRef.current === editorGeneration) resetReflection();
              })
              .catch(() => {
                if (mountedRef.current && ownerIdRef.current === ownerId &&
                    ownerGenerationRef.current === editorGeneration) {
                  setNeedsReload(true);
                  setError('The encrypted draft could not be removed. Please try again.');
                }
              });
          },
        },
      ]
    );
  };

  const updateResponse = (stepId: string, value: string) => {
    const current = latestDraftRef.current;
    if (saveInFlightRef.current || !current || !canUseEditor()) return;
    const snapshot = { ...current, responses: { ...current.responses, [stepId]: value } };
    latestDraftRef.current = snapshot;
    void persistDraftSnapshotRef.current(snapshot);
    setResponses(snapshot.responses);
    if (saveState !== 'idle') setSaveState('idle');
    if (error) setError('');
  };

  const changeStep = (nextStep: number) => {
    const current = latestDraftRef.current;
    if (saveInFlightRef.current || !activeTemplate || !current || !canUseEditor()) return;
    const snapshot = { ...current, stepIndex: Math.max(0, Math.min(activeTemplate.steps.length - 1, nextStep)) };
    latestDraftRef.current = snapshot;
    void persistDraftSnapshotRef.current(snapshot);
    setStepIndex(snapshot.stepIndex);
    if (error) setError('');
  };

  const saveReflection = async () => {
    if (saveInFlightRef.current || saveState === 'saved') return;
    const ownerId = context.user_id;
    const snapshot = latestDraftRef.current;
    if (!activeTemplate || !ownerId || authLoading || !snapshot) {
      setSaveState('error');
      setError('Your private profile is still loading. Please try again.');
      return;
    }
    if (!canUseEditor()) return;

    const validationError = validateReflectionResponses(activeTemplate, snapshot.responses);
    if (validationError) {
      setSaveState('error');
      setError(validationError);
      return;
    }

    const content = serializeReflectionResponses(activeTemplate, snapshot.responses);
    const prepared = prepareJournalDraft({
      ...emptyJournalDraft(),
      title: activeTemplate.title,
      content,
      prompt: activeTemplate.summary,
      entryKind: 'guided',
      tags: ['guided reflection', ...activeTemplate.tags].join(', '),
    });
    const ownerGeneration = ownerGenerationRef.current;
    const completionSession = completion.start(activeTemplate.id);
    if (!completionSession) return;
    saveInFlightRef.current = true;

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
      if (!requireFreshDraft(snapshot.writeToken)) {
        setSaveState('error');
        return;
      }
      void completion.complete(completionSession, {
        id: result.data.id,
      });

      try {
        latestDraftRef.current = null;
        await reflectionDraftStorage.clear(ownerId, snapshot.writeToken);
        if (
          ownerIdRef.current !== ownerId ||
          ownerGenerationRef.current !== ownerGeneration
        ) {
          return;
        }
        setDraftState('idle');
        hydrationTokenRef.current = null;
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
    } finally {
      saveInFlightRef.current = false;
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
        error={[error, completion.error].filter(Boolean).join(' ')}
        needsReload={needsReload}
        onReload={reloadDraft}
        completion={completion}
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
      {error || completion.error ? (
        <Text accessibilityLiveRegion="polite" style={[appUiStyles.error, styles.error]}>
          {[error, completion.error].filter(Boolean).join(' ')}
        </Text>
      ) : null}
      {needsReload ? <AppButton label="Reload saved reflection" onPress={reloadDraft} /> : null}
      <ToolCompletionRetry completion={completion} />
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
  needsReload,
  onReload,
  completion,
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
  needsReload: boolean;
  onReload: () => void;
  completion: ReturnType<typeof useToolCompletion>;
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
            Open it now or start another reflection.
          </Text>
          {error ? <Text style={[appUiStyles.error, styles.error]}>{error}</Text> : null}
          {needsReload ? <AppButton label="Reload saved reflection" onPress={onReload} /> : null}
          <ToolCompletionRetry completion={completion} />
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
        disabled={needsReload || saveState === 'saving'}
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
        {template.note ? <Text style={[appUiStyles.muted, { marginBottom: 16 }]}>{template.note}</Text> : null}
        <Text style={appUiStyles.label}>{step.label}</Text>
        <Text style={styles.prompt}>{step.prompt}</Text>
        <View style={styles.responseGroup}>
          {step.kind === 'date-time' ? (
            <View style={{ gap: 12 }}>
              {responses[step.id] && Number.isFinite(Date.parse(responses[step.id])) ? (
                <>
                  <Text style={appUiStyles.muted}>{new Date(responses[step.id]).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</Text>
                  <DateTimePicker
                    accessibilityLabel="Worry review date and time"
                    value={new Date(responses[step.id])}
                    mode="datetime"
                    display="compact"
                    disabled={needsReload || saveState === 'saving'}
                    onChange={(event, value) => {
                      if (event.type === 'set' && value && Number.isFinite(value.getTime())) onResponseChange(step.id, value.toISOString());
                    }}
                  />
                  <AppButton label="Remove review time" variant="quiet" disabled={needsReload || saveState === 'saving'} onPress={() => onResponseChange(step.id, '')} />
                </>
              ) : <AppButton label="Choose review time" icon="calendar" variant="secondary" disabled={needsReload || saveState === 'saving'} onPress={() => onResponseChange(step.id, new Date(Date.now() + 15 * 60_000).toISOString())} />}
            </View>
          ) : <AppInput
            accessibilityLabel={step.label}
            value={responses[step.id] ?? ''}
            onChangeText={(value) => onResponseChange(step.id, value)}
            editable={!needsReload && saveState !== 'saving'}
            maxLength={REFLECTION_RESPONSE_LIMIT}
            multiline
            autoFocus
            placeholder={step.placeholder}
            inputStyle={styles.responseInput}
          />}
        </View>
        <View style={styles.responseMeta}>
          <Text style={styles.metaText}>
            {completeCount} of {template.steps.length} answered
          </Text>
          {step.kind !== 'date-time' ? <Text style={styles.metaText}>
            {(responses[step.id] ?? '').length.toLocaleString()} /{' '}
            {REFLECTION_RESPONSE_LIMIT.toLocaleString()}
          </Text> : null}
        </View>
        {template.source ? <AppButton label={template.source.label} variant="quiet" icon="external-link" onPress={() => {
          void Linking.openURL(template.source!.url).catch(() => Alert.alert('Could not open the source', 'Please try again when you are online.'));
        }} /> : null}

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
        {needsReload ? <AppButton label="Reload saved reflection" onPress={onReload} /> : null}
          <ToolCompletionRetry completion={completion} />

        <View style={styles.actionRow}>
          <AppButton
            label="Back"
            accessibilityLabel="Previous reflection step"
            icon="arrow-left"
            variant="secondary"
            disabled={needsReload || stepIndex === 0 || saveState === 'saving'}
            onPress={() => onStepChange(stepIndex - 1)}
            style={styles.actionButton}
          />
          {lastStep ? (
            <AppButton
              label="Save to journal"
              icon="save"
              loading={saveState === 'saving'}
              disabled={needsReload}
              onPress={onSave}
              style={styles.actionButton}
            />
          ) : (
            <AppButton
              label="Next"
              icon="arrow-right"
              disabled={needsReload || saveState === 'saving'}
              onPress={() => onStepChange(stepIndex + 1)}
              style={styles.actionButton}
            />
          )}
        </View>
      </AppCard>

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
  },
  quietTemplateCard: {
    backgroundColor: 'rgba(255,254,248,0.66)',
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
