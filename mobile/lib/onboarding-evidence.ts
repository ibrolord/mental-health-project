import type { StartingFocus } from './advisor-onboarding';

type OnboardingEvidence = {
  title: string; introduction: string; eyebrow: string; metric: string; metricLabel: string;
  finding: string; qualifier: string; application: string; citation: string; detail: string; url: string;
  comparison?: readonly { percent: number; label: string }[];
};

// Population estimates and technique findings are not MHtoolkit adoption or outcomes.
// Verified against primary sources on 2026-10-01; keep endpoint and scope beside the number.
export const ONBOARDING_EVIDENCE: Record<StartingFocus, OnboardingEvidence> = {
  steady: {
    title: 'You are not alone in this.',
    introduction: 'You do not need to have everything figured out to take a first step.',
    eyebrow: 'MENTAL HEALTH AROUND THE WORLD',
    metric: '1 in 7',
    metricLabel: 'Nearly one in seven people worldwide',
    finding: 'lived with a mental disorder in 2023, according to WHO.',
    qualifier: 'A global estimate, not MHtoolkit user data.',
    application: 'Start here with a check-in and choose the kind of support you want today.',
    citation: 'WHO · 2026 fact sheet, using 2023 data',
    detail: 'WHO estimates that 1.2 billion people worldwide lived with a mental disorder in 2023. This covers the global population, not just adults or people using apps. It is a prevalence estimate, not evidence that an app improves mental health, and does not describe your own health.',
    url: 'https://www.who.int/news-room/fact-sheets/detail/mental-disorders',
  },
  routine: {
    title: 'Give a small habit a place in your day.',
    introduction: 'A specific when-and-where plan gives you a clear place to start.',
    eyebrow: 'PLANNING IN AN EXERCISE STUDY',
    metric: '91% vs 38%',
    metricLabel: 'Reported exercising the following week',
    comparison: [
      { percent: 91, label: 'Motivation + a specific plan' },
      { percent: 38, label: 'Control group' },
    ],
    finding: 'At least one 20-minute session, in a study of 248 UK students.',
    qualifier: 'One short-term, self-reported study. Not MHtoolkit results.',
    application: 'Next, choose a small action and a moment in your day for it.',
    citation: 'Milne et al. · British Journal of Health Psychology · 2002',
    detail: 'The randomized study analyzed 248 UK undergraduates, ages 18-34. A health-motivation leaflet plus a when-and-where plan was compared with a control group receiving neither. The endpoint was a self-reported exercise session of at least 20 minutes in the week after planning. This was not a test of MHtoolkit, mental-health outcomes, or long-term habit success.',
    url: 'https://bpspsychub.onlinelibrary.wiley.com/doi/pdf/10.1348/135910702169420',
  },
  'follow-through': {
    title: 'Make your next step easier to see.',
    introduction: 'Choose something that matters and keep your progress in view.',
    eyebrow: 'RESEARCH ON TRACKING PROGRESS',
    metric: '138',
    metricLabel: 'studies, with 19,951 participants',
    finding: 'A review found that prompting people to monitor progress improved goal attainment on average.',
    qualifier: 'Across different goals and populations. Not MHtoolkit results.',
    application: 'Choose a next step you can check in on, rather than tackling everything at once.',
    citation: 'Harkin et al. · Psychological Bulletin · 2016',
    detail: 'This meta-analysis compared progress-monitoring interventions with control conditions. Results varied across goals and studies. The average effect size was 0.40, not a 40% success rate. These are technique findings, not MHtoolkit results.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/26479070/',
  },
};

export type WelcomeStep = 'focus' | 'first-step';

export function welcomeNextStep(focus: StartingFocus | null, ready: boolean, busy: boolean): WelcomeStep {
  return focus && ready && !busy ? 'first-step' : 'focus';
}

export function welcomeMotionSpec(reduceMotion: boolean | null) {
  return reduceMotion === false
    ? { duration: 320, translateY: 12, initialOpacity: 0.35 }
    : { duration: 0, translateY: 0, initialOpacity: 1 };
}
