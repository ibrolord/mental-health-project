export const APP_STORE_URL = 'https://apps.apple.com/app/mhtoolkit/id6760159800';
export const SOURCE_REPOSITORY = 'https://github.com/ibrolord/mental-health-project';

// Population statistics, not product efficacy or adoption claims. Verified 2026-10-01.
export const LANDING_EVIDENCE = [
  {
    id: 'global-need', value: '1 in 7',
    description: 'Nearly one in seven people worldwide lived with a mental disorder in 2023.',
    source: 'WHO mental disorders fact sheet, 2026',
    url: 'https://www.who.int/news-room/fact-sheets/detail/mental-disorders',
  },
  {
    id: 'access-gap', value: '>75%',
    description: 'of people experiencing mental disorders in low- and middle-income countries receive no treatment, according to WHO estimates.',
    source: 'WHO depression overview',
    url: 'https://www.who.int/health-topics/depression',
  },
] as const;

export const SUPPORT_AREAS = [
  {
    id: 'feelings', label: 'Understand my feelings', title: 'Give what you feel a little space.',
    description: 'A quick mood check-in can be a starting point. Name the feeling, add context if you want, and come back to your journal when there is more to say.',
    tools: ['Mood check-ins & history', 'Emotion naming', 'Private journaling'],
    image: 'mood', alt: 'MHtoolkit mood screen with emoji check-ins and mood history', href: '/tracker', linkLabel: 'Explore mood check-ins',
  },
  {
    id: 'calm', label: 'Find a moment of calm', title: 'Come back to the here and now.',
    description: 'When everything feels loud, choose a short grounding practice, guided breathing, meditation, or gentle movement. Start with what feels comfortable.',
    tools: ['Guided grounding', 'Breathing & meditation', 'Gentle yoga'],
    image: 'ground', alt: 'MHtoolkit grounding screen offering guided practices', href: '/ground', linkLabel: 'Explore grounding',
  },
  {
    id: 'structure', label: 'Build a little structure', title: 'Make the next step feel possible.',
    description: 'Break a goal into milestones, build a habit around your day, and give one task your attention. Keep the plan small enough to come back to.',
    tools: ['Goals & milestones', 'Habits & routines', 'Focus timer'],
    image: 'goals', alt: 'MHtoolkit goals screen with actionable next steps', href: '/goals', linkLabel: 'Explore goals',
  },
  {
    id: 'patterns', label: 'Notice my patterns', title: 'Get to know your everyday rhythm.',
    description: 'Look back at your mood check-ins and sleep diary. On iOS, optionally connect Apple Health to see sleep, movement, and mindfulness summaries alongside your check-ins.',
    tools: ['Mood trends', 'Sleep diary', 'Optional Apple Health context'],
    image: 'mood', alt: 'Mood history in the MHtoolkit iOS app', href: '/tracker', linkLabel: 'Explore mood trends',
  },
  {
    id: 'connection', label: 'Feel more supported', title: 'Let someone be in your corner.',
    description: 'Invite a trusted accountability partner, choose what you share, and check in on the commitments that matter to you. Find support resources for your country too.',
    tools: ['Accountability partners', 'Shared commitments', 'Local support resources'],
    image: 'together', alt: 'Together accountability partner screen in MHtoolkit', href: '/accountability', linkLabel: 'Explore accountability',
  },
  {
    id: 'direction', label: 'Find my next step', title: 'Bring the pieces of your day together.',
    description: 'Advisor helps you choose a manageable next step using the context you allow. Open AI chat when you want to reflect, untangle a thought, or explore an idea.',
    tools: ['Personalized Advisor', 'Optional AI conversations', 'Tools & learning resources'],
    image: 'today', alt: 'MHtoolkit Today screen with a link to personalized Advisor guidance', href: '/chat', linkLabel: 'Explore AI support',
  },
] as const;
