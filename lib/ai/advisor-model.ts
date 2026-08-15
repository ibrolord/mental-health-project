import { chat, type ChatModel } from './model-router';
import {
  advisorModelOutputSchema,
  type AdvisorModelOutput,
  type AdvisorModelRequest,
} from './advisor-validation';

const UNSAFE_OR_CLINICAL_CLAIM =
  /\b(?:diagnos(?:e|ed|is|tic)|disorder|disease|treatment|medication|caused by|means you have|risk score|mental health score|wellbeing score)\b/i;

function parseJsonObject(value: string): unknown {
  const start = value.indexOf('{');
  const end = value.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(value.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}

function fallbackOutput(request: AdvisorModelRequest): AdvisorModelOutput {
  const candidate = request.candidates[0];
  return {
    candidateId: candidate.id,
    observations: candidate.observations.slice(0, 3),
    signalIds: request.signals
      .filter((signal) => signalSupportsCandidate(signal, candidate))
      .slice(0, 2)
      .map((signal) => signal.id),
    focus: 'steady',
  };
}

function signalSupportsCandidate(
  signal: AdvisorModelRequest['signals'][number],
  candidate: AdvisorModelRequest['candidates'][number]
): boolean {
  const sources = new Set(candidate.sourceLabels);
  if (signal.kind === 'mood') {
    return sources.has('Mood check-in') || sources.has('Mood check-ins');
  }
  if (signal.kind === 'deadline') {
    return sources.has('Goal') || sources.has('Goals');
  }
  if (signal.kind === 'routine' || signal.kind === 'streak') {
    return sources.has('Habit') || sources.has('Habits');
  }
  if (signal.kind === 'health') return sources.has('Apple Health summary');
  return false;
}

export async function createModelAdvisorRecommendation(
  request: AdvisorModelRequest
): Promise<{
  selection: AdvisorModelOutput;
  model: ChatModel;
  personalized: boolean;
}> {
  const prompt = `Choose the single most useful next step from the supplied MHtoolkit Advisor candidates.

Rules:
- Use only the supplied facts. Do not infer a condition, cause, diagnosis, or risk level.
- Prefer one realistic action that fits the current mood and recent feedback.
- Copy one to three observations verbatim from the selected candidate. Do not rewrite them.
- Do not change or invent candidate IDs, actions, routes, or resources.
- Select up to three signal IDs that most directly explain today's priority. Use only supplied signal IDs.
- Every selected signal must support the selected candidate's source labels. Use no signal IDs when none match.
- Choose one focus: steady, deadline, routine, baseline, or recover.
- Return JSON only in this exact shape: {"candidateId":"...","observations":["..."],"signalIds":["..."],"focus":"steady"}

Advisor input:
${JSON.stringify(request)}`;

  const { response, model } = await chat(
    [{ role: 'user', content: prompt }],
    request.appleHealthSummary
      ? { appleHealthSummary: request.appleHealthSummary }
      : undefined,
    { preferredProvider: 'gemini' }
  );
  const parsed = advisorModelOutputSchema.safeParse(parseJsonObject(response));
  const selected = parsed.success ? parsed.data : null;
  const selectedCandidate = selected
    ? request.candidates.find((candidate) => candidate.id === selected.candidateId)
    : null;
  const observationsAreSafe = selected
    ? selected.observations.every(
        (observation) =>
          selectedCandidate?.observations.includes(observation) === true &&
          !UNSAFE_OR_CLINICAL_CLAIM.test(observation)
      )
    : false;
  const selectedSignalIdsAreSafe = selected
    ? selected.signalIds.every((id) => {
        const signal = request.signals.find((item) => item.id === id);
        return Boolean(
          signal && selectedCandidate && signalSupportsCandidate(signal, selectedCandidate)
        );
      })
    : false;

  if (
    !selected ||
    !selectedCandidate ||
    !observationsAreSafe ||
    !selectedSignalIdsAreSafe ||
    model === 'safety'
  ) {
    return { selection: fallbackOutput(request), model, personalized: false };
  }
  return { selection: selected, model, personalized: true };
}
