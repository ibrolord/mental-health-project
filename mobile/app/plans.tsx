import { useEffect, useRef, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
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
  ChoiceChip,
  EmptyState,
  PageHeader,
  SectionHeader,
  appUiStyles,
} from '@/components/AppUI';
import { Colors } from '@/lib/constants';
import { useDataContext } from '@/lib/hooks/use-data-context';
import {
  type OfflineSafetyPlan,
  type OfflineSafetyPlanItem,
} from '@/lib/offline-safety-plan';
import { offlineSafetyPlanCache } from '@/lib/offline-safety-plan-cache';
import { supabase } from '@/lib/supabase';

type Segment = 'activity' | 'safety' | 'staying_well';
type ActivityKind =
  | 'movement'
  | 'social'
  | 'creative'
  | 'outdoors'
  | 'self_care'
  | 'learning'
  | 'rest'
  | 'other';
type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'anytime';
type ActivityStatus = 'planned' | 'in_progress' | 'completed' | 'skipped';
type SafetyItemKind = OfflineSafetyPlanItem['item_kind'];
type StayingWellItemKind =
  | 'protective_routine'
  | 'trigger'
  | 'early_warning_sign'
  | 'coping_strategy'
  | 'support_step'
  | 'clinical_step'
  | 'other';

type ActivityStep = {
  id: string;
  plan_id: string;
  user_id: string;
  action: string;
  timing: string;
  location: string;
  estimated_minutes: number | null;
  position: number;
  completed: boolean;
  created_at: string;
  updated_at: string;
};

type ActivityPlan = {
  id: string;
  user_id: string;
  plan_date: string;
  activity_kind: ActivityKind;
  title: string;
  details: string;
  time_of_day: TimeOfDay;
  planned_minutes: number;
  status: ActivityStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  steps: ActivityStep[];
};

type StayingWellPlan = {
  id: string;
  user_id: string;
  title: string;
  status: 'draft' | 'active' | 'archived';
  created_at: string;
  updated_at: string;
};

type StayingWellItem = {
  id: string;
  plan_id: string;
  user_id: string;
  item_kind: StayingWellItemKind;
  label: string;
  details: string;
  position: number;
  created_at: string;
  updated_at: string;
};

const MAX_ACTIVITY_STEPS = 3;
const MAX_ACTIVITY_MINUTES = 180;
const MAX_ACTIVITY_DETAILS = 1000;
const MAX_PLAN_ITEMS = 6;
const MAX_PLAN_ITEM_POSITION = 5;
const MAX_SAFETY_ITEM_DETAILS = 1000;

const SEGMENTS: { id: Segment; label: string; icon: 'calendar' | 'shield' | 'sun' }[] = [
  { id: 'activity', label: 'Activity', icon: 'calendar' },
  { id: 'safety', label: 'Safety', icon: 'shield' },
  { id: 'staying_well', label: 'Staying well', icon: 'sun' },
];

const ACTIVITY_KINDS: { id: ActivityKind; label: string }[] = [
  { id: 'movement', label: 'Movement' },
  { id: 'social', label: 'Social' },
  { id: 'creative', label: 'Creative' },
  { id: 'outdoors', label: 'Outdoors' },
  { id: 'self_care', label: 'Self-care' },
  { id: 'learning', label: 'Learning' },
  { id: 'rest', label: 'Rest' },
  { id: 'other', label: 'Other' },
];

const TIMES: { id: TimeOfDay; label: string }[] = [
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'Afternoon' },
  { id: 'evening', label: 'Evening' },
  { id: 'anytime', label: 'Anytime' },
];

const SAFETY_KINDS: { id: SafetyItemKind; label: string }[] = [
  { id: 'warning_sign', label: 'What I notice' },
  { id: 'coping_strategy', label: 'What I can do' },
  { id: 'distraction', label: 'People or places for distraction' },
  { id: 'safe_environment', label: 'Safer surroundings' },
  { id: 'support_contact', label: 'Person to contact' },
  { id: 'professional_support', label: 'Professional support' },
  { id: 'reason_to_live', label: 'Reason to keep going' },
  { id: 'other', label: 'Other' },
];

const STAYING_WELL_KINDS: { id: StayingWellItemKind; label: string }[] = [
  { id: 'protective_routine', label: 'Helpful routine' },
  { id: 'trigger', label: 'Situation to plan for' },
  { id: 'early_warning_sign', label: 'Early sign' },
  { id: 'coping_strategy', label: 'Response' },
  { id: 'support_step', label: 'Support step' },
  { id: 'clinical_step', label: 'Care step' },
  { id: 'other', label: 'Other' },
];

const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> = {
  planned: 'Planned',
  in_progress: 'Started',
  completed: 'Completed',
  skipped: 'Set aside',
};

const ACTIVITY_STATUS_ACTIONS: {
  status: ActivityStatus;
  label: string;
  icon: 'calendar' | 'play' | 'check' | 'pause';
}[] = [
  { status: 'planned', label: 'Plan again', icon: 'calendar' },
  { status: 'in_progress', label: 'Start', icon: 'play' },
  { status: 'completed', label: 'Complete', icon: 'check' },
  { status: 'skipped', label: 'Set aside', icon: 'pause' },
];

function localDateValue(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().startsWith(value);
}

function displayDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.valueOf())
    ? value
    : date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
}

function labelFor<T extends string>(
  options: { id: T; label: string }[],
  id: T
): string {
  return options.find((option) => option.id === id)?.label ?? id;
}

function nextPlanItemPosition(items: { position: number }[]): number | null {
  if (items.length >= MAX_PLAN_ITEMS) return null;
  const usedPositions = new Set(items.map((item) => item.position));
  const highestPosition = items.reduce(
    (highest, item) => Math.max(highest, item.position),
    -1
  );
  if (highestPosition < MAX_PLAN_ITEM_POSITION) return highestPosition + 1;
  for (let position = 0; position <= MAX_PLAN_ITEM_POSITION; position += 1) {
    if (!usedPositions.has(position)) return position;
  }
  return null;
}

async function loadActivityPlans(ownerId: string): Promise<ActivityPlan[]> {
  const { data, error } = await supabase
    .from('activity_plans')
    .select(
      'id, user_id, plan_date, activity_kind, title, details, time_of_day, planned_minutes, status, completed_at, created_at, updated_at'
    )
    .eq('user_id', ownerId)
    .order('plan_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;

  const plans = (data ?? []) as Omit<ActivityPlan, 'steps'>[];
  if (plans.length === 0) return [];
  const planIds = plans.map((plan) => plan.id);
  const { data: stepData, error: stepError } = await supabase
    .from('activity_plan_steps')
    .select(
      'id, plan_id, user_id, action, timing, location, estimated_minutes, position, completed, created_at, updated_at'
    )
    .eq('user_id', ownerId)
    .in('plan_id', planIds)
    .order('position', { ascending: true });
  if (stepError) throw stepError;

  const steps = (stepData ?? []) as ActivityStep[];
  return plans.map((plan) => ({
    ...plan,
    steps: steps.filter((step) => step.plan_id === plan.id),
  }));
}

async function loadSafetyPlan(ownerId: string): Promise<{
  plan: OfflineSafetyPlan;
  items: OfflineSafetyPlanItem[];
} | null> {
  const { data, error } = await supabase
    .from('safety_plans')
    .select('id, user_id, title, status, created_at, updated_at')
    .eq('user_id', ownerId)
    .neq('status', 'archived')
    .order('status', { ascending: true })
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const plan = data as OfflineSafetyPlan;
  const { data: itemData, error: itemError } = await supabase
    .from('safety_plan_items')
    .select(
      'id, plan_id, user_id, item_kind, label, details, position, created_at, updated_at'
    )
    .eq('user_id', ownerId)
    .eq('plan_id', plan.id)
    .order('position', { ascending: true });
  if (itemError) throw itemError;
  return { plan, items: (itemData ?? []) as OfflineSafetyPlanItem[] };
}

async function loadStayingWellPlan(ownerId: string): Promise<{
  plan: StayingWellPlan;
  items: StayingWellItem[];
} | null> {
  const { data, error } = await supabase
    .from('staying_well_plans')
    .select('id, user_id, title, status, created_at, updated_at')
    .eq('user_id', ownerId)
    .neq('status', 'archived')
    .order('status', { ascending: true })
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const plan = data as StayingWellPlan;
  const { data: itemData, error: itemError } = await supabase
    .from('staying_well_plan_items')
    .select(
      'id, plan_id, user_id, item_kind, label, details, position, created_at, updated_at'
    )
    .eq('user_id', ownerId)
    .eq('plan_id', plan.id)
    .order('position', { ascending: true });
  if (itemError) throw itemError;
  return { plan, items: (itemData ?? []) as StayingWellItem[] };
}

function SegmentControl({
  selected,
  onSelect,
}: {
  selected: Segment;
  onSelect: (segment: Segment) => void;
}) {
  return (
    <View style={styles.segmentControl} accessibilityRole="tablist">
      {SEGMENTS.map((segment) => {
        const active = segment.id === selected;
        return (
          <Pressable
            key={segment.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(segment.id)}
            style={({ pressed }) => [
              styles.segment,
              active && styles.segmentSelected,
              pressed && styles.pressed,
            ]}
          >
            <Feather
              name={segment.icon}
              size={15}
              color={active ? '#fffef8' : Colors.primary}
            />
            <Text style={[styles.segmentText, active && styles.segmentTextSelected]}>
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function PlanItemList<T extends { id: string; label: string; details: string; position: number }>({
  items,
  kindLabel,
  itemName,
  readOnly = false,
  saving = false,
  onEdit,
  onDelete,
}: {
  items: T[];
  kindLabel: (item: T) => string;
  itemName: string;
  readOnly?: boolean;
  saving?: boolean;
  onEdit: (item: T) => void;
  onDelete: (item: T) => void;
}) {
  return (
    <View>
      {items.map((item, index) => (
        <AppCard key={item.id} quiet>
          <View style={styles.itemHeading}>
            <View style={styles.numberBadge}>
              <Text style={styles.numberText}>{index + 1}</Text>
            </View>
            <View style={styles.itemCopy}>
              <Text style={appUiStyles.label}>{kindLabel(item)}</Text>
              <Text style={styles.itemTitle}>{item.label}</Text>
            </View>
          </View>
          {item.details ? (
            <Text style={[appUiStyles.muted, styles.itemDetails]}>
              {item.details}
            </Text>
          ) : null}
          {!readOnly ? (
            <View style={styles.cardActions}>
              <AppButton
                label="Edit"
                icon="edit-2"
                variant="quiet"
                disabled={saving}
                accessibilityLabel={`Edit ${itemName}: ${item.label}`}
                onPress={() => onEdit(item)}
              />
              <AppButton
                label="Delete"
                icon="trash-2"
                variant="danger"
                disabled={saving}
                accessibilityLabel={`Delete ${itemName}: ${item.label}`}
                onPress={() => onDelete(item)}
              />
            </View>
          ) : null}
        </AppCard>
      ))}
    </View>
  );
}

export default function PlansScreen() {
  const router = useRouter();
  const { view } = useLocalSearchParams<{ view?: string | string[] }>();
  const { context, authLoading } = useDataContext();
  const [segment, setSegment] = useState<Segment>('activity');
  const [activities, setActivities] = useState<ActivityPlan[]>([]);
  const [safety, setSafety] = useState<{
    plan: OfflineSafetyPlan;
    items: OfflineSafetyPlanItem[];
  } | null>(null);
  const [stayingWell, setStayingWell] = useState<{
    plan: StayingWellPlan;
    items: StayingWellItem[];
  } | null>(null);
  const [safetyOffline, setSafetyOffline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);

  const [activityEditor, setActivityEditor] = useState(false);
  const [activityTitle, setActivityTitle] = useState('');
  const [activityDetails, setActivityDetails] = useState('');
  const [activityDate, setActivityDate] = useState(localDateValue);
  const [activityKind, setActivityKind] = useState<ActivityKind>('self_care');
  const [activityTime, setActivityTime] = useState<TimeOfDay>('anytime');
  const [activityMinutes, setActivityMinutes] = useState('30');
  const [activitySteps, setActivitySteps] = useState(['', '', '']);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);

  const [safetyEditor, setSafetyEditor] = useState(false);
  const [safetyKind, setSafetyKind] = useState<SafetyItemKind>('warning_sign');
  const [safetyLabel, setSafetyLabel] = useState('');
  const [safetyDetails, setSafetyDetails] = useState('');
  const [editingSafetyItemId, setEditingSafetyItemId] = useState<string | null>(
    null
  );

  const [wellEditor, setWellEditor] = useState(false);
  const [wellKind, setWellKind] = useState<StayingWellItemKind>('protective_routine');
  const [wellLabel, setWellLabel] = useState('');
  const [wellDetails, setWellDetails] = useState('');
  const [editingWellItemId, setEditingWellItemId] = useState<string | null>(null);

  const ownerRef = useRef(context.user_id);
  const previousOwnerRef = useRef<string | null>(null);
  const saveRef = useRef(false);
  const pendingMutationErrorRef = useRef('');
  ownerRef.current = context.user_id;

  useEffect(() => {
    const requestedView = Array.isArray(view) ? view[0] : view;
    if (requestedView === 'safety') setSegment('safety');
  }, [view]);

  useEffect(() => {
    const previousOwner = previousOwnerRef.current;
    const nextOwner = context.user_id;
    if (previousOwner && previousOwner !== nextOwner) {
      void offlineSafetyPlanCache.clear(previousOwner).catch(() => {});
      setActivityEditor(false);
      setEditingActivityId(null);
      setActivityTitle('');
      setActivityDetails('');
      setActivitySteps(['', '', '']);
      setSafetyEditor(false);
      setEditingSafetyItemId(null);
      setSafetyLabel('');
      setSafetyDetails('');
      setWellEditor(false);
      setEditingWellItemId(null);
      setWellLabel('');
      setWellDetails('');
      pendingMutationErrorRef.current = '';
      setSaving(false);
      setError('');
    }
    previousOwnerRef.current = nextOwner;
  }, [context.user_id]);

  useEffect(() => {
    if (authLoading) return;
    const ownerId = context.user_id;
    if (!ownerId) {
      setActivities([]);
      setSafety(null);
      setStayingWell(null);
      setSafetyOffline(false);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    if (!pendingMutationErrorRef.current) setError('');
    void (async () => {
      const [activityResult, safetyResult, stayingWellResult] =
        await Promise.allSettled([
          loadActivityPlans(ownerId),
          loadSafetyPlan(ownerId),
          loadStayingWellPlan(ownerId),
        ]);
      if (!active || ownerRef.current !== ownerId) return;

      let loadFailed = false;
      let offlineCopyUpdateFailed = false;
      if (activityResult.status === 'fulfilled') {
        setActivities(activityResult.value);
      } else {
        setActivities([]);
        loadFailed = true;
      }

      if (stayingWellResult.status === 'fulfilled') {
        setStayingWell(stayingWellResult.value);
      } else {
        setStayingWell(null);
        loadFailed = true;
      }

      if (safetyResult.status === 'fulfilled') {
        setSafety(safetyResult.value);
        setSafetyOffline(false);
        try {
          if (safetyResult.value) {
            await offlineSafetyPlanCache.write(ownerId, safetyResult.value);
          } else {
            await offlineSafetyPlanCache.clear(ownerId);
          }
        } catch {
          offlineCopyUpdateFailed = true;
        }
      } else {
        loadFailed = true;
        try {
          const cached = await offlineSafetyPlanCache.read(ownerId);
          if (active && ownerRef.current === ownerId && cached) {
            setSafety({ plan: cached.plan, items: cached.items });
            setSafetyOffline(true);
          } else {
            setSafety(null);
            setSafetyOffline(false);
          }
        } catch {
          setSafety(null);
          setSafetyOffline(false);
        }
      }

      if (active && ownerRef.current === ownerId) {
        const pendingMutationError = pendingMutationErrorRef.current;
        pendingMutationErrorRef.current = '';
        const messages = [
          pendingMutationError,
          loadFailed ? 'Some plans could not be loaded.' : '',
          offlineCopyUpdateFailed
            ? 'Your safety plan is available online, but its offline copy could not be updated.'
            : '',
        ].filter(Boolean);
        setError(messages.join(' '));
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [authLoading, context.user_id, refreshToken]);

  const resetActivityEditor = () => {
    setEditingActivityId(null);
    setActivityTitle('');
    setActivityDetails('');
    setActivityDate(localDateValue());
    setActivityKind('self_care');
    setActivityTime('anytime');
    setActivityMinutes('30');
    setActivitySteps(['', '', '']);
  };

  const closeActivityEditor = () => {
    resetActivityEditor();
    setActivityEditor(false);
  };

  const openNewActivityEditor = () => {
    resetActivityEditor();
    setActivityEditor(true);
  };

  const openActivityEditor = (activity: ActivityPlan) => {
    if (
      saving ||
      activity.user_id !== context.user_id ||
      !['planned', 'in_progress'].includes(activity.status)
    ) {
      return;
    }
    if (activity.steps.length > MAX_ACTIVITY_STEPS) {
      setError(
        `This saved plan has more than ${MAX_ACTIVITY_STEPS} steps and cannot be edited without removing the extra steps.`
      );
      return;
    }
    const stepValues = ['', '', ''];
    for (const step of activity.steps) {
      if (step.position >= 1 && step.position <= MAX_ACTIVITY_STEPS) {
        stepValues[step.position - 1] = step.action;
      }
    }
    setEditingActivityId(activity.id);
    setActivityTitle(activity.title);
    setActivityDetails(activity.details);
    setActivityDate(activity.plan_date);
    setActivityKind(activity.activity_kind);
    setActivityTime(activity.time_of_day);
    setActivityMinutes(String(activity.planned_minutes));
    setActivitySteps(stepValues);
    setActivityEditor(true);
  };

  const saveActivity = async () => {
    const ownerId = context.user_id;
    const title = activityTitle.trim();
    const details = activityDetails.trim();
    const minutes = Number(activityMinutes);
    const stepValues = activitySteps.map((step) => step.trim());
    const activity = editingActivityId
      ? activities.find((candidate) => candidate.id === editingActivityId)
      : null;
    if (!ownerId || saveRef.current) return;
    if (
      editingActivityId &&
      (!activity ||
        activity.user_id !== ownerId ||
        !['planned', 'in_progress'].includes(activity.status))
    ) {
      setError('This activity is no longer available to edit.');
      return;
    }
    if (!title) {
      setError('Add a name for this activity.');
      return;
    }
    if (!isCalendarDate(activityDate)) {
      setError('Use YYYY-MM-DD for the activity date.');
      return;
    }
    if (details.length > MAX_ACTIVITY_DETAILS) {
      setError(`Keep activity notes to ${MAX_ACTIVITY_DETAILS} characters.`);
      return;
    }
    if (
      !Number.isInteger(minutes) ||
      minutes < 1 ||
      minutes > MAX_ACTIVITY_MINUTES
    ) {
      setError(
        `Choose a planned time from 1 to ${MAX_ACTIVITY_MINUTES} minutes.`
      );
      return;
    }

    saveRef.current = true;
    setSaving(true);
    setError('');
    try {
      const stepsByPosition = new Map(
        (activity?.steps ?? []).map((step) => [step.position, step])
      );
      const steps = stepValues.flatMap((action, index) => {
        if (!action) return [];
        const position = index + 1;
        const storedStep = stepsByPosition.get(position);
        return [
          {
            ...(storedStep ? { id: storedStep.id } : {}),
            action,
            timing: storedStep?.timing ?? '',
            estimated_minutes: storedStep?.estimated_minutes ?? null,
            position,
          },
        ];
      });
      const { data, error: planError } = await supabase.rpc(
        'save_activity_plan',
        {
          p_plan_id: activity?.id ?? null,
          p_plan_date: activityDate,
          p_activity_kind: activityKind,
          p_title: title,
          p_details: details,
          p_time_of_day: activityTime,
          p_planned_minutes: minutes,
          p_steps: steps,
        }
      );
      if (planError || !data) {
        throw planError ?? new Error('Activity save returned no plan.');
      }

      if (ownerRef.current !== ownerId) return;
      closeActivityEditor();
      setRefreshToken((value) => value + 1);
    } catch {
      if (ownerRef.current === ownerId) {
        setError(
          'This activity could not be saved. Check your connection and try again.'
        );
      }
    } finally {
      saveRef.current = false;
      if (ownerRef.current === ownerId) setSaving(false);
    }
  };

  const updateActivityStatus = async (
    activity: ActivityPlan,
    status: ActivityStatus
  ) => {
    const ownerId = context.user_id;
    if (
      !ownerId ||
      activity.user_id !== ownerId ||
      activity.status === status ||
      saveRef.current
    ) {
      return;
    }

    saveRef.current = true;
    setSaving(true);
    setError('');
    try {
      const { data, error: statusError } = await supabase
        .from('activity_plans')
        .update({
          status,
          completed_at: status === 'completed' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activity.id)
        .eq('user_id', ownerId)
        .select('id')
        .maybeSingle();
      if (statusError || !data) {
        throw statusError ?? new Error('Activity status update did not match.');
      }
      if (ownerRef.current === ownerId) {
        setRefreshToken((value) => value + 1);
      }
    } catch {
      if (ownerRef.current === ownerId) {
        setError('The activity status could not be changed. Check your connection and try again.');
      }
    } finally {
      saveRef.current = false;
      if (ownerRef.current === ownerId) setSaving(false);
    }
  };

  const toggleActivityStep = async (
    activity: ActivityPlan,
    step: ActivityStep
  ) => {
    const ownerId = context.user_id;
    if (
      !ownerId ||
      activity.user_id !== ownerId ||
      step.user_id !== ownerId ||
      step.plan_id !== activity.id ||
      saveRef.current
    ) {
      return;
    }

    saveRef.current = true;
    setSaving(true);
    setError('');
    try {
      const { data, error: stepError } = await supabase
        .from('activity_plan_steps')
        .update({
          completed: !step.completed,
          updated_at: new Date().toISOString(),
        })
        .eq('id', step.id)
        .eq('plan_id', activity.id)
        .eq('user_id', ownerId)
        .select('id')
        .maybeSingle();
      if (stepError || !data) {
        throw stepError ?? new Error('Activity step update did not match.');
      }
      if (ownerRef.current === ownerId) {
        setRefreshToken((value) => value + 1);
      }
    } catch {
      if (ownerRef.current === ownerId) {
        setError('That step could not be changed. Check your connection and try again.');
      }
    } finally {
      saveRef.current = false;
      if (ownerRef.current === ownerId) setSaving(false);
    }
  };

  const deleteActivity = async (activity: ActivityPlan) => {
    const ownerId = context.user_id;
    if (!ownerId || activity.user_id !== ownerId || saveRef.current) return;

    saveRef.current = true;
    setSaving(true);
    setError('');
    try {
      const { data, error: deleteError } = await supabase
        .from('activity_plans')
        .delete()
        .eq('id', activity.id)
        .eq('user_id', ownerId)
        .select('id')
        .maybeSingle();
      if (deleteError || !data) {
        throw deleteError ?? new Error('Activity delete did not match.');
      }
      if (ownerRef.current === ownerId) {
        if (editingActivityId === activity.id) closeActivityEditor();
        setRefreshToken((value) => value + 1);
      }
    } catch {
      if (ownerRef.current === ownerId) {
        setError('This activity could not be deleted. Check your connection and try again.');
      }
    } finally {
      saveRef.current = false;
      if (ownerRef.current === ownerId) setSaving(false);
    }
  };

  const confirmDeleteActivity = (activity: ActivityPlan) => {
    Alert.alert(
      'Delete activity?',
      `Delete "${activity.title}" and its steps? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete activity',
          style: 'destructive',
          onPress: () => void deleteActivity(activity),
        },
      ]
    );
  };

  const closeSafetyEditor = () => {
    setSafetyEditor(false);
    setEditingSafetyItemId(null);
    setSafetyKind('warning_sign');
    setSafetyLabel('');
    setSafetyDetails('');
  };

  const openNewSafetyItemEditor = () => {
    if (safetyOffline || saving) return;
    closeSafetyEditor();
    setSafetyEditor(true);
  };

  const openSafetyItemEditor = (item: OfflineSafetyPlanItem) => {
    if (
      safetyOffline ||
      saving ||
      item.user_id !== context.user_id ||
      item.plan_id !== safety?.plan.id
    ) {
      return;
    }
    setEditingSafetyItemId(item.id);
    setSafetyKind(item.item_kind);
    setSafetyLabel(item.label);
    setSafetyDetails(item.details);
    setSafetyEditor(true);
  };

  const saveSafetyItem = async () => {
    const ownerId = context.user_id;
    const label = safetyLabel.trim();
    const details = safetyDetails.trim();
    if (!ownerId || !label || saveRef.current || safetyOffline) {
      if (!label) setError('Add a short safety-plan item.');
      return;
    }
    if (details.length > MAX_SAFETY_ITEM_DETAILS) {
      setError(
        `Keep safety-plan details to ${MAX_SAFETY_ITEM_DETAILS} characters.`
      );
      return;
    }

    saveRef.current = true;
    setSaving(true);
    setError('');
    try {
      const planId = safety?.plan.id ?? null;
      const currentItems = safety?.items ?? [];
      if (
        currentItems.some(
          (item) =>
            item.user_id !== ownerId ||
            (planId !== null && item.plan_id !== planId)
        )
      ) {
        setError('The safety plan changed. Refresh before saving.');
        return;
      }
      if (
        editingSafetyItemId &&
        (!planId ||
          !currentItems.some(
            (item) =>
              item.id === editingSafetyItemId && item.user_id === ownerId
          ))
      ) {
        setError('That safety-plan item is no longer available to edit.');
        return;
      }

      const nextPosition = editingSafetyItemId
        ? null
        : nextPlanItemPosition(currentItems);
      if (!editingSafetyItemId && nextPosition === null) {
        setError('This safety plan has reached its item limit.');
        return;
      }
      const nextItems = editingSafetyItemId
        ? currentItems.map((item) =>
            item.id === editingSafetyItemId
              ? { ...item, item_kind: safetyKind, label, details }
              : item
          )
        : [
            ...currentItems,
            {
              item_kind: safetyKind,
              label,
              details,
              position: nextPosition as number,
            },
          ];
      const result = await supabase.rpc('save_safety_plan', {
        p_plan_id: planId,
        p_title: safety?.plan.title ?? 'My safety plan',
        p_items: nextItems.map((item) => ({
          ...('id' in item ? { id: item.id } : {}),
          item_kind: item.item_kind,
          label: item.label,
          details: item.details,
          position: item.position,
        })),
      });
      if (result.error || typeof result.data !== 'string') {
        setError('That safety-plan item could not be saved.');
        return;
      }

      if (ownerRef.current !== ownerId) return;
      closeSafetyEditor();
      setRefreshToken((value) => value + 1);
    } catch {
      if (ownerRef.current === ownerId) {
        const message =
          'That safety-plan item could not be saved. Check your connection and try again.';
        pendingMutationErrorRef.current = message;
        setError(message);
        setRefreshToken((value) => value + 1);
      }
    } finally {
      saveRef.current = false;
      if (ownerRef.current === ownerId) setSaving(false);
    }
  };

  const deleteSafetyItem = async (item: OfflineSafetyPlanItem) => {
    const ownerId = context.user_id;
    const planId = safety?.plan.id;
    if (
      safetyOffline ||
      !ownerId ||
      !planId ||
      item.user_id !== ownerId ||
      item.plan_id !== planId ||
      saveRef.current
    ) {
      return;
    }

    saveRef.current = true;
    setSaving(true);
    setError('');
    try {
      const { data, error: deleteError } = await supabase
        .from('safety_plan_items')
        .delete()
        .eq('id', item.id)
        .eq('plan_id', planId)
        .eq('user_id', ownerId)
        .select('id')
        .maybeSingle();
      if (deleteError || !data) {
        throw deleteError ?? new Error('Safety item delete did not match.');
      }
      if (ownerRef.current === ownerId) {
        if (editingSafetyItemId === item.id) closeSafetyEditor();
        setRefreshToken((value) => value + 1);
      }
    } catch {
      if (ownerRef.current === ownerId) {
        setError('That safety-plan item could not be deleted. Check your connection and try again.');
      }
    } finally {
      saveRef.current = false;
      if (ownerRef.current === ownerId) setSaving(false);
    }
  };

  const confirmDeleteSafetyItem = (item: OfflineSafetyPlanItem) => {
    if (safetyOffline) return;
    Alert.alert(
      'Delete safety-plan item?',
      `Delete "${item.label}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete item',
          style: 'destructive',
          onPress: () => void deleteSafetyItem(item),
        },
      ]
    );
  };

  const closeWellEditor = () => {
    setWellEditor(false);
    setEditingWellItemId(null);
    setWellKind('protective_routine');
    setWellLabel('');
    setWellDetails('');
  };

  const openNewWellItemEditor = () => {
    if (saving) return;
    closeWellEditor();
    setWellEditor(true);
  };

  const openWellItemEditor = (item: StayingWellItem) => {
    if (
      saving ||
      item.user_id !== context.user_id ||
      item.plan_id !== stayingWell?.plan.id
    ) {
      return;
    }
    setEditingWellItemId(item.id);
    setWellKind(item.item_kind);
    setWellLabel(item.label);
    setWellDetails(item.details);
    setWellEditor(true);
  };

  const saveStayingWellItem = async () => {
    const ownerId = context.user_id;
    const label = wellLabel.trim();
    if (!ownerId || !label || saveRef.current) {
      if (!label) setError('Add a short staying-well item.');
      return;
    }

    saveRef.current = true;
    setSaving(true);
    setError('');
    try {
      const planId = stayingWell?.plan.id ?? null;
      const currentItems = stayingWell?.items ?? [];
      if (
        currentItems.some(
          (item) =>
            item.user_id !== ownerId ||
            (planId !== null && item.plan_id !== planId)
        )
      ) {
        setError('The staying-well plan changed. Refresh before saving.');
        return;
      }
      if (
        editingWellItemId &&
        (!planId ||
          !currentItems.some(
            (item) => item.id === editingWellItemId && item.user_id === ownerId
          ))
      ) {
        setError('That staying-well item is no longer available to edit.');
        return;
      }

      const nextPosition = editingWellItemId
        ? null
        : nextPlanItemPosition(currentItems);
      if (!editingWellItemId && nextPosition === null) {
        setError('This staying-well plan has reached its item limit.');
        return;
      }
      const nextItems = editingWellItemId
        ? currentItems.map((item) =>
            item.id === editingWellItemId
              ? {
                  ...item,
                  item_kind: wellKind,
                  label,
                  details: wellDetails.trim(),
                }
              : item
          )
        : [
            ...currentItems,
            {
              item_kind: wellKind,
              label,
              details: wellDetails.trim(),
              position: nextPosition as number,
            },
          ];
      const result = await supabase.rpc('save_staying_well_plan', {
        p_plan_id: planId,
        p_title: stayingWell?.plan.title ?? 'My staying-well plan',
        p_items: nextItems.map((item) => ({
          ...('id' in item ? { id: item.id } : {}),
          item_kind: item.item_kind,
          label: item.label,
          details: item.details,
          position: item.position,
        })),
      });
      if (result.error || typeof result.data !== 'string') {
        setError('That staying-well item could not be saved.');
        return;
      }

      if (ownerRef.current !== ownerId) return;
      closeWellEditor();
      setRefreshToken((value) => value + 1);
    } catch {
      if (ownerRef.current === ownerId) {
        const message =
          'That staying-well item could not be saved. Check your connection and try again.';
        pendingMutationErrorRef.current = message;
        setError(message);
        setRefreshToken((value) => value + 1);
      }
    } finally {
      saveRef.current = false;
      if (ownerRef.current === ownerId) setSaving(false);
    }
  };

  const deleteStayingWellItem = async (item: StayingWellItem) => {
    const ownerId = context.user_id;
    const planId = stayingWell?.plan.id;
    if (
      !ownerId ||
      !planId ||
      item.user_id !== ownerId ||
      item.plan_id !== planId ||
      saveRef.current
    ) {
      return;
    }

    saveRef.current = true;
    setSaving(true);
    setError('');
    try {
      const { data, error: deleteError } = await supabase
        .from('staying_well_plan_items')
        .delete()
        .eq('id', item.id)
        .eq('plan_id', planId)
        .eq('user_id', ownerId)
        .select('id')
        .maybeSingle();
      if (deleteError || !data) {
        throw deleteError ?? new Error('Staying-well item delete did not match.');
      }
      if (ownerRef.current === ownerId) {
        if (editingWellItemId === item.id) closeWellEditor();
        setRefreshToken((value) => value + 1);
      }
    } catch {
      if (ownerRef.current === ownerId) {
        setError('That staying-well item could not be deleted. Check your connection and try again.');
      }
    } finally {
      saveRef.current = false;
      if (ownerRef.current === ownerId) setSaving(false);
    }
  };

  const confirmDeleteStayingWellItem = (item: StayingWellItem) => {
    Alert.alert(
      'Delete staying-well item?',
      `Delete "${item.label}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete item',
          style: 'destructive',
          onPress: () => void deleteStayingWellItem(item),
        },
      ]
    );
  };

  const signedOut = !authLoading && !context.user_id;
  const safetyAtLimit = (safety?.items.length ?? 0) >= MAX_PLAN_ITEMS;
  const stayingWellAtLimit =
    (stayingWell?.items.length ?? 0) >= MAX_PLAN_ITEMS;

  return (
    <AppScreen>
      <PageHeader
        eyebrow="Private planning"
        title="My plans"
        description="Keep practical next steps together. These plans are visible only to you."
        icon="clipboard"
      />
      <SegmentControl selected={segment} onSelect={setSegment} />

      {error ? <Text style={[appUiStyles.error, styles.message]}>{error}</Text> : null}

      {signedOut ? (
        <EmptyState
          icon="lock"
          title="Sign in to use My plans"
          description="Your plans are tied to your account and are not available in guest mode."
        />
      ) : loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={appUiStyles.muted}>Loading your plans...</Text>
        </View>
      ) : segment === 'activity' ? (
        <View>
          <SectionHeader
            title="Activity plan"
            description="Choose one activity and up to three small, ordered steps."
            action={
              <AppButton
                label={activityEditor ? 'Close' : 'Add'}
                icon={activityEditor ? 'x' : 'plus'}
                variant="quiet"
                disabled={saving}
                accessibilityLabel={
                  activityEditor ? 'Close activity editor' : 'Add activity'
                }
                onPress={
                  activityEditor ? closeActivityEditor : openNewActivityEditor
                }
              />
            }
          />
          {activityEditor ? (
            <AppCard>
              <AppInput
                label="Activity"
                value={activityTitle}
                onChangeText={setActivityTitle}
                placeholder="What would you like to make time for?"
                maxLength={160}
              />
              <Text style={styles.fieldLabel}>Type</Text>
              <View style={styles.chips}>
                {ACTIVITY_KINDS.map((kind) => (
                  <ChoiceChip
                    key={kind.id}
                    label={kind.label}
                    selected={activityKind === kind.id}
                    onPress={() => setActivityKind(kind.id)}
                  />
                ))}
              </View>
              <Text style={styles.fieldLabelWithSpace}>Time of day</Text>
              <View style={styles.chips}>
                {TIMES.map((time) => (
                  <ChoiceChip
                    key={time.id}
                    label={time.label}
                    selected={activityTime === time.id}
                    onPress={() => setActivityTime(time.id)}
                  />
                ))}
              </View>
              <View style={styles.splitInputs}>
                <View style={styles.splitInput}>
                  <AppInput
                    label="Date"
                    value={activityDate}
                    onChangeText={setActivityDate}
                    placeholder="YYYY-MM-DD"
                    autoCapitalize="none"
                    maxLength={10}
                  />
                </View>
                <View style={styles.splitInput}>
                  <AppInput
                    label="Minutes"
                    value={activityMinutes}
                    onChangeText={setActivityMinutes}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                </View>
              </View>
              <AppInput
                label="Notes (optional)"
                value={activityDetails}
                onChangeText={setActivityDetails}
                placeholder="Anything that makes this easier to start"
                multiline
                maxLength={MAX_ACTIVITY_DETAILS}
              />
              <Text style={styles.fieldLabel}>Steps (optional)</Text>
              {activitySteps.map((step, index) => (
                <AppInput
                  key={index}
                  value={step}
                  onChangeText={(value) =>
                    setActivitySteps((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? value : item
                      )
                    )
                  }
                  placeholder={`Step ${index + 1}`}
                  accessibilityLabel={`Activity step ${index + 1}`}
                  maxLength={160}
                />
              ))}
              <AppButton
                label={editingActivityId ? 'Update activity' : 'Save activity'}
                icon="check"
                onPress={() => void saveActivity()}
                loading={saving}
              />
            </AppCard>
          ) : null}

          {activities.length === 0 ? (
            <EmptyState
              icon="calendar"
              title="No activities planned"
              description="Add one activity when you want a simple next step."
            />
          ) : (
            activities.map((activity) => (
              <AppCard key={activity.id}>
                <View style={styles.cardTopline}>
                  <Text style={appUiStyles.label}>
                    {displayDate(activity.plan_date)}
                  </Text>
                  <Text style={styles.statusBadge}>
                    {ACTIVITY_STATUS_LABELS[activity.status]}
                  </Text>
                </View>
                <Text style={styles.planTitle}>{activity.title}</Text>
                <Text style={appUiStyles.muted}>
                  {labelFor(ACTIVITY_KINDS, activity.activity_kind)} ·{' '}
                  {labelFor(TIMES, activity.time_of_day)} ·{' '}
                  {activity.planned_minutes} min
                </Text>
                {activity.details ? (
                  <Text style={[appUiStyles.body, styles.planDetails]}>
                    {activity.details}
                  </Text>
                ) : null}
                {activity.steps.length > 0 ? (
                  <View style={styles.steps}>
                    {activity.steps.map((step, index) => (
                      <View key={step.id} style={styles.stepRow}>
                        <View style={styles.stepNumber}>
                          <Text style={styles.stepNumberText}>{index + 1}</Text>
                        </View>
                        <Text
                          style={[
                            appUiStyles.body,
                            styles.stepText,
                            step.completed && styles.completedStepText,
                          ]}
                        >
                          {step.action}
                        </Text>
                        <AppButton
                          label={step.completed ? 'Undo' : 'Done'}
                          icon={step.completed ? 'rotate-ccw' : 'check'}
                          variant="quiet"
                          disabled={saving}
                          accessibilityLabel={`${
                            step.completed ? 'Mark incomplete' : 'Mark complete'
                          } step ${index + 1}: ${step.action}`}
                          onPress={() => void toggleActivityStep(activity, step)}
                        />
                      </View>
                    ))}
                  </View>
                ) : null}
                <View style={styles.statusActions}>
                  <Text style={styles.controlLabel}>Change status</Text>
                  <View style={styles.cardActions}>
                    {ACTIVITY_STATUS_ACTIONS.filter(
                      (action) => action.status !== activity.status
                    ).map((action) => (
                      <AppButton
                        key={action.status}
                        label={action.label}
                        icon={action.icon}
                        variant="quiet"
                        disabled={saving}
                        accessibilityLabel={`${action.label} activity: ${activity.title}`}
                        onPress={() =>
                          void updateActivityStatus(activity, action.status)
                        }
                      />
                    ))}
                  </View>
                </View>
                <View style={styles.cardActions}>
                  {['planned', 'in_progress'].includes(activity.status) ? (
                    <AppButton
                      label="Edit"
                      icon="edit-2"
                      variant="quiet"
                      disabled={saving}
                      accessibilityLabel={`Edit activity: ${activity.title}`}
                      onPress={() => openActivityEditor(activity)}
                    />
                  ) : null}
                  <AppButton
                    label="Delete"
                    icon="trash-2"
                    variant="danger"
                    disabled={saving}
                    accessibilityLabel={`Delete activity: ${activity.title}`}
                    onPress={() => confirmDeleteActivity(activity)}
                  />
                </View>
              </AppCard>
            ))
          )}
          <AppCard quiet>
            <SectionHeader
              title="Longer-term planning"
              description="Keep dreams, fears, and time-bound goals in Life planner."
              action={
                <AppButton
                  label="Open"
                  icon="arrow-right"
                  variant="quiet"
                  onPress={() => router.push('/planner')}
                />
              }
            />
          </AppCard>
        </View>
      ) : segment === 'safety' ? (
        <View>
          <AppCard style={styles.urgentCard}>
            <View style={styles.urgentHeading}>
              <Feather name="life-buoy" size={19} color={Colors.danger} />
              <Text style={styles.urgentTitle}>Need urgent help?</Text>
            </View>
            <Text style={appUiStyles.muted}>
              If someone is in immediate danger, contact local emergency services.
              Country support options are in Resources.
            </Text>
            <AppButton
              label="Open urgent resources"
              icon="arrow-right"
              variant="danger"
              onPress={() => router.push('/resources')}
              style={styles.urgentButton}
            />
          </AppCard>

          {safetyOffline ? (
            <AppCard quiet style={styles.offlineCard}>
              <View style={styles.offlineRow}>
                <Feather name="wifi-off" size={17} color={Colors.primary} />
                <View style={styles.itemCopy}>
                  <Text style={styles.offlineTitle}>Saved offline copy</Text>
                  <Text style={appUiStyles.muted}>
                    Read only. Reconnect before making changes.
                  </Text>
                </View>
              </View>
            </AppCard>
          ) : null}

          <SectionHeader
            title={safety?.plan.title ?? 'My safety plan'}
            description="If you can, make this with a qualified professional or someone you trust. Keep signs, steps, and contacts here."
            action={
              <AppButton
                label={safetyEditor ? 'Close' : safetyAtLimit ? 'Full' : 'Add'}
                icon={safetyEditor ? 'x' : 'plus'}
                variant="quiet"
                disabled={
                  safetyOffline || saving || (!safetyEditor && safetyAtLimit)
                }
                accessibilityLabel={
                  safetyEditor
                    ? 'Close safety-plan item editor'
                    : 'Add safety-plan item'
                }
                onPress={
                  safetyEditor ? closeSafetyEditor : openNewSafetyItemEditor
                }
              />
            }
          />
          {safetyEditor && !safetyOffline ? (
            <AppCard>
              <Text style={styles.fieldLabel}>Item type</Text>
              <View style={styles.chips}>
                {SAFETY_KINDS.map((kind) => (
                  <ChoiceChip
                    key={kind.id}
                    label={kind.label}
                    selected={safetyKind === kind.id}
                    onPress={() => setSafetyKind(kind.id)}
                  />
                ))}
              </View>
              <View style={styles.firstInput}>
                <AppInput
                  label="Plan item"
                  value={safetyLabel}
                  onChangeText={setSafetyLabel}
                  placeholder="One clear thing to remember"
                  maxLength={120}
                />
              </View>
              <AppInput
                label="Details (optional)"
                value={safetyDetails}
                onChangeText={setSafetyDetails}
                placeholder="Useful context, contact details, or a location"
                multiline
                maxLength={MAX_SAFETY_ITEM_DETAILS}
              />
              <AppButton
                label={
                  editingSafetyItemId
                    ? 'Update safety-plan item'
                    : 'Save safety-plan item'
                }
                icon="check"
                onPress={() => void saveSafetyItem()}
                loading={saving}
              />
            </AppCard>
          ) : null}
          {!safety || safety.items.length === 0 ? (
            <EmptyState
              icon="shield"
              title="No safety-plan items yet"
              description="Add only the personal information you want available here."
            />
          ) : (
            <PlanItemList
              items={safety.items}
              kindLabel={(item) => labelFor(SAFETY_KINDS, item.item_kind)}
              itemName="safety-plan item"
              readOnly={safetyOffline}
              saving={saving}
              onEdit={openSafetyItemEditor}
              onDelete={confirmDeleteSafetyItem}
            />
          )}
        </View>
      ) : (
        <View>
          <SectionHeader
            title={stayingWell?.plan.title ?? 'My staying-well plan'}
            description="Record routines, early signs, responses, and support steps that matter to you."
            action={
              <AppButton
                label={wellEditor ? 'Close' : stayingWellAtLimit ? 'Full' : 'Add'}
                icon={wellEditor ? 'x' : 'plus'}
                variant="quiet"
                disabled={saving || (!wellEditor && stayingWellAtLimit)}
                accessibilityLabel={
                  wellEditor
                    ? 'Close staying-well item editor'
                    : 'Add staying-well item'
                }
                onPress={wellEditor ? closeWellEditor : openNewWellItemEditor}
              />
            }
          />
          {wellEditor ? (
            <AppCard>
              <Text style={styles.fieldLabel}>Item type</Text>
              <View style={styles.chips}>
                {STAYING_WELL_KINDS.map((kind) => (
                  <ChoiceChip
                    key={kind.id}
                    label={kind.label}
                    selected={wellKind === kind.id}
                    onPress={() => setWellKind(kind.id)}
                  />
                ))}
              </View>
              <View style={styles.firstInput}>
                <AppInput
                  label="Plan item"
                  value={wellLabel}
                  onChangeText={setWellLabel}
                  placeholder="One routine, sign, or next step"
                  maxLength={120}
                />
              </View>
              <AppInput
                label="Details (optional)"
                value={wellDetails}
                onChangeText={setWellDetails}
                placeholder="Keep this practical and personal"
                multiline
                maxLength={2000}
              />
              <AppButton
                label={
                  editingWellItemId
                    ? 'Update staying-well item'
                    : 'Save staying-well item'
                }
                icon="check"
                onPress={() => void saveStayingWellItem()}
                loading={saving}
              />
            </AppCard>
          ) : null}
          {!stayingWell || stayingWell.items.length === 0 ? (
            <EmptyState
              icon="sun"
              title="No staying-well items yet"
              description="Add a routine, sign, or response you want to keep handy."
            />
          ) : (
            <PlanItemList
              items={stayingWell.items}
              kindLabel={(item) =>
                labelFor(STAYING_WELL_KINDS, item.item_kind)
              }
              itemName="staying-well item"
              saving={saving}
              onEdit={openWellItemEditor}
              onDelete={confirmDeleteStayingWellItem}
            />
          )}
        </View>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  segmentControl: {
    flexDirection: 'row',
    gap: 6,
    padding: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'rgba(255,254,248,0.72)',
    marginBottom: 18,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  segmentSelected: { backgroundColor: Colors.primary },
  segmentText: { flexShrink: 1, color: Colors.primary, fontSize: 12, lineHeight: 16, fontWeight: '700', textAlign: 'center' },
  segmentTextSelected: { color: '#fffef8' },
  pressed: { opacity: 0.76 },
  message: { marginBottom: 12 },
  loading: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  fieldLabel: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  fieldLabelWithSpace: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  splitInputs: { flexDirection: 'row', gap: 10, marginTop: 16 },
  splitInput: { flex: 1 },
  firstInput: { marginTop: 16 },
  cardTopline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  statusBadge: {
    color: Colors.primary,
    backgroundColor: Colors.primaryLight,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: '700',
  },
  planTitle: {
    color: Colors.text,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 5,
  },
  planDetails: { marginTop: 12 },
  steps: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 14,
    paddingTop: 12,
    gap: 9,
  },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: { color: Colors.primary, fontSize: 11, fontWeight: '800' },
  stepText: { flex: 1 },
  completedStepText: { textDecorationLine: 'line-through', opacity: 0.68 },
  statusActions: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 14,
    paddingTop: 12,
  },
  controlLabel: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  urgentCard: { backgroundColor: Colors.dangerLight, borderColor: '#efc5bc' },
  urgentHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  urgentTitle: { color: Colors.text, fontSize: 17, fontWeight: '700' },
  urgentButton: { alignSelf: 'flex-start', marginTop: 13 },
  offlineCard: { borderColor: Colors.sage },
  offlineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  offlineTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  itemHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  itemCopy: { flex: 1 },
  numberBadge: {
    width: 29,
    height: 29,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: { color: Colors.primary, fontSize: 12, fontWeight: '800' },
  itemTitle: {
    color: Colors.text,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
    marginTop: 4,
  },
  itemDetails: { marginTop: 10, marginLeft: 40 },
});
