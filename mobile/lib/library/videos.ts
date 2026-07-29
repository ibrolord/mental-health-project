import type {
  LibraryIntegration,
  LibraryTopic,
  PracticalTakeaway,
} from './editorial';

export type VideoTopic = Exclude<LibraryTopic, 'All'>;
export type VideoSourceType = 'official-video' | 'correction';

export interface VideoSource {
  label: string;
  url: string;
  sourceType: VideoSourceType;
}

export interface CuratedVideo {
  id: string;
  title: string;
  creator: string;
  provider: 'TED' | 'TEDx';
  topic: VideoTopic;
  displayTags: string[];
  summary: string;
  centralPremise: string;
  practicalTakeaways: PracticalTakeaway[];
  reflectionPrompts: string[];
  integrations: LibraryIntegration[];
  sources: VideoSource[];
  sourceUrl: string;
  contentNote?: string;
  medicalCaveat: string;
  editorialNote: string;
}

interface VideoDraft
  extends Omit<CuratedVideo, 'integrations' | 'sources' | 'editorialNote'> {
  correctionUrl?: string;
  goalContent: string;
  habitName: string;
  habitDescription: string;
}

const VIDEO_EDITORIAL_NOTE =
  'This guide paraphrases an educational talk and links to the official source. It is not a transcript, endorsement, diagnosis, treatment plan, or substitute for qualified care.';

function curateVideo(draft: VideoDraft): CuratedVideo {
  const {
    correctionUrl,
    goalContent,
    habitName,
    habitDescription,
    ...video
  } = draft;

  const sources: VideoSource[] = [
    {
      label: `${draft.provider}: ${draft.title}`,
      url: draft.sourceUrl,
      sourceType: 'official-video',
    },
  ];

  if (correctionUrl) {
    sources.push({
      label: 'TED correction and follow-up',
      url: correctionUrl,
      sourceType: 'correction',
    });
  }

  return {
    ...video,
    sources,
    integrations: [
      {
        title: 'Reflect on the talk',
        description: 'Capture what fits, what does not, and what you want to remember.',
        actionType: 'journal',
        actionLabel: 'Open a video note',
        prompt: [
          `Notes on ${draft.title}:`,
          ...draft.reflectionPrompts.map((prompt, index) => `${index + 1}. ${prompt}`),
        ].join('\n'),
      },
      {
        title: 'Choose one next step',
        description: 'Turn one useful idea into a bounded, realistic priority.',
        actionType: 'goal',
        actionLabel: 'Add as a priority',
        goalContent,
      },
      {
        title: 'Practice before expanding',
        description: 'Try one small behavior long enough to learn whether it helps.',
        actionType: 'habit',
        actionLabel: 'Prefill a habit',
        habitName,
        habitDescription,
      },
    ],
    editorialNote: VIDEO_EDITORIAL_NOTE,
  };
}

export const CURATED_VIDEOS: CuratedVideo[] = [
  curateVideo({
    id: 'video-anxiety-stress-friend',
    title: 'How to make stress your friend',
    creator: 'Kelly McGonigal',
    provider: 'TED',
    topic: 'Anxiety & stress',
    displayTags: ['Stress', 'Reframing', 'Connection'],
    summary:
      'A reframing of some stress responses as preparation rather than automatic proof of danger, paired with an emphasis on reaching toward safe connection.',
    centralPremise:
      'How a person interprets some stress signals can affect how manageable they feel, while social connection can be an important part of coping.',
    practicalTakeaways: [
      {
        title: 'Name the signal',
        description:
          'A pounding heart or fast breath can be described as a body preparing for a challenge rather than immediately labeled as failure.',
        nextStep: 'Name one body signal and the concrete situation it may be preparing you to face.',
      },
      {
        title: 'Reduce isolation',
        description:
          'Stress can narrow attention inward, even when practical or emotional support would make the situation more workable.',
        nextStep: 'Identify one safe person or resource you can contact about the current stressor.',
      },
    ],
    reflectionPrompts: [
      'What is this stress response trying to help me prepare for?',
      'Which part needs action, support, rest, or a boundary rather than reframing?',
    ],
    goalContent: 'Take one concrete step toward the stressor or ask one safe person for support',
    habitName: 'Name the stress signal without judging it',
    habitDescription:
      'Briefly identify the body signal, the situation, and the next safe response.',
    sourceUrl:
      'https://www.ted.com/talks/kelly_mcgonigal_how_to_make_stress_your_friend',
    medicalCaveat:
      'Reframing is not a cure for chronic, traumatic, unsafe, or medically significant stress and must not be used to tolerate harm.',
  }),
  curateVideo({
    id: 'video-anxiety-emotional-courage',
    title: 'The gift and power of emotional courage',
    creator: 'Susan David',
    provider: 'TED',
    topic: 'Anxiety & stress',
    displayTags: ['Emotions', 'Values', 'Acceptance'],
    summary:
      'A practical argument for naming difficult emotions accurately and choosing actions from values instead of forced positivity or avoidance.',
    centralPremise:
      'Difficult emotions can carry useful information when they are acknowledged without being allowed to dictate every action.',
    practicalTakeaways: [
      {
        title: 'Use precise language',
        description:
          'Specific emotion words can make an experience easier to understand than a global label such as bad, stressed, or overwhelmed.',
        nextStep: 'Replace one broad label with the most accurate emotion word you can find.',
      },
      {
        title: 'Act from a value',
        description:
          'An emotion can be present while the next action is selected according to what matters over the longer term.',
        nextStep: 'Name the value involved and one small action that expresses it safely.',
      },
    ],
    reflectionPrompts: [
      'What am I feeling, as specifically as I can name it?',
      'What value does this feeling point toward, and what safe action fits that value?',
    ],
    goalContent: 'Take one small value-aligned action while allowing the emotion to be present',
    habitName: 'Name one emotion precisely',
    habitDescription:
      'Use a specific emotion word, then note the value or need it may be signaling.',
    sourceUrl:
      'https://www.ted.com/talks/susan_david_the_gift_and_power_of_emotional_courage',
    medicalCaveat:
      'Accepting an emotion does not mean accepting abuse, danger, discrimination, or an unhealthy environment.',
  }),
  curateVideo({
    id: 'video-anxiety-fear-setting',
    title: 'Why you should define your fears instead of your goals',
    creator: 'Tim Ferriss',
    provider: 'TED',
    topic: 'Anxiety & stress',
    displayTags: ['Fear', 'Decisions', 'Planning'],
    summary:
      'A structured decision exercise that separates feared outcomes, prevention, repair, and the costs of continued inaction.',
    centralPremise:
      'Turning vague dread into specific risks and responses can make an avoided decision more concrete and more testable.',
    practicalTakeaways: [
      {
        title: 'Make the fear specific',
        description:
          'A named outcome can be evaluated for likelihood and impact more clearly than an undifferentiated sense that everything may go wrong.',
        nextStep: 'Write the most credible feared outcome in one plain sentence.',
      },
      {
        title: 'Plan prevention and repair',
        description:
          'Some risks can be reduced before action, while others become more tolerable when a realistic recovery path is visible.',
        nextStep: 'Add one prevention step and one repair step for the risk you named.',
      },
    ],
    reflectionPrompts: [
      'What could happen, how could I reduce the risk, and how could I recover?',
      'What is the likely cost of doing nothing for another six months?',
    ],
    goalContent: 'Complete one time-boxed fear-setting exercise for the decision I am avoiding',
    habitName: 'Turn one vague worry into a concrete question',
    habitDescription:
      'Name the feared outcome, its likelihood, and one prevention or repair action.',
    sourceUrl:
      'https://www.ted.com/talks/tim_ferriss_why_you_should_define_your_fears_instead_of_your_goals',
    medicalCaveat:
      'Fear-setting can intensify rumination for some people. Keep it time-boxed, stop if distress escalates, and use qualified support for safety-related decisions.',
  }),
  curateVideo({
    id: 'video-anxiety-mindful-minutes',
    title: 'All it takes is 10 mindful minutes',
    creator: 'Andy Puddicombe',
    provider: 'TED',
    topic: 'Anxiety & stress',
    displayTags: ['Mindfulness', 'Attention', 'Pause'],
    summary:
      'An accessible introduction to brief present-moment practice that does not require eliminating thoughts or forcing a calm state.',
    centralPremise:
      'Short periods of observing present experience can create space between what is happening and an automatic reaction.',
    practicalTakeaways: [
      {
        title: 'Start smaller than the ideal',
        description:
          'A short optional practice can be easier to evaluate honestly than an ambitious routine built around perfect consistency.',
        nextStep: 'Try two minutes and decide afterward whether continuing feels useful.',
      },
      {
        title: 'Observe rather than erase',
        description:
          'The task is to notice thoughts and sensations, not to prove that the mind can become empty or calm on demand.',
        nextStep: 'Name one thought or sensation without arguing with it or following it.',
      },
    ],
    reflectionPrompts: [
      'What did I notice without needing to fix it?',
      'Did this practice feel settling, neutral, activating, or unhelpful?',
    ],
    goalContent: 'Try one optional two-minute present-moment practice and record how it felt',
    habitName: 'Take a two-minute noticing pause',
    habitDescription:
      'Observe the present moment without requiring calm, and stop if the practice feels activating.',
    sourceUrl:
      'https://www.ted.com/talks/andy_puddicombe_all_it_takes_is_10_mindful_minutes',
    medicalCaveat:
      'Mindfulness is not calming for everyone and can be activating for some trauma survivors. Grounding alternatives and an immediate stop option matter.',
  }),
  curateVideo({
    id: 'video-anxiety-three-strategies',
    title: '3 ways to overcome anxiety',
    creator: 'Olivia Remes',
    provider: 'TEDx',
    topic: 'Anxiety & stress',
    displayTags: ['Anxiety', 'Uncertainty', 'Self-compassion'],
    summary:
      'Three simplified strategies for approaching uncertainty, lowering perfectionistic demands, and responding to mistakes more fairly.',
    centralPremise:
      'Small changes in how a person approaches uncertainty, effort, and self-talk may reduce avoidance and build a sense of agency.',
    practicalTakeaways: [
      {
        title: 'Choose good enough',
        description:
          'Perfectionistic standards can make beginning feel dangerous, while a deliberately imperfect first attempt creates information.',
        nextStep: 'Define what a safe, good-enough attempt would look like today.',
      },
      {
        title: 'Use fair self-talk',
        description:
          'A mistake can be answered with the same balance and context that would be offered to someone else.',
        nextStep: 'Write one compassionate response that still acknowledges what needs to change.',
      },
    ],
    reflectionPrompts: [
      'What would a good-enough attempt look like today?',
      'What would I say to someone I care about in the same situation?',
    ],
    goalContent: 'Complete one safe, deliberately good-enough first attempt',
    habitName: 'Practice a good-enough first step',
    habitDescription:
      'Choose a small action where learning matters more than a flawless result.',
    sourceUrl:
      'https://www.ted.com/talks/olivia_remes_3_ways_to_overcome_anxiety',
    medicalCaveat:
      'This short educational TEDx talk is not an anxiety assessment or treatment plan. Persistent or severe symptoms need qualified care.',
  }),
  curateVideo({
    id: 'video-mood-emotional-first-aid',
    title: 'Why we all need to practice emotional first aid',
    creator: 'Guy Winch',
    provider: 'TED',
    topic: 'Mood & self-compassion',
    displayTags: ['Emotional health', 'Rumination', 'Loneliness'],
    summary:
      'A call to treat rejection, loneliness, failure, and repetitive self-criticism as experiences that deserve deliberate care.',
    centralPremise:
      'Emotional injuries can affect functioning and deserve attention rather than dismissal simply because they are not visible.',
    practicalTakeaways: [
      {
        title: 'Notice the injury',
        description:
          'Naming rejection, loneliness, failure, or rumination can make the response more specific than a global judgment about the self.',
        nextStep: 'Identify the emotional injury without turning it into a permanent identity.',
      },
      {
        title: 'Interrupt one loop',
        description:
          'A grounded response, a change of context, or safe connection can interrupt repetitive self-criticism long enough to choose what comes next.',
        nextStep: 'Use one coping response that has helped before or contact one safe person.',
      },
    ],
    reflectionPrompts: [
      'What emotional injury needs care rather than judgment?',
      'What would a proportionate, compassionate response look like?',
    ],
    goalContent: 'Use one grounded response to interrupt the current self-critical loop',
    habitName: 'Practice one emotional care response',
    habitDescription:
      'Name the emotional injury and choose one fair, concrete response.',
    sourceUrl:
      'https://www.ted.com/talks/guy_winch_why_we_all_need_to_practice_emotional_first_aid',
    medicalCaveat:
      'Emotional first aid is a metaphor, not crisis care, diagnosis, or a substitute for professional support.',
  }),
  curateVideo({
    id: 'video-mood-vulnerability',
    title: 'The power of vulnerability',
    creator: 'Brene Brown',
    provider: 'TEDx',
    topic: 'Mood & self-compassion',
    displayTags: ['Vulnerability', 'Connection', 'Shame'],
    summary:
      'A reflection on uncertainty, belonging, and the role of appropriately being seen in meaningful human connection.',
    centralPremise:
      'Connection often requires tolerating uncertainty and bounded openness instead of trying to control every outcome.',
    practicalTakeaways: [
      {
        title: 'Choose the context',
        description:
          'Vulnerability is safer and more useful when trust, consent, and the likely consequences of disclosure have been considered.',
        nextStep: 'Identify one trustworthy person or setting for a small honest statement.',
      },
      {
        title: 'Keep the disclosure bounded',
        description:
          'Honesty does not require sharing every detail, and a person can decide what remains private.',
        nextStep: 'Write the one sentence you want to communicate and the boundary around it.',
      },
    ],
    reflectionPrompts: [
      'Where would safe, bounded honesty help me feel less alone?',
      'What information should remain private until more trust is earned?',
    ],
    goalContent: 'Plan one small, bounded conversation with a trustworthy person',
    habitName: 'Notice one moment of safe honesty',
    habitDescription:
      'Record when an appropriately honest response supported connection or self-respect.',
    sourceUrl:
      'https://www.ted.com/talks/brene_brown_the_power_of_vulnerability',
    medicalCaveat:
      'Vulnerability should be earned and context-sensitive. It is not an instruction to disclose to unsafe, coercive, or untrustworthy people.',
  }),
  curateVideo({
    id: 'video-mood-adaptation',
    title: 'The surprising science of happiness',
    creator: 'Dan Gilbert',
    provider: 'TED',
    topic: 'Mood & self-compassion',
    displayTags: ['Happiness', 'Adaptation', 'Forecasting'],
    summary:
      'A provocative look at how people forecast future happiness and how adaptation can create wellbeing outside a preferred outcome.',
    centralPremise:
      'People may adapt to outcomes in ways they do not predict well, so a forecast about future happiness should be treated as uncertain.',
    practicalTakeaways: [
      {
        title: 'Question the forecast',
        description:
          'A prediction that one outcome will determine all future wellbeing can be examined rather than accepted as certainty.',
        nextStep: 'Write one alternative future in which support, adaptation, or new options remain possible.',
      },
      {
        title: 'Look for available agency',
        description:
          'An unwanted outcome may still leave choices about relationships, routines, meaning, and support.',
        nextStep: 'Name one source of agency that would remain if the preferred result did not happen.',
      },
    ],
    reflectionPrompts: [
      'Which prediction about future happiness am I treating as certain?',
      'What support or agency could remain after an unwanted outcome?',
    ],
    goalContent: 'Identify one workable path that does not depend on the preferred outcome',
    habitName: 'Question one absolute forecast',
    habitDescription:
      'When a future prediction feels certain, record one plausible alternative path.',
    sourceUrl:
      'https://www.ted.com/talks/dan_gilbert_the_surprising_science_of_happiness',
    correctionUrl:
      'https://blog.ted.com/ten-years-later-dan-gilbert-on-life-after-the-surprising-science-of-happiness/',
    medicalCaveat:
      'TED later published corrections to factual claims in the original talk. Use only the broad reflection on adaptation and do not repeat corrected claims as settled evidence.',
  }),
  curateVideo({
    id: 'video-mood-good-life',
    title: 'What makes a good life? Lessons from the longest study on happiness',
    creator: 'Robert Waldinger',
    provider: 'TEDx',
    topic: 'Mood & self-compassion',
    displayTags: ['Relationships', 'Wellbeing', 'Longitudinal research'],
    summary:
      'A summary of long-running observational research emphasizing the association between supportive relationships, health, and wellbeing.',
    centralPremise:
      'The quality of supportive relationships is strongly associated with health and wellbeing across time.',
    practicalTakeaways: [
      {
        title: 'Focus on relationship quality',
        description:
          'A smaller number of safe, dependable relationships may matter more than maximizing contact or social visibility.',
        nextStep: 'Identify one relationship that feels nourishing, strained, or neglected.',
      },
      {
        title: 'Make connection observable',
        description:
          'Relationship investment becomes more concrete when it is expressed as a call, repair, shared activity, or request for support.',
        nextStep: 'Choose one specific connection action that fits the relationship and your capacity.',
      },
    ],
    reflectionPrompts: [
      'Which relationship currently supports my wellbeing?',
      'What small action could strengthen connection without ignoring safety or boundaries?',
    ],
    goalContent: 'Take one specific action to strengthen a safe relationship',
    habitName: 'Make one intentional connection',
    habitDescription:
      'Use a realistic cadence to check in, share time, or offer support in a safe relationship.',
    sourceUrl:
      'https://www.ted.com/talks/robert_waldinger_what_makes_a_good_life_lessons_from_the_longest_study_on_happiness',
    medicalCaveat:
      'Observational research does not provide one universal recipe. Culture, access, safety, disability, and individual circumstances affect how connection is built.',
  }),
  curateVideo({
    id: 'video-mood-meaning',
    title: "There's more to life than being happy",
    creator: 'Emily Esfahani Smith',
    provider: 'TED',
    topic: 'Mood & self-compassion',
    displayTags: ['Meaning', 'Purpose', 'Belonging'],
    summary:
      'A framework for considering belonging, purpose, personal stories, and moments of transcendence when constant happiness is unrealistic.',
    centralPremise:
      'Meaning can be supported by belonging, purpose, coherent life stories, and experiences larger than the self, even on difficult days.',
    practicalTakeaways: [
      {
        title: 'Identify the missing source',
        description:
          'A person can ask whether belonging, purpose, story, or transcendence currently feels undernourished rather than demanding a happier mood.',
        nextStep: 'Choose the one source of meaning that feels most relevant right now.',
      },
      {
        title: 'Use a values-based action',
        description:
          'A contribution or connection can matter independent of whether it produces an immediate positive feeling.',
        nextStep: 'Name one action that expresses what matters without requiring a mood change.',
      },
    ],
    reflectionPrompts: [
      'What still matters on a difficult day?',
      'Which source of meaning feels available without forcing a lesson from pain?',
    ],
    goalContent: 'Take one small action connected to belonging, purpose, story, or perspective',
    habitName: 'Notice one source of meaning',
    habitDescription:
      'Record one moment of belonging, contribution, coherent story, or perspective.',
    sourceUrl:
      'https://www.ted.com/talks/emily_esfahani_smith_there_s_more_to_life_than_being_happy',
    medicalCaveat:
      'A meaning framework is not a treatment for depression and should not pressure people to turn pain into purpose.',
  }),
  curateVideo({
    id: 'video-habits-growth-mindset',
    title: 'The power of believing that you can improve',
    creator: 'Carol Dweck',
    provider: 'TEDx',
    topic: 'Habits & growth',
    displayTags: ['Learning', 'Feedback', 'Growth mindset'],
    summary:
      'An introduction to treating current ability as changeable through strategy, feedback, practice, and support rather than as a fixed identity.',
    centralPremise:
      'Viewing ability as developable can make feedback and strategy changes easier to use, but effort alone does not guarantee an outcome.',
    practicalTakeaways: [
      {
        title: 'Name the skill gap',
        description:
          'A specific skill or context provides more useful information than a global label about intelligence, talent, or worth.',
        nextStep: 'Complete the sentence: The part I have not learned yet is...',
      },
      {
        title: 'Change the strategy',
        description:
          'More effort is useful only when the practice, feedback, support, or accommodation fits the skill being developed.',
        nextStep: 'Choose one different strategy and one signal that will show whether it helped.',
      },
    ],
    reflectionPrompts: [
      'What am I still learning rather than permanently unable to do?',
      'What strategy, feedback, resource, or accommodation is missing?',
    ],
    goalContent: 'Try one different learning strategy and collect one piece of feedback',
    habitName: 'Capture one learning adjustment',
    habitDescription:
      'After practice, note what worked and one strategy or support to change.',
    sourceUrl:
      'https://www.ted.com/talks/carol_dweck_the_power_of_believing_that_you_can_improve',
    medicalCaveat:
      'Growth mindset is not effort fixes everything. Resources, health, disability, opportunity, teaching quality, and structural conditions matter.',
  }),
  curateVideo({
    id: 'video-habits-grit',
    title: 'Grit: The power of passion and perseverance',
    creator: 'Angela Duckworth',
    provider: 'TED',
    topic: 'Habits & growth',
    displayTags: ['Persistence', 'Direction', 'Practice'],
    summary:
      'A concise argument that sustained effort toward a meaningful direction can matter alongside talent.',
    centralPremise:
      'Long-term persistence can support achievement, but it needs to be paired with direction, strategy, rest, resources, and permission to change course.',
    practicalTakeaways: [
      {
        title: 'Check the direction',
        description:
          'Persistence is useful only when the goal still matters and the cost remains proportionate.',
        nextStep: 'Decide whether to persist, change strategy, pause, or stop.',
      },
      {
        title: 'Define the repetition',
        description:
          'A repeatable practice is more actionable than a demand to feel motivated or prove commitment.',
        nextStep: 'Choose one small practice that directly supports the selected direction.',
      },
    ],
    reflectionPrompts: [
      'Does this goal still deserve persistence?',
      'What constraint, rest, resource, or strategy change should be included?',
    ],
    goalContent: 'Choose whether to persist, adapt, pause, or stop one long-term goal',
    habitName: 'Practice one chosen skill',
    habitDescription:
      'Repeat one small action that supports a meaningful goal without ignoring rest or constraints.',
    sourceUrl:
      'https://www.ted.com/talks/angela_lee_duckworth_grit_the_power_of_passion_and_perseverance',
    medicalCaveat:
      'Grit is not the sole cause of success. Rest, resources, safety, discrimination, health, changing priorities, and the option to stop all matter.',
  }),
  curateVideo({
    id: 'video-habits-learning-zone',
    title: 'How to get better at the things you care about',
    creator: 'Eduardo Briceno',
    provider: 'TED',
    topic: 'Habits & growth',
    displayTags: ['Practice', 'Feedback', 'Learning zone'],
    summary:
      'A distinction between performing for an outcome and practicing in a setting where mistakes are expected and used as information.',
    centralPremise:
      'Deliberate time in a learning zone can improve a skill when practice is specific, feedback is relevant, and the context is safe enough for mistakes.',
    practicalTakeaways: [
      {
        title: 'Separate practice from performance',
        description:
          'A practice session can be designed around learning rather than proving competence or protecting an evaluation.',
        nextStep: 'Choose one low-stakes setting where a mistake can produce useful feedback.',
      },
      {
        title: 'Define the feedback signal',
        description:
          'Improvement is easier to evaluate when the skill and evidence are chosen before the session begins.',
        nextStep: 'Name the skill, the exercise, and the signal that will guide the next adjustment.',
      },
    ],
    reflectionPrompts: [
      'What can I practice where mistakes are genuinely allowed?',
      'What feedback would be specific enough to change the next attempt?',
    ],
    goalContent: 'Run one low-stakes learning-zone practice with a defined feedback signal',
    habitName: 'Schedule a learning-zone session',
    habitDescription:
      'Practice one specific skill in a low-stakes context and record one adjustment.',
    sourceUrl:
      'https://www.ted.com/talks/eduardo_briceno_how_to_get_better_at_the_things_you_care_about',
    medicalCaveat:
      'A learning zone requires enough safety, time, access, and feedback. Not every workplace, school, or life context provides those conditions.',
  }),
  curateVideo({
    id: 'video-habits-thirty-day-experiment',
    title: 'Try something new for 30 days',
    creator: 'Matt Cutts',
    provider: 'TED',
    topic: 'Habits & growth',
    displayTags: ['Experiments', 'Consistency', 'Review'],
    summary:
      'A short invitation to use a bounded trial as a way to begin and evaluate a change without treating it as a permanent identity.',
    centralPremise:
      'A small, observable experiment with a defined end can make a desired change easier to begin and review.',
    practicalTakeaways: [
      {
        title: 'Make the experiment observable',
        description:
          'A trial should specify what counts, how often it will happen, and when the user will review it.',
        nextStep: 'Write one behavior, a realistic cadence, and an end date.',
      },
      {
        title: 'Review instead of judging',
        description:
          'A missed day or disappointing result can be used to adjust the experiment rather than to label the person.',
        nextStep: 'Choose the questions you will use to decide whether to continue, change, or stop.',
      },
    ],
    reflectionPrompts: [
      'What did this experiment teach me?',
      'What should continue, change, pause, or stop when the trial ends?',
    ],
    goalContent: 'Design one small, time-bounded behavior experiment with an end review',
    habitName: 'Run one small behavior experiment',
    habitDescription:
      'Use a realistic cadence and review what happened without rigid streak rules.',
    sourceUrl:
      'https://www.ted.com/talks/matt_cutts_try_something_new_for_30_days',
    medicalCaveat:
      'Thirty days is a convenient experiment length, not a scientific guarantee that a behavior will become automatic.',
  }),
  curateVideo({
    id: 'video-habits-original-thinkers',
    title: 'The surprising habits of original thinkers',
    creator: 'Adam Grant',
    provider: 'TED',
    topic: 'Habits & growth',
    displayTags: ['Creativity', 'Experiments', 'Failure'],
    summary:
      'A study of how original work can include doubt, incubation, many weak ideas, and repeated attempts rather than instant confidence.',
    centralPremise:
      'Generating multiple options and running bounded tests can be more useful than waiting for certainty or demanding that every idea succeed.',
    practicalTakeaways: [
      {
        title: 'Generate before judging',
        description:
          'A larger pool of possible approaches reduces pressure on the first idea to be brilliant.',
        nextStep: 'Write five options, including deliberately ordinary or imperfect ones.',
      },
      {
        title: 'Use a reversible test',
        description:
          'An idea becomes easier to evaluate when the first experiment is small enough to learn from without creating disproportionate harm.',
        nextStep: 'Define the smallest safe test and what evidence would change your mind.',
      },
    ],
    reflectionPrompts: [
      'What are five possible approaches, including imperfect ones?',
      'What reversible test would teach me the most?',
    ],
    goalContent: 'Run one small, reversible test of an idea and record what it teaches',
    habitName: 'Generate one extra option',
    habitDescription:
      'Before committing, add one more possible approach and compare the tradeoffs.',
    sourceUrl:
      'https://www.ted.com/talks/adam_grant_the_surprising_habits_of_original_thinkers',
    medicalCaveat:
      'Failure should not be romanticized. Experiments should remain proportional, reversible, and safe.',
  }),
  curateVideo({
    id: 'video-burnout-stress-cycle',
    title: "The cure for burnout (hint: it isn't self-care)",
    creator: 'Emily Nagoski and Amelia Nagoski',
    provider: 'TED',
    topic: 'Burnout & recovery',
    displayTags: ['Burnout', 'Stress response', 'Recovery'],
    summary:
      'A conversation distinguishing stressors from the body response to stress and emphasizing recovery practices alongside changes to harmful conditions.',
    centralPremise:
      'The conditions causing stress and the body response to stress are related but distinct, so both recovery and environmental change may be needed.',
    practicalTakeaways: [
      {
        title: 'Separate stressor and response',
        description:
          'Naming the external condition and the internal response can prevent a recovery practice from being mistaken for a complete solution.',
        nextStep: 'Write the stressor in one column and the current body response in another.',
      },
      {
        title: 'Choose a safe state shift',
        description:
          'Movement, breathing, connection, expression, or rest may help the body register that the immediate demand has changed.',
        nextStep: 'Try one safe recovery activity and notice whether anything shifts.',
      },
    ],
    reflectionPrompts: [
      'What is the stressor, and what is the stress response?',
      'What condition needs to change rather than be managed more efficiently?',
    ],
    goalContent: 'Change one burnout condition or protect one realistic recovery period',
    habitName: 'Complete one recovery transition',
    habitDescription:
      'After a demanding period, use one safe activity that helps the body change state.',
    sourceUrl:
      'https://www.ted.com/talks/emily_nagoski_and_amelia_nagoski_the_cure_for_burnout_hint_it_isn_t_self_care',
    medicalCaveat:
      'Burnout is not merely an individual coping failure. Workload, control, fairness, support, caregiving, health, and systemic conditions may need to change.',
  }),
  curateVideo({
    id: 'video-burnout-work-rumination',
    title: 'How to turn off work thoughts during your free time',
    creator: 'Guy Winch',
    provider: 'TED',
    topic: 'Burnout & recovery',
    displayTags: ['Rumination', 'Work boundaries', 'Recovery'],
    summary:
      'A practical approach to work rumination using concrete closure notes and transitions that protect non-work recovery time.',
    centralPremise:
      'Clear next actions and visible boundaries can reduce mental carryover from unfinished work into time intended for recovery.',
    practicalTakeaways: [
      {
        title: 'Create concrete closure',
        description:
          'An unresolved task can be less mentally sticky when the exact next action and return time are written down.',
        nextStep: 'Write the next action and when you will return to it before ending work.',
      },
      {
        title: 'Mark the transition',
        description:
          'A physical, digital, or temporal cue can help distinguish work time from the rest of life.',
        nextStep: 'Choose one repeatable shutdown cue that fits your actual schedule.',
      },
    ],
    reflectionPrompts: [
      'What remains unresolved, and what is the next scheduled action?',
      'Which work boundary is realistic enough to repeat?',
    ],
    goalContent: 'Create one concrete closure plan for the work issue occupying free time',
    habitName: 'Write a two-minute work shutdown note',
    habitDescription:
      'Capture the unfinished item, its next action, and when you will return to it.',
    sourceUrl:
      'https://www.ted.com/talks/guy_winch_how_to_turn_off_work_thoughts_during_your_free_time',
    medicalCaveat:
      'A shutdown routine cannot repair an unsafe, exploitative, or chronically overloaded work environment.',
  }),
  curateVideo({
    id: 'video-burnout-types-of-rest',
    title: 'The real reason why we are tired and what to do about it',
    creator: 'Saundra Dalton-Smith',
    provider: 'TEDx',
    topic: 'Burnout & recovery',
    displayTags: ['Rest', 'Fatigue', 'Recovery needs'],
    summary:
      'An educational framework for distinguishing physical, mental, sensory, creative, emotional, social, and spiritual forms of depletion.',
    centralPremise:
      'Feeling tired may involve several unmet recovery needs, so the response can be matched to the kind of depletion rather than sleep alone.',
    practicalTakeaways: [
      {
        title: 'Use specific rest language',
        description:
          'Naming sensory, emotional, social, mental, or physical depletion can make the next recovery choice more relevant.',
        nextStep: 'Choose the one type of depletion that feels most noticeable right now.',
      },
      {
        title: 'Match the response',
        description:
          'A quiet room, honest conversation, creative input, physical rest, or reduced demands solve different problems.',
        nextStep: 'Select one brief recovery action that matches the need you named.',
      },
    ],
    reflectionPrompts: [
      'Which kind of rest feels missing?',
      'What medical, emotional, or environmental issue should not be reduced to a rest category?',
    ],
    goalContent: 'Protect one recovery activity that matches the kind of depletion I notice',
    habitName: 'Name the kind of rest I need',
    habitDescription:
      'Identify the current depletion and choose one matching, realistic response.',
    sourceUrl:
      'https://www.ted.com/talks/saundra_dalton_smith_the_real_reason_why_we_are_tired_and_what_to_do_about_it',
    medicalCaveat:
      'The seven-types framework is an educational model, not a diagnosis. Persistent fatigue can have medical or psychiatric causes and deserves appropriate evaluation.',
  }),
  curateVideo({
    id: 'video-burnout-sleep',
    title: 'How to succeed? Get more sleep',
    creator: 'Arianna Huffington',
    provider: 'TED',
    topic: 'Burnout & recovery',
    displayTags: ['Sleep', 'Performance', 'Boundaries'],
    summary:
      'A brief challenge to the idea that sleep deprivation proves commitment or improves decision-making and performance.',
    centralPremise:
      'Treating chronic sleep loss as a badge of ambition can undermine wellbeing, attention, judgment, and sustainable work.',
    practicalTakeaways: [
      {
        title: 'Question the trade',
        description:
          'Some sleep loss comes from unavoidable circumstances, while some comes from demands, habits, or norms that can be reconsidered.',
        nextStep: 'Name one pressure currently competing with sleep and whether it can change.',
      },
      {
        title: 'Choose one realistic cue',
        description:
          'A small wind-down or scheduling adjustment is more testable than a demand to sleep perfectly.',
        nextStep: 'Choose one cue that makes the next sleep opportunity easier to protect.',
      },
    ],
    reflectionPrompts: [
      'What pressure is competing with sleep?',
      'Which part is adjustable, and which part needs support or medical evaluation?',
    ],
    goalContent: 'Make one realistic scheduling or environment change that protects sleep',
    habitName: 'Use one wind-down cue',
    habitDescription:
      'Choose a flexible cue that helps mark the transition toward a sleep opportunity.',
    sourceUrl:
      'https://www.ted.com/talks/arianna_huffington_how_to_succeed_get_more_sleep',
    medicalCaveat:
      'This is a brief motivational talk, not insomnia treatment. Persistent sleep problems, breathing issues, or severe daytime sleepiness need qualified care.',
  }),
  curateVideo({
    id: 'video-burnout-slowness',
    title: 'In praise of slowness',
    creator: 'Carl Honore',
    provider: 'TED',
    topic: 'Burnout & recovery',
    displayTags: ['Pace', 'Attention', 'Quality'],
    summary:
      'A case for matching pace to the activity instead of automatically treating faster as better in work, relationships, and daily life.',
    centralPremise:
      'Deliberately choosing a suitable pace can protect attention, quality, connection, and recovery from a constant bias toward speed.',
    practicalTakeaways: [
      {
        title: 'Find the costly rush',
        description:
          'Some tasks benefit from speed, while others lose accuracy, connection, or enjoyment when hurried.',
        nextStep: 'Identify one recurring activity where rushing creates a visible cost.',
      },
      {
        title: 'Protect one deliberate pace',
        description:
          'A bounded slow period can be more realistic than trying to transform the pace of an entire life.',
        nextStep: 'Choose one activity or transition to do without unnecessary acceleration.',
      },
    ],
    reflectionPrompts: [
      'Where is speed helping, and where is it costing me?',
      'What slower pace is actually available within my constraints?',
    ],
    goalContent: 'Protect one activity or transition from unnecessary rushing',
    habitName: 'Use one deliberate slow block',
    habitDescription:
      'Choose one realistic activity to complete at a pace that protects attention or connection.',
    sourceUrl: 'https://www.ted.com/talks/carl_honore_in_praise_of_slowness',
    medicalCaveat:
      'Slowing down is not equally available in every job, caregiving role, disability context, or financial situation.',
  }),
  curateVideo({
    id: 'video-trauma-aces-health',
    title: 'How childhood trauma affects health across a lifetime',
    creator: 'Nadine Burke Harris',
    provider: 'TED',
    topic: 'Trauma',
    displayTags: ['Childhood adversity', 'Health', 'Trauma-informed care'],
    summary:
      'An overview of population-level associations between adverse childhood experiences and later health risks, and the importance of trauma-informed care.',
    centralPremise:
      'Childhood adversity can affect health across time, making prevention, context, safety, and qualified support important without making any outcome inevitable.',
    practicalTakeaways: [
      {
        title: 'Replace blame with context',
        description:
          'Understanding adversity can widen the explanation for a response without reducing a person to a score or a history.',
        nextStep: 'Name one present-day support or accommodation that would make the situation safer.',
      },
      {
        title: 'Keep risk separate from destiny',
        description:
          'Population associations cannot predict one individual outcome and should not be used as a self-diagnosis.',
        nextStep: 'Write one protective factor or qualified support available in the present.',
      },
    ],
    reflectionPrompts: [
      'What helps me feel safer in the present?',
      'What support can I identify without recording trauma details?',
    ],
    goalContent: 'Save or contact one present-day source of safe, qualified support',
    habitName: 'Notice one present-day safety cue',
    habitDescription:
      'Briefly identify a safe person, place, boundary, or grounding cue without revisiting trauma details.',
    sourceUrl:
      'https://www.ted.com/talks/nadine_burke_harris_how_childhood_trauma_affects_health_across_a_lifetime',
    contentNote:
      'Discusses childhood abuse, neglect, family adversity, illness, and mortality.',
    medicalCaveat:
      "An ACE score is not a diagnosis or destiny and must not be used by MHtoolkit to predict an individual's health.",
  }),
  curateVideo({
    id: 'video-trauma-broken-body',
    title: "A broken body isn't a broken person",
    creator: 'Janine Shepherd',
    provider: 'TED',
    topic: 'Trauma',
    displayTags: ['Injury', 'Identity', 'Adaptation'],
    summary:
      'A personal account of severe injury, disability, changed identity, and building a different future after an expected path was lost.',
    centralPremise:
      'A devastating injury can disrupt an expected identity without erasing personhood or the possibility of a meaningful future.',
    practicalTakeaways: [
      {
        title: 'Separate role from personhood',
        description:
          'Losing an ability, role, or expected future does not make the whole person broken or less worthy.',
        nextStep: 'Name one value, relationship, or capacity that remains larger than the lost role.',
      },
      {
        title: 'Define an adaptive next step',
        description:
          'A present-day goal can fit the body and circumstances that exist now instead of demanding a return to a previous identity.',
        nextStep: 'Choose one safe goal that reflects current capacity and support.',
      },
    ],
    reflectionPrompts: [
      'What part of me remains larger than this loss?',
      'What goal fits my current reality rather than an imposed recovery story?',
    ],
    goalContent: 'Define one adaptive goal that respects current capacity and support needs',
    habitName: 'Notice one available capacity',
    habitDescription:
      'Record one ability, value, relationship, or source of agency available today.',
    sourceUrl:
      'https://www.ted.com/talks/janine_shepherd_a_broken_body_isn_t_a_broken_person',
    contentNote:
      'Discusses a severe accident, critical injury, disability, rehabilitation, and loss of an expected future.',
    medicalCaveat:
      "This is one person's recovery story, not a standard that injured or disabled people should be expected to match.",
  }),
  curateVideo({
    id: 'video-trauma-chosen-values',
    title: "I am the son of a terrorist. Here's how I chose peace.",
    creator: 'Zak Ebrahim',
    provider: 'TED',
    topic: 'Trauma',
    displayTags: ['Values', 'Family violence', 'Agency'],
    summary:
      'A personal story about examining inherited hatred and choosing values different from a violent family environment.',
    centralPremise:
      'A person can question inherited beliefs and choose actions aligned with personally selected values, while recovery still requires more than willpower.',
    practicalTakeaways: [
      {
        title: 'Examine the inherited belief',
        description:
          'A belief learned in a family or social environment can be inspected rather than treated as an unchangeable identity.',
        nextStep: 'Name one inherited belief you want to evaluate using your present values.',
      },
      {
        title: 'Express the chosen value safely',
        description:
          'A value becomes more concrete through one action that remains proportionate to the current context.',
        nextStep: 'Choose one safe behavior that expresses the value you want to carry forward.',
      },
    ],
    reflectionPrompts: [
      'Which value is mine to choose?',
      'What support is needed so this choice does not depend on willpower alone?',
    ],
    goalContent: 'Take one safe action that expresses a value I consciously chose',
    habitName: 'Name one chosen value in action',
    habitDescription:
      'Record one small behavior that reflects a personally selected value.',
    sourceUrl:
      'https://www.ted.com/talks/zak_ebrahim_i_am_the_son_of_a_terrorist_here_s_how_i_chose_peace',
    contentNote:
      'Discusses terrorism, murder, family violence, hatred, and childhood fear.',
    medicalCaveat:
      'A story of agency is not trauma treatment and must not imply that recovery is achieved by willpower alone.',
  }),
  curateVideo({
    id: 'video-trauma-veteran-belonging',
    title: 'Our lonely society makes it hard to come home from war',
    creator: 'Sebastian Junger',
    provider: 'TED',
    topic: 'Trauma',
    displayTags: ['Veterans', 'Belonging', 'Readjustment'],
    summary:
      'One social perspective on how belonging and the conditions of returning home may affect some veterans after war.',
    centralPremise:
      'Community and mutual belonging may be relevant to veteran readjustment, but they do not provide a complete explanation of PTSD or any one experience.',
    practicalTakeaways: [
      {
        title: 'Include belonging in the picture',
        description:
          'Recovery and readjustment can involve social context as well as individual symptoms and clinical care.',
        nextStep: 'Identify one safe peer, veteran, cultural, or community resource.',
      },
      {
        title: 'Avoid the single explanation',
        description:
          'One compelling social account should not replace medical, psychological, economic, family, or individual factors.',
        nextStep: 'Write the other factors that also need to remain visible.',
      },
    ],
    reflectionPrompts: [
      'Where do I experience mutual belonging?',
      'Which parts of my experience are not explained by this talk?',
    ],
    goalContent: 'Identify one appropriate peer, veteran, cultural, or community support resource',
    habitName: 'Notice one moment of mutual belonging',
    habitDescription:
      'Record a safe interaction where support or contribution moved in both directions.',
    sourceUrl:
      'https://www.ted.com/talks/sebastian_junger_our_lonely_society_makes_it_hard_to_come_home_from_war',
    contentNote:
      'Discusses war, combat, post-traumatic stress, suicide, and social isolation.',
    medicalCaveat:
      'This is one social interpretation, not a complete account of PTSD or veteran experience and not a substitute for trauma-informed care.',
  }),
  curateVideo({
    id: 'video-trauma-forging-meaning',
    title: 'How the worst moments in our lives make us who we are',
    creator: 'Andrew Solomon',
    provider: 'TED',
    topic: 'Trauma',
    displayTags: ['Adversity', 'Identity', 'Meaning'],
    summary:
      'A reflection on constructing identity and meaning after adversity without claiming that suffering was deserved or necessary.',
    centralPremise:
      'People may choose to build meaning around adversity, while no one owes growth, forgiveness, gratitude, or a lesson for what happened.',
    practicalTakeaways: [
      {
        title: 'Separate event and identity',
        description:
          'What happened can remain true without being allowed to define every part of the person or future.',
        nextStep: 'Name one part of your identity that is not reducible to the adversity.',
      },
      {
        title: 'Keep meaning optional',
        description:
          'Meaning-making can be useful for some people at some times and harmful when it becomes a demand.',
        nextStep: 'Choose whether reflection, support, rest, or no exercise at all feels right today.',
      },
    ],
    reflectionPrompts: [
      'What meaning, if any, do I choose to carry forward?',
      'What part of this experience should remain senseless, private, or unresolved?',
    ],
    goalContent: 'Name one self-defined value or identity that is larger than the adversity',
    habitName: 'Notice one identity beyond adversity',
    habitDescription:
      'Record one role, value, relationship, interest, or capacity not defined by the trauma.',
    sourceUrl:
      'https://www.ted.com/talks/andrew_solomon_how_the_worst_moments_in_our_lives_make_us_who_we_are',
    contentNote:
      'Discusses bullying, violence, rape, illness, disability, and identity conflict.',
    medicalCaveat:
      'No one owes meaning, growth, forgiveness, or gratitude for trauma.',
  }),
  curateVideo({
    id: 'video-grief-moving-forward',
    title: 'We don\'t "move on" from grief. We move forward with it',
    creator: 'Nora McInerny',
    provider: 'TED',
    topic: 'Grief & loss',
    displayTags: ['Grief', 'Continuing bonds', 'Loss'],
    summary:
      'A candid account of continuing to live while keeping a deceased person and the loss as part of an ongoing life story.',
    centralPremise:
      'Moving forward does not require erasing a person, relationship, or loss, and grief does not follow a fixed timetable.',
    practicalTakeaways: [
      {
        title: 'Reject the erasure model',
        description:
          'A continuing bond, memory, or ritual can coexist with change rather than proving that a person is stuck.',
        nextStep: 'Name one memory, value, or connection you want to carry forward.',
      },
      {
        title: 'Remove the deadline',
        description:
          'Grief changes across time without following a universal stage sequence or deadline for being over it.',
        nextStep: 'Replace one timetable judgment with a description of what today is actually like.',
      },
    ],
    reflectionPrompts: [
      'What do I want to carry forward from this person or chapter?',
      'What expectation about grief can I set down?',
    ],
    goalContent: 'Choose one optional remembrance, connection, or support action that fits today',
    habitName: 'Make space for one honest grief check-in',
    habitDescription:
      'At a flexible cadence, name what is present without scoring progress or demanding closure.',
    sourceUrl:
      'https://www.ted.com/talks/nora_mcinerny_we_don_t_move_on_from_grief_we_move_forward_with_it',
    contentNote:
      'Discusses death of a spouse and parent, pregnancy loss, and grief with candid humor.',
    medicalCaveat:
      'Grief varies widely. MHtoolkit must not score, stage, or prescribe a timeline for it.',
  }),
  curateVideo({
    id: 'video-grief-resilient-people',
    title: '3 secrets of resilient people',
    creator: 'Lucy Hone',
    provider: 'TEDx',
    topic: 'Grief & loss',
    displayTags: ['Grief', 'Resilience', 'Attention'],
    summary:
      'Three strategies for severe adversity: recognize suffering, notice available support without denial, and ask whether a choice is helping or harming.',
    centralPremise:
      'Resilience can involve realistic attention and supportive choices, not constant strength, quick recovery, or the absence of grief.',
    practicalTakeaways: [
      {
        title: 'Hold pain and support together',
        description:
          'Noticing one available support does not require denying the size or reality of a loss.',
        nextStep: 'Name what hurts and one thing that is still supporting you.',
      },
      {
        title: 'Ask whether it helps',
        description:
          'A simple question can create a pause before a behavior that may intensify suffering or reduce available support.',
        nextStep: 'Before one choice, ask: Is this helping me or harming me right now?',
      },
    ],
    reflectionPrompts: [
      'What hurts, and what is still supporting me?',
      'What choice would be more supportive without requiring me to feel strong?',
    ],
    goalContent: 'Choose one supportive action for today without requiring myself to feel resilient',
    habitName: 'Ask whether this is helping',
    habitDescription:
      'Use the question before one recurring choice, without turning the answer into self-judgment.',
    sourceUrl:
      'https://www.ted.com/talks/lucy_hone_3_secrets_of_resilient_people',
    contentNote: 'Discusses sudden death of a child and parental grief.',
    medicalCaveat:
      'Resilience is not constant strength, quick recovery, or a moral requirement. Support needs differ.',
  }),
  curateVideo({
    id: 'video-grief-end-of-life',
    title: 'What really matters at the end of life',
    creator: 'BJ Miller',
    provider: 'TED',
    topic: 'Grief & loss',
    displayTags: ['End of life', 'Dignity', 'Palliative care'],
    summary:
      'A palliative-care perspective centered on comfort, dignity, sensory experience, relationships, and the priorities of the person who is ill.',
    centralPremise:
      "End-of-life care can honor the person's own priorities and humanity rather than focusing only on medical intervention.",
    practicalTakeaways: [
      {
        title: 'Ask what matters now',
        description:
          'A direct question about comfort, connection, meaning, or unfinished practical needs can center the person rather than the system.',
        nextStep: 'Write one question to bring to a care team or trusted person.',
      },
      {
        title: 'Protect ordinary dignity',
        description:
          'Small sensory, relational, cultural, and spiritual preferences may matter alongside clinical decisions.',
        nextStep: 'Name one ordinary comfort or connection that would make today more humane.',
      },
    ],
    reflectionPrompts: [
      'What gives this day dignity or meaning?',
      'Which question belongs with a care team, legal adviser, spiritual support, or trusted person?',
    ],
    goalContent: 'Write one question or preference to discuss with the appropriate care support',
    habitName: 'Notice one source of dignity or comfort',
    habitDescription:
      'Record one ordinary preference, connection, or sensory comfort that matters today.',
    sourceUrl:
      'https://www.ted.com/talks/bj_miller_what_really_matters_at_the_end_of_life',
    contentNote:
      'Discusses death, dying, hospice, serious illness, and severe injury.',
    medicalCaveat:
      "Medical, legal, cultural, and spiritual decisions belong with the person, their chosen supports, and qualified professionals.",
  }),
  curateVideo({
    id: 'video-grief-regret',
    title: "Don't regret regret",
    creator: 'Kathryn Schulz',
    provider: 'TED',
    topic: 'Grief & loss',
    displayTags: ['Regret', 'Values', 'Self-forgiveness'],
    summary:
      'A reflection on regret as a common human response that can reveal values and inform repair without defining a person forever.',
    centralPremise:
      'Regret can contain information about what matters while remaining separate from a global judgment of worth.',
    practicalTakeaways: [
      {
        title: 'Find the value underneath',
        description:
          'Regret often points toward care, responsibility, belonging, courage, or another value that can guide a present action.',
        nextStep: 'Complete the sentence: This regret shows that I care about...',
      },
      {
        title: 'Separate repair from punishment',
        description:
          'A repairable action calls for accountability, while an irreversible outcome may call for grief, learning, and self-compassion.',
        nextStep: 'Choose whether the next step is repair, learning, support, or self-forgiveness.',
      },
    ],
    reflectionPrompts: [
      'What does this regret show that I care about?',
      'What is repairable, and what needs grief or self-forgiveness instead?',
    ],
    goalContent: 'Take one proportionate repair, learning, support, or self-forgiveness step',
    habitName: 'Turn one regret into useful information',
    habitDescription:
      'Name the value involved and choose repair or learning without repetitive self-punishment.',
    sourceUrl: 'https://www.ted.com/talks/kathryn_schulz_don_t_regret_regret',
    contentNote:
      'Discusses personal mistakes, loss, shame, and irreversible decisions.',
    medicalCaveat:
      'Severe or persistent guilt, self-punishment, or suicidal thinking requires support beyond a reflection exercise.',
  }),
  curateVideo({
    id: 'video-grief-broken-heart',
    title: 'How to fix a broken heart',
    creator: 'Guy Winch',
    provider: 'TED',
    topic: 'Grief & loss',
    displayTags: ['Heartbreak', 'Recovery', 'Rumination'],
    summary:
      'A practical account of heartbreak loops and the work of rebuilding routines, social connection, and identity after romantic loss.',
    centralPremise:
      'Recovery from heartbreak can involve reducing idealization, accepting available explanations, and deliberately refilling the gaps left in daily life.',
    practicalTakeaways: [
      {
        title: 'Use the fuller account',
        description:
          'An idealized memory can be balanced with the complete relationship rather than used as evidence that nothing else will compare.',
        nextStep: 'Write one missing part of the story that the idealized version leaves out.',
      },
      {
        title: 'Refill one gap',
        description:
          'A breakup can remove routines, roles, places, and social contact as well as the person.',
        nextStep: 'Choose one routine, social, or identity gap to rebuild deliberately.',
      },
    ],
    reflectionPrompts: [
      'What gap did this loss leave?',
      'What part of the full story am I omitting when I idealize the relationship?',
    ],
    goalContent: 'Rebuild one routine, social connection, or identity gap left by the loss',
    habitName: 'Restore one part of daily life',
    habitDescription:
      'Use a realistic cadence to rebuild one routine or connection affected by the breakup.',
    sourceUrl: 'https://www.ted.com/talks/guy_winch_how_to_fix_a_broken_heart',
    contentNote:
      'Discusses romantic separation, rejection, grief, and emotional pain.',
    medicalCaveat:
      'Safety, coercion, stalking, abuse, severe depression, or crisis needs appropriate support, not a breakup checklist.',
  }),
  curateVideo({
    id: 'video-relationships-healthy-love',
    title: 'The difference between healthy and unhealthy love',
    creator: 'Katie Hood',
    provider: 'TED',
    topic: 'Relationships & boundaries',
    displayTags: ['Healthy love', 'Abuse warning signs', 'Safety'],
    summary:
      'A pattern-based introduction to intensity, isolation, belittling, volatility, and possessiveness as possible signs of unhealthy love.',
    centralPremise:
      'Repeated patterns can provide more useful safety information than a single label, especially when a relationship reduces autonomy, respect, or connection.',
    practicalTakeaways: [
      {
        title: 'Look at the pattern',
        description:
          'Intensity, isolation, belittling, volatility, and possessiveness become more concerning when they repeat or escalate.',
        nextStep: 'Privately record the repeated behavior and its effect on safety or autonomy.',
      },
      {
        title: 'Build support outside the relationship',
        description:
          'Isolation can make risk harder to assess, while a trusted person or specialist resource can widen options.',
        nextStep: 'Identify one safe person or qualified support resource outside the relationship.',
      },
    ],
    reflectionPrompts: [
      'Which repeated patterns increase or reduce safety and respect?',
      'Who can support me without alerting or escalating the person causing harm?',
    ],
    goalContent: 'Privately identify one safe support resource outside the relationship',
    habitName: 'Notice one relationship pattern',
    habitDescription:
      'Record patterns privately only when doing so is safe; do not use the habit if discovery could create risk.',
    sourceUrl:
      'https://www.ted.com/talks/katie_hood_the_difference_between_healthy_and_unhealthy_love',
    contentNote:
      'Discusses emotional abuse, controlling behavior, and relationship violence.',
    medicalCaveat:
      'If abuse or coercion may be present, prioritize safety planning and qualified support. Do not default to couples communication or confrontation.',
  }),
  curateVideo({
    id: 'video-relationships-rebuild-trust',
    title: 'How to build (and rebuild) trust',
    creator: 'Frances Frei',
    provider: 'TED',
    topic: 'Relationships & boundaries',
    displayTags: ['Trust', 'Repair', 'Evidence'],
    summary:
      'A framework for making trust more specific through authenticity, judgment, and whether the other person experiences genuine concern.',
    centralPremise:
      'Trust can be examined through observable dimensions rather than treated as an all-or-nothing feeling.',
    practicalTakeaways: [
      {
        title: 'Name the weak dimension',
        description:
          'A specific concern about honesty, judgment, or care is easier to discuss and evaluate than a global accusation.',
        nextStep: 'Name the trust dimension and the evidence that currently supports your concern.',
      },
      {
        title: 'Request observable repair',
        description:
          'A repair request becomes more useful when it describes a behavior rather than demanding an immediate feeling of trust.',
        nextStep: 'Write one bounded behavior that would provide relevant evidence over time.',
      },
    ],
    reflectionPrompts: [
      'Which trust dimension feels weak, and what evidence supports that view?',
      'What observable repair would help without obligating reconciliation?',
    ],
    goalContent: 'Prepare one bounded trust conversation or observable repair request',
    habitName: 'Notice evidence relevant to trust',
    habitDescription:
      'Record one observable behavior without forcing an immediate all-or-nothing conclusion.',
    sourceUrl:
      'https://www.ted.com/talks/frances_frei_how_to_build_and_rebuild_trust',
    medicalCaveat:
      'A trust framework does not create an obligation to reconcile, especially after abuse, coercion, or repeated harm.',
  }),
  curateVideo({
    id: 'video-relationships-better-conversation',
    title: '10 ways to have a better conversation',
    creator: 'Celeste Headlee',
    provider: 'TEDx',
    topic: 'Relationships & boundaries',
    displayTags: ['Conversation', 'Listening', 'Curiosity'],
    summary:
      'A practical set of conversation habits centered on attention, curiosity, brevity, and listening without rehearsing the next response.',
    centralPremise:
      'A conversation becomes more reciprocal when participants remain present, ask genuine questions, and listen to learn rather than to perform.',
    practicalTakeaways: [
      {
        title: 'Enter ready to learn',
        description:
          'Curiosity leaves room for information that does not fit the story a person expected to hear.',
        nextStep: 'Choose one open question whose answer you do not already assume.',
      },
      {
        title: 'Listen before preparing',
        description:
          'Rehearsing a response while another person speaks can reduce attention and make the exchange feel predetermined.',
        nextStep: 'After the person finishes, summarize one thing you learned before answering.',
      },
    ],
    reflectionPrompts: [
      'What did I learn that I did not already know?',
      'Was the conversation safe and mutual enough for these skills to matter?',
    ],
    goalContent: 'Practice one open question and one accurate listening summary in a safe conversation',
    habitName: 'Practice one conversation skill',
    habitDescription:
      'Choose one skill at a time, such as an open question, brief answer, or listening summary.',
    sourceUrl:
      'https://www.ted.com/talks/celeste_headlee_10_ways_to_have_a_better_conversation',
    medicalCaveat:
      'Communication skill cannot compensate for a lack of safety, good faith, consent, or mutual participation.',
  }),
  curateVideo({
    id: 'video-relationships-boundaries',
    title: 'How boundaries make space for the sweet things in life',
    creator: 'Yasmine Cheyenne',
    provider: 'TEDx',
    topic: 'Relationships & boundaries',
    displayTags: ['Boundaries', 'Time', 'Energy'],
    summary:
      'A visual and practical way to think about limited time and energy, and what intentional boundaries can make room for.',
    centralPremise:
      'A boundary is not only a refusal; it can protect capacity for relationships, values, and activities that matter.',
    practicalTakeaways: [
      {
        title: 'Name what the yes displaces',
        description:
          'Every commitment uses limited time or energy, so the tradeoff can be made visible before agreeing.',
        nextStep: 'Write what the current yes leaves less room for.',
      },
      {
        title: 'State your own action',
        description:
          'A workable boundary describes what the user will do rather than trying to control another person.',
        nextStep: 'Write one specific boundary and the action you can safely take if it is crossed.',
      },
    ],
    reflectionPrompts: [
      'What do I want this boundary to make room for?',
      'How can I communicate or act on it without increasing danger?',
    ],
    goalContent: 'Write and safely communicate one specific boundary that protects something important',
    habitName: 'Check what a yes makes room for',
    habitDescription:
      'Before one recurring commitment, notice the time, energy, and value tradeoff.',
    sourceUrl:
      'https://www.ted.com/talks/yasmine_cheyenne_how_boundaries_make_space_for_the_sweet_things_in_life',
    medicalCaveat:
      "A boundary does not guarantee another person's cooperation. Safety planning takes priority where retaliation or coercion is possible.",
  }),
  curateVideo({
    id: 'video-relationships-long-term-desire',
    title: 'The secret to desire in a long-term relationship',
    creator: 'Esther Perel',
    provider: 'TED',
    topic: 'Relationships & boundaries',
    displayTags: ['Desire', 'Intimacy', 'Autonomy'],
    summary:
      'A mature discussion of the tension between security and novelty, and how autonomy and curiosity can coexist with long-term intimacy.',
    centralPremise:
      'Long-term intimacy can involve both security and separateness, while desire is shaped by far more than effort or relationship commitment.',
    practicalTakeaways: [
      {
        title: 'Protect individuality',
        description:
          'Seeing a partner as a separate person can preserve curiosity without reducing closeness or commitment.',
        nextStep: 'Name one individual interest, relationship, or activity worth protecting.',
      },
      {
        title: 'Discuss conditions, not demands',
        description:
          'A conversation can explore the conditions that support connection without requiring a specific sexual response or outcome.',
        nextStep: 'Write one low-pressure, consent-centered question about connection.',
      },
    ],
    reflectionPrompts: [
      'When do I feel connected while still feeling like myself?',
      'What health, stress, consent, identity, or safety context also belongs in this conversation?',
    ],
    goalContent: 'Prepare one low-pressure, consent-centered conversation about connection',
    habitName: 'Protect one source of individuality',
    habitDescription:
      'Make room for an interest, relationship, or activity that supports a separate sense of self.',
    sourceUrl:
      'https://www.ted.com/talks/esther_perel_the_secret_to_desire_in_a_long_term_relationship',
    contentNote:
      'Contains mature discussion of sex, desire, and long-term relationships.',
    medicalCaveat:
      'This is not medical or couples therapy advice. Sexual wellbeing requires consent and may be affected by health, medication, trauma, disability, identity, stress, and relationship safety.',
  }),
];
