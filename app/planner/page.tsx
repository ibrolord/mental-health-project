'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  Compass,
  Lightbulb,
  Pause,
  Plus,
  Shield,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DismissibleNotice } from '@/components/dismissible-notice';
import { PushNotificationSettings } from '@/components/push-notification-settings';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

type ItemType = 'dream' | 'motivation' | 'fear' | 'milestone';
type Horizon = '30_days' | '90_days' | '1_year' | '3_years' | 'someday';
type ItemStatus = 'active' | 'complete' | 'paused';

type PlanItem = {
  id: string;
  item_type: ItemType;
  horizon: Horizon;
  title: string;
  reflection: string;
  next_step: string;
  target_date: string | null;
  status: ItemStatus;
};

type PlannerReminder = {
  id: string;
  local_time: string | null;
  days_of_week: number[];
  enabled: boolean;
};

const ITEM_TYPES: Array<{
  id: ItemType;
  label: string;
  prompt: string;
  reflectionLabel: string;
  icon: typeof Compass;
}> = [
  {
    id: 'dream',
    label: 'Dream',
    prompt: 'What direction would feel meaningful?',
    reflectionLabel: 'Why does this matter to you?',
    icon: Sparkles,
  },
  {
    id: 'motivation',
    label: 'Motivation',
    prompt: 'What value or person helps you keep going?',
    reflectionLabel: 'What do you want to remember on a hard day?',
    icon: Lightbulb,
  },
  {
    id: 'fear',
    label: 'Obstacle',
    prompt: 'What might get in the way?',
    reflectionLabel: 'What boundary, preparation, or support could help?',
    icon: Shield,
  },
  {
    id: 'milestone',
    label: 'Milestone',
    prompt: 'What visible result are you working toward?',
    reflectionLabel: 'How will you know this is complete?',
    icon: Compass,
  },
];

const HORIZONS: Array<{ id: Horizon; label: string }> = [
  { id: '30_days', label: '30 days' },
  { id: '90_days', label: '90 days' },
  { id: '1_year', label: '1 year' },
  { id: '3_years', label: '3 years' },
  { id: 'someday', label: 'Someday' },
];

const WEEKDAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const EMPTY_DRAFT = {
  itemType: 'dream' as ItemType,
  horizon: '90_days' as Horizon,
  title: '',
  reflection: '',
  nextStep: '',
  targetDate: '',
};

export default function PlannerPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<PlanItem[]>([]);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [filter, setFilter] = useState<Horizon | 'all'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [reminder, setReminder] = useState<PlannerReminder | null>(null);
  const [reminderDay, setReminderDay] = useState(0);
  const [reminderTime, setReminderTime] = useState('18:00');
  const [reminderSaving, setReminderSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const createInFlightRef = useRef(false);

  const loadPlanner = async () => {
    if (!user) return;
    const [itemsResult, reminderResult] = await Promise.all([
      supabase
        .from('life_plan_items')
        .select(
          'id, item_type, horizon, title, reflection, next_step, target_date, status'
        )
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false }),
      supabase
        .from('wellbeing_reminders')
        .select('id, local_time, days_of_week, enabled')
        .eq('user_id', user.id)
        .eq('kind', 'planner')
        .eq('route', '/planner')
        .limit(1)
        .maybeSingle(),
    ]);

    if (itemsResult.error || reminderResult.error) {
      setError(itemsResult.error?.message ?? reminderResult.error?.message ?? '');
      return;
    }
    setItems((itemsResult.data ?? []) as PlanItem[]);
    const loadedReminder = reminderResult.data as PlannerReminder | null;
    setReminder(loadedReminder);
    if (loadedReminder?.local_time) {
      setReminderTime(loadedReminder.local_time.slice(0, 5));
      setReminderDay(loadedReminder.days_of_week[0] ?? 0);
    }
  };

  useEffect(() => {
    if (!authLoading && user) void loadPlanner();
    // loadPlanner is intentionally scoped to the current owner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  const addItem = async () => {
    if (!user || !draft.title.trim() || createInFlightRef.current) return;
    createInFlightRef.current = true;
    setSaving(true);
    setError('');
    setStatus('');
    const { error: insertError } = await supabase.from('life_plan_items').insert({
      user_id: user.id,
      item_type: draft.itemType,
      horizon: draft.horizon,
      title: draft.title.trim().replace(/\s+/g, ' ').slice(0, 160),
      reflection: draft.reflection.trim().slice(0, 2_000),
      next_step: draft.nextStep.trim().slice(0, 500),
      target_date: draft.targetDate || null,
    });
    if (insertError) {
      setError(
        insertError.code === '23505'
          ? 'That active item is already in this time horizon.'
          : insertError.message
      );
    } else {
      setDraft(EMPTY_DRAFT);
      setShowCreate(false);
      setStatus('Plan item added. Keep the next step small enough to start.');
      await loadPlanner();
    }
    setSaving(false);
    createInFlightRef.current = false;
  };

  const setBusy = (id: string, busy: boolean) => {
    setBusyIds((current) => {
      const next = new Set(current);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const updateStatus = async (item: PlanItem, nextStatus: ItemStatus) => {
    setBusy(item.id, true);
    setError('');
    const { error: updateError } = await supabase
      .from('life_plan_items')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', item.id);
    if (updateError) {
      setError(
        updateError.code === '23505'
          ? 'An active item with that title and time horizon already exists.'
          : 'That plan item could not be updated. Please try again.'
      );
    } else {
      setItems((current) =>
        current.map((value) =>
          value.id === item.id ? { ...value, status: nextStatus } : value
        )
      );
    }
    setBusy(item.id, false);
  };

  const deleteItem = async (item: PlanItem) => {
    setBusy(item.id, true);
    setError('');
    const { error: deleteError } = await supabase
      .from('life_plan_items')
      .delete()
      .eq('id', item.id);
    if (deleteError) setError(deleteError.message);
    else setItems((current) => current.filter((value) => value.id !== item.id));
    setBusy(item.id, false);
  };

  const savePlannerReminder = async () => {
    if (!user || reminderSaving) return;
    setReminderSaving(true);
    setError('');
    const payload = {
      user_id: user.id,
      habit_id: null,
      kind: 'planner' as const,
      label: 'Review your life plan',
      route: '/planner',
      enabled: true,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      days_of_week: [reminderDay],
      local_time: reminderTime,
      scheduled_at: null,
      updated_at: new Date().toISOString(),
    };
    const result = reminder
      ? await supabase.from('wellbeing_reminders').update(payload).eq('id', reminder.id)
      : await supabase.from('wellbeing_reminders').insert(payload);
    if (result.error) {
      if (result.error.code === '23505') await loadPlanner();
      setError(
        result.error.code === '23505'
          ? 'A planner reminder already exists. It has been reloaded.'
          : result.error.message
      );
    } else {
      setStatus('Weekly planning reminder saved.');
      await loadPlanner();
    }
    setReminderSaving(false);
  };

  const removePlannerReminder = async () => {
    if (!reminder || reminderSaving) return;
    setReminderSaving(true);
    const { error: deleteError } = await supabase
      .from('wellbeing_reminders')
      .delete()
      .eq('id', reminder.id);
    if (deleteError) setError(deleteError.message);
    else {
      setReminder(null);
      setStatus('Planner reminder removed.');
    }
    setReminderSaving(false);
  };

  const visibleItems = items.filter(
    (item) => filter === 'all' || item.horizon === filter
  );
  const activeItems = visibleItems.filter((item) => item.status === 'active');
  const inactiveItems = visibleItems.filter((item) => item.status !== 'active');
  const selectedType = ITEM_TYPES.find((type) => type.id === draft.itemType)!;

  return (
    <main className="px-4 py-8 md:px-8 md:py-12">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <Compass className="h-3.5 w-3.5" aria-hidden="true" />
              Life planner
            </div>
            <h1 className="font-display text-4xl font-medium leading-[1.05] tracking-[-0.02em] text-foreground md:text-5xl">
              Turn a direction into one next step.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
              Organize dreams, motivations, obstacles, and milestones across
              realistic time horizons. This is private planning, not a judgment of
              your progress.
            </p>
          </div>
          <Button onClick={() => setShowCreate((value) => !value)}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Add to plan
          </Button>
        </header>

        {(error || status) && (
          <p
            role={error ? 'alert' : 'status'}
            className={cn(
              'mt-6 rounded-xl border px-4 py-3 text-sm',
              error
                ? 'border-destructive/25 bg-destructive/5 text-destructive'
                : 'border-border bg-secondary text-foreground'
            )}
          >
            {error || status}
          </p>
        )}

        {showCreate && (
          <section className="app-panel mt-6 p-5 md:p-6">
            <div className="grid gap-5 md:grid-cols-[0.72fr_1.28fr]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  What are you organizing?
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {ITEM_TYPES.map((type) => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            itemType: type.id,
                          }))
                        }
                        className={cn(
                          'rounded-xl border p-3 text-left transition-colors',
                          draft.itemType === type.id
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-background text-foreground hover:bg-secondary'
                        )}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        <span className="mt-2 block text-sm font-medium">
                          {type.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <label className="block">
                  <Label htmlFor="plan-title">{selectedType.prompt}</Label>
                  <Input
                    id="plan-title"
                    value={draft.title}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    maxLength={160}
                    className="mt-2"
                  />
                </label>

                <label className="block">
                  <Label htmlFor="plan-reflection">
                    {selectedType.reflectionLabel}
                  </Label>
                  <Textarea
                    id="plan-reflection"
                    value={draft.reflection}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        reflection: event.target.value,
                      }))
                    }
                    maxLength={2_000}
                    className="mt-2 min-h-24"
                  />
                </label>

                <label className="block">
                  <Label htmlFor="plan-next-step">
                    What is the smallest visible next step?
                  </Label>
                  <Input
                    id="plan-next-step"
                    value={draft.nextStep}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        nextStep: event.target.value,
                      }))
                    }
                    maxLength={500}
                    className="mt-2"
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label>
                    <Label htmlFor="plan-horizon">Time horizon</Label>
                    <select
                      id="plan-horizon"
                      value={draft.horizon}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          horizon: event.target.value as Horizon,
                        }))
                      }
                      className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                    >
                      {HORIZONS.map((horizon) => (
                        <option key={horizon.id} value={horizon.id}>
                          {horizon.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <Label htmlFor="plan-target">Target date (optional)</Label>
                    <Input
                      id="plan-target"
                      type="date"
                      value={draft.targetDate}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          targetDate: event.target.value,
                        }))
                      }
                      className="mt-2"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => void addItem()}
                    disabled={saving || !draft.title.trim()}
                  >
                    {saving ? 'Adding…' : 'Add to plan'}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowCreate(false);
                      setDraft(EMPTY_DRAFT);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </section>
        )}

        <div className="mt-8 flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-2 text-sm',
              filter === 'all'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-foreground'
            )}
          >
            All horizons
          </button>
          {HORIZONS.map((horizon) => (
            <button
              key={horizon.id}
              type="button"
              onClick={() => setFilter(horizon.id)}
              className={cn(
                'shrink-0 rounded-full border px-3.5 py-2 text-sm',
                filter === horizon.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-foreground'
              )}
            >
              {horizon.label}
            </button>
          ))}
        </div>

        <section className="mt-5">
          {activeItems.length === 0 ? (
            <div className="app-panel py-12 text-center">
              <CalendarDays
                className="mx-auto h-7 w-7 text-muted-foreground"
                aria-hidden="true"
              />
              <h2 className="mt-4 font-display text-2xl text-foreground">
                No active items in this horizon.
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Start with one direction and a next step you can see yourself doing.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {activeItems.map((item) => (
                <PlanCard
                  key={item.id}
                  item={item}
                  busy={busyIds.has(item.id)}
                  onStatus={updateStatus}
                  onDelete={deleteItem}
                />
              ))}
            </div>
          )}
        </section>

        {inactiveItems.length > 0 && (
          <details className="app-panel mt-5 p-5">
            <summary className="cursor-pointer font-medium text-foreground">
              Completed and paused ({inactiveItems.length})
            </summary>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {inactiveItems.map((item) => (
                <PlanCard
                  key={item.id}
                  item={item}
                  busy={busyIds.has(item.id)}
                  onStatus={updateStatus}
                  onDelete={deleteItem}
                />
              ))}
            </div>
          </details>
        )}

        <section className="mt-8 grid gap-5 lg:grid-cols-2">
          <div className="app-panel p-5">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-foreground" aria-hidden="true" />
              <h2 className="font-display text-xl text-foreground">
                Weekly plan review
              </h2>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              One optional reminder to revisit your plan. The notification is
              generic and does not include your private plan text.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label>
                <Label htmlFor="planner-reminder-day">Day</Label>
                <select
                  id="planner-reminder-day"
                  value={reminderDay}
                  onChange={(event) => setReminderDay(Number(event.target.value))}
                  className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {WEEKDAYS.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <Label htmlFor="planner-reminder-time">Time</Label>
                <Input
                  id="planner-reminder-time"
                  type="time"
                  value={reminderTime}
                  onChange={(event) => setReminderTime(event.target.value)}
                  className="mt-2"
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => void savePlannerReminder()}
                disabled={reminderSaving}
              >
                {reminder ? 'Update reminder' : 'Save reminder'}
              </Button>
              {reminder && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void removePlannerReminder()}
                  disabled={reminderSaving}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
          <PushNotificationSettings />
        </section>

        <DismissibleNotice
          noticeKey="planner-privacy-v1"
          className="mt-6"
          title="Your sharing controls"
        >
          AI context can include your plans. Accountability shares completion
          counts only.
        </DismissibleNotice>
      </div>
    </main>
  );
}

function PlanCard({
  item,
  busy,
  onStatus,
  onDelete,
}: {
  item: PlanItem;
  busy: boolean;
  onStatus: (item: PlanItem, status: ItemStatus) => Promise<void>;
  onDelete: (item: PlanItem) => Promise<void>;
}) {
  const type = ITEM_TYPES.find((value) => value.id === item.item_type)!;
  const horizon = HORIZONS.find((value) => value.id === item.horizon)!;
  const Icon = type.icon;

  return (
    <article
      className={cn(
        'rounded-2xl border border-border bg-card p-5',
        item.status !== 'active' && 'opacity-70'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-foreground">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
          {horizon.label}
        </span>
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {type.label}
      </p>
      <h3 className="mt-1 font-display text-2xl text-foreground">{item.title}</h3>
      {item.reflection && (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {item.reflection}
        </p>
      )}
      {item.next_step && (
        <div className="mt-4 rounded-xl bg-secondary/65 p-3">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Next visible step
          </p>
          <p className="mt-1 flex items-start gap-2 text-sm text-foreground">
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {item.next_step}
          </p>
        </div>
      )}
      {item.target_date && (
        <p className="mt-3 text-xs text-muted-foreground">
          Target: {new Date(`${item.target_date}T00:00:00`).toLocaleDateString()}
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
        {item.status === 'active' ? (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void onStatus(item, 'complete')}
            >
              <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Complete
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void onStatus(item, 'paused')}
            >
              <Pause className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Pause
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void onStatus(item, 'active')}
          >
            {item.status === 'paused' ? 'Resume' : 'Make active'}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          aria-label={`Delete ${item.title}`}
          onClick={() => void onDelete(item)}
          className="ml-auto text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    </article>
  );
}
