'use client';

import { useEffect, useRef, useState, type ComponentType } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  Check,
  ChevronDown,
  Compass,
  Heart,
  Lightbulb,
  ListChecks,
  Save,
  Sparkles,
  Waypoints,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useDataContext } from '@/lib/hooks/use-data-context';
import { emptyJournalDraft, prepareJournalDraft } from '@/lib/journal';
import {
  advanceOwnerGeneration,
  createOwnerGeneration,
  isCurrentOwnerGeneration,
} from '@/lib/mood-check-in';
import {
  completedReflectionSteps,
  REFLECTION_RESPONSE_LIMIT,
  REFLECTION_TEMPLATES,
  reflectionTemplateById,
  serializeReflectionResponses,
  validateReflectionResponses,
  type ReflectionTemplate,
  type ReflectionTemplateId,
} from '@/lib/reflections';
import {
  clearWebReflectionDraft,
  readWebReflectionDraft,
  writeWebReflectionDraft,
} from '@/lib/reflection-draft-storage';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const TEMPLATE_ICONS: Record<
  ReflectionTemplateId,
  ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
> = {
  'balanced-thought': BrainCircuit,
  'solve-one-thing': ListChecks,
  'make-room': Compass,
  'compassionate-reset': Heart,
  'good-moments': Sparkles,
  'express-and-close': BookOpenCheck,
  'weekly-patterns': Waypoints,
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function ReflectPage() {
  const { context, authLoading } = useDataContext();
  const readyOwnerId = authLoading ? null : context.user_id;
  const ownerKey = readyOwnerId ? `user_id:${readyOwnerId}` : null;
  const ownerGenerationRef = useRef(createOwnerGeneration(ownerKey));
  ownerGenerationRef.current = advanceOwnerGeneration(
    ownerGenerationRef.current,
    ownerKey
  );
  const ownerGeneration = ownerGenerationRef.current;
  const [activeId, setActiveId] = useState<ReflectionTemplateId | null>(null);
  const [draftOwnerId, setDraftOwnerId] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [draftReady, setDraftReady] = useState(false);
  const [error, setError] = useState('');
  const activeIdRef = useRef(activeId);
  const draftOwnerIdRef = useRef(draftOwnerId);
  const responsesRef = useRef(responses);
  const draftRevisionRef = useRef(0);
  const saveOperationGenerationRef = useRef(0);
  const preselectionGenerationRef = useRef<number | null>(null);
  const beginRef = useRef<(template: ReflectionTemplate) => void>(() => undefined);
  activeIdRef.current = activeId;
  draftOwnerIdRef.current = draftOwnerId;
  responsesRef.current = responses;

  const storedActiveTemplate = reflectionTemplateById(activeId);
  const activeTemplate =
    readyOwnerId && draftOwnerId === readyOwnerId ? storedActiveTemplate : null;
  const primaryTemplates = REFLECTION_TEMPLATES.filter((template) => template.primary);
  const moreTemplates = REFLECTION_TEMPLATES.filter((template) => !template.primary);

  useEffect(() => {
    const ownerId = readyOwnerId;
    const loadGeneration = ownerGenerationRef.current;
    draftRevisionRef.current += 1;
    saveOperationGenerationRef.current += 1;
    activeIdRef.current = null;
    draftOwnerIdRef.current = null;
    responsesRef.current = {};
    setActiveId(null);
    setDraftOwnerId(null);
    setStepIndex(0);
    setResponses({});
    setSaveState('idle');
    setError('');
    setDraftReady(false);

    if (!ownerId) return;
    try {
      const draft = readWebReflectionDraft(ownerId);
      if (
        !isCurrentOwnerGeneration(ownerGenerationRef.current, loadGeneration) ||
        ownerGenerationRef.current.ownerKey !== `user_id:${ownerId}`
      ) {
        return;
      }
      if (draft) {
        activeIdRef.current = draft.templateId;
        draftOwnerIdRef.current = ownerId;
        responsesRef.current = draft.responses;
        setActiveId(draft.templateId);
        setDraftOwnerId(ownerId);
        setStepIndex(draft.stepIndex);
        setResponses(draft.responses);
      }
      setDraftReady(true);
    } catch {
      setDraftReady(true);
      setError('This browser could not restore your reflection draft.');
    }
  }, [ownerGeneration.generation, readyOwnerId]);

  useEffect(() => {
    if (
      !draftReady ||
      !readyOwnerId ||
      draftOwnerId !== readyOwnerId ||
      !activeId ||
      saveState === 'saved'
    ) {
      return;
    }
    const timeout = window.setTimeout(() => {
      try {
        writeWebReflectionDraft(readyOwnerId, {
          templateId: activeId,
          stepIndex,
          responses,
        });
      } catch {
        setError('This browser could not save your reflection draft.');
      }
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [activeId, draftOwnerId, draftReady, readyOwnerId, responses, saveState, stepIndex]);

  const begin = (template: ReflectionTemplate) => {
    if (!readyOwnerId || !draftReady) {
      setError('Your private profile is still loading. Please try again.');
      return;
    }
    draftRevisionRef.current += 1;
    saveOperationGenerationRef.current += 1;
    activeIdRef.current = template.id;
    draftOwnerIdRef.current = readyOwnerId;
    responsesRef.current = {};
    setActiveId(template.id);
    setDraftOwnerId(readyOwnerId);
    setStepIndex(0);
    setResponses({});
    setSaveState('idle');
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  beginRef.current = begin;

  useEffect(() => {
    if (!readyOwnerId) return;
    if (
      draftOwnerIdRef.current &&
      draftOwnerIdRef.current !== readyOwnerId
    ) {
      return;
    }
    if (preselectionGenerationRef.current === ownerGeneration.generation) return;
    preselectionGenerationRef.current = ownerGeneration.generation;

    const requestedMode = new URLSearchParams(window.location.search).get(
      'mode'
    ) as ReflectionTemplateId | null;
    const requestedTemplate = reflectionTemplateById(requestedMode);
    if (
      !requestedTemplate ||
      activeIdRef.current ||
      draftOwnerIdRef.current ||
      saveState === 'saved'
    ) {
      return;
    }
    beginRef.current(requestedTemplate);
  }, [activeId, draftOwnerId, draftReady, ownerGeneration.generation, readyOwnerId, saveState]);

  const closeReflection = () => {
    const hasResponses = Object.values(responsesRef.current).some(
      (response) => response.trim().length > 0
    );
    if (
      saveState !== 'saved' &&
      hasResponses &&
      !window.confirm('Discard this reflection draft?')
    ) {
      return;
    }
    if (readyOwnerId) {
      try {
        clearWebReflectionDraft(readyOwnerId);
      } catch {
        setError('This browser could not clear the reflection draft.');
        return;
      }
    }
    draftRevisionRef.current += 1;
    saveOperationGenerationRef.current += 1;
    activeIdRef.current = null;
    draftOwnerIdRef.current = null;
    responsesRef.current = {};
    setActiveId(null);
    setDraftOwnerId(null);
    setStepIndex(0);
    setResponses({});
    setSaveState('idle');
    setError('');
  };

  const updateResponse = (stepId: string, value: string) => {
    draftRevisionRef.current += 1;
    const nextResponses = { ...responsesRef.current, [stepId]: value };
    responsesRef.current = nextResponses;
    setResponses(nextResponses);
    if (saveState !== 'idle') setSaveState('idle');
    if (error) setError('');
  };

  const saveReflection = async () => {
    const templateSnapshot = activeTemplate;
    const ownerId = readyOwnerId;
    if (!templateSnapshot || !ownerId || draftOwnerIdRef.current !== ownerId) {
      setSaveState('error');
      setError('Your private profile is still loading. Please try again.');
      return;
    }

    const responsesSnapshot = { ...responsesRef.current };
    const validationError = validateReflectionResponses(
      templateSnapshot,
      responsesSnapshot
    );
    if (validationError) {
      setSaveState('error');
      setError(validationError);
      return;
    }

    const content = serializeReflectionResponses(
      templateSnapshot,
      responsesSnapshot
    );
    const prepared = prepareJournalDraft({
      ...emptyJournalDraft(),
      title: templateSnapshot.title,
      content,
      prompt: templateSnapshot.summary,
      entryKind: 'guided',
      tags: ['guided reflection', ...templateSnapshot.tags].join(', '),
    });
    const saveOwnerGeneration = ownerGenerationRef.current;
    const saveDraftRevision = draftRevisionRef.current;
    const saveOperationGeneration = saveOperationGenerationRef.current + 1;
    saveOperationGenerationRef.current = saveOperationGeneration;
    const saveIsCurrent = () =>
      isCurrentOwnerGeneration(
        ownerGenerationRef.current,
        saveOwnerGeneration
      ) &&
      saveOperationGenerationRef.current === saveOperationGeneration &&
      draftRevisionRef.current === saveDraftRevision &&
      activeIdRef.current === templateSnapshot.id &&
      draftOwnerIdRef.current === ownerId &&
      JSON.stringify(responsesRef.current) === JSON.stringify(responsesSnapshot);

    setSaveState('saving');
    setError('');
    try {
      const result = await supabase
        .from('journal_entries')
        .insert({ ...prepared, user_id: ownerId })
        .select('id')
        .single();

      if (!saveIsCurrent()) return;
      if (result.error || !result.data) {
        setSaveState('error');
        setError('This reflection could not be saved. Your responses are still here.');
        return;
      }

      setSaveState('saved');
      try {
        clearWebReflectionDraft(ownerId);
      } catch {
        setError('Saved. This browser could not clear the draft copy.');
      }
    } catch {
      if (!saveIsCurrent()) return;
      setSaveState('error');
      setError('This reflection could not be saved. Your responses are still here.');
    }
  };

  return (
    <main className="min-h-screen px-4 pb-28 pt-7 md:px-8 md:pb-12 md:pt-11">
      <div className="mx-auto max-w-5xl">
        {activeTemplate ? (
          <ReflectionRunner
            template={activeTemplate}
            stepIndex={stepIndex}
            responses={responses}
            saveState={saveState}
            error={error}
            onClose={closeReflection}
            onStepChange={setStepIndex}
            onResponseChange={updateResponse}
            onSave={saveReflection}
          />
        ) : (
          <>
            <header className="relative overflow-hidden rounded-[2rem] bg-[#173F38] px-6 py-8 text-white shadow-[0_24px_70px_rgba(23,63,56,0.18)] md:px-10 md:py-11">
              <div className="absolute -right-12 -top-16 h-56 w-56 rounded-full bg-amber-300/20 blur-2xl" />
              <div className="relative max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-emerald-50">
                  <Lightbulb className="h-4 w-4" aria-hidden="true" />
                  Guided reflection
                </div>
                <h1 className="mt-4 font-display text-4xl font-medium leading-tight md:text-6xl">
                  Reflect without getting stuck.
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-emerald-50/90">
                  Choose a short structure, write only what feels useful, and finish
                  with a direction you can carry forward.
                </p>
              </div>
            </header>

            <section className="mt-7" aria-labelledby="reflection-start-heading">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
                    Start here
                  </p>
                  <h2
                    id="reflection-start-heading"
                    className="mt-2 font-display text-3xl font-medium text-foreground"
                  >
                    What would help you think clearly?
                  </h2>
                </div>
                <Link
                  href="/journal"
                  className="text-sm font-semibold text-primary underline underline-offset-4"
                >
                  Open free-form journal
                </Link>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {primaryTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onSelect={begin}
                    disabled={!readyOwnerId || !draftReady}
                  />
                ))}
              </div>
              {(!readyOwnerId || !draftReady) && (
                <p role="status" className="mt-3 text-sm text-muted-foreground">
                  {authLoading
                    ? 'Getting your private profile ready...'
                    : 'Your private profile is not ready. Refresh and try again.'}
                </p>
              )}
            </section>

            <details className="group app-panel mt-5 overflow-hidden">
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-5 font-semibold text-foreground outline-none hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden md:px-6">
                <span>
                  More reflections
                  <span className="ml-2 font-normal text-muted-foreground">
                    {moreTemplates.length}
                  </span>
                </span>
                <ChevronDown
                  className="h-5 w-5 text-muted-foreground transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <div className="grid gap-3 border-t border-border p-4 sm:grid-cols-2 md:p-6">
                {moreTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onSelect={begin}
                    disabled={!readyOwnerId || !draftReady}
                    quiet
                  />
                ))}
              </div>
            </details>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/65 px-5 py-4 text-sm text-muted-foreground">
              <p>Journal content stays private. Nothing is sent to AI automatically.</p>
              <Link href="/research#reflection" className="font-semibold underline">
                Research and limits
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function TemplateCard({
  template,
  onSelect,
  disabled = false,
  quiet = false,
}: {
  template: ReflectionTemplate;
  onSelect: (template: ReflectionTemplate) => void;
  disabled?: boolean;
  quiet?: boolean;
}) {
  const Icon = TEMPLATE_ICONS[template.id];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(template)}
      className={cn(
        'group/card rounded-2xl border border-border text-left transition-[border-color,background-color,transform] hover:-translate-y-0.5 hover:border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-55 disabled:hover:translate-y-0',
        quiet ? 'bg-background p-4' : 'app-panel p-5'
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary">
          <Icon className="h-5 w-5" aria-hidden={true} />
        </span>
        <span className="text-xs font-medium text-muted-foreground">{template.duration}</span>
      </span>
      <span className="mt-4 block text-xs font-bold uppercase tracking-[0.12em] text-accent">
        {template.skill}
      </span>
      <span className="mt-1 block font-display text-2xl font-medium text-foreground">
        {template.title}
      </span>
      <span className="mt-2 block text-sm leading-6 text-muted-foreground">
        {template.summary}
      </span>
      <span className="mt-4 inline-flex items-center text-sm font-semibold text-primary">
        Begin
        <ArrowRight
          className="ml-1.5 h-4 w-4 transition-transform group-hover/card:translate-x-1"
          aria-hidden="true"
        />
      </span>
    </button>
  );
}

function ReflectionRunner({
  template,
  stepIndex,
  responses,
  saveState,
  error,
  onClose,
  onStepChange,
  onResponseChange,
  onSave,
}: {
  template: ReflectionTemplate;
  stepIndex: number;
  responses: Record<string, string>;
  saveState: SaveState;
  error: string;
  onClose: () => void;
  onStepChange: (index: number) => void;
  onResponseChange: (stepId: string, value: string) => void;
  onSave: () => void;
}) {
  const step = template.steps[stepIndex];
  const completeCount = completedReflectionSteps(template, responses);
  const lastStep = stepIndex === template.steps.length - 1;
  const Icon = TEMPLATE_ICONS[template.id];
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    stepHeadingRef.current?.focus();
  }, [step.id, template.id]);

  if (saveState === 'saved') {
    return (
      <section className="app-panel mx-auto grid min-h-[34rem] max-w-2xl place-items-center p-7 text-center md:p-12">
        <div>
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-secondary text-primary">
            <Check className="h-7 w-7" aria-hidden="true" />
          </span>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-accent">
            Saved to journal
          </p>
          <h1 className="mt-2 font-display text-4xl font-medium text-foreground">
            Your reflection is in your journal.
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            Your words stay in your journal. Partners only see enabled activity counts.
          </p>
          {error && (
            <p role="alert" className="mx-auto mt-4 max-w-md rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {error}
            </p>
          )}
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/journal">Open journal</Link>
            </Button>
            <Button variant="outline" onClick={onClose}>
              Choose another
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl">
      <button
        type="button"
        onClick={onClose}
        className="inline-flex items-center text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
        All reflections
      </button>

      <div className="app-panel mt-4 overflow-hidden">
        <header className="border-b border-border bg-secondary/55 px-5 py-5 md:px-8 md:py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
                <Icon className="h-5 w-5" aria-hidden={true} />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-accent">
                  {template.skill}
                </p>
                <h1 className="mt-1 font-display text-2xl font-medium text-foreground md:text-3xl">
                  {template.title}
                </h1>
              </div>
            </div>
            <span className="shrink-0 text-xs font-medium text-muted-foreground">
              {stepIndex + 1} / {template.steps.length}
            </span>
          </div>
          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-background">
            <div
              className="h-full rounded-full bg-accent transition-[width]"
              style={{ width: `${((stepIndex + 1) / template.steps.length) * 100}%` }}
              aria-hidden="true"
            />
          </div>
        </header>

        <div className="px-5 py-7 md:px-8 md:py-9">
          <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            Step {stepIndex + 1} of {template.steps.length}: {step.label}
          </p>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {step.label}
          </p>
          <h2
            ref={stepHeadingRef}
            tabIndex={-1}
            className="mt-3 font-display text-3xl font-medium leading-tight text-foreground outline-none md:text-4xl"
          >
            {step.prompt}
          </h2>
          <Textarea
            value={responses[step.id] ?? ''}
            onChange={(event) => onResponseChange(step.id, event.target.value)}
            maxLength={REFLECTION_RESPONSE_LIMIT}
            placeholder={step.placeholder}
            aria-label={step.label}
            className="mt-6 min-h-44 resize-y text-base leading-7 md:min-h-52"
          />
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {completeCount} of {template.steps.length} answered
            </span>
            <span>
              {(responses[step.id] ?? '').length.toLocaleString()} /{' '}
              {REFLECTION_RESPONSE_LIMIT.toLocaleString()}
            </span>
          </div>

          {error && (
            <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </p>
          )}

          <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onStepChange(Math.max(0, stepIndex - 1))}
              disabled={stepIndex === 0 || saveState === 'saving'}
            >
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Back
            </Button>

            {lastStep ? (
              <Button type="button" onClick={onSave} disabled={saveState === 'saving'}>
                <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                {saveState === 'saving' ? 'Saving...' : 'Save to journal'}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => onStepChange(Math.min(template.steps.length - 1, stepIndex + 1))}
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-muted-foreground">
        <p>Skip any question that is not useful. Your draft stays on this page until saved.</p>
        <Link href="/research#reflection" className="font-semibold underline">
          Evidence guide
        </Link>
      </div>
    </section>
  );
}
