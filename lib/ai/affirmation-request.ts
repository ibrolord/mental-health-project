import { z } from 'zod';
import { containsExplicitCrisis } from './crisis';

/**
 * /api/affirmations/generate input.
 *
 * Accepts what web and iOS 1.0.9 send. iOS 1.0.9 also sends mood notes and
 * goal text; the privacy copy says mood notes are not sent to AI, so the
 * server reads that free text only for the crisis check and never puts it in
 * the model prompt. Unknown keys are dropped, not rejected, so older clients
 * keep working.
 */
// 7 mood notes and 5 goals from the 1.0.9 client fit easily; old notes have
// no length cap in the database, so free text is bounded by the body size only.
export const AFFIRMATION_MAX_REQUEST_BYTES = 128 * 1024;

const optionalFreeText = z.string().nullable().optional();

export const affirmationRequestSchema = z.object({
  moods: z.array(z.object({
    emoji: z.string().trim().min(1).max(16),
    note: optionalFreeText,
  })).max(31).nullable().optional(),
  assessments: z.array(z.object({
    type: z.string().trim().min(1).max(32),
    score: z.number().finite().min(0).max(10_000),
    max_score: z.number().finite().positive().max(10_000),
  })).max(10).nullable().optional(),
  goals: z.array(z.object({
    content: optionalFreeText,
    status: z.string().trim().max(32).nullable().optional(),
  })).max(30).nullable().optional(),
});

export type AffirmationRequest = z.infer<typeof affirmationRequestSchema>;

/** True when any free text the client sent contains explicit crisis language. */
export function affirmationRequestHasCrisis(request: AffirmationRequest): boolean {
  const texts = [
    ...(request.moods ?? []).map((mood) => mood.note),
    ...(request.goals ?? []).map((goal) => goal.content),
  ].filter((text): text is string => typeof text === 'string' && text.trim() !== '');
  // Check each text on its own: containsExplicitCrisis reads the last three
  // user messages, and a note must never fall out of that window.
  return texts.some((content) => containsExplicitCrisis([{ role: 'user', content }]));
}

/** Prompt built only from mood emojis, assessment percentages and goal counts. */
export function buildAffirmationPrompt(request: AffirmationRequest): string {
  let context = 'Generate a personalized affirmation based on this user data:\n\n';

  const moods = request.moods ?? [];
  if (moods.length > 0) {
    context += `Recent moods (last 7 days): ${moods.slice(0, 7).map((mood) => mood.emoji).join(' ')}\n`;
  }

  const assessments = request.assessments ?? [];
  if (assessments.length > 0) {
    context += '\nRecent assessments:\n';
    for (const assessment of assessments.slice(0, 3)) {
      const percentage = Math.round((assessment.score / assessment.max_score) * 100);
      context += `- ${assessment.type.replace(/[^A-Za-z0-9 _-]/g, '')}: ${percentage}% severity\n`;
    }
  }

  const goals = request.goals ?? [];
  if (goals.length > 0) {
    const completed = goals.filter((goal) => goal.status === 'completed').length;
    context += `\nGoals: ${completed} of ${goals.length} completed recently\n`;
  }

  context += `\nCreate ONE short, personalized affirmation (1-2 sentences max) that:
- Speaks directly to where this person is right now
- Is compassionate and validating
- Offers a gentle reframe or encouragement
- Feels authentic, not generic

Return ONLY the affirmation text, no explanation or formatting.`;

  return context;
}
