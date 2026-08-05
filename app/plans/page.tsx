'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronRight,
  HeartHandshake,
  Leaf,
  LoaderCircle,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

type Segment = 'overview' | 'activity' | 'safety' | 'staying-well';
type SaveSection = Exclude<Segment, 'overview'>;
type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
type ActivityKind =
  | 'movement'
  | 'social'
  | 'creative'
  | 'outdoors'
  | 'self_care'
  | 'learning'
  | 'rest'
  | 'other';
type RoutineSlot = 'morning' | 'afternoon' | 'evening' | 'anytime';
type SafetyItemKind =
  | 'warning_sign'
  | 'coping_strategy'
  | 'distraction'
  | 'safe_environment'
  | 'support_contact'
  | 'professional_support'
  | 'reason_to_live'
  | 'other';
type StayingWellItemKind =
  | 'protective_routine'
  | 'trigger'
  | 'early_warning_sign'
  | 'coping_strategy'
  | 'support_step'
  | 'clinical_step'
  | 'other';

type ActivityPlan = {
  id: string;
  plan_date: string;
  activity_kind: ActivityKind;
  title: string;
  details: string;
  time_of_day: RoutineSlot;
  planned_minutes: number;
  status: 'planned' | 'in_progress' | 'completed' | 'skipped';
};

type ActivityStepRow = {
  id: string;
  plan_id: string;
  action: string;
  timing: string;
  estimated_minutes: number | null;
  position: number;
  completed: boolean;
};

type ActivityStepDraft = {
  id?: string;
  action: string;
  timing: string;
  estimatedMinutes: string;
  position: number;
};

type WellbeingPlan = {
  id: string;
  title: string;
  status: 'draft' | 'active' | 'archived';
};

type PlanItemRow<K extends string> = {
  id: string;
  plan_id: string;
  item_kind: K;
  label: string;
  details: string;
  position: number;
};

type PlanItemDraft<K extends string> = {
  id?: string;
  kind: K;
  label: string;
  details: string;
  position: number;
};

type ActivityDraft = {
  title: string;
  details: string;
  planDate: string;
  kind: ActivityKind;
  timeOfDay: RoutineSlot;
  plannedMinutes: string;
};

type OwnerPlanData = {
  activityPlan: ActivityPlan | null;
  activitySteps: ActivityStepRow[];
  safetyPlan: WellbeingPlan | null;
  safetyItems: Array<PlanItemRow<SafetyItemKind>>;
  stayingWellPlan: WellbeingPlan | null;
  stayingWellItems: Array<PlanItemRow<StayingWellItemKind>>;
};

type Feedback = { state: SaveState; message: string };

const MAX_ACTIVITY_STEPS = 3;
const MAX_PLAN_ITEMS = 6;
const MAX_PLAN_ITEM_POSITION = 5;
const MAX_ACTIVITY_MINUTES = 180;
const MAX_ACTIVITY_DETAILS = 1_000;
const MAX_SAFETY_ITEM_DETAILS = 1_000;
const MAX_STAYING_WELL_ITEM_DETAILS = 2_000;

const SEGMENTS: Array<{
  id: Segment;
  label: string;
  icon: typeof Activity;
}> = [
  { id: 'overview', label: 'Overview', icon: Check },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'safety', label: 'Safety', icon: ShieldCheck },
  { id: 'staying-well', label: 'Staying well', icon: Leaf },
];

const ACTIVITY_KINDS: Array<{ id: ActivityKind; label: string }> = [
  { id: 'movement', label: 'Movement' },
  { id: 'social', label: 'Social' },
  { id: 'creative', label: 'Creative' },
  { id: 'outdoors', label: 'Outdoors' },
  { id: 'self_care', label: 'Self-care' },
  { id: 'learning', label: 'Learning' },
  { id: 'rest', label: 'Rest' },
  { id: 'other', label: 'Other' },
];

const ROUTINE_SLOTS: Array<{ id: RoutineSlot; label: string }> = [
  { id: 'anytime', label: 'Anytime' },
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'Afternoon' },
  { id: 'evening', label: 'Evening' },
];

const SAFETY_ITEM_KINDS: Array<{ id: SafetyItemKind; label: string }> = [
  { id: 'warning_sign', label: 'What I notice' },
  { id: 'coping_strategy', label: 'What I can try' },
  { id: 'distraction', label: 'People or places for distraction' },
  { id: 'safe_environment', label: 'A safer environment' },
  { id: 'support_contact', label: 'Personal support' },
  { id: 'professional_support', label: 'Professional support' },
  { id: 'reason_to_live', label: 'What matters to me' },
  { id: 'other', label: 'Other' },
];

const STAYING_WELL_ITEM_KINDS: Array<{
  id: StayingWellItemKind;
  label: string;
}> = [
  { id: 'protective_routine', label: 'Helpful routine' },
  { id: 'trigger', label: 'Situation to prepare for' },
  { id: 'early_warning_sign', label: 'Change I may notice' },
  { id: 'coping_strategy', label: 'Response that may help' },
  { id: 'support_step', label: 'Support step' },
  { id: 'clinical_step', label: 'Agreed care step' },
  { id: 'other', label: 'Other' },
];

function blankFeedback(): Record<SaveSection, Feedback> {
  return {
    activity: { state: 'idle', message: '' },
    safety: { state: 'idle', message: '' },
    'staying-well': { state: 'idle', message: '' },
  };
}

function blankActivityDraft(): ActivityDraft {
  return {
    title: '',
    details: '',
    planDate: localCalendarDate(),
    kind: 'movement',
    timeOfDay: 'anytime',
    plannedMinutes: '15',
  };
}

function localCalendarDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function blankSafetyItems(): Array<PlanItemDraft<SafetyItemKind>> {
  return [
    { kind: 'warning_sign', label: '', details: '', position: 0 },
    { kind: 'coping_strategy', label: '', details: '', position: 1 },
    { kind: 'distraction', label: '', details: '', position: 2 },
    { kind: 'support_contact', label: '', details: '', position: 3 },
    { kind: 'professional_support', label: '', details: '', position: 4 },
    { kind: 'safe_environment', label: '', details: '', position: 5 },
  ];
}

function nextFreePosition(items: Array<{ position: number }>, start: number): number {
  const used = new Set(items.map((item) => item.position));
  let position = start;
  while (used.has(position)) position += 1;
  return position;
}

async function fetchOwnerPlans(ownerId: string): Promise<OwnerPlanData> {
  const [activityResult, safetyResult, stayingWellResult] = await Promise.all([
    supabase
      .from('activity_plans')
      .select(
        'id, plan_date, activity_kind, title, details, time_of_day, planned_minutes, status'
      )
      .eq('user_id', ownerId)
      .in('status', ['planned', 'in_progress'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('safety_plans')
      .select('id, title, status')
      .eq('user_id', ownerId)
      .in('status', ['draft', 'active'])
      .order('status', { ascending: true })
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('staying_well_plans')
      .select('id, title, status')
      .eq('user_id', ownerId)
      .in('status', ['draft', 'active'])
      .order('status', { ascending: true })
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const parentError =
    activityResult.error ?? safetyResult.error ?? stayingWellResult.error;
  if (parentError) throw parentError;

  const activityPlan = activityResult.data as ActivityPlan | null;
  const safetyPlan = safetyResult.data as WellbeingPlan | null;
  const stayingWellPlan = stayingWellResult.data as WellbeingPlan | null;

  const [activityStepsResult, safetyItemsResult, stayingWellItemsResult] =
    await Promise.all([
      activityPlan
        ? supabase
            .from('activity_plan_steps')
            .select(
              'id, plan_id, action, timing, estimated_minutes, position, completed'
            )
            .eq('user_id', ownerId)
            .eq('plan_id', activityPlan.id)
            .order('position', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      safetyPlan
        ? supabase
            .from('safety_plan_items')
            .select('id, plan_id, item_kind, label, details, position')
            .eq('user_id', ownerId)
            .eq('plan_id', safetyPlan.id)
            .order('position', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      stayingWellPlan
        ? supabase
            .from('staying_well_plan_items')
            .select('id, plan_id, item_kind, label, details, position')
            .eq('user_id', ownerId)
            .eq('plan_id', stayingWellPlan.id)
            .order('position', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
    ]);

  const childError =
    activityStepsResult.error ??
    safetyItemsResult.error ??
    stayingWellItemsResult.error;
  if (childError) throw childError;

  return {
    activityPlan,
    activitySteps: (activityStepsResult.data ?? []) as ActivityStepRow[],
    safetyPlan,
    safetyItems: (safetyItemsResult.data ?? []) as Array<
      PlanItemRow<SafetyItemKind>
    >,
    stayingWellPlan,
    stayingWellItems: (stayingWellItemsResult.data ?? []) as Array<
      PlanItemRow<StayingWellItemKind>
    >,
  };
}

function FeedbackLine({ feedback }: { feedback: Feedback }) {
  if (feedback.state === 'idle') return null;
  const isError = feedback.state === 'error';

  return (
    <p
      role={isError ? 'alert' : 'status'}
      aria-live="polite"
      className={cn(
        'flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-sm',
        isError
          ? 'border-destructive/25 bg-destructive/5 text-destructive'
          : 'border-border bg-secondary text-foreground'
      )}
    >
      {feedback.state === 'saving' && (
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
      )}
      {feedback.state === 'saved' && (
        <Check className="h-4 w-4" aria-hidden="true" />
      )}
      {feedback.message}
    </p>
  );
}

function PlanItemsEditor<K extends string>({
  idPrefix,
  items,
  kinds,
  maxDetailsLength,
  onChange,
}: {
  idPrefix: string;
  items: Array<PlanItemDraft<K>>;
  kinds: Array<{ id: K; label: string }>;
  maxDetailsLength: number;
  onChange: (items: Array<PlanItemDraft<K>>) => void;
}) {
  const nextPosition = nextFreePosition(items, 0);
  const canAddItem =
    items.length < MAX_PLAN_ITEMS && nextPosition <= MAX_PLAN_ITEM_POSITION;

  const addItem = () => {
    if (!canAddItem) return;
    onChange(
      [
        ...items,
        {
          kind: kinds[0].id,
          label: '',
          details: '',
          position: nextPosition,
        },
      ].sort((left, right) => left.position - right.position)
    );
  };

  const updateItem = (
    index: number,
    patch: Partial<PlanItemDraft<K>>
  ) => {
    onChange(
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      )
    );
  };

  return (
    <div>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={item.id ?? `${idPrefix}-${item.position}`}
            className="rounded-2xl border border-border bg-background/70 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Item {index + 1}
              </p>
              <button
                type="button"
                onClick={() =>
                  onChange(items.filter((_, itemIndex) => itemIndex !== index))
                }
                className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Remove item ${index + 1}`}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Remove
              </button>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-[0.72fr_1.28fr]">
              <label>
                <Label htmlFor={`${idPrefix}-kind-${item.position}`}>Type</Label>
                <select
                  id={`${idPrefix}-kind-${item.position}`}
                  value={item.kind}
                  onChange={(event) =>
                    updateItem(index, { kind: event.target.value as K })
                  }
                  className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {kinds.map((kind) => (
                    <option key={kind.id} value={kind.id}>
                      {kind.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <Label htmlFor={`${idPrefix}-label-${item.position}`}>
                  Short note
                </Label>
                <Input
                  id={`${idPrefix}-label-${item.position}`}
                  value={item.label}
                  onChange={(event) =>
                    updateItem(index, { label: event.target.value })
                  }
                  maxLength={120}
                  placeholder="Keep it specific and easy to scan"
                  className="mt-2"
                />
              </label>
            </div>
            <label className="mt-3 block">
              <Label htmlFor={`${idPrefix}-details-${item.position}`}>
                Details (optional)
              </Label>
              <Textarea
                id={`${idPrefix}-details-${item.position}`}
                value={item.details}
                onChange={(event) =>
                  updateItem(index, { details: event.target.value })
                }
                maxLength={maxDetailsLength}
                className="mt-2 min-h-20"
              />
            </label>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-background/50 px-4 py-8 text-center text-sm text-muted-foreground">
          Add only the notes that would be useful to find again.
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={addItem}
          disabled={!canAddItem}
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Add item
        </Button>
        <span className="text-xs text-muted-foreground">
          {items.length} of {MAX_PLAN_ITEMS} items
        </span>
      </div>
    </div>
  );
}

export default function PlansPage() {
  const { user, loading: authLoading } = useAuth();
  const [segment, setSegment] = useState<Segment>('overview');
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activityPlan, setActivityPlan] = useState<ActivityPlan | null>(null);
  const [storedActivitySteps, setStoredActivitySteps] = useState<
    ActivityStepRow[]
  >([]);
  const [activityDraft, setActivityDraft] =
    useState<ActivityDraft>(blankActivityDraft);
  const [activitySteps, setActivitySteps] = useState<ActivityStepDraft[]>([]);
  const [safetyPlan, setSafetyPlan] = useState<WellbeingPlan | null>(null);
  const [storedSafetyItems, setStoredSafetyItems] = useState<
    Array<PlanItemRow<SafetyItemKind>>
  >([]);
  const [safetyTitle, setSafetyTitle] = useState('My safety plan');
  const [safetyItems, setSafetyItems] = useState<
    Array<PlanItemDraft<SafetyItemKind>>
  >(blankSafetyItems);
  const [stayingWellPlan, setStayingWellPlan] =
    useState<WellbeingPlan | null>(null);
  const [storedStayingWellItems, setStoredStayingWellItems] = useState<
    Array<PlanItemRow<StayingWellItemKind>>
  >([]);
  const [stayingWellTitle, setStayingWellTitle] = useState(
    'My staying-well plan'
  );
  const [stayingWellItems, setStayingWellItems] = useState<
    Array<PlanItemDraft<StayingWellItemKind>>
  >([]);
  const [feedback, setFeedback] =
    useState<Record<SaveSection, Feedback>>(blankFeedback);
  const ownerGenerationRef = useRef(0);
  const currentOwnerIdRef = useRef<string | null>(null);
  const saveInFlightRef = useRef<Record<SaveSection, boolean>>({
    activity: false,
    safety: false,
    'staying-well': false,
  });

  const isCurrentOwner = (ownerId: string, ownerGeneration: number) =>
    currentOwnerIdRef.current === ownerId &&
    ownerGenerationRef.current === ownerGeneration;

  const applyOwnerData = (data: OwnerPlanData) => {
    setActivityPlan(data.activityPlan);
    setStoredActivitySteps(data.activitySteps);
    setActivityDraft(
      data.activityPlan
        ? {
            title: data.activityPlan.title,
            details: data.activityPlan.details,
            planDate: data.activityPlan.plan_date,
            kind: data.activityPlan.activity_kind,
            timeOfDay: data.activityPlan.time_of_day,
            plannedMinutes: String(data.activityPlan.planned_minutes),
          }
        : blankActivityDraft()
    );
    setActivitySteps(
      data.activitySteps.map((step) => ({
        id: step.id,
        action: step.action,
        timing: step.timing,
        estimatedMinutes:
          step.estimated_minutes === null ? '' : String(step.estimated_minutes),
        position: step.position,
      }))
    );

    setSafetyPlan(data.safetyPlan);
    setStoredSafetyItems(data.safetyItems);
    setSafetyTitle(data.safetyPlan?.title ?? 'My safety plan');
    setSafetyItems(
      data.safetyItems.length > 0
        ? data.safetyItems.map((item) => ({
            id: item.id,
            kind: item.item_kind,
            label: item.label,
            details: item.details,
            position: item.position,
          }))
        : blankSafetyItems()
    );

    setStayingWellPlan(data.stayingWellPlan);
    setStoredStayingWellItems(data.stayingWellItems);
    setStayingWellTitle(
      data.stayingWellPlan?.title ?? 'My staying-well plan'
    );
    setStayingWellItems(
      data.stayingWellItems.map((item) => ({
        id: item.id,
        kind: item.item_kind,
        label: item.label,
        details: item.details,
        position: item.position,
      }))
    );
  };

  const loadOwner = async (ownerId: string, ownerGeneration: number) => {
    try {
      const data = await fetchOwnerPlans(ownerId);
      if (!isCurrentOwner(ownerId, ownerGeneration)) return;
      applyOwnerData(data);
      setLoadError('');
    } catch (error) {
      console.error('Plans load failed:', error);
      if (!isCurrentOwner(ownerId, ownerGeneration)) return;
      setLoadError(
        'We could not load your plans. Check your connection and try again.'
      );
    } finally {
      if (isCurrentOwner(ownerId, ownerGeneration)) setLoadingPlans(false);
    }
  };

  useEffect(() => {
    const ownerGeneration = ++ownerGenerationRef.current;
    currentOwnerIdRef.current = user?.id ?? null;
    setActivityPlan(null);
    setStoredActivitySteps([]);
    setSafetyPlan(null);
    setStoredSafetyItems([]);
    setStayingWellPlan(null);
    setStoredStayingWellItems([]);
    setFeedback(blankFeedback());
    setLoadError('');

    if (authLoading) {
      setLoadingPlans(true);
      return;
    }
    if (!user) {
      setLoadingPlans(false);
      setLoadError('A private session is required to load your plans.');
      return;
    }

    setLoadingPlans(true);
    void loadOwner(user.id, ownerGeneration);
    // loadOwner is guarded by an owner generation and must not restart on form edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  const setSectionFeedback = (
    section: SaveSection,
    state: SaveState,
    message: string
  ) => {
    setFeedback((current) => ({
      ...current,
      [section]: { state, message },
    }));
  };

  const markDirty = (section: SaveSection) => {
    if (saveInFlightRef.current[section]) return;
    setSectionFeedback(section, 'dirty', 'Unsaved changes.');
  };

  const reconcileAfterSave = async (
    ownerId: string,
    ownerGeneration: number
  ) => {
    const data = await fetchOwnerPlans(ownerId);
    if (isCurrentOwner(ownerId, ownerGeneration)) applyOwnerData(data);
  };

  const saveActivity = async () => {
    if (!user || saveInFlightRef.current.activity) return;
    const ownerId = user.id;
    const ownerGeneration = ownerGenerationRef.current;
    const title = activityDraft.title.trim();
    const minutes = Number(activityDraft.plannedMinutes);
    const desiredSteps = activitySteps.filter(
      (step) => step.action.trim() || step.timing.trim() || step.estimatedMinutes
    );

    if (!title) {
      setSectionFeedback('activity', 'error', 'Add a short activity name.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(activityDraft.planDate)) {
      setSectionFeedback('activity', 'error', 'Choose a valid plan date.');
      return;
    }
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_ACTIVITY_MINUTES) {
      setSectionFeedback(
        'activity',
        'error',
        `Choose a duration from 1 to ${MAX_ACTIVITY_MINUTES} minutes.`
      );
      return;
    }
    if (activityDraft.details.trim().length > MAX_ACTIVITY_DETAILS) {
      setSectionFeedback(
        'activity',
        'error',
        `Keep activity details to ${MAX_ACTIVITY_DETAILS} characters or fewer.`
      );
      return;
    }
    if (activitySteps.length > MAX_ACTIVITY_STEPS) {
      setSectionFeedback(
        'activity',
        'error',
        `This saved plan has more than ${MAX_ACTIVITY_STEPS} steps. Remove extra steps before saving.`
      );
      return;
    }
    if (desiredSteps.some((step) => !step.action.trim())) {
      setSectionFeedback(
        'activity',
        'error',
        'Each added step needs a short action.'
      );
      return;
    }
    if (
      desiredSteps.some((step) => {
        if (!step.estimatedMinutes) return false;
        const value = Number(step.estimatedMinutes);
        return !Number.isInteger(value) || value < 1 || value > MAX_ACTIVITY_MINUTES;
      })
    ) {
      setSectionFeedback(
        'activity',
        'error',
        `Step durations must be from 1 to ${MAX_ACTIVITY_MINUTES} minutes.`
      );
      return;
    }

    saveInFlightRef.current.activity = true;
    setSectionFeedback('activity', 'saving', 'Saving activity...');

    try {
      const result = await supabase.rpc('save_activity_plan', {
        p_plan_id: activityPlan?.id ?? null,
        p_plan_date: activityDraft.planDate,
        p_activity_kind: activityDraft.kind,
        p_title: title,
        p_details: activityDraft.details.trim(),
        p_time_of_day: activityDraft.timeOfDay,
        p_planned_minutes: minutes,
        p_steps: desiredSteps.map((step) => ({
          ...(step.id ? { id: step.id } : {}),
          action: step.action.trim(),
          timing: step.timing.trim(),
          estimated_minutes: step.estimatedMinutes
            ? Number(step.estimatedMinutes)
            : null,
          position: step.position,
        })),
      });
      if (result.error || !result.data) {
        throw result.error ?? new Error('The activity plan could not be saved.');
      }

      await reconcileAfterSave(ownerId, ownerGeneration);
      if (isCurrentOwner(ownerId, ownerGeneration)) {
        setSectionFeedback('activity', 'saved', 'Activity saved.');
      }
    } catch (error) {
      console.error('Activity plan save failed:', error);
      try {
        await reconcileAfterSave(ownerId, ownerGeneration);
      } catch (reloadError) {
        console.error('Activity plan reconciliation failed:', reloadError);
      }
      if (isCurrentOwner(ownerId, ownerGeneration)) {
        setSectionFeedback(
          'activity',
          'error',
          'We could not finish saving. Your latest stored version has been reloaded where possible.'
        );
      }
    } finally {
      saveInFlightRef.current.activity = false;
    }
  };

  const validatePlanItems = <K extends string,>(
    title: string,
    items: Array<PlanItemDraft<K>>,
    section: SaveSection,
    maxDetailsLength: number
  ): Array<PlanItemDraft<K>> | null => {
    if (!title.trim()) {
      setSectionFeedback(section, 'error', 'Add a short plan title.');
      return null;
    }
    if (items.length > MAX_PLAN_ITEMS) {
      setSectionFeedback(
        section,
        'error',
        `Keep this plan to ${MAX_PLAN_ITEMS} items or fewer.`
      );
      return null;
    }
    const desired = items.filter(
      (item) => item.label.trim() || item.details.trim()
    );
    if (desired.some((item) => !item.label.trim())) {
      setSectionFeedback(
        section,
        'error',
        'Each item with details also needs a short note.'
      );
      return null;
    }
    if (
      desired.some(
        (item) =>
          !Number.isInteger(item.position) ||
          item.position < 0 ||
          item.position > MAX_PLAN_ITEM_POSITION
      )
    ) {
      setSectionFeedback(section, 'error', 'A plan item has an invalid position.');
      return null;
    }
    if (desired.some((item) => item.details.trim().length > maxDetailsLength)) {
      setSectionFeedback(
        section,
        'error',
        `Keep item details to ${maxDetailsLength} characters or fewer.`
      );
      return null;
    }
    return desired;
  };

  const saveSafetyPlan = async () => {
    if (!user || saveInFlightRef.current.safety) return;
    const desired = validatePlanItems(
      safetyTitle,
      safetyItems,
      'safety',
      MAX_SAFETY_ITEM_DETAILS
    );
    if (!desired) return;
    const ownerId = user.id;
    const ownerGeneration = ownerGenerationRef.current;
    saveInFlightRef.current.safety = true;
    setSectionFeedback('safety', 'saving', 'Saving safety plan...');

    try {
      const result = await supabase.rpc('save_safety_plan', {
        p_plan_id: safetyPlan?.id ?? null,
        p_title: safetyTitle.trim(),
        p_items: desired.map((item) => ({
          ...(item.id ? { id: item.id } : {}),
          item_kind: item.kind,
          label: item.label.trim(),
          details: item.details.trim(),
          position: item.position,
        })),
      });
      if (result.error || !result.data) {
        throw result.error ?? new Error('The safety plan could not be saved.');
      }

      await reconcileAfterSave(ownerId, ownerGeneration);
      if (isCurrentOwner(ownerId, ownerGeneration)) {
        setSectionFeedback('safety', 'saved', 'Safety plan saved.');
      }
    } catch (error) {
      console.error('Safety plan save failed:', error);
      try {
        await reconcileAfterSave(ownerId, ownerGeneration);
      } catch (reloadError) {
        console.error('Safety plan reconciliation failed:', reloadError);
      }
      if (isCurrentOwner(ownerId, ownerGeneration)) {
        setSectionFeedback(
          'safety',
          'error',
          'We could not finish saving. Your latest stored version has been reloaded where possible.'
        );
      }
    } finally {
      saveInFlightRef.current.safety = false;
    }
  };

  const saveStayingWellPlan = async () => {
    if (!user || saveInFlightRef.current['staying-well']) return;
    const desired = validatePlanItems(
      stayingWellTitle,
      stayingWellItems,
      'staying-well',
      MAX_STAYING_WELL_ITEM_DETAILS
    );
    if (!desired) return;
    const ownerId = user.id;
    const ownerGeneration = ownerGenerationRef.current;
    saveInFlightRef.current['staying-well'] = true;
    setSectionFeedback('staying-well', 'saving', 'Saving staying-well plan...');

    try {
      const result = await supabase.rpc('save_staying_well_plan', {
        p_plan_id: stayingWellPlan?.id ?? null,
        p_title: stayingWellTitle.trim(),
        p_items: desired.map((item) => ({
          ...(item.id ? { id: item.id } : {}),
          item_kind: item.kind,
          label: item.label.trim(),
          details: item.details.trim(),
          position: item.position,
        })),
      });
      if (result.error || !result.data) {
        throw (
          result.error ?? new Error('The staying-well plan could not be saved.')
        );
      }

      await reconcileAfterSave(ownerId, ownerGeneration);
      if (isCurrentOwner(ownerId, ownerGeneration)) {
        setSectionFeedback(
          'staying-well',
          'saved',
          'Staying-well plan saved.'
        );
      }
    } catch (error) {
      console.error('Staying-well plan save failed:', error);
      try {
        await reconcileAfterSave(ownerId, ownerGeneration);
      } catch (reloadError) {
        console.error('Staying-well plan reconciliation failed:', reloadError);
      }
      if (isCurrentOwner(ownerId, ownerGeneration)) {
        setSectionFeedback(
          'staying-well',
          'error',
          'We could not finish saving. Your latest stored version has been reloaded where possible.'
        );
      }
    } finally {
      saveInFlightRef.current['staying-well'] = false;
    }
  };

  const updateActivityDraft = (patch: Partial<ActivityDraft>) => {
    if (saveInFlightRef.current.activity) return;
    markDirty('activity');
    setActivityDraft((current) => ({ ...current, ...patch }));
  };

  const updateActivityStep = (
    index: number,
    patch: Partial<ActivityStepDraft>
  ) => {
    if (saveInFlightRef.current.activity) return;
    markDirty('activity');
    setActivitySteps((current) =>
      current.map((step, stepIndex) =>
        stepIndex === index ? { ...step, ...patch } : step
      )
    );
  };

  const addActivityStep = () => {
    if (
      saveInFlightRef.current.activity ||
      activitySteps.length >= MAX_ACTIVITY_STEPS
    ) {
      return;
    }
    markDirty('activity');
    setActivitySteps((current) =>
      [
        ...current,
        {
          action: '',
          timing: '',
          estimatedMinutes: '',
          position: nextFreePosition(current, 1),
        },
      ].sort((left, right) => left.position - right.position)
    );
  };

  const retryLoad = () => {
    if (!user) return;
    setLoadingPlans(true);
    setLoadError('');
    void loadOwner(user.id, ownerGenerationRef.current);
  };

  const renderOverview = () => {
    const cards: Array<{
      id: SaveSection;
      eyebrow: string;
      title: string;
      description: string;
      detail: string;
      icon: typeof Activity;
    }> = [
      {
        id: 'activity',
        eyebrow: 'Next small thing',
        title: activityPlan?.title ?? 'Plan one small activity',
        description: 'Break it into no more than three ordered steps.',
        detail: activityPlan
          ? `${storedActivitySteps.length} saved ${storedActivitySteps.length === 1 ? 'step' : 'steps'}`
          : 'Not started',
        icon: Activity,
      },
      {
        id: 'safety',
        eyebrow: 'Keep close',
        title: safetyPlan?.title ?? 'Draft a safety plan',
        description: 'Make this plan with a qualified clinician.',
        detail: safetyPlan
          ? `${storedSafetyItems.length} saved ${storedSafetyItems.length === 1 ? 'item' : 'items'}`
          : 'Not started',
        icon: ShieldCheck,
      },
      {
        id: 'staying-well',
        eyebrow: 'Notice and respond',
        title: stayingWellPlan?.title ?? 'Create a staying-well plan',
        description: 'Keep routines, changes, and support steps easy to find.',
        detail: stayingWellPlan
          ? `${storedStayingWellItems.length} saved ${storedStayingWellItems.length === 1 ? 'item' : 'items'}`
          : 'Not started',
        icon: Leaf,
      },
    ];

    return (
      <section
        id="plans-panel-overview"
        role="tabpanel"
        aria-labelledby="plans-tab-overview"
        className="mt-6"
      >
        <div className="grid gap-4 md:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => setSegment(card.id)}
                className="app-panel group flex min-h-64 flex-col p-5 text-left transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-secondary text-foreground">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="mt-6 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {card.eyebrow}
                </span>
                <span className="mt-2 font-display text-2xl font-medium leading-tight text-foreground">
                  {card.title}
                </span>
                <span className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {card.description}
                </span>
                <span className="mt-auto flex items-center justify-between gap-3 pt-6 text-sm font-medium text-foreground">
                  {card.detail}
                  <ChevronRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              </button>
            );
          })}
        </div>

        <div className="app-panel-quiet mt-4 flex flex-col gap-3 p-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <HeartHandshake
              className="mt-0.5 h-4 w-4 shrink-0 text-foreground"
              aria-hidden="true"
            />
            <p>
              These notes stay private to your account. They are not shared with
              partners or AI.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-x-4 gap-y-2">
            <Link
              href="/planner"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Open life planner
            </Link>
            <Link
              href="/settings"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Privacy settings
            </Link>
          </div>
        </div>
      </section>
    );
  };

  const renderActivity = () => (
    <section
      id="plans-panel-activity"
      role="tabpanel"
      aria-labelledby="plans-tab-activity"
      className="app-panel mt-6 p-5 md:p-6"
    >
      <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            One activity
          </p>
          <h2 className="mt-2 font-display text-3xl font-medium text-foreground">
            Make the next thing smaller.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Choose something manageable. Change the plan whenever a smaller step
            would fit better.
          </p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-foreground">
          Up to {MAX_ACTIVITY_STEPS} steps
        </span>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="md:col-span-2">
          <Label htmlFor="activity-title">Small activity</Label>
          <Input
            id="activity-title"
            value={activityDraft.title}
            onChange={(event) => updateActivityDraft({ title: event.target.value })}
            maxLength={160}
            placeholder="For example, walk to the end of the street"
            className="mt-2"
          />
        </label>
        <label>
          <Label htmlFor="activity-kind">Kind</Label>
          <select
            id="activity-kind"
            value={activityDraft.kind}
            onChange={(event) =>
              updateActivityDraft({ kind: event.target.value as ActivityKind })
            }
            className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {ACTIVITY_KINDS.map((kind) => (
              <option key={kind.id} value={kind.id}>
                {kind.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <Label htmlFor="activity-date">Date</Label>
          <Input
            id="activity-date"
            type="date"
            value={activityDraft.planDate}
            onChange={(event) =>
              updateActivityDraft({ planDate: event.target.value })
            }
            className="mt-2"
          />
        </label>
        <label>
          <Label htmlFor="activity-time">Time of day</Label>
          <select
            id="activity-time"
            value={activityDraft.timeOfDay}
            onChange={(event) =>
              updateActivityDraft({ timeOfDay: event.target.value as RoutineSlot })
            }
            className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {ROUTINE_SLOTS.map((slot) => (
              <option key={slot.id} value={slot.id}>
                {slot.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <Label htmlFor="activity-minutes">Planned minutes</Label>
          <Input
            id="activity-minutes"
            type="number"
            min={1}
            max={MAX_ACTIVITY_MINUTES}
            inputMode="numeric"
            value={activityDraft.plannedMinutes}
            onChange={(event) =>
              updateActivityDraft({ plannedMinutes: event.target.value })
            }
            className="mt-2"
          />
        </label>
        <label className="md:col-span-2">
          <Label htmlFor="activity-details">Helpful note (optional)</Label>
          <Textarea
            id="activity-details"
            value={activityDraft.details}
            onChange={(event) =>
              updateActivityDraft({ details: event.target.value })
            }
            maxLength={MAX_ACTIVITY_DETAILS}
            className="mt-2 min-h-20"
          />
        </label>
      </div>

      <div className="mt-7 border-t border-border pt-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Ordered steps
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Each step should be small enough to begin.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            {activitySteps.length} of {MAX_ACTIVITY_STEPS}
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {activitySteps.map((step, index) => (
            <div
              key={step.id ?? `activity-step-${step.position}`}
              className="rounded-2xl border border-border bg-background/70 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">
                  Step {index + 1}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (saveInFlightRef.current.activity) return;
                    markDirty('activity');
                    setActivitySteps((current) =>
                      current.filter((_, stepIndex) => stepIndex !== index)
                    );
                  }}
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Remove activity step ${index + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Remove
                </button>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_0.7fr_0.4fr]">
                <label>
                  <Label htmlFor={`activity-step-action-${step.position}`}>
                    Action
                  </Label>
                  <Input
                    id={`activity-step-action-${step.position}`}
                    value={step.action}
                    onChange={(event) =>
                      updateActivityStep(index, { action: event.target.value })
                    }
                    maxLength={160}
                    className="mt-2"
                  />
                </label>
                <label>
                  <Label htmlFor={`activity-step-timing-${step.position}`}>
                    When (optional)
                  </Label>
                  <Input
                    id={`activity-step-timing-${step.position}`}
                    value={step.timing}
                    onChange={(event) =>
                      updateActivityStep(index, { timing: event.target.value })
                    }
                    maxLength={100}
                    placeholder="After lunch"
                    className="mt-2"
                  />
                </label>
                <label>
                  <Label htmlFor={`activity-step-minutes-${step.position}`}>
                    Minutes
                  </Label>
                  <Input
                    id={`activity-step-minutes-${step.position}`}
                    type="number"
                    min={1}
                    max={MAX_ACTIVITY_MINUTES}
                    inputMode="numeric"
                    value={step.estimatedMinutes}
                    onChange={(event) =>
                      updateActivityStep(index, {
                        estimatedMinutes: event.target.value,
                      })
                    }
                    className="mt-2"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={addActivityStep}
          disabled={activitySteps.length >= MAX_ACTIVITY_STEPS}
          className="mt-4"
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Add small step
        </Button>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <FeedbackLine feedback={feedback.activity} />
        </div>
        <Button
          type="button"
          onClick={() => void saveActivity()}
          disabled={feedback.activity.state === 'saving'}
          className="sm:min-w-36"
        >
          {feedback.activity.state === 'saving' ? 'Saving...' : 'Save activity'}
        </Button>
      </div>
    </section>
  );

  const renderSafety = () => (
    <section
      id="plans-panel-safety"
      role="tabpanel"
      aria-labelledby="plans-tab-safety"
      className="app-panel mt-6 p-5 md:p-6"
    >
      <div className="border-b border-border pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Safety plan
        </p>
        <h2 className="mt-2 font-display text-3xl font-medium text-foreground">
          Keep clear steps within reach.
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Make this plan with a qualified clinician. Review it together when your
          needs or circumstances change.
        </p>
      </div>

      <div className="mt-5 rounded-2xl border border-border bg-secondary p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              This is a private reference, not an emergency service.
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Saving or opening this plan never contacts anyone for you. Use the
              urgent-help link above when you need immediate support options.
            </p>
          </div>
        </div>
      </div>

      <label className="mt-5 block">
        <Label htmlFor="safety-title">Plan title</Label>
        <Input
          id="safety-title"
          value={safetyTitle}
          onChange={(event) => {
            if (saveInFlightRef.current.safety) return;
            markDirty('safety');
            setSafetyTitle(event.target.value);
          }}
          maxLength={120}
          className="mt-2"
        />
      </label>

      <div className="mt-6">
        <PlanItemsEditor
          idPrefix="safety"
          items={safetyItems}
          kinds={SAFETY_ITEM_KINDS}
          maxDetailsLength={MAX_SAFETY_ITEM_DETAILS}
          onChange={(items) => {
            if (saveInFlightRef.current.safety) return;
            markDirty('safety');
            setSafetyItems(items);
          }}
        />
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <FeedbackLine feedback={feedback.safety} />
        </div>
        <Button
          type="button"
          onClick={() => void saveSafetyPlan()}
          disabled={feedback.safety.state === 'saving'}
          className="sm:min-w-36"
        >
          {feedback.safety.state === 'saving' ? 'Saving...' : 'Save safety plan'}
        </Button>
      </div>
    </section>
  );

  const renderStayingWell = () => (
    <section
      id="plans-panel-staying-well"
      role="tabpanel"
      aria-labelledby="plans-tab-staying-well"
      className="app-panel mt-6 p-5 md:p-6"
    >
      <div className="border-b border-border pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Staying-well plan
        </p>
        <h2 className="mt-2 font-display text-3xl font-medium text-foreground">
          Notice what supports you.
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Keep practical routines, changes you may notice, and support steps in
          one place. Update them when they stop being useful.
        </p>
      </div>

      <label className="mt-5 block">
        <Label htmlFor="staying-well-title">Plan title</Label>
        <Input
          id="staying-well-title"
          value={stayingWellTitle}
          onChange={(event) => {
            if (saveInFlightRef.current['staying-well']) return;
            markDirty('staying-well');
            setStayingWellTitle(event.target.value);
          }}
          maxLength={120}
          className="mt-2"
        />
      </label>

      <div className="mt-6">
        <PlanItemsEditor
          idPrefix="staying-well"
          items={stayingWellItems}
          kinds={STAYING_WELL_ITEM_KINDS}
          maxDetailsLength={MAX_STAYING_WELL_ITEM_DETAILS}
          onChange={(items) => {
            if (saveInFlightRef.current['staying-well']) return;
            markDirty('staying-well');
            setStayingWellItems(items);
          }}
        />
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <FeedbackLine feedback={feedback['staying-well']} />
        </div>
        <Button
          type="button"
          onClick={() => void saveStayingWellPlan()}
          disabled={feedback['staying-well'].state === 'saving'}
          className="sm:min-w-44"
        >
          {feedback['staying-well'].state === 'saving'
            ? 'Saving...'
            : 'Save staying-well plan'}
        </Button>
      </div>
    </section>
  );

  return (
    <main className="px-4 py-8 md:px-8 md:py-12">
      <div className="mx-auto max-w-5xl">
        <header>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            Private planning
          </div>
          <h1 className="mt-4 font-display text-4xl font-medium leading-[1.05] tracking-[-0.02em] text-foreground md:text-5xl">
            My plans
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Keep the next small activity and a few personal reference notes easy
            to find. Change any plan when it no longer fits.
          </p>
        </header>

        <aside className="sticky top-3 z-20 mt-6 rounded-2xl border border-destructive/25 bg-card/95 p-3 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <AlertTriangle
                className="h-4 w-4 shrink-0 text-destructive"
                aria-hidden="true"
              />
              <span>Need urgent help? Find immediate support options.</span>
            </div>
            <Link
              href="/resources"
              className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl bg-destructive px-4 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Urgent-help resources
              <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </aside>

        <nav
          className="mt-6 grid grid-cols-2 gap-2 rounded-2xl border border-border bg-card p-2 md:grid-cols-4"
          role="tablist"
          aria-label="Plan sections"
        >
          {SEGMENTS.map((item) => {
            const Icon = item.icon;
            const selected = segment === item.id;
            return (
              <button
                key={item.id}
                id={`plans-tab-${item.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`plans-panel-${item.id}`}
                onClick={() => setSegment(item.id)}
                className={cn(
                  'flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {(authLoading || loadingPlans) && (
          <section
            className="app-panel mt-6 flex min-h-64 items-center justify-center p-8"
            aria-live="polite"
          >
            <div className="text-center">
              <LoaderCircle
                className="mx-auto h-6 w-6 animate-spin text-muted-foreground"
                aria-hidden="true"
              />
              <p className="mt-3 text-sm text-muted-foreground">
                Loading your private plans...
              </p>
            </div>
          </section>
        )}

        {!authLoading && !loadingPlans && loadError && (
          <section className="app-panel mt-6 p-6" role="alert">
            <p className="text-sm text-destructive">{loadError}</p>
            {user && (
              <Button type="button" variant="outline" onClick={retryLoad} className="mt-4">
                Try again
              </Button>
            )}
          </section>
        )}

        {!authLoading && !loadingPlans && !loadError && (
          <>
            {segment === 'overview' && renderOverview()}
            {segment === 'activity' && renderActivity()}
            {segment === 'safety' && renderSafety()}
            {segment === 'staying-well' && renderStayingWell()}
          </>
        )}
      </div>
    </main>
  );
}
