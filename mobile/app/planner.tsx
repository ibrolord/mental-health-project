pyenv: cannot rehash: /Users/ibrobaba/.pyenv/shims isn't writable
pyenv: cannot rehash: /Users/ibrobaba/.pyenv/shims isn't writable
import { useEffect, useRef, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import {
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
import { useDataContext } from '@/lib/hooks/use-data-context';
import { refreshReminders } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/lib/constants';

type PlanType = 'dream' | 'motivation' | 'fear' | 'milestone';
type PlanHorizon = '30_days' | '90_days' | '1_year' | '3_years' | 'someday';
type PlanStatus = 'active' | 'complete' | 'paused';

type PlanItem = {
  id: string;
  user_id: string;
  item_type: PlanType;
  horizon: PlanHorizon;
  title: string;
  reflection: string;
  next_step: string;
  target_date: string | null;
  status: PlanStatus;
  created_at: string;
  updated_at: string;
};

const PLAN_TYPES: {
  id: PlanType;
  label: string;
  icon: 'cloud' | 'zap' | 'shield' | 'flag';
}[] = [
  { id: 'dream', label: 'Dream', icon: 'cloud' },
  { id: 'motivation', label: 'Motivation', icon: 'zap' },
  { id: 'fear', label: 'Fear to plan for', icon: 'shield' },
  { id: 'milestone', label: 'Milestone', icon: 'flag' },
];

const HORIZONS: { id: PlanHorizon; label: string }[] = [
  { id: '30_days', label: '30 days' },
  { id: '90_days', label: '90 days' },
  { id: '1_year', label: '1 year' },
  { id: '3_years', label: '3 years' },
  { id: 'someday', label: 'Someday' },
];

function isTargetDate(value: string) {
  return !value.trim() || /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

export default function PlannerScreen() {
  const { context, authLoading } = useDataContext();
  const [items, setItems] = useState<PlanItem[]>([]);
  const [filter, setFilter] = useState<PlanStatus>('active');
  const [editorOpen, setEditorOpen] = useState(false);
  const [itemType, setItemType] = useState<PlanType>('dream');
  const [horizon, setHorizon] = useState<PlanHorizon>('90_days');
  const [title, setTitle] = useState('');
  const [reflection, setReflection] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const ownerRef = useRef(context.user_id);
  const saveRef = useRef(false);
  ownerRef.current = context.user_id;

  const refreshReminderContent = () => {
    void refreshReminders().catch((error) => {
      console.warn('Could not refresh local reminders after a plan change:', error);
    });
  };

  useEffect(() => {
    if (authLoading) return;
    const ownerId = context.user_id;
    if (!ownerId) {
      setItems([]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError('');
    void supabase
      .from('life_plan_items')
      .select('*')
      .eq('user_id', ownerId)
      .order('updated_at', { ascending: false })
      .then(({ data, error: loadError }) => {
        if (!active || ownerRef.current !== ownerId) return;
        if (loadError) {
          setError('Your life plan could not be loaded.');
        } else {
          setItems((data ?? []) as PlanItem[]);
        }
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [authLoading, context.user_id]);

  const resetEditor = () => {
    setItemType('dream');
    setHorizon('90_days');
    setTitle('');
    setReflection('');
    setNextStep('');
    setTargetDate('');
    setError('');
  };

  const createItem = async () => {
    const ownerId = context.user_id;
    if (!ownerId || !title.trim() || saveRef.current) return;
    if (!isTargetDate(targetDate)) {
      setError('Use YYYY-MM-DD for the target date.');
      return;
    }

    saveRef.current = true;
    setSaving(true);
    setError('');
    try {
      const { data, error: createError } = await supabase
        .from('life_plan_items')
        .insert({
          user_id: ownerId,
          item_type: itemType,
          horizon,
          title: title.trim(),
          reflection: reflection.trim(),
          next_step: nextStep.trim(),
          target_date: targetDate.trim() || null,
        })
        .select()
        .single();

      if (ownerRef.current !== ownerId) return;
      if (createError) {
        setError(
          createError.code === '23505'
            ? 'That item is already active in this time horizon.'
            : 'This plan item could not be saved.'
        );
        return;
      }
      setItems((current) => [data as PlanItem, ...current]);
      resetEditor();
      setEditorOpen(false);
      setFilter('active');
      refreshReminderContent();
    } finally {
      saveRef.current = false;
      if (ownerRef.current === ownerId) setSaving(false);
    }
  };

  const changeStatus = async (item: PlanItem, status: PlanStatus) => {
    const ownerId = context.user_id;
    if (!ownerId) return;
    const previous = item.status;
    setItems((current) =>
      current.map((candidate) =>
        candidate.id === item.id ? { ...candidate, status } : candidate
      )
    );
    const { data, error: updateError } = await supabase
      .from('life_plan_items')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', item.id)
      .eq('user_id', ownerId)
      .select()
      .single();
    if (ownerRef.current !== ownerId) return;
    if (updateError || !data) {
      setItems((current) =>
        current.map((candidate) =>
          candidate.id === item.id ? { ...candidate, status: previous } : candidate
        )
      );
      setError('That plan item was not changed.');
      return;
    }
    setItems((current) =>
      current.map((candidate) =>
        candidate.id === item.id ? (data as PlanItem) : candidate
      )
    );
    refreshReminderContent();
  };

  const deleteItem = (item: PlanItem) => {
    const ownerId = context.user_id;
    if (!ownerId) return;
    Alert.alert('Delete plan item?', `"${item.title}" will be deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error: deleteError } = await supabase
            .from('life_plan_items')
            .delete()
            .eq('id', item.id)
            .eq('user_id', ownerId);
          if (ownerRef.current !== ownerId) return;
          if (deleteError) {
            setError('That plan item could not be deleted.');
          } else {
            setItems((current) =>
              current.filter((candidate) => candidate.id !== item.id)
            );
            refreshReminderContent();
          }
        },
      },
    ]);
  };

  const visible = items.filter((item) => item.status === filter);

  return (
    <AppScreen>
      <PageHeader
        eyebrow="Life planner"
        title="Give the future a next step."
        description="Hold dreams, motivations, fears, and milestones without turning them into one overwhelming list."
        icon="map"
        action={
          <AppButton
            label={editorOpen ? 'Close' : 'Add'}
            icon={editorOpen ? 'x' : 'plus'}
            variant="quiet"
            onPress={() => {
              if (editorOpen) resetEditor();
              setEditorOpen((current) => !current);
            }}
          />
        }
      />

      {editorOpen ? (
        <AppCard>
          <SectionHeader
            title="Add one item"
            description="Keep the next step small enough to begin."
          />
          <Text style={styles.fieldLabel}>Type</Text>
          <View style={styles.chips}>
            {PLAN_TYPES.map((type) => (
              <ChoiceChip
                key={type.id}
                label={type.label}
                icon={type.icon}
                selected={itemType === type.id}
                onPress={() => setItemType(type.id)}
              />
            ))}
          </View>
          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Time horizon</Text>
          <View style={styles.chips}>
            {HORIZONS.map((item) => (
              <ChoiceChip
                key={item.id}
                label={item.label}
                selected={horizon === item.id}
                onPress={() => setHorizon(item.id)}
              />
            ))}
          </View>
          <AppInput
            label="Title"
            value={title}
            onChangeText={setTitle}
            maxLength={160}
            placeholder="What matters?"
            style={{ marginTop: 16 }}
          />
          <AppInput
            label="Why this matters"
            value={reflection}
            onChangeText={setReflection}
            maxLength={2000}
            placeholder="A short reflection"
            multiline
          />
          <AppInput
            label="Next useful step"
            value={nextStep}
            onChangeText={setNextStep}
            maxLength={500}
            placeholder="One action you can begin"
          />
          <AppInput
            label="Target date (optional)"
            value={targetDate}
            onChangeText={setTargetDate}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
          />
          {error ? <Text style={appUiStyles.error}>{error}</Text> : null}
          <AppButton
            label="Save plan item"
            icon="check"
            loading={saving}
            disabled={!title.trim() || authLoading || !context.user_id}
            onPress={() => void createItem()}
            style={{ marginTop: 6 }}
          />
        </AppCard>
      ) : null}

      <View style={styles.filters}>
        {(['active', 'complete', 'paused'] as PlanStatus[]).map((status) => (
          <ChoiceChip
            key={status}
            label={
              status === 'active'
                ? 'Active'
                : status === 'complete'
                  ? 'Completed'
                  : 'Paused'
            }
            selected={filter === status}
            onPress={() => setFilter(status)}
          />
        ))}
      </View>

      {error && !editorOpen ? (
        <Text style={[appUiStyles.error, { marginBottom: 12 }]}>{error}</Text>
      ) : null}

      {loading ? (
        <Text style={appUiStyles.muted}>Loading your plan...</Text>
      ) : visible.length === 0 ? (
        <EmptyState
          icon="map"
          title={`No ${filter} plan items`}
          description={
            filter === 'active'
              ? 'Add one dream, motivation, fear, or milestone when you are ready.'
              : 'Items will appear here when their status changes.'
          }
          action={
            filter === 'active' ? (
              <AppButton
                label="Add one item"
                icon="plus"
                onPress={() => setEditorOpen(true)}
              />
            ) : undefined
          }
        />
      ) : (
        visible.map((item) => {
          const meta = PLAN_TYPES.find((type) => type.id === item.item_type)!;
          return (
            <AppCard key={item.id}>
              <View style={styles.itemHeader}>
                <View style={styles.itemIcon}>
                  <Feather name={meta.icon} size={18} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemMeta}>
                    {meta.label} ·{' '}
                    {HORIZONS.find(({ id }) => id === item.horizon)?.label}
                  </Text>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                </View>
              </View>
              {item.reflection ? (
                <Text style={[appUiStyles.muted, { marginTop: 12 }]}>
                  {item.reflection}
                </Text>
              ) : null}
              {item.next_step ? (
                <View style={styles.nextStep}>
                  <Text style={appUiStyles.label}>Next step</Text>
                  <Text style={styles.nextStepText}>{item.next_step}</Text>
                </View>
              ) : null}
              {item.target_date ? (
                <Text style={styles.target}>Target: {item.target_date}</Text>
              ) : null}
              <View style={styles.itemActions}>
                {item.status === 'active' ? (
                  <AppButton
                    label="Complete"
                    icon="check"
                    onPress={() => void changeStatus(item, 'complete')}
                    style={{ flex: 1 }}
                  />
                ) : (
                  <AppButton
                    label={item.status === 'paused' ? 'Resume' : 'Make active'}
                    icon="rotate-ccw"
                    variant="secondary"
                    onPress={() => void changeStatus(item, 'active')}
                    style={{ flex: 1 }}
                  />
                )}
                {item.status === 'active' ? (
                  <AppButton
                    label="Pause"
                    icon="pause"
                    variant="quiet"
                    onPress={() => void changeStatus(item, 'paused')}
                  />
                ) : null}
                {item.status === 'paused' ? (
                  <AppButton
                    label="Complete"
                    icon="check"
                    variant="quiet"
                    onPress={() => void changeStatus(item, 'complete')}
                  />
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${item.title}`}
                  onPress={() => deleteItem(item)}
                  style={styles.deleteButton}
                >
                  <Feather name="trash-2" size={17} color={Colors.danger} />
                </Pressable>
              </View>
            </AppCard>
          );
        })
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  itemHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemMeta: {
    color: Colors.accent,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  itemTitle: {
    color: Colors.text,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700',
    marginTop: 3,
  },
  nextStep: {
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    padding: 12,
    marginTop: 13,
  },
  nextStepText: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
  },
  target: { color: Colors.textSecondary, fontSize: 11, marginTop: 10 },
  itemActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  deleteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
