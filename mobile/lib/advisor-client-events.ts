export type AdvisorClientEvent = { ownerKey: string; kind: 'changed' | 'refreshed' };
const listeners = new Set<(event: AdvisorClientEvent) => void>();

export function subscribeAdvisorClient(listener: (event: AdvisorClientEvent) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function emitAdvisorClient(ownerKey: string | null, kind: AdvisorClientEvent['kind'] = 'changed') {
  if (!ownerKey) return;
  for (const listener of listeners) {
    try { listener({ ownerKey, kind }); }
    catch { console.warn('An Advisor view could not refresh.'); }
  }
}
