// Explicit opt-in live provider smoke test. Sends fictional fixtures only.
import { config } from 'dotenv';
import { createModelAdvisorRecommendation } from '../lib/ai/advisor-model';
import { advisorModelRequestSchema } from '../lib/ai/advisor-validation';

config({ path: '.env.local', quiet: true });
if (process.env.RUN_ADVISOR_LIVE !== '1') throw new Error('Set RUN_ADVISOR_LIVE=1 to call the configured AI provider with fictional data.');

const now = new Date().toISOString();
const input = advisorModelRequestSchema.parse({
  nowIso: now, mood: null, signals: [], appleHealthSummary: null,
  candidates: [{
    id: 'goal:fictional-qa', observation: 'A fictional reading step is planned.',
    observations: ['A fictional reading step is planned.'],
    action: 'Read one page.', smallerAction: 'Open the book.', sourceLabels: ['Goal'],
    followThroughOptions: [{ id: 'smaller', text: 'You said time got in the way. Try the smaller version.' }],
  }],
  recentFeedback: [{ recommendationId: 'goal:fictional-qa', helpful: null,
    resolution: 'partial', started: true, barrier: 'time', recordedAt: now }],
  commitment: { recommendationId: 'goal:fictional-qa', status: 'needs_recovery',
    lastCheckInResult: 'partial', recoveryReason: 'time', useSmallerStep: false },
  profile: { preferredName: 'QA', priorities: ['goals'], supportStyle: 'practical' },
});
const started = Date.now();
const result = await createModelAdvisorRecommendation(input);
if (!result.personalized || result.selection.candidateId !== input.commitment?.recommendationId ||
  result.selection.followThroughId !== 'smaller') {
  throw new Error('Live provider did not return a valid grounded follow-through for the accepted step.');
}
console.log(JSON.stringify({ status: 'PASS', provider: result.model,
  acceptedStepPreserved: true, groundedFollowThrough: true,
  privateContextSent: false, durationMs: Date.now() - started,
  scope: 'local server model function; not a deployed API or device result' }));
