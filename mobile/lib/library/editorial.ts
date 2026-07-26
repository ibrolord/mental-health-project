export interface BookRecord {
  id: string;
  title: string;
  author: string;
  summary: string;
  takeaways: string[];
  quote: string | null;
  action_step: string | null;
  tags: string[];
  read_time_minutes: number;
}

export const LIBRARY_TOPICS = [
  'All',
  'Anxiety & stress',
  'Mood & self-compassion',
  'Habits & growth',
  'Burnout & recovery',
  'Trauma',
] as const;

export type LibraryTopic = (typeof LIBRARY_TOPICS)[number];
export type BookSourceType = 'author' | 'publisher' | 'research' | 'clinical-context';
export type LibraryActionType = 'journal' | 'goal' | 'habit';

export interface BookSource {
  label: string;
  url: string;
  sourceType: BookSourceType;
}

export interface CorePremise {
  title: string;
  premise: string;
  whyItMatters: string;
  practice: string;
}

export interface PracticalTakeaway {
  title: string;
  description: string;
  nextStep: string;
}

export interface LibraryIntegration {
  title: string;
  description: string;
  actionType: LibraryActionType;
  actionLabel: string;
  prompt?: string;
  goalContent?: string;
  habitName?: string;
  habitDescription?: string;
}

export interface CuratedBook extends BookRecord {
  topic: Exclude<LibraryTopic, 'All'>;
  displayTags: string[];
  editorialNote: string;
  centralPremise: string;
  corePremises: CorePremise[];
  practicalTakeaways: PracticalTakeaway[];
  reflectionPrompts: string[];
  integrations: LibraryIntegration[];
  sources: BookSource[];
  medicalCaveat?: string;
}

type EditorialOverride = Omit<
  CuratedBook,
  'id' | 'title' | 'author' | 'quote' | 'tags' | 'read_time_minutes'
>;

const BOOK_METADATA: Pick<
  BookRecord,
  'id' | 'title' | 'author' | 'read_time_minutes'
>[] = [
  { id: 'atomic-habits', title: 'Atomic Habits', author: 'James Clear', read_time_minutes: 15 },
  {
    id: 'the-happiness-trap',
    title: 'The Happiness Trap',
    author: 'Russ Harris',
    read_time_minutes: 16,
  },
  { id: 'feeling-good', title: 'Feeling Good', author: 'David D. Burns', read_time_minutes: 18 },
  {
    id: 'when-the-body-says-no',
    title: 'When the Body Says No',
    author: 'Gabor Maté',
    read_time_minutes: 16,
  },
  {
    id: 'burnout-stress-cycle',
    title: 'Burnout: The Secret to Unlocking the Stress Cycle',
    author: 'Emily Nagoski & Amelia Nagoski',
    read_time_minutes: 17,
  },
  {
    id: 'gifts-of-imperfection',
    title: 'The Gifts of Imperfection',
    author: 'Brené Brown',
    read_time_minutes: 15,
  },
  {
    id: 'the-body-keeps-the-score',
    title: 'The Body Keeps the Score',
    author: 'Bessel van der Kolk',
    read_time_minutes: 18,
  },
  { id: 'mindset', title: 'Mindset', author: 'Carol Dweck', read_time_minutes: 15 },
];

const STANDARD_NOTE =
  "Premises are paraphrased from the book and linked sources. This guide is not a replacement for the book, diagnosis, treatment, or individualized professional advice.";

const EDITORIAL_OVERRIDES: Record<string, EditorialOverride> = {
  'Atomic Habits': {
    topic: 'Habits & growth',
    displayTags: ['Habits', 'Behavior change', 'Environment'],
    summary:
      'James Clear presents behavior change as a systems and environment problem, not simply a test of motivation. The useful question is often how to make a chosen action easier to notice, begin, and repeat.',
    centralPremise:
      'Small actions can compound when they are repeated, but consistency is more likely when the surrounding system supports the behavior. The book therefore shifts attention from dramatic goals to cues, friction, repetition, and identity.',
    corePremises: [
      {
        title: 'Systems shape repeated behavior',
        premise:
          'Goals identify a direction, while systems are the recurring processes that move a person in that direction. A goal can be meaningful without being sufficient to change daily behavior.',
        whyItMatters:
          'This reframes a missed habit as information about the setup rather than proof of personal failure.',
        practice:
          'Describe when, where, and after which existing action the new behavior will happen.',
      },
      {
        title: 'Make the cue easier to notice',
        premise:
          'The book organizes habits around cue, craving, response, and reward. Changing what is visible or immediately available can alter the first part of that loop.',
        whyItMatters:
          'People often overestimate memory and motivation while underestimating the physical and digital environment.',
        practice:
          'Put the needed object in view, schedule one clear reminder, or remove one competing cue.',
      },
      {
        title: 'Reduce the starting friction',
        premise:
          'A behavior is easier to repeat when its first step is brief and simple. The smallest version is not the final ambition; it is an accessible entry point.',
        whyItMatters:
          'Starting can carry more resistance than continuing, especially on low-energy days.',
        practice:
          'Define a version that takes about two minutes, such as opening the document or walking once around the block.',
      },
      {
        title: 'Use identity as direction, not a verdict',
        premise:
          'Clear suggests that repeated actions can provide evidence for an identity a person wants to build. Identity should guide choices without turning one lapse into a fixed label.',
        whyItMatters:
          'A flexible identity can support persistence; a rigid identity can create shame when life interrupts the routine.',
        practice:
          'Complete the sentence: "I am practicing being someone who..." and name one action that would count as evidence.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Design the next repetition',
        description:
          'Do not redesign your whole life. Improve the conditions for the next occurrence of one behavior.',
        nextStep: 'Choose one cue, one tiny response, and one immediate sign that it is complete.',
      },
      {
        title: 'Treat lapses as data',
        description:
          'A missed day can reveal that the cue was vague, the action was too large, or the context changed.',
        nextStep: 'Write down what got in the way and reduce one point of friction before trying again.',
      },
      {
        title: 'Keep context in view',
        description:
          'Health, disability, caregiving, work conditions, and resources affect what is realistic. Small systems should adapt to the person.',
        nextStep: 'Choose a minimum version that remains safe and possible on a difficult day.',
      },
    ],
    takeaways: [
      'Build a repeatable system around one behavior instead of relying on motivation alone.',
      'Make the cue visible and the first step easier to begin.',
      'Use lapses to adjust the system rather than to judge yourself.',
    ],
    action_step:
      'Choose one small action, attach it to an existing cue, and make the first repetition take about two minutes.',
    reflectionPrompts: [
      'Which habit currently depends too much on remembering or feeling motivated?',
      'What is the smallest version that would still count on a difficult day?',
      'What in your environment makes the desired action easier or harder?',
    ],
    integrations: [
      {
        title: 'Design your habit loop',
        description: 'Capture the cue, tiny action, likely friction, and a realistic backup version.',
        actionType: 'journal',
        actionLabel: 'Open a book note',
        prompt:
          'What behavior do I want to repeat? What will cue it, what is the two-minute version, what friction should I remove, and what will count on a difficult day?',
      },
      {
        title: 'Prioritize the setup',
        description: 'Turn environment design into one concrete task for today.',
        actionType: 'goal',
        actionLabel: 'Add as a priority',
        goalContent: 'Prepare the environment for one habit I want to repeat',
      },
      {
        title: 'Track the smallest version',
        description: 'Create a habit that is easy to complete and revise after you learn from it.',
        actionType: 'habit',
        actionLabel: 'Prefill a habit',
        habitName: 'Complete the two-minute version',
        habitDescription:
          'Use the cue I chose and complete the smallest safe version. Adjust the setup after a miss.',
      },
    ],
    sources: [
      {
        label: 'James Clear: Atomic Habits summary',
        url: 'https://jamesclear.com/atomic-habits-summary',
        sourceType: 'author',
      },
      {
        label: 'Penguin Random House book page',
        url: 'https://www.penguinrandomhouse.com/books/543993/atomic-habits-by-james-clear/',
        sourceType: 'publisher',
      },
    ],
    editorialNote: STANDARD_NOTE,
  },
  'The Happiness Trap': {
    topic: 'Anxiety & stress',
    displayTags: ['Acceptance', 'Values', 'Psychological flexibility'],
    summary:
      'Russ Harris introduces Acceptance and Commitment Therapy-informed skills for relating differently to difficult thoughts and feelings while continuing to move toward personally chosen values.',
    centralPremise:
      'A meaningful life does not require the permanent removal of uncomfortable inner experiences. Psychological flexibility involves noticing what is present, making room for it when useful, and choosing behavior based on values rather than automatic avoidance.',
    corePremises: [
      {
        title: 'Control can become the struggle',
        premise:
          'Strategies used to eliminate every unwanted thought or feeling may work briefly yet narrow life when they become rigid avoidance.',
        whyItMatters:
          'The issue is not that coping is bad; it is whether a strategy helps in the situation and over time.',
        practice:
          'Ask, "When I use this strategy, does it help me build the life I want, or mainly shrink the moment?"',
      },
      {
        title: 'Thoughts are events, not commands',
        premise:
          'Cognitive defusion means noticing the process of thinking without automatically treating each thought as literal truth or an instruction.',
        whyItMatters:
          'Creating a little distance can make room for a deliberate response without requiring the thought to disappear.',
        practice:
          'Try adding, "I am noticing the thought that..." before a recurring thought and observe what changes.',
      },
      {
        title: 'Acceptance is active willingness',
        premise:
          'Acceptance in this framework means allowing an internal experience to be present when fighting it is costly. It does not mean approving harm, tolerating unsafe conditions, or giving up change.',
        whyItMatters:
          'The distinction prevents acceptance language from being used to dismiss practical problems or necessary boundaries.',
        practice:
          'Name the feeling, notice where it shows up, and choose whether the next action calls for willingness, protection, support, or problem-solving.',
      },
      {
        title: 'Values guide ongoing action',
        premise:
          'Values describe qualities of action, such as being caring, curious, or dependable. Unlike goals, they are directions that can be expressed repeatedly.',
        whyItMatters:
          'Values can offer a compass when certainty, confidence, or comfort is unavailable.',
        practice:
          'Choose one value and one small behavior that would express it in the next 24 hours.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Name the process',
        description:
          'Labeling "thinking," "worrying," or "self-criticism" can be more workable than debating every thought.',
        nextStep: 'Notice one recurring mental story and practice naming it without arguing with it.',
      },
      {
        title: 'Separate acceptance from passivity',
        description:
          'Making room for a feeling and changing an unsafe or unfair situation can happen at the same time.',
        nextStep: 'Identify whether this moment calls for internal willingness, external action, or both.',
      },
      {
        title: 'Make values observable',
        description:
          'A value becomes useful when translated into a behavior small enough to carry out.',
        nextStep: 'Write one action another person could observe that represents the value you chose.',
      },
    ],
    takeaways: [
      'Notice thoughts without automatically treating them as facts or commands.',
      'Acceptance of an internal experience does not require accepting unsafe circumstances.',
      'Use values to choose one observable action even when discomfort is present.',
    ],
    action_step:
      'Name one value, notice one internal barrier, and choose a small action that expresses the value without requiring the barrier to disappear.',
    reflectionPrompts: [
      'Which inner experience have you been trying hardest to eliminate, and what has that struggle cost?',
      'What thought would be easier to carry if you saw it as a mental event rather than a command?',
      'Which value do you want your next action to express?',
    ],
    integrations: [
      {
        title: 'Practice defusion on paper',
        description: 'Observe a difficult thought, its pull, and a values-based alternative action.',
        actionType: 'journal',
        actionLabel: 'Start a reflection',
        prompt:
          'What thought is showing up? What does it urge me to do? If I hold it lightly rather than obey it, which value could guide my next small action?',
      },
      {
        title: 'Choose a values action',
        description: 'Make one values-aligned behavior a priority for today.',
        actionType: 'goal',
        actionLabel: 'Add as a priority',
        goalContent: 'Take one small action that expresses a value I choose',
      },
      {
        title: 'Build a noticing practice',
        description: 'Create a brief routine for noticing thoughts before reacting.',
        actionType: 'habit',
        actionLabel: 'Prefill a habit',
        habitName: 'Pause and name the thought',
        habitDescription:
          'Once a day, notice a recurring thought, name it as a thought, and choose the next action deliberately.',
      },
    ],
    sources: [
      {
        label: 'The Happiness Trap official site',
        url: 'https://thehappinesstrap.com/',
        sourceType: 'author',
      },
      {
        label: 'Russ Harris introductory ACT workshop handout',
        url: 'https://thehappinesstrap.com/upimages/2007%20Introductory%20ACT%20Workshop%20Handout%20-%20%20Russ%20Harris.pdf',
        sourceType: 'author',
      },
    ],
    medicalCaveat:
      'ACT-informed self-help can support reflection, but significant or persistent distress may require individualized assessment and care.',
    editorialNote: STANDARD_NOTE,
  },
  'Feeling Good': {
    topic: 'Mood & self-compassion',
    displayTags: ['CBT-informed', 'Thought patterns', 'Behavior'],
    summary:
      'David Burns presents cognitive behavioral self-help exercises for identifying automatic thoughts, checking common thinking patterns, and developing more balanced responses.',
    centralPremise:
      'Interpretations can influence emotion and behavior, so putting a thought into words and examining it can sometimes change how a situation is experienced. The method is not forced positivity: an alternative thought should account for evidence, context, and uncertainty.',
    corePremises: [
      {
        title: 'Make the automatic thought visible',
        premise:
          'Fast interpretations can feel like direct descriptions of reality. Writing down the specific thought creates something that can be examined.',
        whyItMatters:
          'Vague distress is difficult to evaluate; a concrete sentence makes the underlying meaning clearer.',
        practice:
          'Write the situation, emotion, and exact thought that passed through your mind without editing it.',
      },
      {
        title: 'Look for thinking patterns',
        premise:
          'The book describes patterns such as all-or-nothing thinking, discounting positives, mind reading, and predicting the future.',
        whyItMatters:
          'A pattern label is a hypothesis that prompts questions, not proof that the concern is imaginary.',
        practice:
          'Ask whether the thought uses absolutes, assumes another person’s mind, or treats one event as a permanent rule.',
      },
      {
        title: 'Build a believable alternative',
        premise:
          'A balanced response includes evidence that supports the original concern as well as evidence, possibilities, and context it left out.',
        whyItMatters:
          'An unrealistically positive statement is easy to reject and may invalidate a real problem.',
        practice:
          'Write the most accurate response you can believe, even if it only reduces certainty from 100 percent to 80 percent.',
      },
      {
        title: 'Behavior can test the prediction',
        premise:
          'Small actions can generate new information when withdrawal or avoidance keeps a prediction untested.',
        whyItMatters:
          'Mood can affect activity, and reduced activity can in turn remove opportunities for mastery, pleasure, or connection.',
        practice:
          'Choose a low-risk action that tests one prediction or adds a small amount of useful activity.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Record before reframing',
        description:
          'Capture the original thought and emotional intensity before trying to change it.',
        nextStep: 'Use one short thought record: situation, emotion, thought, evidence, balanced response.',
      },
      {
        title: 'Do not reason away real conditions',
        description:
          'Cognitive review should not erase discrimination, illness, conflict, or other genuine external problems.',
        nextStep: 'Separate the parts that need practical action from the parts that involve uncertain interpretation.',
      },
      {
        title: 'Use experiments, not self-tests',
        description:
          'A behavioral experiment gathers information; it is not a pass-or-fail measure of worth.',
        nextStep: 'Predict what will happen, try one safe action, and record what actually occurred.',
      },
    ],
    takeaways: [
      'Write the exact automatic thought before trying to evaluate it.',
      'Use thinking-pattern labels as questions, not as proof that a concern is false.',
      'Create a balanced response and test predictions with small, safe actions.',
    ],
    action_step:
      'Complete one brief thought record. If the exercise increases distress or involves self-harm thoughts, stop and seek appropriate support.',
    reflectionPrompts: [
      'What specific meaning did you assign to the situation?',
      'What evidence or context did the first thought leave out?',
      'What small, safe action could give you better information?',
    ],
    integrations: [
      {
        title: 'Write a balanced thought record',
        description: 'Separate the event, feeling, automatic thought, evidence, and next action.',
        actionType: 'journal',
        actionLabel: 'Open a thought record',
        prompt:
          'What happened? What did I feel and how strongly? What automatic thought appeared? What supports it, what does not, and what balanced response is believable?',
      },
      {
        title: 'Run a small experiment',
        description: 'Turn an uncertain prediction into a low-risk information-gathering task.',
        actionType: 'goal',
        actionLabel: 'Add as a priority',
        goalContent: 'Run one small, safe experiment to test an automatic prediction',
      },
      {
        title: 'Notice one thought a day',
        description: 'Build familiarity with automatic thoughts without analyzing everything.',
        actionType: 'habit',
        actionLabel: 'Prefill a habit',
        habitName: 'Capture one automatic thought',
        habitDescription:
          'Write one situation, emotion, and thought. Add a balanced response only if it feels useful.',
      },
    ],
    sources: [
      {
        label: 'David Burns book resources',
        url: 'https://feelinggood.com/books/',
        sourceType: 'author',
      },
      {
        label: 'HarperCollins academic book page',
        url: 'https://www.harperacademic.com/book/9780380731763/feeling-good/',
        sourceType: 'publisher',
      },
    ],
    medicalCaveat:
      'This is a self-help framework, not an assessment or treatment plan. Depression can require professional care, and cognitive exercises should not be used to dismiss real danger or adversity.',
    editorialNote: STANDARD_NOTE,
  },
  'When the Body Says No': {
    topic: 'Anxiety & stress',
    displayTags: ['Stress', 'Boundaries', 'Debated claims'],
    summary:
      'Gabor Maté explores possible relationships among chronic stress, emotional suppression, caregiving patterns, and physical illness. The book combines observations and research with broad causal interpretations that remain debated and should not be applied to symptoms without medical evaluation.',
    centralPremise:
      'The author argues that long-standing stress and difficulty expressing needs can affect health through mind-body pathways. It is reasonable to consider stress as one influence on wellbeing, but the book cannot determine why an individual developed symptoms or illness.',
    corePremises: [
      {
        title: 'Stress has biological and social dimensions',
        premise:
          'The book treats stress as a response shaped by demands, relationships, history, and the body rather than as a purely mental attitude.',
        whyItMatters:
          'This can broaden reflection beyond personal willpower and toward workload, safety, support, and recovery.',
        practice:
          'List the recurring demands, supports, and constraints around one stressful situation.',
      },
      {
        title: 'Automatic caregiving can hide personal limits',
        premise:
          'Maté highlights patterns of prioritizing others, avoiding conflict, or suppressing anger when those patterns become rigid.',
        whyItMatters:
          'Noticing a pattern can support boundary-setting without blaming a person for illness or for how they learned to stay safe.',
        practice:
          'Identify one request you agree to automatically and what you need before answering it.',
      },
      {
        title: 'Emotions can carry information',
        premise:
          'The book treats emotions such as anger as signals about needs, limits, or perceived threat rather than as states that must always be suppressed.',
        whyItMatters:
          'Listening to a signal is different from acting impulsively on it.',
        practice:
          'Name the emotion, the possible need it points to, and one safe way to respond.',
      },
      {
        title: 'Narrative is not diagnosis',
        premise:
          'A compelling life story can help organize experience but cannot establish a medical cause for cancer, autoimmune disease, pain, or other conditions.',
        whyItMatters:
          'Overconfident mind-body explanations can create guilt, delay evaluation, or overlook biological and environmental causes.',
        practice:
          'Keep medical questions with qualified clinicians and use journaling only to explore stress, support, and boundaries.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Map demands and recovery',
        description:
          'Stress reflection is more useful when it identifies concrete demands and available support.',
        nextStep: 'Write one demand that can change, one that cannot, and one form of support to seek.',
      },
      {
        title: 'Pause before automatic agreement',
        description:
          'A brief delay can create room to notice capacity before making a commitment.',
        nextStep: 'Practice saying, "Let me check and get back to you," in one low-risk situation.',
      },
      {
        title: 'Do not self-diagnose from a book',
        description:
          'Physical symptoms and illnesses have many possible causes and require appropriate evaluation.',
        nextStep: 'Seek medical care for new, persistent, worsening, or concerning symptoms.',
      },
    ],
    takeaways: [
      'Consider stress alongside demands, relationships, resources, and recovery.',
      'Notice rigid caregiving or conflict-avoidance patterns without blaming yourself for illness.',
      'Do not use the author’s mind-body narrative to diagnose symptoms or assign medical cause.',
    ],
    action_step:
      'Identify one low-risk boundary to practice. For new, persistent, worsening, or concerning physical symptoms, consult a qualified healthcare professional.',
    reflectionPrompts: [
      'Where do you say yes before checking your capacity?',
      'Which emotion or body signal might be pointing to a need or limit?',
      'What practical support would reduce a recurring demand?',
    ],
    integrations: [
      {
        title: 'Map a boundary',
        description: 'Explore the demand, your capacity, the feared consequence, and a safe response.',
        actionType: 'journal',
        actionLabel: 'Start a boundary note',
        prompt:
          'What am I being asked to carry? What is my actual capacity? What do I fear would happen if I set a limit, and what safe, specific boundary could I try?',
      },
      {
        title: 'Make space before answering',
        description: 'Prioritize one pause that prevents an automatic commitment.',
        actionType: 'goal',
        actionLabel: 'Add as a priority',
        goalContent: 'Pause and check my capacity before one non-urgent commitment',
      },
      {
        title: 'Practice a capacity check',
        description: 'Build a brief routine for noticing needs before saying yes.',
        actionType: 'habit',
        actionLabel: 'Prefill a habit',
        habitName: 'Check capacity before agreeing',
        habitDescription:
          'Before one non-urgent yes, notice energy, time, and support. Delay the answer when needed.',
      },
    ],
    sources: [
      {
        label: 'Penguin Random House Canada book page',
        url: 'https://www.penguinrandomhouse.ca/books/109013/when-the-body-says-no-by-gabor-mate-md/9780676973129',
        sourceType: 'publisher',
      },
      {
        label: 'American Psychological Association: Stress effects on the body',
        url: 'https://www.apa.org/topics/stress/body',
        sourceType: 'clinical-context',
      },
    ],
    medicalCaveat:
      'The book includes debated causal medical claims. Stress can affect wellbeing, but it does not explain an individual illness, and illness is not evidence of emotional failure.',
    editorialNote:
      "This guide separates the author's perspective from established clinical limits. It must not be used to explain symptoms without medical evaluation.",
  },
  'Burnout: The Secret to Unlocking the Stress Cycle': {
    topic: 'Burnout & recovery',
    displayTags: ['Burnout', 'Recovery', 'Structural stress'],
    summary:
      'Emily and Amelia Nagoski distinguish stressors from the stress response and describe recovery as an active process. They also emphasize that burnout is shaped by social expectations and working conditions, not only individual coping.',
    centralPremise:
      'Solving a problem does not always settle the body’s stress response, and calming the response does not remove the problem. Sustainable recovery therefore needs both regulation and practical change to demands, resources, or boundaries.',
    corePremises: [
      {
        title: 'Stressor and stress are different targets',
        premise:
          'A stressor is the demand or threat; stress is the response that can continue after the immediate situation ends.',
        whyItMatters:
          'It explains why finishing a difficult task may not immediately produce relief.',
        practice:
          'For one difficult moment, name the stressor and separately name what would help your body settle.',
      },
      {
        title: 'Recovery needs completion signals',
        premise:
          'The authors discuss movement, breathing, affection, connection, laughter, and creative expression as possible ways to signal safety or completion.',
        whyItMatters:
          'There is no single required method; the useful option is one that is safe, accessible, and genuinely settling for the person.',
        practice:
          'Try one brief recovery activity and note how you feel before and after rather than assuming it must work.',
      },
      {
        title: 'Rest is a requirement, not a reward',
        premise:
          'Persistent depletion cannot be solved by asking for more effort from an already exhausted system.',
        whyItMatters:
          'Treating rest as something earned only after everything is done can make recovery impossible.',
        practice:
          'Protect one small period of sleep support, quiet, nourishment, or unstructured recovery.',
      },
      {
        title: 'Context can be the problem',
        premise:
          'Burnout can reflect workload, discrimination, caregiving, lack of control, or inadequate resources. Individual techniques cannot repair every structural condition.',
        whyItMatters:
          'This reduces self-blame and keeps organizational change, accommodation, and support in the plan.',
        practice:
          'Identify one demand to reduce, one resource to request, or one boundary that requires another person’s participation.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Use a two-column plan',
        description:
          'Keep actions for the stressor separate from actions for the stress response.',
        nextStep: 'Write one problem-solving step and one recovery step for the same situation.',
      },
      {
        title: 'Measure effect, not virtue',
        description:
          'A recovery practice is useful because of how it affects you, not because it is considered healthy in the abstract.',
        nextStep: 'Rate tension before and after one safe activity and keep only what helps.',
      },
      {
        title: 'Escalate structural needs',
        description:
          'Some demands require workload change, accommodation, shared responsibility, or professional support.',
        nextStep: 'Name one request that cannot be replaced by personal coping.',
      },
    ],
    takeaways: [
      'Address the external stressor and the internal stress response as related but separate tasks.',
      'Choose recovery practices based on safety, access, and observed effect.',
      'Include workload, resources, and structural change rather than placing all responsibility on coping.',
    ],
    action_step:
      'Choose one brief recovery activity and one practical change to a demand. Notice the effect instead of requiring either step to solve everything.',
    reflectionPrompts: [
      'Which stressor is still active, and which response continues after it ends?',
      'What reliably helps your system settle, even slightly?',
      'Which part of the problem requires a change in conditions or support?',
    ],
    integrations: [
      {
        title: 'Separate stress from stressor',
        description: 'Build a two-part plan for practical action and recovery.',
        actionType: 'journal',
        actionLabel: 'Start a recovery map',
        prompt:
          'What is the external stressor? What can change, and what cannot right now? What is my stress response, and which safe recovery action might help it settle?',
      },
      {
        title: 'Protect one recovery need',
        description: 'Turn rest or support into a concrete priority rather than leftover time.',
        actionType: 'goal',
        actionLabel: 'Add as a priority',
        goalContent: 'Protect one realistic period for recovery or support today',
      },
      {
        title: 'Close one stress cycle',
        description: 'Test a brief recovery practice and observe its effect.',
        actionType: 'habit',
        actionLabel: 'Prefill a habit',
        habitName: 'Practice one recovery signal',
        habitDescription:
          'After a stressful period, try one safe activity that helps me settle and notice the effect.',
      },
    ],
    sources: [
      {
        label: 'Penguin Random House book page',
        url: 'https://www.penguinrandomhouse.com/books/592377/burnout-by-emily-nagoski-phd-and-amelia-nagoski-dma/9781984817075/',
        sourceType: 'publisher',
      },
      {
        label: 'World Health Organization: Burn-out in ICD-11',
        url: 'https://www.who.int/news/item/28-05-2019-burn-out-an-occupational-phenomenon-international-classification-of-diseases',
        sourceType: 'clinical-context',
      },
    ],
    medicalCaveat:
      'Burnout can overlap with depression, anxiety, sleep problems, and medical conditions. Persistent impairment or safety concerns warrant professional assessment.',
    editorialNote: STANDARD_NOTE,
  },
  'The Gifts of Imperfection': {
    topic: 'Mood & self-compassion',
    displayTags: ['Self-compassion', 'Perfectionism', 'Connection'],
    summary:
      'Brené Brown organizes her qualitative research and reflections into practices for engaging with vulnerability, shame, perfectionism, belonging, and self-compassion.',
    centralPremise:
      'A life organized around proving worth or avoiding imperfection can restrict connection and authenticity. The book proposes practicing courage, compassion, and connection while accepting that uncertainty and mistakes are part of participation.',
    corePremises: [
      {
        title: 'Perfectionism is not healthy striving',
        premise:
          'Brown distinguishes learning and high standards from attempts to avoid blame, judgment, or shame by appearing flawless.',
        whyItMatters:
          'The same task can be driven by curiosity and care or by fear that any mistake will define the person.',
        practice:
          'Ask whether the standard serves the work or mainly protects you from imagined judgment.',
      },
      {
        title: 'Shame grows in secrecy',
        premise:
          'The book argues that shame becomes more powerful when an experience cannot be named and placed in a wider human context.',
        whyItMatters:
          'Selective, safe disclosure can reduce isolation, but vulnerability is not owed to everyone.',
        practice:
          'Identify one trustworthy person and one level of disclosure that would be safe and appropriate.',
      },
      {
        title: 'Self-compassion keeps accountability possible',
        premise:
          'Responding to difficulty with kindness and perspective does not erase impact or responsibility.',
        whyItMatters:
          'Harsh self-attack can consume attention that could otherwise support repair and learning.',
        practice:
          'Name what happened, what responsibility is yours, and the next repair without adding a global judgment of worth.',
      },
      {
        title: 'Belonging is different from fitting in',
        premise:
          'The book contrasts changing oneself to gain approval with participating while remaining connected to one’s values and limits.',
        whyItMatters:
          'This can help evaluate relationships or environments that demand constant performance.',
        practice:
          'Notice where you edit yourself for approval and whether a smaller act of honesty would be safe.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Define good enough before starting',
        description:
          'A stopping rule protects time and reduces endless revision driven by fear.',
        nextStep: 'Write the minimum requirements and the point at which the task is complete.',
      },
      {
        title: 'Choose vulnerability with boundaries',
        description:
          'Authenticity does not mean disclosing personal information to unsafe or untrustworthy people.',
        nextStep: 'Choose the person, purpose, timing, and amount before sharing.',
      },
      {
        title: 'Pair compassion with repair',
        description:
          'A kind response can include honest responsibility and a specific corrective action.',
        nextStep: 'Replace a global self-judgment with one factual lesson and one next step.',
      },
    ],
    takeaways: [
      'Separate healthy effort from perfectionism driven by fear of judgment.',
      'Use vulnerability selectively with people and contexts that have earned trust.',
      'Combine self-compassion with honest accountability and repair.',
    ],
    action_step:
      'Choose one low-stakes task, define what “good enough” means before starting, and stop when those requirements are met.',
    reflectionPrompts: [
      'What are you trying to prevent others from thinking about you?',
      'Where would “good enough” protect energy without compromising safety or quality?',
      'What would accountability sound like without a global judgment of your worth?',
    ],
    integrations: [
      {
        title: 'Rewrite the perfectionist rule',
        description: 'Examine the standard, the fear beneath it, and a fair stopping point.',
        actionType: 'journal',
        actionLabel: 'Start a good-enough note',
        prompt:
          'What standard am I trying to meet? What do I fear a mistake would mean? What does responsible, good-enough work require, and where can I stop?',
      },
      {
        title: 'Finish one good-enough task',
        description: 'Practice completing a low-risk task without unnecessary polishing.',
        actionType: 'goal',
        actionLabel: 'Add as a priority',
        goalContent: 'Complete one low-risk task using a clear good-enough stopping rule',
      },
      {
        title: 'Use a compassionate debrief',
        description: 'Build a routine for learning without self-attack.',
        actionType: 'habit',
        actionLabel: 'Prefill a habit',
        habitName: 'End the day with one fair debrief',
        habitDescription:
          'Name one thing that was hard, one thing I handled, and one adjustment without judging my worth.',
      },
    ],
    sources: [
      {
        label: 'Brené Brown official book page',
        url: 'https://brenebrown.com/book/the-gifts-of-imperfection/',
        sourceType: 'author',
      },
      {
        label: 'Brené Brown Gifts Hub',
        url: 'https://brenebrown.com/hubs/the-gifts-hub/',
        sourceType: 'author',
      },
    ],
    editorialNote: STANDARD_NOTE,
  },
  'The Body Keeps the Score': {
    topic: 'Trauma',
    displayTags: ['Trauma', 'Safety', 'Professional care'],
    summary:
      'Bessel van der Kolk surveys trauma research, clinical observations, and treatment approaches, emphasizing that traumatic stress can affect memory, attention, emotion, relationships, and physical responses.',
    centralPremise:
      'Traumatic experiences can continue to influence how threat and safety are perceived even after danger has passed. Recovery is presented as rebuilding present-day safety, agency, connection, and regulation, but treatment must be individualized and some claims or modalities in the book remain debated.',
    corePremises: [
      {
        title: 'Threat responses can persist',
        premise:
          'The book describes how reminders may trigger intense reactions, numbness, avoidance, or disconnection when the nervous system responds as though danger is current.',
        whyItMatters:
          'This framing can reduce moral judgment while preserving the need for careful assessment.',
        practice:
          'When activated, orient to the date, location, and observable signs of present safety rather than forcing a memory narrative.',
      },
      {
        title: 'Trauma can affect multiple domains',
        premise:
          'The author discusses effects involving sleep, concentration, relationships, bodily sensations, emotion, and memory.',
        whyItMatters:
          'A broad pattern may deserve professional evaluation, but no single symptom proves trauma or a specific diagnosis.',
        practice:
          'Track the context and impact of symptoms without assigning a cause from the book.',
      },
      {
        title: 'Agency and consent matter',
        premise:
          'Recovery approaches should increase choice and control rather than reproduce helplessness or pressure.',
        whyItMatters:
          'A person should not be pushed into disclosure, exposure, body work, or memory processing without informed consent and qualified support.',
        practice:
          'Before an exercise, identify permission to stop, a grounding option, and who can provide support.',
      },
      {
        title: 'No single treatment fits everyone',
        premise:
          'The book discusses many conventional and unconventional modalities, but evidence, availability, contraindications, and personal fit differ.',
        whyItMatters:
          'A compelling case story is not proof that a method is appropriate for a particular reader.',
        practice:
          'Discuss symptoms and treatment options with a licensed, trauma-informed professional who can assess your situation.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Orient before interpreting',
        description:
          'When distress rises, present-moment orientation may be safer than analyzing the past.',
        nextStep: 'Name the date, place, five visible objects, and one available choice.',
      },
      {
        title: 'Protect choice',
        description:
          'A useful support plan includes consent, pacing, and an option to stop.',
        nextStep: 'Write what helps you feel more in control and what a helper should not do.',
      },
      {
        title: 'Seek qualified assessment',
        description:
          'Symptoms can have many causes, and trauma treatment can temporarily increase distress.',
        nextStep: 'Use professional support for diagnosis, treatment selection, or memory-focused work.',
      },
    ],
    takeaways: [
      'Traumatic stress can affect many domains, but no single symptom establishes a diagnosis.',
      'Present-day safety, consent, pacing, and agency should guide any exercise or support.',
      'Treatment choices require individualized professional assessment; no single modality fits everyone.',
    ],
    action_step:
      'If you feel activated, orient to your current surroundings and available choices. Do not push through trauma memories alone.',
    reflectionPrompts: [
      'What helps you recognize that you are in the present rather than the past?',
      'What choices, boundaries, or supports increase your sense of control?',
      'What would you want a qualified helper to know before beginning difficult work?',
    ],
    integrations: [
      {
        title: 'Create a present-safety note',
        description: 'Record grounding cues, choices, boundaries, and support contacts without recounting trauma.',
        actionType: 'journal',
        actionLabel: 'Start a safety note',
        prompt:
          'What tells me I am in the present? Which surroundings, choices, boundaries, and trusted supports help me feel safer? What should I avoid when activated?',
      },
      {
        title: 'Prepare one support step',
        description: 'Choose a practical, non-memory-focused action that increases support or control.',
        actionType: 'goal',
        actionLabel: 'Add as a priority',
        goalContent: 'Take one practical step that increases present-day safety or support',
      },
      {
        title: 'Practice brief orientation',
        description: 'Build a gentle present-moment routine with permission to stop.',
        actionType: 'habit',
        actionLabel: 'Prefill a habit',
        habitName: 'Orient to the present',
        habitDescription:
          'Briefly name the date, place, visible surroundings, and one choice available now. Stop if it increases distress.',
      },
    ],
    sources: [
      {
        label: 'Bessel van der Kolk official book resources',
        url: 'https://www.besselvanderkolk.com/resources/the-body-keeps-the-score',
        sourceType: 'author',
      },
      {
        label: 'Penguin Random House book page',
        url: 'https://www.penguinrandomhouse.com/books/313183/the-body-keeps-the-score-by-bessel-van-der-kolk-md/',
        sourceType: 'publisher',
      },
      {
        label: 'US VA National Center for PTSD: treatment basics',
        url: 'https://www.ptsd.va.gov/understand_tx/tx_basics.asp',
        sourceType: 'clinical-context',
      },
    ],
    medicalCaveat:
      'This can be activating and is not a self-guided treatment plan. Some scientific interpretations and treatment claims are debated. Do not use the guide to recover memories or diagnose yourself.',
    editorialNote:
      'This guide does not endorse every scientific or treatment claim in the book. Use trauma material with consent, pacing, and qualified support.',
  },
  Mindset: {
    topic: 'Habits & growth',
    displayTags: ['Learning', 'Feedback', 'Context'],
    summary:
      'Carol Dweck describes how beliefs about whether abilities can develop may influence challenge-seeking, feedback, persistence, and responses to setbacks.',
    centralPremise:
      'Treating ability as developable can support learning behavior, while treating performance as a fixed verdict can make mistakes feel identity-threatening. The framework is most useful when paired with effective strategy, feedback, support, rest, and genuine opportunity.',
    corePremises: [
      {
        title: 'A result is not an identity',
        premise:
          'A fixed interpretation turns one performance into evidence of permanent ability or worth. A developmental interpretation treats it as current information.',
        whyItMatters:
          'This can create room to learn without denying disappointment or consequences.',
        practice:
          'Rewrite "I am bad at this" as a specific description of what is not working yet.',
      },
      {
        title: 'Effort needs strategy',
        premise:
          'Persistence is not valuable when it repeats an ineffective method without feedback or support.',
        whyItMatters:
          'Praising effort alone can become another demand and can hide barriers or poor instruction.',
        practice:
          'After a setback, identify one strategy to change and one source of useful feedback.',
      },
      {
        title: 'Feedback is information',
        premise:
          'When performance is not treated as a verdict on identity, corrective feedback can be easier to examine.',
        whyItMatters:
          'Not all feedback is accurate or fair, so openness should be paired with evaluation.',
        practice:
          'Separate the observable information, the interpretation, and the part you can test.',
      },
      {
        title: 'Context changes outcomes',
        premise:
          'Learning depends on time, health, access, instruction, safety, resources, and opportunity as well as beliefs and behavior.',
        whyItMatters:
          'The mindset framework should not be used to blame people for structural barriers or to promise that effort guarantees a result.',
        practice:
          'Name one resource, accommodation, or support that would make the learning experiment fairer.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Use specific language',
        description:
          'Replace global labels with the particular skill, context, or strategy that needs work.',
        nextStep: 'Complete: "The part I have not learned yet is..."',
      },
      {
        title: 'Change the method, not just the effort',
        description:
          'More repetition is useful only when the practice gives relevant information or skill.',
        nextStep: 'Choose one different strategy and decide how you will evaluate it.',
      },
      {
        title: 'Ask what support is missing',
        description:
          'Progress is not solely an individual attitude problem.',
        nextStep: 'Identify one feedback source, resource, accommodation, or boundary that would help.',
      },
    ],
    takeaways: [
      'Treat current performance as information rather than a permanent identity.',
      'Pair effort with strategy changes, feedback, and rest.',
      'Include resources, health, opportunity, and structural barriers in any learning plan.',
    ],
    action_step:
      'Choose one skill, define a small experiment with a different strategy, and name the feedback or support needed to evaluate it fairly.',
    reflectionPrompts: [
      'Which result are you currently turning into a global label about yourself?',
      'What strategy could change instead of simply increasing effort?',
      'What resource, feedback, or accommodation would make progress more possible?',
    ],
    integrations: [
      {
        title: 'Turn a setback into data',
        description: 'Separate the result, strategy, context, and next experiment.',
        actionType: 'journal',
        actionLabel: 'Start a learning note',
        prompt:
          'What happened? What specific skill or strategy is involved? What did the result teach me, what context mattered, and what different experiment or support will I try next?',
      },
      {
        title: 'Run one learning experiment',
        description: 'Make the next strategy change concrete and observable.',
        actionType: 'goal',
        actionLabel: 'Add as a priority',
        goalContent: 'Try one different strategy and collect feedback on the result',
      },
      {
        title: 'Record one useful lesson',
        description: 'Build a practice of specific learning rather than global self-judgment.',
        actionType: 'habit',
        actionLabel: 'Prefill a habit',
        habitName: 'Capture one learning adjustment',
        habitDescription:
          'After practice, note what worked, what did not, and one strategy or support to change.',
      },
    ],
    sources: [
      {
        label: 'Stanford University book listing',
        url: 'https://ccsre.stanford.edu/publications/mindset-updated-edition-changing-way-you-think-fulfill-your-potential',
        sourceType: 'publisher',
      },
      {
        label: 'Stanford Graduate School of Education: Carol Dweck',
        url: 'https://ed.stanford.edu/faculty/dweck',
        sourceType: 'research',
      },
    ],
    medicalCaveat:
      'Mindset is not a clinical treatment, and the framework must not be used to blame people for illness, disability, discrimination, or lack of opportunity.',
    editorialNote: STANDARD_NOTE,
  },
};

export function applyEditorialReview(book: BookRecord): CuratedBook | null {
  const override = EDITORIAL_OVERRIDES[book.title];
  if (!override) return null;

  return {
    ...book,
    ...override,
    quote: null,
  };
}

export const CURATED_LIBRARY: CuratedBook[] = BOOK_METADATA.map((metadata) => {
  const reviewed = applyEditorialReview({
    ...metadata,
    summary: '',
    takeaways: [],
    quote: null,
    action_step: null,
    tags: [],
  });

  if (!reviewed) {
    throw new Error(`Missing editorial review for ${metadata.title}`);
  }

  return reviewed;
}).sort((a, b) => a.title.localeCompare(b.title));
