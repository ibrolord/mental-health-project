import { hasUnsafeAdvisorContext, type AdvisorContext } from './advisor-core';
import { hasExplicitUrgentSafetyLanguage } from './local-safety';

/**
 * True when a review prompt must be skipped because of the user's wider
 * Advisor context. Goals and habits feed the safety check, so if either failed
 * to load we cannot tell, and fail closed.
 */
export function shouldSkipReviewForAdvisorContext(context: AdvisorContext): boolean {
  if (
    context.sourceAvailability?.goals !== 'ready' ||
    context.sourceAvailability?.habits !== 'ready'
  ) {
    return true;
  }
  return hasUnsafeAdvisorContext(context);
}

/**
 * True when today's persisted check-in note has urgent safety language. A save
 * that leaves the note untouched (Dashboard, Tracker mood pick) keeps it, so
 * the note must be read back rather than trusted from screen state. Fails
 * closed when the note cannot be read.
 */
export async function checkInNoteNeedsSafety(
  loadNote: () => Promise<string | null | undefined>
): Promise<boolean> {
  try {
    const note = await loadNote();
    return typeof note === 'string' && hasExplicitUrgentSafetyLanguage(note);
  } catch {
    return true;
  }
}
