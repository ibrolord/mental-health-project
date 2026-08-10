import {
  formatHealthMinutes,
  type AppleHealthAiSummary,
  type AppleHealthAiWindowSummary,
} from './apple-health-core';

function formatWindow(
  label: string,
  summary: AppleHealthAiWindowSummary
): string {
  return [
    `${label}:`,
    `${summary.coverageDays} days with data`,
    `${summary.averageSteps?.toLocaleString() ?? 'unavailable'} average steps`,
    `${formatHealthMinutes(summary.averageSleepMinutes)} average sleep`,
    `${summary.exerciseMinutes} exercise minutes`,
    `${summary.mindfulMinutes} mindful minutes`,
    `${summary.workoutCount} workouts`,
    `${summary.stateOfMindCount} State of Mind entries`,
  ].join(' · ');
}

export function appleHealthAiSharePreview(
  summary: AppleHealthAiSummary
): string {
  return [
    'This one request will send these derived Apple Health summaries to the AI provider through MHtoolkit:',
    '',
    formatWindow('7 days', summary.sevenDay),
    formatWindow('30 days', summary.thirtyDay),
    `Mood comparison: ${summary.moodComparison}`,
    '',
    'Raw samples, dates, source devices, and identifiers stay on your device. The summary payload is not added to saved chat history, but the AI response may reflect it. AI guidance can be wrong and is not medical advice.',
  ].join('\n');
}
