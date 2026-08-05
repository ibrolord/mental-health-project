import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '@/lib/constants';
import {
  createPrivacyEventRpcPayload,
  type PrivacyEventPlatform,
} from '@/lib/privacy-events';
import { supabase } from '@/lib/supabase';
import {
  adaptVisitBriefRows,
  createVisitBriefSelection,
  createVisitBriefTransfer,
  generateVisitBrief,
  type ActivityPlanRow,
  type ActivityStepRow,
  type PlanItemRow,
  type PlanRow,
  type SleepDiaryRow,
  type SupportPreferencesRow,
  type VisitBriefSectionId,
  type VisitBriefSelection,
  type VisitBriefSource,
} from '@/lib/visit-brief';

const SECTIONS: {
  id: Exclude<VisitBriefSectionId, 'safetyPlan'>;
  label: string;
  description: string;
}[] = [
  { id: 'activityPlans', label: 'Activity plans', description: 'Actions and steps' },
  { id: 'stayingWellPlan', label: 'Staying-well plan', description: 'Routines and responses' },
  { id: 'sleepDiary', label: 'Sleep diary', description: 'Complete factual entries' },
  { id: 'supportPreferences', label: 'Support preferences', description: 'How support works best' },
];

type SectionState = Partial<Record<VisitBriefSectionId, string>>;

async function loadSection(
  section: VisitBriefSectionId,
  ownerId: string
): Promise<VisitBriefSource[VisitBriefSectionId]> {
  if (section === 'activityPlans') {
    const plans = await supabase
      .from('activity_plans')
      .select('id, plan_date, title, details')
      .eq('user_id', ownerId)
      .order('plan_date', { ascending: false })
      .limit(12);
    if (plans.error) throw plans.error;
    const rows = (plans.data ?? []) as ActivityPlanRow[];
    const ids = rows.map((plan) => plan.id);
    const steps = ids.length > 0
      ? await supabase
          .from('activity_plan_steps')
          .select('plan_id, action, timing, location, estimated_minutes, position')
          .eq('user_id', ownerId)
          .in('plan_id', ids)
          .order('position', { ascending: true })
      : { data: [], error: null };
    if (steps.error) throw steps.error;
    return adaptVisitBriefRows({
      activityPlans: rows,
      activitySteps: (steps.data ?? []) as ActivityStepRow[],
    }).activityPlans;
  }

  if (section === 'safetyPlan' || section === 'stayingWellPlan') {
    const isSafety = section === 'safetyPlan';
    const parentTable = isSafety ? 'safety_plans' : 'staying_well_plans';
    const itemTable = isSafety ? 'safety_plan_items' : 'staying_well_plan_items';
    const parent = await supabase
      .from(parentTable)
      .select('id')
      .eq('user_id', ownerId)
      .in('status', ['active', 'draft'])
      .order('status', { ascending: true })
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (parent.error) throw parent.error;
    const plan = parent.data as PlanRow | null;
    if (!plan) return undefined;
    const items = await supabase
      .from(itemTable)
      .select('plan_id, item_kind, label, details, position')
      .eq('user_id', ownerId)
      .eq('plan_id', plan.id)
      .order('position', { ascending: true });
    if (items.error) throw items.error;
    const rows = (items.data ?? []) as PlanItemRow[];
    return isSafety
      ? adaptVisitBriefRows({ safetyPlan: plan, safetyItems: rows }).safetyPlan
      : adaptVisitBriefRows({ stayingWellPlan: plan, stayingWellItems: rows }).stayingWellPlan;
  }

  if (section === 'sleepDiary') {
    const result = await supabase
      .from('sleep_diary_entries')
      .select(
        'id, entry_date, went_to_bed_at, tried_to_sleep_at, fell_asleep_at, woke_up_at, got_out_of_bed_at, awakenings, awake_minutes, nap_minutes, timezone_offset_minutes, timezone_name, notes'
      )
      .eq('user_id', ownerId)
      .order('entry_date', { ascending: false })
      .limit(31);
    if (result.error) throw result.error;
    return adaptVisitBriefRows({ sleepEntries: (result.data ?? []) as SleepDiaryRow[] }).sleepDiary;
  }

  const result = await supabase
    .from('partner_support_preferences')
    .select(
      'support_style, check_in_frequency, advice_mode, celebrate_progress, gentle_reminders, acknowledge_setbacks'
    )
    .eq('user_id', ownerId)
    .maybeSingle();
  if (result.error) throw result.error;
  return adaptVisitBriefRows({
    supportPreferences: result.data as SupportPreferencesRow | null,
  }).supportPreferences;
}

export function VisitBriefBuilder({ ownerId }: { ownerId: string | null }) {
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<VisitBriefSelection>(createVisitBriefSelection);
  const [source, setSource] = useState<VisitBriefSource>({});
  const [loading, setLoading] = useState<Set<VisitBriefSectionId>>(new Set());
  const [errors, setErrors] = useState<SectionState>({});
  const [status, setStatus] = useState('');
  const ownerRef = useRef(ownerId);

  useEffect(() => {
    ownerRef.current = ownerId;
    setOpen(false);
    setSelection(createVisitBriefSelection());
    setSource({});
    setLoading(new Set());
    setErrors({});
    setStatus('');
  }, [ownerId]);

  const brief = (() => {
    try {
      return generateVisitBrief(selection, source);
    } catch {
      return { preview: 'Visit brief', sectionCount: 0 };
    }
  })();
  const transfer = createVisitBriefTransfer(brief);

  const toggleSection = async (section: VisitBriefSectionId, enabled: boolean) => {
    setStatus('');
    setErrors((current) => ({ ...current, [section]: '' }));
    if (!enabled) {
      setSelection((current) => ({ ...current, [section]: false }));
      return;
    }
    if (!ownerId) {
      setErrors((current) => ({ ...current, [section]: 'Sign in to include this section.' }));
      return;
    }
    if (source[section]) {
      setSelection((current) => ({ ...current, [section]: true }));
      return;
    }

    const requestedOwner = ownerId;
    setSelection((current) => ({ ...current, [section]: true }));
    setLoading((current) => new Set(current).add(section));
    try {
      const sectionSource = await loadSection(section, requestedOwner);
      if (ownerRef.current !== requestedOwner) return;
      if (!sectionSource) {
        setSelection((current) => ({ ...current, [section]: false }));
        setErrors((current) => ({ ...current, [section]: 'No saved content for this section.' }));
        return;
      }
      setSource((current) => ({ ...current, [section]: sectionSource }));
    } catch {
      if (ownerRef.current !== requestedOwner) return;
      setSelection((current) => ({ ...current, [section]: false }));
      setErrors((current) => ({ ...current, [section]: 'This section could not be loaded.' }));
    } finally {
      if (ownerRef.current === requestedOwner) {
        setLoading((current) => {
          const next = new Set(current);
          next.delete(section);
          return next;
        });
      }
    }
  };

  const performShare = async () => {
    if (brief.sectionCount === 0) return;
    setStatus('');
    try {
      const result = await Share.share({
        title: 'MHtoolkit Visit Brief',
        message: transfer.sharedText,
      });
      if (result.action !== Share.sharedAction) {
        setStatus('Share cancelled.');
        return;
      }
      const platform: PrivacyEventPlatform = Platform.OS === 'android' ? 'android' : 'ios';
      const event = await supabase.rpc(
        'record_privacy_event',
        createPrivacyEventRpcPayload('export_requested', platform)
      );
      setStatus(
        event.error
          ? 'Shared. Privacy Activity could not be updated.'
          : 'Visit Brief shared.'
      );
    } catch {
      setStatus('Visit Brief could not be shared.');
    }
  };

  const share = () => {
    if (!selection.safetyPlan) {
      void performShare();
      return;
    }
    Alert.alert(
      'Share this safety-plan copy?',
      'The receiving person or app may keep it after you send it.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: () => void performShare() },
      ]
    );
  };

  const renderSwitch = (
    id: VisitBriefSectionId,
    label: string,
    description: string,
    safety = false
  ) => (
    <View key={id} style={[styles.option, safety && styles.safetyOption]}>
      <View style={styles.optionCopy}>
        <Text style={styles.optionTitle}>{label}</Text>
        <Text style={styles.optionDescription}>{description}</Text>
        {errors[id] ? <Text style={styles.error}>{errors[id]}</Text> : null}
      </View>
      {loading.has(id) ? (
        <ActivityIndicator size="small" color={Colors.primary} />
      ) : (
        <Switch
          accessibilityLabel={`Include ${label}`}
          value={selection[id]}
          onValueChange={(enabled) => void toggleSection(id, enabled)}
          trackColor={{ false: '#d1d5db', true: safety ? '#b45309' : Colors.primary }}
          thumbColor="#fff"
        />
      )}
    </View>
  );

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((current) => !current)}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
      >
        <View style={styles.headerIcon}>
          <Feather name="file-text" size={18} color={Colors.primary} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Visit Brief</Text>
          <Text style={styles.description}>Choose what to share for an appointment.</Text>
        </View>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.textSecondary} />
      </Pressable>

      {open ? (
        <View style={styles.body}>
          <Text style={styles.notice}>
            Everything starts off. Journal, AI chat, assessments, and mood notes are never included.
          </Text>

          {SECTIONS.map((section) =>
            renderSwitch(section.id, section.label, section.description)
          )}

          <Text style={styles.safetyLabel}>Extra-sensitive</Text>
          {renderSwitch(
            'safetyPlan',
            'Safety plan',
            'Include only when you explicitly turn this on.',
            true
          )}

          {brief.sectionCount > 0 ? (
            <>
              <Text style={styles.previewLabel}>Exact preview</Text>
              <View style={styles.preview}>
                <Text selectable style={styles.previewText}>{transfer.previewText}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={share}
                style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}
              >
                <Feather name="share-2" size={16} color="#fffef8" />
                <Text style={styles.shareButtonText}>Share exact preview</Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.empty}>Turn on a section to build a brief.</Text>
          )}
          {status ? <Text style={styles.status}>{status}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20 },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1 },
  title: { fontSize: 18, fontWeight: '600', color: Colors.text },
  description: { marginTop: 3, fontSize: 14, color: Colors.textSecondary },
  body: { borderTopWidth: 1, borderTopColor: Colors.border, padding: 20, paddingTop: 16 },
  notice: {
    borderRadius: 12,
    backgroundColor: Colors.background,
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    padding: 13,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 14,
  },
  safetyOption: {
    borderWidth: 1,
    borderColor: '#fbbf24',
    borderRadius: 12,
    backgroundColor: '#fffbeb',
    paddingHorizontal: 12,
    marginTop: 6,
  },
  optionCopy: { flex: 1 },
  optionTitle: { fontSize: 14, fontWeight: '600', color: Colors.text },
  optionDescription: { marginTop: 2, fontSize: 12, lineHeight: 17, color: Colors.textSecondary },
  error: { marginTop: 5, fontSize: 12, color: Colors.danger },
  safetyLabel: {
    marginTop: 18,
    color: '#92400e',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  previewLabel: { marginTop: 20, fontSize: 13, fontWeight: '700', color: Colors.text },
  preview: {
    marginTop: 8,
    maxHeight: 320,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  previewText: { fontSize: 12, lineHeight: 18, color: Colors.text },
  shareButton: {
    marginTop: 14,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  shareButtonText: { color: '#fffef8', fontSize: 14, fontWeight: '700' },
  empty: { marginTop: 16, color: Colors.textSecondary, fontSize: 13, textAlign: 'center' },
  status: { marginTop: 12, color: Colors.textSecondary, fontSize: 13, textAlign: 'center' },
  pressed: { opacity: 0.72 },
});
