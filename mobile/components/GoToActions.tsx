import { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '@/lib/constants';
import {
  GO_TO_ACTION_LIMIT,
  GO_TO_CUE_LIMIT,
  GO_TO_TOOLS,
  getGoToTool,
  sanitizeGoToActions,
  type GoToAction,
  type GoToRoute,
  type GoToToolId,
} from '@/lib/wellbeing/go-to-actions';
import {
  loadGoToActions,
  saveGoToActions,
  subscribeGoToActionsCleared,
} from '@/lib/go-to-actions-storage';

type Props = {
  ownerKey: string | null;
  onNavigate: (route: GoToRoute) => void;
};

function moveAction(actions: GoToAction[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= actions.length) return actions;
  const next = [...actions];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}

export function GoToActions({ ownerKey, onNavigate }: Props) {
  const [actions, setActions] = useState<GoToAction[]>(sanitizeGoToActions(null));
  const [draft, setDraft] = useState<GoToAction[]>(actions);
  const [editing, setEditing] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [ready, setReady] = useState(false);
  const loadRevision = useRef(0);

  useEffect(() => {
    const revision = ++loadRevision.current;
    let active = true;
    setReady(false);
    void loadGoToActions(ownerKey).then((loaded) => {
      if (!active || revision !== loadRevision.current || !ownerKey) return;
      setActions(loaded);
      setDraft(loaded);
      setEditing(false);
      setStorageError(false);
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, [ownerKey]);

  useEffect(() => subscribeGoToActionsCleared((clearedOwnerKey) => {
    if (clearedOwnerKey !== ownerKey) return;
    loadRevision.current += 1;
    const defaults = sanitizeGoToActions(null);
    setActions(defaults);
    setDraft(defaults);
    setEditing(false);
    setStorageError(false);
    setReady(true);
  }), [ownerKey]);

  const toggleTool = (toolId: GoToToolId) => {
    setDraft((current) => {
      const selected = current.some((action) => action.toolId === toolId);
      if (selected) {
        return current.length === 1
          ? current
          : current.filter((action) => action.toolId !== toolId);
      }
      if (current.length >= GO_TO_ACTION_LIMIT) return current;
      return [...current, { toolId, cue: '' }];
    });
  };

  const save = async () => {
    const next = sanitizeGoToActions(draft);
    const persisted = await saveGoToActions(ownerKey, next);
    setActions(next);
    setDraft(next);
    setStorageError(!persisted);
    setEditing(false);
  };

  if (!ready) {
    return (
      <View accessibilityState={{ busy: true }} style={styles.card}>
        <Text style={styles.title}>My go-to actions</Text>
        <Text style={styles.loading}>Loading your actions…</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>My go-to actions</Text>
          <Text style={styles.subtitle}>Keep the tools you use most within reach.</Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ expanded: editing, disabled: !ownerKey }}
          disabled={!ownerKey}
          style={[styles.customize, !ownerKey && styles.disabled]}
          onPress={() => {
            setDraft(actions);
            setEditing((current) => !current);
            setStorageError(false);
          }}
        >
          <Feather name={editing ? 'x' : 'sliders'} size={16} color={Colors.primary} />
          <Text style={styles.customizeText}>{editing ? 'Close' : 'Customize'}</Text>
        </TouchableOpacity>
      </View>

      {editing ? (
        <View style={styles.editor}>
          <Text style={styles.sectionLabel}>Choose one to three</Text>
          <View style={styles.toolChoices}>
            {GO_TO_TOOLS.map((tool) => {
              const selected = draft.some((action) => action.toolId === tool.id);
              const disabled = !selected && draft.length >= GO_TO_ACTION_LIMIT;
              return (
                <TouchableOpacity
                  key={tool.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled }}
                  disabled={disabled}
                  style={[
                    styles.toolChoice,
                    selected && styles.toolChoiceSelected,
                    disabled && styles.disabled,
                  ]}
                  onPress={() => toggleTool(tool.id)}
                >
                  {selected ? <Feather name="check" size={14} color="#fff" /> : null}
                  <Text style={[styles.toolChoiceText, selected && styles.toolChoiceTextSelected]}>
                    {tool.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {draft.map((action, index) => {
            const tool = getGoToTool(action.toolId);
            return (
              <View key={action.toolId} style={styles.draftRow}>
                <View style={styles.draftHeader}>
                  <Text style={styles.draftTitle}>{tool.label}</Text>
                  <View style={styles.orderControls}>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`Move ${tool.label} up`}
                      accessibilityState={{ disabled: index === 0 }}
                      disabled={index === 0}
                      style={[styles.orderButton, index === 0 && styles.disabled]}
                      onPress={() => setDraft((current) => moveAction(current, index, -1))}
                    >
                      <Feather name="arrow-up" size={17} color={Colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`Move ${tool.label} down`}
                      accessibilityState={{ disabled: index === draft.length - 1 }}
                      disabled={index === draft.length - 1}
                      style={[
                        styles.orderButton,
                        index === draft.length - 1 && styles.disabled,
                      ]}
                      onPress={() => setDraft((current) => moveAction(current, index, 1))}
                    >
                      <Feather name="arrow-down" size={17} color={Colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.inputLabel}>When I notice… (optional)</Text>
                <TextInput
                  accessibilityLabel={`When I notice for ${tool.label}, optional`}
                  value={action.cue}
                  maxLength={GO_TO_CUE_LIMIT}
                  placeholder="for example, my thoughts are racing"
                  placeholderTextColor={Colors.textSecondary}
                  style={styles.input}
                  onChangeText={(cue) =>
                    setDraft((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, cue } : item
                      )
                    )
                  }
                />
              </View>
            );
          })}

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ disabled: !ownerKey }}
            disabled={!ownerKey}
            style={[styles.saveButton, !ownerKey && styles.disabled]}
            onPress={save}
          >
            <Text style={styles.saveButtonText}>Save actions</Text>
          </TouchableOpacity>
          <Text style={styles.deviceNote}>Saved only on this device.</Text>
        </View>
      ) : (
        <View style={styles.actions}>
          {actions.map((action) => {
            const tool = getGoToTool(action.toolId);
            return (
              <TouchableOpacity
                key={action.toolId}
                accessibilityRole="button"
                style={styles.action}
                onPress={() => onNavigate(tool.route)}
              >
                <View style={styles.actionCopy}>
                  <Text style={styles.actionTitle}>{tool.label}</Text>
                  {action.cue ? (
                    <Text style={styles.actionCue}>When I notice {action.cue}</Text>
                  ) : null}
                </View>
                <Feather name="arrow-right" size={18} color={Colors.primary} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {storageError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          Changes could not be saved and may be lost when you leave this view.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerCopy: { flex: 1 },
  title: { fontSize: 18, fontWeight: '600', color: Colors.text },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  loading: { fontSize: 14, color: Colors.textSecondary, marginTop: 8 },
  customize: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  customizeText: { color: Colors.primary, fontSize: 13, fontWeight: '700' },
  actions: { marginTop: 14, gap: 8 },
  action: {
    minHeight: 58,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: Colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionCopy: { flex: 1 },
  actionTitle: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  actionCue: { color: Colors.textSecondary, fontSize: 13, marginTop: 3 },
  editor: { marginTop: 18 },
  sectionLabel: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  toolChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  toolChoice: {
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toolChoiceSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  toolChoiceText: { color: Colors.text, fontSize: 13, fontWeight: '700' },
  toolChoiceTextSelected: { color: '#fff' },
  draftRow: { marginTop: 14, borderRadius: 14, backgroundColor: Colors.background, padding: 14 },
  draftHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  draftTitle: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  orderControls: { flexDirection: 'row', gap: 2 },
  orderButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  inputLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600', marginTop: 8 },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    backgroundColor: Colors.card,
    color: Colors.text,
    paddingHorizontal: 12,
    marginTop: 6,
  },
  saveButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  deviceNote: { color: Colors.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 8 },
  disabled: { opacity: 0.45 },
  error: { color: '#b42318', fontSize: 13, marginTop: 12 },
});
