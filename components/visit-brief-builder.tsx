'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Clipboard,
  Download,
  FileText,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { recordWebPrivacyEvent } from '@/components/privacy-activity';
import { USER_DATA_REGISTRY } from '@/lib/data/user-data-registry';
import { supabase } from '@/lib/supabase/client';
import {
  createActivityPlan,
  createSafetyPlan,
  createSleepDiaryEntry,
  createStayingWellPlan,
  createSupportPreferences,
} from '@/lib/wellbeing/recovery-tools';
import {
  createVisitBriefSelection,
  generateVisitBrief,
  getVisitBriefExportText,
  type VisitBrief,
  type VisitBriefSelection,
  type VisitBriefSource,
} from '@/lib/wellbeing/visit-brief';
import { formatStoredSleepClock } from '@/lib/wellbeing/sleep-entry';

const VISIT_BRIEF_TABLES = [
  'activity_plans',
  'activity_plan_steps',
  'safety_plans',
  'safety_plan_items',
  'staying_well_plans',
  'staying_well_plan_items',
  'sleep_diary_entries',
  'partner_support_preferences',
] as const;

type ActivityPlanRow = {
  id: string;
  plan_date: string;
  title: string;
  details: string;
};

type ActivityStepRow = {
  plan_id: string;
  action: string;
  timing: string;
  location: string;
  estimated_minutes: number | null;
  position: number;
  completed: boolean;
};

type PlanRow = { id: string };

type PlanItemRow = {
  plan_id: string;
  item_kind: string;
  label: string;
  details: string;
  position: number;
};

type SleepDiaryRow = {
  id: string;
  entry_date: string;
  went_to_bed_at: string | null;
  tried_to_sleep_at: string | null;
  fell_asleep_at: string | null;
  woke_up_at: string | null;
  got_out_of_bed_at: string | null;
  awakenings: number | null;
  awake_minutes: number | null;
  nap_minutes: number | null;
  timezone_offset_minutes: number | null;
  timezone_name: string | null;
  notes: string;
};

type SupportPreferencesRow = {
  support_style: string;
  check_in_frequency: string;
  advice_mode: string;
  celebrate_progress: boolean;
  gentle_reminders: boolean;
  acknowledge_setbacks: boolean;
};

export type VisitBriefDatabaseSnapshot = {
  activityPlans: ActivityPlanRow[];
  activitySteps: ActivityStepRow[];
  safetyPlan: PlanRow | null;
  safetyItems: PlanItemRow[];
  stayingWellPlan: PlanRow | null;
  stayingWellItems: PlanItemRow[];
  sleepEntries: SleepDiaryRow[];
  supportPreferences: SupportPreferencesRow | null;
};

export type VisitBriefTransfer = {
  previewText: string;
  clipboardText: string;
  downloadText: string;
  filename: string;
};

const SECTION_COPY: Array<{
  id: Exclude<keyof VisitBriefSelection, 'safetyPlan'>;
  label: string;
  description: string;
}> = [
  {
    id: 'activityPlans',
    label: 'Activity plans',
    description: 'Planned actions and steps',
  },
  {
    id: 'stayingWellPlan',
    label: 'Staying-well plan',
    description: 'Routines, warning changes, and responses',
  },
  {
    id: 'sleepDiary',
    label: 'Sleep diary',
    description: 'Complete factual sleep entries',
  },
  {
    id: 'supportPreferences',
    label: 'Support preferences',
    description: 'How you prefer to receive support',
  },
];

const SUPPORT_STYLE_LABELS: Record<string, string> = {
  not_set: 'Not selected',
  encouragement: 'Encouragement',
  listening: 'Listen first',
  accountability: 'Accountability',
  practical_help: 'Practical help',
  mixed: 'A mix',
};

const FREQUENCY_LABELS: Record<string, string> = {
  never: 'Only when I ask',
  daily: 'Daily',
  few_times_week: 'A few times a week',
  weekly: 'Weekly',
  as_needed: 'As needed',
};

const ADVICE_LABELS: Record<string, string> = {
  ask_first: 'Ask before advice',
  when_requested: 'Only when requested',
  welcome: 'Advice is welcome',
};

function normalizeSpace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function summarizeRow(label: string, details: string, maxLength = 160): string {
  const normalizedLabel = normalizeSpace(label);
  const normalizedDetails = normalizeSpace(details);
  const combined = normalizedDetails
    ? `${normalizedLabel}: ${normalizedDetails}`
    : normalizedLabel;
  if (combined.length <= maxLength) return combined;
  return `${combined.slice(0, Math.max(1, maxLength - 3)).trimEnd()}...`;
}

function elapsedMinutes(from: string, to: string): number | null {
  const start = Date.parse(from);
  const end = Date.parse(to);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  const minutes = Math.round((end - start) / 60_000);
  return minutes <= 1_440 ? minutes : null;
}

function listForKinds(items: PlanItemRow[], kinds: string[]): string[] {
  return items
    .filter((item) => kinds.includes(item.item_kind))
    .sort((left, right) => left.position - right.position)
    .map((item) => summarizeRow(item.label, item.details, 2_200));
}

function contactsForKind(items: PlanItemRow[], kind: string) {
  return items
    .filter((item) => item.item_kind === kind)
    .sort((left, right) => left.position - right.position)
    .map((item) => ({
      name: summarizeRow(item.label, '', 120),
      details: normalizeSpace(item.details) || undefined,
    }));
}

function assertVisitBriefPolicies(): void {
  for (const table of VISIT_BRIEF_TABLES) {
    const policy = USER_DATA_REGISTRY[table];
    if (policy.partner !== 'none' || policy.ai !== 'never') {
      throw new Error('Visit Brief data policy is invalid.');
    }
  }
}

export function adaptVisitBriefRows(snapshot: VisitBriefDatabaseSnapshot): VisitBriefSource {
  assertVisitBriefPolicies();
  const source: VisitBriefSource = {};

  const activityPlans = snapshot.activityPlans.flatMap((plan) => {
    const steps = snapshot.activitySteps
      .filter((step) => step.plan_id === plan.id)
      .sort((left, right) => left.position - right.position);
    if (steps.length === 0) return [];

    return [
      createActivityPlan({
        id: plan.id,
        title: summarizeRow(plan.title, '', 120),
        scheduledDate: plan.plan_date,
        steps: steps.map((step) => ({
          action: summarizeRow(step.action, '', 160),
          when: normalizeSpace(step.timing) || undefined,
          where: normalizeSpace(step.location) || undefined,
          estimatedMinutes:
            step.estimated_minutes && step.estimated_minutes >= 1 && step.estimated_minutes <= 180
              ? step.estimated_minutes
              : undefined,
          completed: step.completed,
        })),
        notes: normalizeSpace(plan.details)
          ? summarizeRow(plan.details, '', 2_000)
          : undefined,
      }),
    ];
  });
  if (activityPlans.length > 0) {
    source.activityPlans = { provenance: 'user-entered', value: activityPlans };
  }

  if (snapshot.safetyPlan) {
    const items = snapshot.safetyItems.filter(
      (item) => item.plan_id === snapshot.safetyPlan?.id
    );
    const safetyPlan = createSafetyPlan({
      warningSigns: listForKinds(items, ['warning_sign']),
      internalCopingStrategies: listForKinds(items, ['coping_strategy']),
      peopleAndPlacesForDistraction: listForKinds(items, ['distraction']),
      peopleToAskForHelp: contactsForKind(items, 'support_contact'),
      professionalAndAgencyContacts: contactsForKind(items, 'professional_support'),
      waysToMakeEnvironmentSafer: listForKinds(items, ['safe_environment']),
    });
    if (
      safetyPlan.warningSigns.length > 0 ||
      safetyPlan.internalCopingStrategies.length > 0 ||
      safetyPlan.peopleAndPlacesForDistraction.length > 0 ||
      safetyPlan.peopleToAskForHelp.length > 0 ||
      safetyPlan.professionalAndAgencyContacts.length > 0 ||
      safetyPlan.waysToMakeEnvironmentSafer.length > 0
    ) {
      source.safetyPlan = { provenance: 'user-entered', value: safetyPlan };
    }
  }

  if (snapshot.stayingWellPlan) {
    const items = snapshot.stayingWellItems.filter(
      (item) => item.plan_id === snapshot.stayingWellPlan?.id
    );
    const plan = createStayingWellPlan({
      dailyActions: listForKinds(items, ['protective_routine']),
      situationsToPrepareFor: listForKinds(items, ['trigger']),
      changesIWantToNotice: listForKinds(items, ['early_warning_sign']),
      responsesIChoose: listForKinds(items, [
        'coping_strategy',
        'clinical_step',
      ]),
      peopleIWantInvolved: contactsForKind(items, 'support_step'),
    });
    if (
      plan.dailyActions.length > 0 ||
      plan.situationsToPrepareFor.length > 0 ||
      plan.changesIWantToNotice.length > 0 ||
      plan.responsesIChoose.length > 0 ||
      plan.peopleIWantInvolved.length > 0
    ) {
      source.stayingWellPlan = { provenance: 'user-entered', value: plan };
    }
  }

  const sleepEntries = snapshot.sleepEntries.flatMap((entry) => {
    const wentToBedAt = entry.went_to_bed_at
      ? formatStoredSleepClock(entry.went_to_bed_at, entry.timezone_name, entry.timezone_offset_minutes) ?? undefined
      : undefined;
    const triedToSleepAt = entry.tried_to_sleep_at
      ? formatStoredSleepClock(entry.tried_to_sleep_at, entry.timezone_name, entry.timezone_offset_minutes) ?? undefined
      : undefined;
    const finalWakeAt = entry.woke_up_at
      ? formatStoredSleepClock(entry.woke_up_at, entry.timezone_name, entry.timezone_offset_minutes) ?? undefined
      : undefined;
    const gotOutOfBedAt = entry.got_out_of_bed_at
      ? formatStoredSleepClock(entry.got_out_of_bed_at, entry.timezone_name, entry.timezone_offset_minutes) ?? undefined
      : undefined;
    const minutesToSleep = entry.tried_to_sleep_at && entry.fell_asleep_at
      ? elapsedMinutes(entry.tried_to_sleep_at, entry.fell_asleep_at)
      : null;
    return [
      createSleepDiaryEntry({
        id: entry.id,
        date: entry.entry_date,
        wentToBedAt,
        triedToSleepAt,
        estimatedMinutesToFallAsleep: minutesToSleep ?? undefined,
        awakenings: [],
        recordedAwakeningCount: entry.awakenings ?? undefined,
        recordedMinutesAwake: entry.awake_minutes ?? undefined,
        finalWakeAt,
        gotOutOfBedAt,
        naps: [],
        recordedNapMinutes: entry.nap_minutes ?? undefined,
        notes: normalizeSpace(entry.notes) || undefined,
      }),
    ];
  });
  if (sleepEntries.length > 0) {
    source.sleepDiary = { provenance: 'user-entered', value: sleepEntries };
  }

  if (snapshot.supportPreferences) {
    const preferences = snapshot.supportPreferences;
    source.supportPreferences = {
      provenance: 'user-entered',
      value: createSupportPreferences({
        communicationNeeds: [
          `Support style: ${SUPPORT_STYLE_LABELS[preferences.support_style] ?? preferences.support_style}`,
          `Check-ins: ${FREQUENCY_LABELS[preferences.check_in_frequency] ?? preferences.check_in_frequency}`,
          `Advice: ${ADVICE_LABELS[preferences.advice_mode] ?? preferences.advice_mode}`,
        ],
        helpfulSupport: [
          preferences.celebrate_progress ? 'Celebrate progress' : '',
          preferences.gentle_reminders ? 'Gentle reminders' : '',
          preferences.acknowledge_setbacks ? 'Acknowledge setbacks without judgment' : '',
        ].filter(Boolean),
      }),
    };
  }

  return source;
}

export function createVisitBriefTransfer(
  brief: VisitBrief,
  date = new Date().toISOString().slice(0, 10)
): VisitBriefTransfer {
  const exactText = getVisitBriefExportText(brief);
  return Object.freeze({
    previewText: exactText,
    clipboardText: exactText,
    downloadText: exactText,
    filename: `mhtoolkit-visit-brief-${date}.txt`,
  });
}

async function loadVisitBriefSource(ownerId: string): Promise<VisitBriefSource> {
  assertVisitBriefPolicies();
  const [activityResult, safetyResult, stayingWellResult, sleepResult, supportResult] =
    await Promise.all([
      supabase
        .from('activity_plans')
        .select('id, plan_date, title, details')
        .eq('user_id', ownerId)
        .order('plan_date', { ascending: false })
        .limit(12),
      supabase
        .from('safety_plans')
        .select('id')
        .eq('user_id', ownerId)
        .in('status', ['active', 'draft'])
        .order('status', { ascending: true })
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('staying_well_plans')
        .select('id')
        .eq('user_id', ownerId)
        .in('status', ['active', 'draft'])
        .order('status', { ascending: true })
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('sleep_diary_entries')
        .select(
          'id, entry_date, went_to_bed_at, tried_to_sleep_at, fell_asleep_at, woke_up_at, got_out_of_bed_at, awakenings, awake_minutes, nap_minutes, timezone_offset_minutes, timezone_name, notes'
        )
        .eq('user_id', ownerId)
        .order('entry_date', { ascending: false })
        .limit(31),
      supabase
        .from('partner_support_preferences')
        .select(
          'support_style, check_in_frequency, advice_mode, celebrate_progress, gentle_reminders, acknowledge_setbacks'
        )
        .eq('user_id', ownerId)
        .maybeSingle(),
    ]);

  const parentError =
    activityResult.error ??
    safetyResult.error ??
    stayingWellResult.error ??
    sleepResult.error ??
    supportResult.error;
  if (parentError) throw parentError;

  const activityPlans = (activityResult.data ?? []) as ActivityPlanRow[];
  const safetyPlan = safetyResult.data as PlanRow | null;
  const stayingWellPlan = stayingWellResult.data as PlanRow | null;

  const activityIds = activityPlans.map((plan) => plan.id);
  const [activityStepsResult, safetyItemsResult, stayingWellItemsResult] =
    await Promise.all([
      activityIds.length > 0
        ? supabase
            .from('activity_plan_steps')
            .select(
              'plan_id, action, timing, location, estimated_minutes, position, completed'
            )
            .eq('user_id', ownerId)
            .in('plan_id', activityIds)
            .order('position', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      safetyPlan
        ? supabase
            .from('safety_plan_items')
            .select('plan_id, item_kind, label, details, position')
            .eq('user_id', ownerId)
            .eq('plan_id', safetyPlan.id)
            .order('position', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      stayingWellPlan
        ? supabase
            .from('staying_well_plan_items')
            .select('plan_id, item_kind, label, details, position')
            .eq('user_id', ownerId)
            .eq('plan_id', stayingWellPlan.id)
            .order('position', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
    ]);

  const childError =
    activityStepsResult.error ?? safetyItemsResult.error ?? stayingWellItemsResult.error;
  if (childError) throw childError;

  return adaptVisitBriefRows({
    activityPlans,
    activitySteps: (activityStepsResult.data ?? []) as ActivityStepRow[],
    safetyPlan,
    safetyItems: (safetyItemsResult.data ?? []) as PlanItemRow[],
    stayingWellPlan,
    stayingWellItems: (stayingWellItemsResult.data ?? []) as PlanItemRow[],
    sleepEntries: (sleepResult.data ?? []) as SleepDiaryRow[],
    supportPreferences: supportResult.data as SupportPreferencesRow | null,
  });
}

function downloadTransfer(transfer: VisitBriefTransfer): void {
  const blob = new Blob([transfer.downloadText], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = transfer.filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function VisitBriefBuilder({ ownerId }: { ownerId: string | null }) {
  const [selection, setSelection] = useState<VisitBriefSelection>(() =>
    createVisitBriefSelection()
  );
  const [source, setSource] = useState<VisitBriefSource>({});
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [pendingTransfer, setPendingTransfer] = useState<'copy' | 'download' | null>(null);
  const ownerRef = useRef(ownerId);

  useEffect(() => {
    ownerRef.current = ownerId;
    setSelection(createVisitBriefSelection());
    setSource({});
    setLoaded(false);
    setLoading(false);
    setError('');
    setStatus('');
    setPendingTransfer(null);
  }, [ownerId]);

  const briefResult = (() => {
    try {
      return { brief: generateVisitBrief({ selection, source }), error: '' };
    } catch {
      return { brief: generateVisitBrief({}), error: 'This brief could not be prepared.' };
    }
  })();
  const transfer = createVisitBriefTransfer(briefResult.brief);
  const canTransfer = briefResult.brief.sections.length > 0 && !briefResult.error;

  const load = async () => {
    if (!ownerId) {
      setLoaded(false);
      setSource({});
      setError('Sign in to prepare a Visit Brief.');
      return;
    }

    const requestedOwner = ownerId;
    setLoading(true);
    setError('');
    setStatus('');
    try {
      const nextSource = await loadVisitBriefSource(requestedOwner);
      if (ownerRef.current !== requestedOwner) return;
      setSource(nextSource);
      setLoaded(true);
      setSelection(createVisitBriefSelection());
    } catch {
      if (ownerRef.current !== requestedOwner) return;
      setLoaded(false);
      setSource({});
      setError('Visit Brief data could not be loaded.');
    } finally {
      if (ownerRef.current === requestedOwner) setLoading(false);
    }
  };

  const toggle = (id: keyof VisitBriefSelection, checked: boolean) => {
    setStatus('');
    setSelection((current) => ({ ...current, [id]: checked }));
  };

  const recordExport = async () => {
    try {
      await recordWebPrivacyEvent('export_requested', {
        method: 'privacy_settings',
      });
      return true;
    } catch {
      return false;
    }
  };

  const performCopy = async () => {
    if (!canTransfer) return;
    try {
      await navigator.clipboard.writeText(transfer.clipboardText);
      const recorded = await recordExport();
      setStatus(recorded ? 'Visit Brief copied.' : 'Copied, but Privacy Activity could not be updated.');
    } catch {
      setStatus('Visit Brief could not be copied.');
    }
  };

  const performDownload = async () => {
    if (!canTransfer) return;
    try {
      downloadTransfer(transfer);
      const recorded = await recordExport();
      setStatus(recorded ? 'Visit Brief downloaded.' : 'Downloaded, but Privacy Activity could not be updated.');
    } catch {
      setStatus('Visit Brief could not be downloaded.');
    }
  };

  const requestTransfer = (kind: 'copy' | 'download') => {
    if (!canTransfer) return;
    if (selection.safetyPlan) {
      setPendingTransfer(kind);
      return;
    }
    if (kind === 'copy') void performCopy();
    else void performDownload();
  };

  const confirmSensitiveTransfer = () => {
    const kind = pendingTransfer;
    setPendingTransfer(null);
    if (kind === 'copy') void performCopy();
    if (kind === 'download') void performDownload();
  };

  return (
    <Card className="mb-6 overflow-hidden">
      <details
        className="group"
        onToggle={(event) => {
          if (event.currentTarget.open && !loaded && !loading) void load();
        }}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
          <span className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-xl font-semibold">Visit Brief</span>
              <span className="mt-1 block text-sm font-normal text-muted-foreground">
                Choose exactly what to include in a factual appointment summary.
              </span>
            </span>
          </span>
          <ChevronDown
            className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>

        <CardContent className="border-t border-border pt-6">
          <div className="rounded-xl border border-border bg-secondary p-4 text-sm text-muted-foreground">
            Every section starts off. Journal entries, AI chat history, assessment scores, and mood notes are never available here.
          </div>

          {loading && (
            <p role="status" className="mt-4 text-sm text-muted-foreground">
              Loading available sections...
            </p>
          )}
          {error && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
                Try again
              </Button>
            </div>
          )}

          {loaded && !error && (
            <>
              <div className="mt-4 flex justify-end">
                <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
                  <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                  Refresh data
                </Button>
              </div>
              <fieldset className="mt-5 space-y-2">
                <legend className="mb-2 text-sm font-semibold">Include in this brief</legend>
                {SECTION_COPY.map((section) => (
                  <SectionToggle
                    key={section.id}
                    label={section.label}
                    description={section.description}
                    checked={selection[section.id]}
                    available={Boolean(source[section.id])}
                    onChange={(checked) => toggle(section.id, checked)}
                  />
                ))}
              </fieldset>

              <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">Safety plan</p>
                    <p className="mt-1 text-sm">Excluded unless you turn it on for this brief.</p>
                    <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-lg bg-white/70 p-3 text-sm">
                      <input
                        type="checkbox"
                        checked={selection.safetyPlan}
                        disabled={!source.safetyPlan}
                        onChange={(event) => toggle('safetyPlan', event.target.checked)}
                        className="h-4 w-4"
                      />
                      <span>
                        {source.safetyPlan ? 'Include my safety plan' : 'No saved safety plan available'}
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {briefResult.error && (
                <p role="alert" className="mt-4 text-sm text-destructive">
                  {briefResult.error}
                </p>
              )}

              <div className="mt-5">
                <label htmlFor="visit-brief-preview" className="text-sm font-semibold">
                  Exact preview
                </label>
                <Textarea
                  id="visit-brief-preview"
                  className="mt-2 min-h-64 font-mono text-xs"
                  readOnly
                  value={transfer.previewText}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  The copied and downloaded text is exactly what appears above.
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" onClick={() => requestTransfer('copy')} disabled={!canTransfer}>
                  <Clipboard className="mr-2 h-4 w-4" aria-hidden="true" />
                  Copy exact text
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => requestTransfer('download')}
                  disabled={!canTransfer}
                >
                  <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                  Download .txt
                </Button>
              </div>
              {pendingTransfer && (
                <div role="alert" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                  <p className="font-semibold">Share this safety-plan copy?</p>
                  <p className="mt-1">The receiving person or app may keep it after you send it.</p>
                  <div className="mt-3 flex gap-2">
                    <Button type="button" size="sm" onClick={confirmSensitiveTransfer}>Continue</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setPendingTransfer(null)}>Cancel</Button>
                  </div>
                </div>
              )}
              {status && (
                <p role="status" className="mt-3 text-sm text-muted-foreground">
                  {status}
                </p>
              )}
            </>
          )}
        </CardContent>
      </details>
    </Card>
  );
}

function SectionToggle({
  label,
  description,
  checked,
  available,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  available: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-3 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4"
        checked={checked}
        disabled={!available}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {available ? description : 'No compatible saved data available'}
        </span>
      </span>
    </label>
  );
}
