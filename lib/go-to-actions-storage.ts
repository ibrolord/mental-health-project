import {
  parseGoToActions,
  serializeGoToActions,
  type GoToAction,
} from '@/lib/wellbeing/go-to-actions';

const STORAGE_PREFIX = 'mhtoolkit.go_to_actions.v1';

export function goToActionsStorageKey(ownerKey: string): string {
  return `${STORAGE_PREFIX}:${encodeURIComponent(ownerKey)}`;
}

export function loadGoToActions(ownerKey: string | null): GoToAction[] {
  if (typeof window === 'undefined' || !ownerKey) return parseGoToActions(null);
  try {
    return parseGoToActions(window.localStorage.getItem(goToActionsStorageKey(ownerKey)));
  } catch {
    return parseGoToActions(null);
  }
}

export function saveGoToActions(
  ownerKey: string | null,
  actions: GoToAction[]
): boolean {
  if (typeof window === 'undefined' || !ownerKey) return false;
  try {
    window.localStorage.setItem(
      goToActionsStorageKey(ownerKey),
      serializeGoToActions(actions)
    );
    return true;
  } catch {
    return false;
  }
}

export function clearGoToActions(ownerKey: string | null): boolean {
  if (typeof window === 'undefined' || !ownerKey) return false;
  try {
    window.localStorage.removeItem(goToActionsStorageKey(ownerKey));
    return true;
  } catch {
    return false;
  }
}
