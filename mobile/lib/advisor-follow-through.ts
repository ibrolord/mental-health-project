import type { AdvisorActionInstance } from './advisor-action-storage';
import type { AdvisorRecentRecommendation } from './advisor-core';

export type AdvisorCommitmentContext = Pick<AdvisorActionInstance,
  'recommendationId' | 'status' | 'lastCheckInResult' | 'recoveryReason' | 'useSmallerStep'>;

export function advisorModelFeedback(recent: readonly AdvisorRecentRecommendation[], nowIso: string) {
  const now = Date.parse(nowIso);
  return recent
    .filter((item): item is Exclude<AdvisorRecentRecommendation, string> =>
      typeof item !== 'string' && !item.recommendationId.startsWith('personal-plan:'))
    .map((item) => ({ item, at: item.feedbackAt ?? item.resolvedAt ?? item.completedAt ?? item.startedAt ?? item.offeredAt }))
    .filter(({ at }) => at && Number.isFinite(Date.parse(at)) &&
      Date.parse(at) <= now && now - Date.parse(at) <= 90 * 86400000)
    .sort((a, b) => Date.parse(b.at!) - Date.parse(a.at!))
    .slice(0, 5)
    .map(({ item, at }) => ({
      recommendationId: item.recommendationId,
      helpful: item.helpful ?? null,
      resolution: item.resolution ?? (item.completedAt ? 'completed' as const : null),
      ...(item.startedAt ? { started: true } : {}),
      barrier: item.barrier ?? null,
      recordedAt: new Date(at!).toISOString(),
    }));
}

// The model chooses among grounded follow-through messages; it cannot invent
// progress, medical interpretations, or a new commitment on the user's behalf.
export function advisorFollowThroughOptions(
  candidateId: string,
  feedback: ReturnType<typeof advisorModelFeedback>,
  commitment: AdvisorCommitmentContext | null = null
): { id: string; text: string }[] {
  const options: { id: string; text: string }[] = [];
  const active = commitment?.recommendationId === candidateId ? commitment : null;
  const previous = feedback.find((item) => item.recommendationId === candidateId);
  const barrier = active ? active.recoveryReason : previous?.barrier;
  if (active) {
    options.push({ id: 'keep-step', text: active.status === 'accepted'
      ? 'This is the step you chose. Start when it fits, or adjust it if today has changed.'
      : 'Keep the step you chose. When you return, tell me what got done so the next suggestion fits.' });
  }
  if (barrier === 'time' || barrier === 'energy') {
    options.unshift({ id: 'smaller', text: `You said ${barrier} got in the way. ${active?.useSmallerStep
      ? 'You have already chosen the smaller version; it is okay to pause or reschedule.'
      : 'Try the smaller version, or choose a better time rather than adding more.'}` });
  } else if (barrier === 'unclear') {
    options.unshift({ id: 'clarify', text: 'You said the step was unclear. Open the tool and choose one concrete action before starting.' });
  } else if (barrier === 'priority') {
    options.unshift({ id: 'reconsider', text: 'You said your priorities changed. Keep this step only if it still matters; otherwise choose a different one.' });
  }
  if (active?.lastCheckInResult === 'partial') {
    options.push({ id: 'partial', text: 'You recorded some progress. Continue from where you stopped, rather than starting over.' });
  } else if (!active && previous?.resolution === 'partial') {
    options.push({ id: 'past-partial', text: 'Last time you tried this, you recorded some progress. Choose where to pick it up if it still fits today.' });
  }
  if (previous?.helpful === true) {
    options.push({ id: 'helped', text: 'You said this step helped before. Try it again only if it still fits today.' });
  } else if (!active && previous?.helpful === false) {
    options.push({ id: 'not-helpful', text: 'You said this did not help. You can change the approach instead of repeating it.' });
  }
  if (!active && !options.length) {
    const latest = feedback.find((item) => item.resolution || item.helpful !== null);
    if (latest?.resolution === 'completed') {
      options.push({ id: 'completed', text: 'Your previous step is marked done. Choose one next step only if you have room for it today.' });
    } else if (latest?.helpful === false || latest?.resolution === 'skipped') {
      options.push({ id: 'different', text: 'Your last feedback is shaping this suggestion. Try a different approach, and tell me whether it fits.' });
    }
  }
  return options.slice(0, 3);
}
