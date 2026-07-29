export type AdditionalBookTopic =
  | 'Anxiety & stress'
  | 'Mood & self-compassion'
  | 'Habits & growth'
  | 'Burnout & recovery'
  | 'Trauma'
  | 'Grief & loss'
  | 'Relationships & boundaries';

export interface AdditionalCorePremise {
  title: string;
  premise: string;
  whyItMatters: string;
  practice: string;
}

export interface AdditionalPracticalTakeaway {
  title: string;
  description: string;
  nextStep: string;
}

export interface AdditionalBookSource {
  label: string;
  url: string;
  sourceType: 'author' | 'publisher' | 'research' | 'clinical-context';
}

export interface AdditionalBookDraft {
  id: string;
  title: string;
  author: string;
  topic: AdditionalBookTopic;
  displayTags: string[];
  readTimeMinutes: number;
  summary: string;
  centralPremise: string;
  corePremises: AdditionalCorePremise[];
  practicalTakeaways: [
    AdditionalPracticalTakeaway,
    ...AdditionalPracticalTakeaway[],
  ];
  reflectionPrompts: string[];
  sources: AdditionalBookSource[];
  medicalCaveat?: string;
}

type BookSeed = Omit<
  AdditionalBookDraft,
  'corePremises' | 'practicalTakeaways' | 'sources' | 'medicalCaveat'
> & {
  corePremises: [AdditionalCorePremise, AdditionalCorePremise, AdditionalCorePremise];
  practicalTakeaways: [
    AdditionalPracticalTakeaway,
    AdditionalPracticalTakeaway,
    AdditionalPracticalTakeaway,
  ];
  reflectionPrompts: [string, string, string];
  sources: [AdditionalBookSource, ...AdditionalBookSource[]];
  medicalCaveat?: string;
};

const DEFAULT_CAVEATS: Record<AdditionalBookTopic, string> = {
  'Anxiety & stress':
    'This guide is educational, not a diagnosis or treatment plan. Anxiety can have psychological, medical, medication-related, and situational causes. Seek qualified care for severe, persistent, or worsening symptoms, and do not attempt intense exposure exercises without appropriate support.',
  'Mood & self-compassion':
    'This guide cannot diagnose or treat depression or another mood condition. Personal practices may support care, but they do not replace assessment, therapy, medication review, or urgent help when safety is at risk.',
  'Habits & growth':
    'Behavior-change frameworks are not moral tests and may not account for illness, disability, neurodivergence, trauma, poverty, discrimination, caregiving, or unsafe conditions. Adapt or reject any practice that does not fit your context.',
  'Burnout & recovery':
    'Burnout language can overlap with depression, anxiety, sleep disorders, medication effects, and medical illness. Rest and workload changes may help, but persistent exhaustion or loss of functioning deserves qualified assessment.',
  Trauma:
    'Trauma material can be activating and is not a self-guided treatment protocol. Do not use this guide to recover memories, diagnose yourself or others, or force body-based or exposure practices. Pause and seek trauma-informed support if distress increases.',
  'Grief & loss':
    'Grief has no universal sequence or deadline. This guide does not diagnose prolonged grief, depression, or trauma and should not be used to pressure yourself to recover. Seek support when distress is overwhelming, persistent, or affects safety and basic functioning.',
  'Relationships & boundaries':
    'Relationship frameworks are not diagnoses and should not be used to label another person. Communication tools are not a substitute for safety planning; in coercive, threatening, or abusive situations, prioritize specialized support over joint exercises.',
};

function defineBook(seed: BookSeed): AdditionalBookDraft {
  return {
    ...seed,
    medicalCaveat: seed.medicalCaveat ?? DEFAULT_CAVEATS[seed.topic],
  };
}

export const ADDITIONAL_BOOKS: AdditionalBookDraft[] = [
  defineBook({
    id: 'unwinding-anxiety',
    title: 'Unwinding Anxiety',
    author: 'Judson Brewer',
    topic: 'Anxiety & stress',
    displayTags: ['Anxiety loops', 'Curiosity', 'Mindfulness'],
    readTimeMinutes: 14,
    summary:
      'Judson Brewer frames worry and many coping behaviors as learned habit loops. The guide focuses on mapping triggers, noticing the short- and long-term results of a response, and using curiosity to create room for a different choice.',
    centralPremise:
      'Anxiety can become self-reinforcing when a trigger leads to worry or avoidance that briefly feels protective. Change begins by observing the loop accurately, becoming disenchanted with responses that do not actually help, and practicing a more rewarding response such as curiosity.',
    corePremises: [
      {
        title: 'Map the loop before trying to stop it',
        premise:
          'A habit loop links a trigger, a behavior, and a result. Worry, checking, scrolling, or eating may become the behavior even when the original trigger is uncertainty or bodily tension.',
        whyItMatters:
          'Naming the sequence replaces a vague sense of failure with specific information about what is being learned and reinforced.',
        practice:
          'Record one recent episode as trigger, behavior, immediate result, and later result without trying to correct it yet.',
      },
      {
        title: 'Update the reward value',
        premise:
          'The brain keeps repeating actions it predicts will be rewarding. Paying close attention to the actual outcome can reveal that a familiar coping response brings less relief and more cost than expected.',
        whyItMatters:
          'A behavior is easier to release when its real consequences are felt clearly rather than argued against abstractly.',
        practice:
          'After a familiar coping behavior, notice what changed in your body and mind immediately and ten minutes later.',
      },
      {
        title: 'Curiosity can compete with fear',
        premise:
          'Curiosity invites contact with present sensations without demanding certainty or immediate escape. It is offered as a different reward, not a command to feel calm.',
        whyItMatters:
          'The goal becomes learning what is happening now instead of winning an argument with every anxious prediction.',
        practice:
          'Gently ask, "What does this feel like right now, and where do I notice it?" for three breaths.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Log one anxiety loop',
        description:
          'Choose one repeated pattern and observe its trigger, response, and consequences with neutral language.',
        nextStep:
          'During the next manageable episode, write four lines: trigger, behavior, immediate result, and later result.',
      },
      {
        title: 'Compare predicted and actual relief',
        description:
          'A coping response may promise safety while delivering only brief relief and a stronger loop later.',
        nextStep:
          'Rate expected relief before the response and actual relief ten minutes afterward on a 0 to 10 scale.',
      },
      {
        title: 'Use curiosity as an experiment',
        description:
          'Curiosity is not required to remove anxiety; it creates a small opening for new learning.',
        nextStep:
          'Try one brief curiosity check during mild anxiety and stop if close observation makes distress worse.',
      },
    ],
    reflectionPrompts: [
      'Which anxiety response gives quick relief but creates a larger cost later?',
      'What does the response promise, and what result does it actually deliver?',
      'Where could curiosity replace judgment for one manageable moment?',
    ],
    sources: [
      {
        label: 'Penguin Random House: Unwinding Anxiety',
        url: 'https://www.penguinrandomhouse.com/books/669748/unwinding-anxiety-by-judson-brewer-md-phd/9780593421406/',
        sourceType: 'publisher',
      },
      {
        label: 'NIMH: Anxiety disorders',
        url: 'https://www.nimh.nih.gov/health/topics/anxiety-disorders',
        sourceType: 'clinical-context',
      },
    ],
  }),
  defineBook({
    id: 'rewire-your-anxious-brain',
    title: 'Rewire Your Anxious Brain',
    author: 'Catherine M. Pittman & Elizabeth M. Karle',
    topic: 'Anxiety & stress',
    displayTags: ['Fear learning', 'Worry', 'Neuroscience'],
    readTimeMinutes: 14,
    summary:
      'Catherine Pittman and Elizabeth Karle distinguish fast, learned fear responses from language-heavy worry and rumination. The distinction is used to choose a response that matches the process rather than treating every form of anxiety the same way.',
    centralPremise:
      'Anxiety can emerge through rapid conditioned alarm or through interpretations and predictions. Understanding which pathway is active may help a person choose between body-based regulation and new learning on one hand, or examining and redirecting worry on the other.',
    corePremises: [
      {
        title: 'Fast alarm and verbal worry differ',
        premise:
          'Some fear reactions appear before a person can explain them, while others are sustained by imagined scenarios, interpretation, and rumination.',
        whyItMatters:
          'Trying to reason away a conditioned alarm may be frustrating, while treating every thought as irrelevant can miss a worry process that can be examined.',
        practice:
          'During a mild episode, note whether the first signal was a body alarm, an image, a verbal prediction, or a combination.',
      },
      {
        title: 'Avoidance protects the old prediction',
        premise:
          'Consistently escaping a safe but feared situation prevents the nervous system from learning that the expected outcome may not occur or can be tolerated.',
        whyItMatters:
          'New learning usually requires contact with manageable uncertainty, not only intellectual reassurance.',
        practice:
          'Identify the smallest safe step toward a feared situation and discuss pacing with a clinician when symptoms are severe.',
      },
      {
        title: 'The cortex can generate convincing stories',
        premise:
          'Language and imagination can simulate threats that are not present. Repeated analysis can feel productive while keeping attention locked on danger.',
        whyItMatters:
          'Recognizing worry as a mental process creates options besides answering every hypothetical question.',
        practice:
          'Label a recurring prediction as "a worry story" and return to one observable fact or chosen task.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Classify the first signal',
        description:
          'A rough distinction between body alarm and verbal worry can guide the next experiment.',
        nextStep:
          'For one week, record the first noticeable signal in three manageable anxiety episodes.',
      },
      {
        title: 'Match the response to the process',
        description:
          'Use grounding and gradual new learning for conditioned alarm; use attention and thinking skills for rumination.',
        nextStep:
          'Choose one low-risk response that fits the signal instead of cycling through every coping tool.',
      },
      {
        title: 'Keep neuroscience modest',
        description:
          'Brain labels are simplified teaching tools, not a scan of what is happening in one individual.',
        nextStep:
          'Describe the pattern in everyday language before using a brain-based explanation.',
      },
    ],
    reflectionPrompts: [
      'Does anxiety usually begin as a body alarm, a prediction, or both?',
      'Which avoidance behavior prevents you from gathering new information?',
      'What explanation helps without turning a simplified brain model into certainty?',
    ],
    sources: [
      {
        label: 'New Harbinger: Rewire Your Anxious Brain',
        url: 'https://www.newharbinger.com/9781648486388/rewire-your-anxious-brain/',
        sourceType: 'publisher',
      },
      {
        label: 'NIMH: Anxiety disorders',
        url: 'https://www.nimh.nih.gov/health/topics/anxiety-disorders',
        sourceType: 'clinical-context',
      },
    ],
  }),
  defineBook({
    id: 'anxiety-and-phobia-workbook',
    title: 'The Anxiety and Phobia Workbook',
    author: 'Edmund J. Bourne',
    topic: 'Anxiety & stress',
    displayTags: ['Anxiety skills', 'Exposure', 'Self-assessment'],
    readTimeMinutes: 16,
    summary:
      'Edmund Bourne presents a broad workbook spanning anxiety education, relaxation, self-talk, exposure, lifestyle factors, and relapse planning. Its breadth is best used to select a relevant skill rather than attempting every exercise at once.',
    centralPremise:
      'Anxiety is maintained by interacting patterns in physiology, attention, interpretation, avoidance, and daily context. A structured plan can target more than one maintaining factor while measuring whether the chosen practices are actually helping.',
    corePremises: [
      {
        title: 'Start with a pattern, not a global label',
        premise:
          'Different anxiety presentations involve different triggers, sensations, beliefs, avoidance patterns, and impairments.',
        whyItMatters:
          'A specific description makes it easier to choose a relevant exercise and to know when professional assessment is needed.',
        practice:
          'Describe one episode using situation, body sensations, thoughts, actions, duration, and impact.',
      },
      {
        title: 'Skills work as a coordinated plan',
        premise:
          'Breathing, relaxation, thinking skills, exposure, sleep, movement, and support address different parts of an anxiety pattern.',
        whyItMatters:
          'One technique failing does not prove that change is impossible; it may be poorly matched, poorly timed, or insufficient on its own.',
        practice:
          'Choose one skill for immediate arousal and one for the longer-term avoidance pattern.',
      },
      {
        title: 'Exposure requires pacing and learning',
        premise:
          'Approaching feared but reasonably safe situations can support new learning when steps are planned, repeated, and not overwhelmed by escape or coercion.',
        whyItMatters:
          'Exposure is not simply enduring maximum distress, and poorly designed attempts can backfire.',
        practice:
          'If appropriate, build a gradual hierarchy with a qualified clinician and define what new information each step can provide.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Build a one-page pattern map',
        description:
          'A concise map can connect symptoms, triggers, coping responses, and functional impact.',
        nextStep:
          'Complete one pattern map before selecting exercises from the workbook.',
      },
      {
        title: 'Choose fewer skills',
        description:
          'Depth and repetition are more informative than rapidly sampling a large toolkit.',
        nextStep:
          'Practice one matched skill for a week and record context, use, and outcome.',
      },
      {
        title: 'Set a care threshold',
        description:
          'Decide in advance which symptoms or impairments mean self-guided work is no longer enough.',
        nextStep:
          'Write down when you will contact a clinician, prescriber, or urgent support service.',
      },
    ],
    reflectionPrompts: [
      'Which part of your anxiety pattern causes the greatest functional cost?',
      'Which skill is most directly matched to that maintaining factor?',
      'What signs would tell you to stop self-guided work and seek assessment?',
    ],
    sources: [
      {
        label: 'New Harbinger: The Anxiety and Phobia Workbook',
        url: 'https://www.newharbinger.com/9781648485572/the-anxiety-and-phobia-workbook/',
        sourceType: 'publisher',
      },
      {
        label: 'NIMH: Anxiety disorders',
        url: 'https://www.nimh.nih.gov/health/topics/anxiety-disorders',
        sourceType: 'clinical-context',
      },
    ],
  }),
  defineBook({
    id: 'overcoming-unwanted-intrusive-thoughts',
    title: 'Overcoming Unwanted Intrusive Thoughts',
    author: 'Sally M. Winston & Martin N. Seif',
    topic: 'Anxiety & stress',
    displayTags: ['Intrusive thoughts', 'CBT', 'Shame reduction'],
    readTimeMinutes: 14,
    summary:
      'Sally Winston and Martin Seif explain why unwanted thoughts can become sticky when they are treated as evidence, danger, or a problem that must be eliminated. The book emphasizes reducing struggle, reassurance, and shame rather than proving the thought false every time.',
    centralPremise:
      'An intrusive thought is not the same as an intention, value, prediction, or action. Repeated suppression, analysis, checking, and reassurance can teach the mind that the thought is important, while a less alarmed response allows it to pass without becoming the center of behavior.',
    corePremises: [
      {
        title: 'Content does not equal character',
        premise:
          'Unwanted thoughts often target what a person most fears or values. Their presence alone does not establish desire, danger, or moral meaning.',
        whyItMatters:
          'Shame and self-surveillance can intensify attention to the thought and make ordinary mental noise feel diagnostic.',
        practice:
          'Use neutral language: "An unwanted thought showed up," without adding a conclusion about identity.',
      },
      {
        title: 'Suppression can increase salience',
        premise:
          'Monitoring whether a thought is gone requires repeatedly checking for it, which can keep it active and important.',
        whyItMatters:
          'The struggle to achieve complete mental control may become a larger problem than the original thought.',
        practice:
          'Allow a manageable thought to be present while continuing one ordinary, values-consistent activity.',
      },
      {
        title: 'Reassurance can become a ritual',
        premise:
          'Repeatedly asking whether the thought means something may bring brief relief while strengthening the demand for certainty.',
        whyItMatters:
          'Short-term relief can obscure the long-term cost of dependence on checking or another person response.',
        practice:
          'Delay one nonessential reassurance request and observe the urge without using the delay as another test.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Name the process neutrally',
        description:
          'Separate the occurrence of a thought from conclusions about intent, identity, or probability.',
        nextStep:
          'Write one sentence beginning, "I am noticing an unwanted thought about..." and stop before interpreting it.',
      },
      {
        title: 'Reduce one ritual',
        description:
          'Choose one checking, mental review, or reassurance behavior that keeps the cycle active.',
        nextStep:
          'Delay or shorten one low-risk ritual and record what happened to the urge over time.',
      },
      {
        title: 'Return to chosen behavior',
        description:
          'Progress is measured by what you do while the thought is present, not by forcing a blank mind.',
        nextStep:
          'Select one five-minute activity that reflects your values and continue it without resolving the thought.',
      },
    ],
    reflectionPrompts: [
      'What meaning do you automatically assign to the presence of the thought?',
      'Which response brings brief relief but keeps the thought important?',
      'What ordinary action would you choose if certainty were not required first?',
    ],
    sources: [
      {
        label: 'New Harbinger: Overcoming Unwanted Intrusive Thoughts',
        url: 'https://www.newharbinger.com/9781626254350/overcoming-unwanted-intrusive-thoughts/',
        sourceType: 'publisher',
      },
      {
        label: 'NIMH: Obsessive-compulsive disorder',
        url: 'https://www.nimh.nih.gov/health/topics/obsessive-compulsive-disorder-ocd',
        sourceType: 'clinical-context',
      },
    ],
    medicalCaveat:
      'This guide is educational and cannot determine why a thought is occurring. Intrusive thoughts can appear in several conditions and in people without a disorder. Seek qualified assessment when thoughts, rituals, distress, or functional impairment are severe; seek urgent help if there is actual intent or an immediate safety risk.',
  }),
  defineBook({
    id: 'needing-to-know-for-sure',
    title: 'Needing to Know for Sure',
    author: 'Martin N. Seif & Sally M. Winston',
    topic: 'Anxiety & stress',
    displayTags: ['Uncertainty', 'Checking', 'Reassurance'],
    readTimeMinutes: 13,
    summary:
      'Martin Seif and Sally Winston focus on compulsive checking and reassurance seeking. They distinguish useful information gathering from repeated attempts to obtain a feeling of absolute certainty that ordinary life cannot provide.',
    centralPremise:
      'Reassurance becomes self-reinforcing when it is used to eliminate every trace of doubt: relief arrives briefly, uncertainty returns, and the next check feels even more necessary. Recovery involves learning to make reasonable decisions without waiting for a permanent feeling of certainty.',
    corePremises: [
      {
        title: 'Information and reassurance have different jobs',
        premise:
          'Information supports a decision based on relevant facts; reassurance is often repeated after sufficient facts are already available because the desired feeling has not arrived.',
        whyItMatters:
          'The distinction prevents unlimited research from masquerading as careful decision-making.',
        practice:
          'Before searching or asking, write the decision, the fact still needed, and how that fact would change the decision.',
      },
      {
        title: 'Relief teaches repetition',
        premise:
          'Checking lowers distress in the moment, so the behavior is reinforced even though it reduces confidence in handling uncertainty later.',
        whyItMatters:
          'The cycle can continue despite the person knowing that another check is unlikely to add useful evidence.',
        practice:
          'Record the number of checks, relief duration, and whether any decision-relevant fact changed.',
      },
      {
        title: 'Reasonable confidence is enough',
        premise:
          'Many decisions must be made with incomplete information. The skill is tolerating residual uncertainty after proportionate due diligence.',
        whyItMatters:
          'Waiting for certainty can consume time, strain relationships, and delay meaningful action indefinitely.',
        practice:
          'Set a fact-based stopping rule before beginning research, then make the decision when the rule is met.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Write a stopping rule',
        description:
          'Define what adequate information looks like before anxiety moves the finish line.',
        nextStep:
          'For one low-stakes decision, set a time limit and list the two facts that are genuinely necessary.',
      },
      {
        title: 'Delay one repeat check',
        description:
          'A short delay can reveal that an urge changes without being obeyed.',
        nextStep:
          'Delay one non-safety-critical repeat check by ten minutes and track the urge at the start and end.',
      },
      {
        title: 'Answer with uncertainty',
        description:
          'A balanced response can acknowledge what is known and what cannot be guaranteed.',
        nextStep:
          'Practice saying, "I have enough information to proceed, even though I cannot know for sure."',
      },
    ],
    reflectionPrompts: [
      'Which repeated check is seeking a feeling rather than a new fact?',
      'What would proportionate due diligence look like in this situation?',
      'What cost does waiting for certainty create in your life or relationships?',
    ],
    sources: [
      {
        label: 'New Harbinger: Needing to Know for Sure',
        url: 'https://www.newharbinger.com/9781684033713/needing-to-know-for-sure/',
        sourceType: 'publisher',
      },
      {
        label: 'NIMH: Obsessive-compulsive disorder',
        url: 'https://www.nimh.nih.gov/health/topics/obsessive-compulsive-disorder-ocd',
        sourceType: 'clinical-context',
      },
    ],
  }),
  defineBook({
    id: 'mindfulness-acceptance-workbook-anxiety',
    title: 'The Mindfulness and Acceptance Workbook for Anxiety',
    author: 'John P. Forsyth & Georg H. Eifert',
    topic: 'Anxiety & stress',
    displayTags: ['ACT', 'Values', 'Acceptance'],
    readTimeMinutes: 16,
    summary:
      'John Forsyth and Georg Eifert use Acceptance and Commitment Therapy skills to shift the goal from controlling every anxious experience to building a fuller life. Mindfulness, acceptance, self-compassion, exposure, and values are organized around behavior that matters.',
    centralPremise:
      'Anxiety becomes especially restrictive when life is organized around avoiding it. Willing contact with manageable discomfort, grounded in present awareness and personally chosen values, can expand behavior even when fear and uncertainty remain.',
    corePremises: [
      {
        title: 'Control efforts have a workability test',
        premise:
          'A strategy should be evaluated by what it does to life over time, not only by whether it lowers discomfort for a few minutes.',
        whyItMatters:
          'Avoidance can look successful in the moment while steadily shrinking relationships, work, health, or meaning.',
        practice:
          'List what one control strategy gives you immediately and what it costs over a month.',
      },
      {
        title: 'Acceptance is active willingness',
        premise:
          'Acceptance means allowing an internal experience that is already present while choosing behavior deliberately; it does not mean liking danger or tolerating mistreatment.',
        whyItMatters:
          'This keeps the skill from becoming resignation or another demand to feel calm.',
        practice:
          'For thirty seconds, notice one manageable sensation and soften the struggle around it without trying to increase it.',
      },
      {
        title: 'Values orient exposure',
        premise:
          'Approaching a fear is more meaningful when it serves a relationship, role, or quality of action the person genuinely cares about.',
        whyItMatters:
          'Values provide direction when anxiety cannot promise a comfortable or certain outcome.',
        practice:
          'Complete, "I am willing to feel some discomfort in order to move toward..." and name one safe step.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Run a workability review',
        description:
          'Evaluate one coping strategy by both immediate relief and long-term effect on your life.',
        nextStep:
          'Create two columns titled "helps now" and "costs later" for one recurring avoidance pattern.',
      },
      {
        title: 'Name a value as behavior',
        description:
          'Values become usable when translated from abstract nouns into qualities of action.',
        nextStep:
          'Turn one value into a phrase such as "listen with care" or "act with curiosity."',
      },
      {
        title: 'Choose a willing step',
        description:
          'Take a manageable action because it matters, not as a test that anxiety must disappear.',
        nextStep:
          'Schedule one small, safe, value-linked action and define success as showing up.',
      },
    ],
    reflectionPrompts: [
      'Which anxiety-control strategy narrows life the most over time?',
      'What value would make a manageable amount of discomfort worth carrying?',
      'How will you define success without requiring anxiety to disappear?',
    ],
    sources: [
      {
        label: 'New Harbinger: Mindfulness and Acceptance Workbook for Anxiety',
        url: 'https://www.newharbinger.com/9781648484476/the-mindfulness-and-acceptance-workbook-for-anxiety/',
        sourceType: 'publisher',
      },
      {
        label: 'Association for Contextual Behavioral Science: self-help books',
        url: 'https://contextualscience.org/selfhelp_books',
        sourceType: 'research',
      },
    ],
  }),
  defineBook({
    id: 'get-out-of-your-mind-and-into-your-life',
    title: 'Get Out of Your Mind and Into Your Life',
    author: 'Steven C. Hayes & Spencer Smith',
    topic: 'Anxiety & stress',
    displayTags: ['ACT', 'Defusion', 'Committed action'],
    readTimeMinutes: 15,
    summary:
      'Steven Hayes and Spencer Smith introduce Acceptance and Commitment Therapy through exercises on avoidance, defusion, present-moment attention, values, and committed action. The workbook asks whether behavior serves a chosen life direction rather than whether every thought feels resolved.',
    centralPremise:
      'Painful thoughts and feelings need not be removed before meaningful action begins. Psychological flexibility grows when a person can notice inner experience, loosen literal attachment to thoughts, contact the present, and choose behavior in service of values.',
    corePremises: [
      {
        title: 'Experiential avoidance has a cost',
        premise:
          'Efforts to eliminate internal pain can become rigid and consume the time, attention, and opportunities that make life meaningful.',
        whyItMatters:
          'The relevant question is not whether avoidance ever helps, but whether it dominates behavior and works over time.',
        practice:
          'Identify one thing you stopped doing mainly to avoid a thought, feeling, memory, or sensation.',
      },
      {
        title: 'Defusion changes the relationship to thought',
        premise:
          'A thought can be noticed as language produced by the mind rather than automatically followed as a command or accepted as a complete description.',
        whyItMatters:
          'Distance creates choice without requiring an argument about whether the thought is true in every possible sense.',
        practice:
          'Repeat a difficult thought after the phrase, "My mind is offering the story that..."',
      },
      {
        title: 'Committed action is adjustable',
        premise:
          'Values guide repeated action, while specific goals and methods can change when context, health, or new information changes.',
        whyItMatters:
          'Flexibility avoids turning a values practice into perfectionism or another rigid rule.',
        practice:
          'Choose one ten-minute value-linked action and a smaller backup version for a difficult day.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Spot the control agenda',
        description:
          'Notice where life has become organized around not feeling a particular internal experience.',
        nextStep:
          'Write one sentence: "I keep waiting to do ___ until I no longer feel ___."',
      },
      {
        title: 'Practice one defusion phrase',
        description:
          'Use language that helps you see a thought without automatically obeying it.',
        nextStep:
          'Use one defusion phrase once a day with a recurring, non-crisis thought.',
      },
      {
        title: 'Make values observable',
        description:
          'Convert one value into a small action that another person could see.',
        nextStep:
          'Schedule one value-linked action and define a smaller safe version in advance.',
      },
    ],
    reflectionPrompts: [
      'What are you postponing until your internal experience changes?',
      'Which thought most often acts like a command?',
      'What ten-minute action would express a chosen value today?',
    ],
    sources: [
      {
        label: 'New Harbinger: Get Out of Your Mind and Into Your Life',
        url: 'https://www.newharbinger.com/9781648487767/get-out-of-your-mind-and-into-your-life/',
        sourceType: 'publisher',
      },
      {
        label: 'Association for Contextual Behavioral Science: self-help books',
        url: 'https://contextualscience.org/selfhelp_books',
        sourceType: 'research',
      },
    ],
  }),
  defineBook({
    id: 'a-liberated-mind',
    title: 'A Liberated Mind',
    author: 'Steven C. Hayes',
    topic: 'Anxiety & stress',
    displayTags: ['Psychological flexibility', 'Values', 'Perspective'],
    readTimeMinutes: 15,
    summary:
      'Steven Hayes presents psychological flexibility as a set of learnable pivots: opening to experience, noticing thoughts, contacting a broader sense of self, attending to the present, clarifying values, and building habits around committed action.',
    centralPremise:
      'Suffering often intensifies when people become entangled with thoughts, avoid vulnerability, or lose contact with values. Flexible attention and action can help a person turn toward what is difficult while still choosing a meaningful direction.',
    corePremises: [
      {
        title: 'Turn toward vulnerability with choice',
        premise:
          'Pain often points toward something that matters, but approaching it should be voluntary, paced, and connected to a purpose rather than forced.',
        whyItMatters:
          'This reframes vulnerability as information and a possible doorway, not as weakness or proof that distress is beneficial.',
        practice:
          'Name one difficult feeling and the value or relationship that may explain why it matters.',
      },
      {
        title: 'Perspective is larger than content',
        premise:
          'A person can notice changing thoughts, roles, and emotions from a perspective that is not exhausted by any single story.',
        whyItMatters:
          'A broader perspective can reduce the pressure to define the entire self by one moment or judgment.',
        practice:
          'List three different stories your mind has told about the same event and note that you observed all three.',
      },
      {
        title: 'Values need behavioral habits',
        premise:
          'Values become influential when they repeatedly shape small decisions, environmental supports, and recovery after lapses.',
        whyItMatters:
          'Insight without a behavior path can remain inspiring but inert.',
        practice:
          'Choose one recurring cue that can prompt a two-minute value-consistent action.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Link pain to care',
        description:
          'Explore whether a difficult emotion points toward a value without romanticizing the pain.',
        nextStep:
          'Complete: "This hurts in part because I care about..." and name one safe response.',
      },
      {
        title: 'Use a perspective pause',
        description:
          'Notice that a story is present without turning it into the full definition of you.',
        nextStep:
          'Write the thought, then add, "This is one perspective my mind is producing right now."',
      },
      {
        title: 'Install one values cue',
        description:
          'Connect a tiny chosen action to an event that already occurs.',
        nextStep:
          'After one daily cue, perform a two-minute action that expresses a chosen quality.',
      },
    ],
    reflectionPrompts: [
      'What value may be underneath a painful feeling without making the pain necessary?',
      'Which self-story has become too narrow or literal?',
      'What existing cue could support one repeatable values-based action?',
    ],
    sources: [
      {
        label: 'Penguin Random House: A Liberated Mind',
        url: 'https://www.penguinrandomhouse.com/books/549319/a-liberated-mind-by-steven-c-hayes-phd/9780735214026/',
        sourceType: 'publisher',
      },
      {
        label: 'Association for Contextual Behavioral Science',
        url: 'https://contextualscience.org/',
        sourceType: 'research',
      },
    ],
  }),
  defineBook({
    id: 'mind-over-mood',
    title: 'Mind Over Mood',
    author: 'Dennis Greenberger & Christine A. Padesky',
    topic: 'Mood & self-compassion',
    displayTags: ['CBT', 'Thought records', 'Behavior'],
    readTimeMinutes: 16,
    summary:
      'Dennis Greenberger and Christine Padesky offer a structured Cognitive Behavioral Therapy workbook for connecting situations, moods, thoughts, physical reactions, and actions. The method emphasizes testing interpretations and building alternative responses rather than demanding positive thinking.',
    centralPremise:
      'Emotional reactions are influenced by the meanings assigned to events and by patterns of behavior. Writing the sequence down makes automatic interpretations visible, allows evidence to be evaluated, and supports targeted behavioral experiments.',
    corePremises: [
      {
        title: 'Separate the parts of an episode',
        premise:
          'Situation, emotion, body response, thought, and behavior interact but are not interchangeable.',
        whyItMatters:
          'Precision prevents a conclusion such as "I felt rejected, therefore I was rejected" from hiding the step where meaning was assigned.',
        practice:
          'Write one event using five headings: situation, emotions, body, automatic thoughts, and actions.',
      },
      {
        title: 'Test thoughts rather than replace them reflexively',
        premise:
          'A balanced thought accounts for evidence that supports and does not support the original interpretation; it is not forced optimism.',
        whyItMatters:
          'A believable alternative is more useful than a positive statement the person immediately rejects.',
        practice:
          'List observable evidence on both sides, then write the most complete statement those facts support.',
      },
      {
        title: 'Behavior provides new evidence',
        premise:
          'A small planned action can test a prediction and change mood through experience, even before thinking feels fully resolved.',
        whyItMatters:
          'Rumination alone may never produce the information needed to update a belief.',
        practice:
          'Turn one prediction into a safe experiment with a specific action and an observable result.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Complete one thought record',
        description:
          'Use one recent, specific event instead of analyzing your whole personality or history at once.',
        nextStep:
          'Complete the five-part event map and rate each emotion from 0 to 100.',
      },
      {
        title: 'Write a balanced conclusion',
        description:
          'Include all relevant evidence and uncertainty rather than swinging from negative to unrealistically positive.',
        nextStep:
          'Draft one alternative thought you can believe at least halfway.',
      },
      {
        title: 'Design a behavioral test',
        description:
          'Gather information through one bounded action instead of continued mental debate.',
        nextStep:
          'Write the prediction, action, safety boundary, and result you will observe.',
      },
    ],
    reflectionPrompts: [
      'Which part of the event are you treating as a fact when it is actually an interpretation?',
      'What evidence does the original thought leave out?',
      'What safe action could produce information that rumination cannot?',
    ],
    sources: [
      {
        label: 'Guilford Press: Mind Over Mood',
        url: 'https://www.guilford.com/search/9781462520428',
        sourceType: 'publisher',
      },
      {
        label: 'Mind Over Mood official resources',
        url: 'https://mindovermood.com/2nd-edition-mind-over-mood/',
        sourceType: 'author',
      },
    ],
  }),
  defineBook({
    id: 'cognitive-behavioral-therapy-made-simple',
    title: 'Cognitive Behavioral Therapy Made Simple',
    author: 'Seth J. Gillihan',
    topic: 'Mood & self-compassion',
    displayTags: ['CBT', 'Goals', 'Practice'],
    readTimeMinutes: 14,
    summary:
      'Seth Gillihan introduces CBT through practical work on goals, behavior, thoughts, mindfulness, procrastination, worry, and relapse prevention. The guide is most useful as a structured introduction, not as a substitute for individualized formulation.',
    centralPremise:
      'Thoughts, actions, emotions, and attention influence one another, so change can begin at more than one point in the cycle. Clear goals, repeated practice, and review of results turn broad intentions into learnable experiments.',
    corePremises: [
      {
        title: 'Define the problem behaviorally',
        premise:
          'A workable goal describes what will be different in daily life rather than only naming a symptom that should disappear.',
        whyItMatters:
          'Observable goals make progress easier to notice and reduce all-or-nothing judgments.',
        practice:
          'Translate "feel better" into one activity, routine, or situation you want to handle differently.',
      },
      {
        title: 'Action can precede motivation',
        premise:
          'Waiting to feel ready can maintain withdrawal or procrastination; a planned, manageable action can create momentum and information.',
        whyItMatters:
          'This offers another entry point when arguing with thoughts feels exhausting or ineffective.',
        practice:
          'Choose a task that takes five minutes and schedule the exact start time.',
      },
      {
        title: 'Maintenance requires review',
        premise:
          'Skills are more durable when people identify triggers for old patterns, early warning signs, and a plan for restarting after lapses.',
        whyItMatters:
          'A lapse becomes expected data rather than proof that the entire effort failed.',
        practice:
          'Write three early warning signs and the smallest helpful response to each.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Write one observable goal',
        description:
          'Define a change in behavior, frequency, or participation that can be reviewed.',
        nextStep:
          'Complete: "Over the next seven days, I will..." with a specific, safe action.',
      },
      {
        title: 'Use the smallest entry point',
        description:
          'Begin with behavior when mood or confidence is not yet available.',
        nextStep:
          'Schedule one five-minute version and give yourself permission to stop when it is complete.',
      },
      {
        title: 'Create a restart plan',
        description:
          'Decide how you will notice and respond when the old cycle returns.',
        nextStep:
          'Write one early warning sign, one support contact, and one minimum action.',
      },
    ],
    reflectionPrompts: [
      'What would improvement look like in observable daily behavior?',
      'Which five-minute action could happen before motivation arrives?',
      'What is your smallest credible restart after a lapse?',
    ],
    sources: [
      {
        label: 'Seth Gillihan: Cognitive Behavioral Therapy Made Simple',
        url: 'https://sethgillihan.com/books/cognitive-behavioral-therapy-made-simple/',
        sourceType: 'author',
      },
      {
        label: 'NIMH: Psychotherapies',
        url: 'https://www.nimh.nih.gov/health/topics/psychotherapies',
        sourceType: 'clinical-context',
      },
    ],
  }),
  defineBook({
    id: 'the-upward-spiral',
    title: 'The Upward Spiral',
    author: 'Alex Korb',
    topic: 'Mood & self-compassion',
    displayTags: ['Depression', 'Neuroscience', 'Small actions'],
    readTimeMinutes: 15,
    summary:
      'Alex Korb uses accessible neuroscience to explain why depression can feel self-reinforcing and why modest changes in movement, sleep routines, social contact, decision-making, and attention may help interrupt that pattern. The neuroscience is a framing device, not a way to diagnose an individual brain.',
    centralPremise:
      'Mood, behavior, attention, physiology, and environment can reinforce one another in either direction. A person does not need to solve every cause at once; one feasible action can alter part of the system and make the next helpful action more available.',
    corePremises: [
      {
        title: 'Small changes can influence a larger system',
        premise:
          'Depressive patterns involve interacting loops rather than one isolated failure of motivation, thinking, or willpower.',
        whyItMatters:
          'This reduces the pressure to find a single perfect intervention before doing anything useful.',
        practice:
          'Choose one controllable point in the day, such as getting outside, eating, or contacting someone, and make it slightly easier.',
      },
      {
        title: 'Decisions can reduce unresolved load',
        premise:
          'Avoided choices can keep uncertainty active, while a good-enough decision can free attention even when no option is perfect.',
        whyItMatters:
          'Rumination often presents itself as problem-solving while postponing the action that could provide relief or information.',
        practice:
          'Set a short decision window, name the minimum criteria, and choose the option that meets them.',
      },
      {
        title: 'Social and physical actions are legitimate entry points',
        premise:
          'Movement, daylight, sleep regularity, touch, gratitude, and connection can affect mood-related systems without requiring a person to first think positively.',
        whyItMatters:
          'Behavioral entry points remain available when concentration and cognitive effort are limited.',
        practice:
          'Select one low-demand action and track whether it changes energy or distress by even one point.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Pick one leverage point',
        description:
          'Work on one part of the daily system instead of trying to overhaul mood, sleep, exercise, and relationships together.',
        nextStep:
          'Choose one five-minute action for tomorrow and specify when and where it will happen.',
      },
      {
        title: 'Make one good-enough decision',
        description:
          'Reduce the cognitive burden of an unresolved low-stakes choice.',
        nextStep:
          'List two minimum criteria, set a ten-minute deadline, and decide when the timer ends.',
      },
      {
        title: 'Record movement, not perfection',
        description:
          'Notice small shifts so improvement is not erased by all-or-nothing evaluation.',
        nextStep:
          'Before and after one activity, rate mood and energy from 0 to 10 without requiring either score to improve.',
      },
    ],
    reflectionPrompts: [
      'Which part of your daily loop is both influential and realistically changeable today?',
      'What unresolved decision is consuming more attention than its stakes justify?',
      'Which action has occasionally shifted your energy, even when it did not change your whole mood?',
    ],
    sources: [
      {
        label: 'New Harbinger: The Upward Spiral',
        url: 'https://www.newharbinger.com/9781648486869/the-upward-spiral/',
        sourceType: 'publisher',
      },
      {
        label: 'NIMH: Depression',
        url: 'https://www.nimh.nih.gov/health/topics/depression',
        sourceType: 'clinical-context',
      },
    ],
  }),
  defineBook({
    id: 'the-noonday-demon',
    title: 'The Noonday Demon',
    author: 'Andrew Solomon',
    topic: 'Mood & self-compassion',
    displayTags: ['Depression', 'Lived experience', 'Care systems'],
    readTimeMinutes: 17,
    summary:
      'Andrew Solomon combines memoir, interviews, history, science, policy, and cultural reporting to examine depression at personal and societal scales. The book resists simple explanations and shows how illness, identity, treatment access, stigma, and material conditions interact.',
    centralPremise:
      'Depression is not adequately explained by weakness, one chemical story, or one universal life narrative. Understanding it requires attention to biological vulnerability, psychological experience, relationships, culture, poverty, politics, and the uneven availability of effective care.',
    corePremises: [
      {
        title: 'Depression is heterogeneous',
        premise:
          'People described by the same diagnostic label can have different symptoms, histories, resources, risks, and responses to treatment.',
        whyItMatters:
          'A single person’s recovery story should not be treated as a prescription or a standard others have failed to meet.',
        practice:
          'Separate what is true in your experience from what belongs to someone else’s account.',
      },
      {
        title: 'Context shapes suffering and access to care',
        premise:
          'Poverty, stigma, isolation, discrimination, and health-system barriers can deepen distress and constrain the choices available.',
        whyItMatters:
          'A purely individual self-help frame can mistake structural limits for personal unwillingness.',
        practice:
          'Name one internal burden and one environmental barrier instead of collapsing them into one judgment about yourself.',
      },
      {
        title: 'Treatment can be plural and iterative',
        premise:
          'Medication, psychotherapy, social support, routine, meaning, and practical assistance may each matter, with no universal combination.',
        whyItMatters:
          'Needing adjustment, another opinion, or more than one form of support is not evidence that care has failed.',
        practice:
          'Keep a concise record of symptoms, function, benefits, and side effects to support a qualified care conversation.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Reject one-cause explanations',
        description:
          'Use a multi-factor map rather than blaming character or assuming one biological story explains everything.',
        nextStep:
          'List biological, psychological, social, and practical factors that may be relevant, marking uncertainty clearly.',
      },
      {
        title: 'Track function as well as feeling',
        description:
          'Changes in sleep, eating, concentration, work, care tasks, and connection may be important even when mood words are hard to choose.',
        nextStep:
          'Record one mood rating and two daily-function indicators for the next three days.',
      },
      {
        title: 'Prepare a care summary',
        description:
          'A short factual history can make a clinical conversation more useful.',
        nextStep:
          'Write when the change began, what has worsened or helped, current medications, and any safety concerns.',
      },
    ],
    reflectionPrompts: [
      'Which explanation for depression have you treated as complete when it may be only partial?',
      'What practical or social condition is affecting your ability to recover?',
      'What would a clinician need to know about your daily functioning, not only your mood?',
    ],
    sources: [
      {
        label: 'Andrew Solomon: The Noonday Demon',
        url: 'https://andrewsolomon.com/books/the-noonday-demon/',
        sourceType: 'author',
      },
      {
        label: 'NIMH: Depression',
        url: 'https://www.nimh.nih.gov/health/topics/depression',
        sourceType: 'clinical-context',
      },
    ],
    medicalCaveat:
      'This guide discusses depression but cannot determine whether you have it or which treatment is appropriate. Severe symptoms, inability to meet basic needs, new agitation, psychosis, mania-like symptoms, or thoughts of self-harm require prompt professional assessment; immediate danger requires emergency help.',
  }),
  defineBook({
    id: 'reasons-to-stay-alive',
    title: 'Reasons to Stay Alive',
    author: 'Matt Haig',
    topic: 'Mood & self-compassion',
    displayTags: ['Memoir', 'Hope', 'Depression'],
    readTimeMinutes: 13,
    summary:
      'Matt Haig’s memoir describes his experience of depression, panic, suicidal crisis, gradual recovery, and the ordinary anchors that helped him remain connected to life. Its value is companionship and perspective, not a universal recovery formula.',
    centralPremise:
      'A mind in severe distress can make the present feel permanent and erase access to alternative futures. Time, care, connection, treatment, and small sensory or relational anchors can make space for a future the person cannot yet imagine.',
    corePremises: [
      {
        title: 'A crisis narrows the visible future',
        premise:
          'Intense depression or panic can make current pain feel endless even though mental states and circumstances can change.',
        whyItMatters:
          'The inability to picture improvement is a feature of the moment, not reliable proof that improvement is impossible.',
        practice:
          'Borrow a shorter time horizon: focus on staying connected and safe through the next hour rather than solving a lifetime.',
      },
      {
        title: 'Personal anchors can be ordinary',
        premise:
          'Reasons to continue may include people, places, art, food, animals, curiosity, responsibilities, or experiences still unknown.',
        whyItMatters:
          'An anchor does not have to be grand, philosophical, or persuasive to anyone else.',
        practice:
          'Write three specific things that make the next day more inhabitable, however small.',
      },
      {
        title: 'Memoir offers recognition, not instruction',
        premise:
          'Another person’s account can reduce isolation while still differing from your symptoms, resources, treatment needs, and pace.',
        whyItMatters:
          'Readers can take comfort without concluding they should recover in the same way.',
        practice:
          'Mark passages or ideas as “recognizes me,” “does not fit,” or “worth discussing” rather than true or false for everyone.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Build a personal anchor list',
        description:
          'Create a concrete list that remains available when distress makes recall difficult.',
        nextStep:
          'Write five people, sensations, places, routines, or future moments that can help you reach the next safe interval.',
      },
      {
        title: 'Reduce the time horizon',
        description:
          'Replace an impossible demand to fix everything with the next safety-preserving action.',
        nextStep:
          'Choose who you can contact and where you can be for the next hour if distress rises.',
      },
      {
        title: 'Share the hard sentence',
        description:
          'Specific language helps another person understand the seriousness of the moment.',
        nextStep:
          'Draft: “I am having a hard time staying safe and need you to stay with me while we get help.”',
      },
    ],
    reflectionPrompts: [
      'What does distress make feel permanent even though it has changed before?',
      'Which ordinary experience would you like to remain available to encounter again?',
      'Who can help hold hope or make decisions when you cannot access either alone?',
    ],
    sources: [
      {
        label: 'Penguin Random House: Reasons to Stay Alive',
        url: 'https://www.penguinrandomhouse.com/books/529836/reasons-to-stay-alive-by-matt-haig/',
        sourceType: 'publisher',
      },
      {
        label: 'NIMH: Depression',
        url: 'https://www.nimh.nih.gov/health/topics/depression',
        sourceType: 'clinical-context',
      },
    ],
    medicalCaveat:
      'This memoir is not a crisis plan or treatment. If you may act on thoughts of suicide or cannot stay safe, contact local emergency services or a verified crisis service now and involve a trusted person who can remain with you. Do not rely on this guide or the app during an emergency.',
  }),
  defineBook({
    id: 'self-compassion',
    title: 'Self-Compassion',
    author: 'Kristin Neff',
    topic: 'Mood & self-compassion',
    displayTags: ['Self-kindness', 'Common humanity', 'Mindfulness'],
    readTimeMinutes: 15,
    summary:
      'Kristin Neff presents self-compassion as a trainable response to difficulty built from mindfulness, common humanity, and kindness toward oneself. The approach is not passive approval; it asks what response would be both caring and constructive.',
    centralPremise:
      'People can acknowledge pain and responsibility without using contempt as motivation. A compassionate stance notices suffering clearly, remembers that struggle is part of human life, and offers the support needed to act wisely rather than defensively.',
    corePremises: [
      {
        title: 'Mindfulness names pain without becoming the whole story',
        premise:
          'Self-compassion begins by recognizing that a difficult experience is happening without minimizing it or defining the entire self by it.',
        whyItMatters:
          'Accurate naming creates enough distance to choose a response instead of automatically escalating shame.',
        practice:
          'Use one factual sentence: “This is a moment of disappointment,” rather than a global identity judgment.',
      },
      {
        title: 'Common humanity counters isolating shame',
        premise:
          'Mistakes, inadequacy, loss, and uncertainty are widespread human experiences even when the details are personal.',
        whyItMatters:
          'Remembering shared fallibility can reduce the belief that struggle proves uniquely defective character.',
        practice:
          'Name the broader human need or difficulty beneath the event without comparing whose pain is worse.',
      },
      {
        title: 'Kindness can include accountability',
        premise:
          'A caring response may involve rest, protection, repair, practice, an apology, or a difficult boundary.',
        whyItMatters:
          'Self-compassion is more useful when it supports wise action rather than being confused with avoidance or indulgence.',
        practice:
          'Ask what you need to hear and what responsible next action that support would make possible.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Use the three-part pause',
        description:
          'Respond to one difficult moment with mindfulness, shared humanity, and kindness.',
        nextStep:
          'Write one sentence for what hurts, one for how this is human, and one for the support you need.',
      },
      {
        title: 'Change the motivational voice',
        description:
          'Keep the useful standard while removing humiliation and threat.',
        nextStep:
          'Rewrite one self-critical instruction as firm guidance you would give someone you respect.',
      },
      {
        title: 'Pair care with repair',
        description:
          'Let compassion create the stability needed to address an impact or mistake.',
        nextStep:
          'Choose one repair action that is specific, proportionate, and within your control.',
      },
    ],
    reflectionPrompts: [
      'What fact about this situation can you acknowledge without turning it into a verdict on your worth?',
      'How would you speak to someone you respect who made the same mistake?',
      'What caring response would make responsible action more possible, not less?',
    ],
    sources: [
      {
        label: 'Kristin Neff: Self-Compassion resources',
        url: 'https://self-compassion.org/',
        sourceType: 'author',
      },
      {
        label: 'Self-Compassion research overview',
        url: 'https://self-compassion.org/the-research/',
        sourceType: 'research',
      },
    ],
  }),
  defineBook({
    id: 'fierce-self-compassion',
    title: 'Fierce Self-Compassion',
    author: 'Kristin Neff',
    topic: 'Mood & self-compassion',
    displayTags: ['Boundaries', 'Agency', 'Self-compassion'],
    readTimeMinutes: 15,
    summary:
      'Kristin Neff extends self-compassion beyond soothing to include protection, boundary-setting, meeting needs, and motivated change. The book particularly examines how gendered social expectations can discourage anger, agency, and self-protection.',
    centralPremise:
      'Compassion has a tender form that comforts pain and a fierce form that protects, provides, and motivates. Sustainable care may require both: warmth toward the person who is hurting and decisive action toward the conditions causing harm.',
    corePremises: [
      {
        title: 'Compassion can protect',
        premise:
          'A caring response is not always gentle accommodation; it can mean saying no, leaving, naming harm, or seeking support.',
        whyItMatters:
          'People taught to preserve harmony at personal cost may misread self-erasure as kindness.',
        practice:
          'Identify one recurring situation where protecting your time, body, values, or safety is the compassionate response.',
      },
      {
        title: 'Anger can carry information without controlling behavior',
        premise:
          'Anger may signal violation, unfairness, or blocked needs, while still requiring careful choices about expression and action.',
        whyItMatters:
          'Suppressing all anger loses information; acting from it impulsively can create additional harm.',
        practice:
          'Name what the anger is protecting, then choose a response consistent with safety and long-term values.',
      },
      {
        title: 'Motivation need not depend on shame',
        premise:
          'Fierce compassion can set high standards while treating setbacks as information and preserving dignity.',
        whyItMatters:
          'Threat-based motivation may produce bursts of effort but can also fuel avoidance, exhaustion, and fear of failure.',
        practice:
          'State the standard, the reason it matters, and the next learnable step without attacking identity.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Write a protective boundary',
        description:
          'Translate a vague wish for respect into a clear statement of what you will do.',
        nextStep:
          'Complete: “When this happens, I will…” using an action you control and can carry out safely.',
      },
      {
        title: 'Decode one anger signal',
        description:
          'Use anger as data before deciding how to respond.',
        nextStep:
          'Write what happened, what value or need was affected, and the safest proportionate response.',
      },
      {
        title: 'Use a compassionate standard',
        description:
          'Keep accountability while removing identity-based attack.',
        nextStep:
          'Rewrite one demand as: “This matters because…, and my next practice is…”',
      },
    ],
    reflectionPrompts: [
      'Where have you confused being caring with making yourself continuously available?',
      'What value or need is your anger trying to protect?',
      'What would firm, non-shaming accountability sound like in this situation?',
    ],
    sources: [
      {
        label: 'Kristin Neff: Books',
        url: 'https://self-compassion.org/books-by-kristin-neff/',
        sourceType: 'author',
      },
      {
        label: 'Kristin Neff: Self-Compassion research overview',
        url: 'https://self-compassion.org/the-research/',
        sourceType: 'research',
      },
    ],
  }),
  defineBook({
    id: 'the-mindful-self-compassion-workbook',
    title: 'The Mindful Self-Compassion Workbook',
    author: 'Kristin Neff and Christopher Germer',
    topic: 'Mood & self-compassion',
    displayTags: ['Workbook', 'Mindfulness', 'Self-kindness'],
    readTimeMinutes: 16,
    summary:
      'Kristin Neff and Christopher Germer provide a structured sequence of mindful self-compassion exercises, including compassionate language, difficult-emotion practices, values, relationships, caregiving, and savoring. Exercises are invitations to test, not requirements to endure distress.',
    centralPremise:
      'Self-compassion becomes more accessible through repeated experiential practice rather than intellectual agreement alone. Mindful awareness helps a person stay in contact with difficulty, while compassionate language and action change how that difficulty is held.',
    corePremises: [
      {
        title: 'Practice should remain within a workable range',
        premise:
          'Compassion exercises can soothe some people and initially intensify grief, shame, or threat for others, especially when care has been unsafe or unfamiliar.',
        whyItMatters:
          'Forcing a supposedly helpful exercise can reproduce self-criticism and make dysregulation worse.',
        practice:
          'Use the least activating version, keep eyes open if helpful, orient to the room, and stop when distress keeps rising.',
      },
      {
        title: 'Supportive touch and language are experiments',
        premise:
          'Tone, posture, phrases, and physical gestures may influence how the nervous system receives a moment of care.',
        whyItMatters:
          'Different people need different forms of support; one scripted phrase or gesture will not feel safe or authentic for everyone.',
        practice:
          'Test two neutral phrases or gestures and keep only what feels credible and stabilizing.',
      },
      {
        title: 'Compassion includes receiving what is good',
        premise:
          'The program pairs care for pain with gratitude, savoring, and appreciation, without using positive experience to deny difficulty.',
        whyItMatters:
          'Allowing pleasant moments to register can broaden attention while respecting that pain is still present.',
        practice:
          'Notice one pleasant sensory detail for ten seconds and describe it without demanding a mood change.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Create a safe practice menu',
        description:
          'Identify several forms of compassionate support so one difficult exercise is never the only option.',
        nextStep:
          'List one phrase, gesture, place, person, and activity that can offer low-intensity support.',
      },
      {
        title: 'Run a two-minute experiment',
        description:
          'Use a brief practice and evaluate its effect instead of assuming it should help.',
        nextStep:
          'Try one neutral compassionate phrase for two minutes, then record whether distress fell, stayed, or rose.',
      },
      {
        title: 'Let a good moment register',
        description:
          'Practice noticing something pleasant without invalidating what remains hard.',
        nextStep:
          'Describe one sound, taste, sight, or sensation you appreciated today and what made it noticeable.',
      },
    ],
    reflectionPrompts: [
      'Which forms of care feel supportive, neutral, uncomfortable, or unsafe to you?',
      'What phrase sounds genuinely kind without feeling exaggerated?',
      'How can you let one pleasant moment matter without using it to cancel pain?',
    ],
    sources: [
      {
        label: 'Guilford Press: The Mindful Self-Compassion Workbook',
        url: 'https://www.guilford.com/books/The-Mindful-Self-Compassion-Workbook/Neff-Germer/9781462526789/authors',
        sourceType: 'publisher',
      },
      {
        label: 'Center for Mindful Self-Compassion',
        url: 'https://centerformsc.org/',
        sourceType: 'author',
      },
    ],
  }),
  defineBook({
    id: 'learned-optimism',
    title: 'Learned Optimism',
    author: 'Martin E. P. Seligman',
    topic: 'Mood & self-compassion',
    displayTags: ['Explanatory style', 'Setbacks', 'Evidence'],
    readTimeMinutes: 16,
    summary:
      'Martin Seligman examines how habitual explanations for setbacks can affect persistence, mood, and behavior. The useful practice is not indiscriminate positivity but checking whether a negative explanation is permanent, pervasive, and personal beyond what evidence supports.',
    centralPremise:
      'People can learn to notice pessimistic interpretations and dispute the parts that are inaccurate or overgeneralized. More flexible explanations preserve the ability to respond to a specific problem without turning it into proof that every domain, every future attempt, or the whole self is doomed.',
    corePremises: [
      {
        title: 'Explanations differ in scope and duration',
        premise:
          'A setback can be interpreted as temporary or permanent, specific or pervasive, and influenced by many factors or entirely caused by a defective self.',
        whyItMatters:
          'Permanent and global explanations can suppress effort even when the actual problem is limited and changeable.',
        practice:
          'Underline words such as always, never, everything, and nothing, then test whether each matches the facts.',
      },
      {
        title: 'Disputation should use evidence',
        premise:
          'A more hopeful explanation is useful when it is more accurate, not merely because it sounds positive.',
        whyItMatters:
          'Forced optimism can dismiss real constraints, injustice, illness, grief, or accountability.',
        practice:
          'Ask for alternative causes, counterexamples, implications, and the most useful action supported by current evidence.',
      },
      {
        title: 'Flexible optimism has boundaries',
        premise:
          'Optimism can support persistence, while caution and realistic risk assessment remain valuable in high-stakes situations.',
        whyItMatters:
          'No explanatory style should replace expertise, safety planning, or attention to evidence.',
        practice:
          'Use optimistic experimentation for reversible choices and deliberate analysis for safety-critical ones.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Audit one setback explanation',
        description:
          'Identify whether your interpretation extends beyond the event’s actual duration, scope, or causes.',
        nextStep:
          'Write the explanation, then label its permanent, pervasive, and personal claims.',
      },
      {
        title: 'Generate evidence-based alternatives',
        description:
          'Create multiple plausible explanations without denying the most difficult facts.',
        nextStep:
          'List three contributing factors and one counterexample to any absolute claim.',
      },
      {
        title: 'Match optimism to the stakes',
        description:
          'Use hope to support action while retaining caution where harm could be serious.',
        nextStep:
          'Classify the next decision as reversible or high-stakes and choose the review level accordingly.',
      },
    ],
    reflectionPrompts: [
      'Which part of your explanation turns one event into a permanent forecast?',
      'What remains specific to this situation rather than true of your whole life or identity?',
      'Where would realistic caution serve you better than an optimistic experiment?',
    ],
    sources: [
      {
        label: 'Penguin Random House: Learned Optimism',
        url: 'https://www.penguinrandomhouse.com/books/163862/learned-optimism-by-martin-e-p-seligman-phd/9781400078394/',
        sourceType: 'publisher',
      },
      {
        label: 'NIMH: Psychotherapies',
        url: 'https://www.nimh.nih.gov/health/topics/psychotherapies',
        sourceType: 'clinical-context',
      },
    ],
  }),
  defineBook({
    id: 'the-how-of-happiness',
    title: 'The How of Happiness',
    author: 'Sonja Lyubomirsky',
    topic: 'Mood & self-compassion',
    displayTags: ['Wellbeing', 'Activities', 'Fit'],
    readTimeMinutes: 15,
    summary:
      'Sonja Lyubomirsky reviews intentional activities associated with wellbeing, including gratitude, relationships, goals, coping, kindness, savoring, and physical care. She emphasizes person-activity fit and variation rather than prescribing the same happiness routine to everyone.',
    centralPremise:
      'Some aspects of wellbeing can be influenced through intentional activity, but an intervention is more likely to help when it fits the person, culture, needs, timing, and resources. Practices also need variation and meaning so they do not become empty obligations.',
    corePremises: [
      {
        title: 'Fit matters more than trendiness',
        premise:
          'A wellbeing activity can align or conflict with a person’s values, temperament, culture, symptoms, and current circumstances.',
        whyItMatters:
          'A poor fit can create guilt or burden even when group-level research finds average benefit.',
        practice:
          'Rate each proposed activity for enjoyment, meaning, effort, cultural fit, and practicality before choosing one.',
      },
      {
        title: 'Adaptation can reduce impact',
        premise:
          'Repeated positive activities may become automatic and lose salience when performed in the same way without attention.',
        whyItMatters:
          'More frequency is not always better; timing and variation can preserve meaning.',
        practice:
          'Vary the form or schedule of a practice while keeping its underlying purpose.',
      },
      {
        title: 'Wellbeing is not compulsory positivity',
        premise:
          'Intentional activities can coexist with grief, anger, illness, injustice, and the need for clinical or practical support.',
        whyItMatters:
          'Happiness practices become harmful when used to invalidate pain or assign blame for conditions outside individual control.',
        practice:
          'State what the activity may support and what problem it cannot solve.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Run a fit assessment',
        description:
          'Choose a wellbeing practice based on values and capacity rather than popularity.',
        nextStep:
          'Score three activities from 1 to 5 for meaning, effort, fit, and accessibility, then choose the strongest match.',
      },
      {
        title: 'Set a bounded experiment',
        description:
          'Test one activity long enough to learn without converting it into a permanent obligation.',
        nextStep:
          'Schedule the practice twice this week and record mood, meaning, and burden afterward.',
      },
      {
        title: 'Protect emotional honesty',
        description:
          'Allow difficult emotions and positive activity to coexist.',
        nextStep:
          'Complete: “This practice may support…, and it does not erase or solve…”',
      },
    ],
    reflectionPrompts: [
      'Which wellbeing activity fits your values rather than someone else’s image of a good life?',
      'When does a helpful practice begin to feel performative or obligatory?',
      'What pain or external problem should not be reframed as a failure to practice happiness?',
    ],
    sources: [
      {
        label: 'Penguin Random House: The How of Happiness',
        url: 'https://www.penguinrandomhouse.com/books/298918/the-how-of-happiness-by-sonja-lyubomirsky/',
        sourceType: 'publisher',
      },
      {
        label: 'Sonja Lyubomirsky research and publications',
        url: 'https://sonjalyubomirsky.com/',
        sourceType: 'author',
      },
    ],
  }),
  defineBook({
    id: 'mindful-self-compassion-for-burnout',
    title: 'Mindful Self-Compassion for Burnout',
    author: 'Kristin Neff and Christopher Germer',
    topic: 'Burnout & recovery',
    displayTags: ['Burnout', 'Caregiving', 'Self-compassion'],
    readTimeMinutes: 16,
    summary:
      'Kristin Neff and Christopher Germer apply mindful self-compassion to exhaustion, overextension, caregiving strain, and work-related depletion. The approach combines immediate support with examination of boundaries and conditions that repeatedly consume capacity.',
    centralPremise:
      'Burnout is not resolved by demanding more performance from an exhausted person. Compassion can help stabilize the immediate experience, identify unmet needs, protect finite capacity, and support changes to workloads, roles, boundaries, or systems that keep recreating depletion.',
    corePremises: [
      {
        title: 'Relief and structural change are different tasks',
        premise:
          'A calming practice may reduce immediate distress while leaving an unsafe workload, inequitable role, or impossible expectation unchanged.',
        whyItMatters:
          'Coping skills should not be used to adapt a person indefinitely to harmful conditions.',
        practice:
          'Separate what offers short-term recovery from what must change in the environment.',
      },
      {
        title: 'Caregiving requires care for the caregiver',
        premise:
          'Empathy without replenishment, boundaries, and shared responsibility can contribute to depletion and reduced capacity to help.',
        whyItMatters:
          'Self-neglect is not proof of commitment and can ultimately undermine both the caregiver and the care.',
        practice:
          'Identify one task to share, decline, postpone, or perform at a sustainable standard.',
      },
      {
        title: 'Compassion can motivate protective action',
        premise:
          'A kind response may include rest, medical assessment, workplace documentation, advocacy, leave, or a firm boundary.',
        whyItMatters:
          'Soothing alone is insufficient when the body and context are signaling that current demands are untenable.',
        practice:
          'Ask what you would want protected if this exhaustion belonged to someone you were responsible for.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Create a two-column recovery map',
        description:
          'Distinguish practices that restore capacity from conditions that require change.',
        nextStep:
          'List three immediate supports and three workload or boundary changes, assigning an owner to each.',
      },
      {
        title: 'Lower one unnecessary standard',
        description:
          'Protect energy by defining what is good enough for a low-risk task.',
        nextStep:
          'Choose one task and write the minimum acceptable outcome, time limit, and stopping point.',
      },
      {
        title: 'Make one support request',
        description:
          'Ask for a concrete redistribution rather than hoping others infer the need.',
        nextStep:
          'Draft one request naming the task, the change needed, and the timeframe.',
      },
    ],
    reflectionPrompts: [
      'Which part of your exhaustion needs soothing, and which part needs a changed condition?',
      'What standard or responsibility are you carrying without explicit agreement?',
      'What support would you recommend if someone you cared for had your current workload?',
    ],
    sources: [
      {
        label: 'Guilford Press: Mindful Self-Compassion for Burnout',
        url: 'https://www.guilford.com/books/Mindful-Self-Compassion-for-Burnout/Neff-Germer/9781462550227',
        sourceType: 'publisher',
      },
      {
        label: 'WHO: Burn-out as an occupational phenomenon',
        url: 'https://www.who.int/standards/classifications/frequently-asked-questions/burn-out-an-occupational-phenomenon',
        sourceType: 'clinical-context',
      },
    ],
  }),
  defineBook({
    id: 'radical-acceptance',
    title: 'Radical Acceptance',
    author: 'Tara Brach',
    topic: 'Mood & self-compassion',
    displayTags: ['Acceptance', 'Mindfulness', 'Belonging'],
    readTimeMinutes: 15,
    summary:
      'Tara Brach combines Buddhist-informed mindfulness, compassion practices, personal stories, and clinical experience to address shame and the persistent sense of being deficient. Acceptance means recognizing present experience clearly, not approving harm or abandoning change.',
    centralPremise:
      'Suffering often intensifies when pain is joined by the belief that the experience or the person having it should not exist as they are. Mindful attention and compassion can interrupt that internal war, making more deliberate action possible.',
    corePremises: [
      {
        title: 'The trance of deficiency narrows identity',
        premise:
          'Shame can organize attention around evidence of being inadequate while hiding complexity, context, strengths, and belonging.',
        whyItMatters:
          'When a painful story is mistaken for the whole self, defensive or avoidant reactions become more likely.',
        practice:
          'Name the recurring deficiency story and then list the facts, relationships, and qualities it excludes.',
      },
      {
        title: 'Acceptance is contact with reality',
        premise:
          'Accepting that an emotion or event is present does not mean liking it, agreeing with it, forgiving it, or allowing it to continue.',
        whyItMatters:
          'Clear contact with what is happening is necessary for an effective response.',
        practice:
          'Use the phrase “This is here right now” and separately decide what protection or change is needed.',
      },
      {
        title: 'The RAIN sequence creates a pause',
        premise:
          'Recognizing, allowing, investigating with care, and nurturing can organize attention during a difficult internal experience.',
        whyItMatters:
          'A sequence can reduce automatic fusion with shame or fear, but it should remain optional and titrated.',
        practice:
          'Use only the first one or two steps if deeper investigation increases activation.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Name the deficiency story',
        description:
          'Identify the repeated global conclusion that appears when you struggle.',
        nextStep:
          'Write: “The story says I am…, especially when…” and list two facts it leaves out.',
      },
      {
        title: 'Separate acceptance from permission',
        description:
          'Acknowledge reality while preserving the right to protect yourself or pursue change.',
        nextStep:
          'Complete: “This is happening, and the action I choose now is…”',
      },
      {
        title: 'Use a bounded RAIN practice',
        description:
          'Try only as much inner attention as remains stabilizing.',
        nextStep:
          'Recognize and name the feeling, allow ten seconds of contact, then orient to five things in the room.',
      },
    ],
    reflectionPrompts: [
      'What recurring story makes a painful moment feel like proof of personal deficiency?',
      'What can you acknowledge without approving or permitting harm?',
      'Which part of mindful investigation feels supportive, and where do you need a stopping boundary?',
    ],
    sources: [
      {
        label: 'Tara Brach: Radical Acceptance',
        url: 'https://www.tarabrach.com/books/radical-acceptance/',
        sourceType: 'author',
      },
      {
        label: 'NIMH: Psychotherapies',
        url: 'https://www.nimh.nih.gov/health/topics/psychotherapies',
        sourceType: 'clinical-context',
      },
    ],
  }),
  defineBook({
    id: 'what-my-bones-know',
    title: 'What My Bones Know',
    author: 'Stephanie Foo',
    topic: 'Trauma',
    displayTags: ['Memoir', 'Complex trauma', 'Recovery'],
    readTimeMinutes: 17,
    summary:
      'Stephanie Foo investigates the effects of childhood abuse through memoir, reporting, family history, culture, and her experiences with multiple forms of care. The book documents one person’s search for understanding and recovery rather than establishing a universal pathway.',
    centralPremise:
      'Long-term trauma can shape relationships, self-concept, bodily arousal, work, and expectations of safety, while adaptation and meaningful change remain possible. Recovery is often nonlinear and may involve naming what happened, building safer relationships, and trying care that fits the individual.',
    corePremises: [
      {
        title: 'High functioning can coexist with significant distress',
        premise:
          'Achievement, competence, and productivity may conceal hypervigilance, shame, relational fear, or exhaustion rather than disproving them.',
        whyItMatters:
          'External success should not be used to dismiss suffering or delay support.',
        practice:
          'Track the internal cost of a successful day, including tension, recovery time, avoidance, and self-talk.',
      },
      {
        title: 'Understanding spans personal and cultural context',
        premise:
          'Family patterns, migration, culture, racism, economic pressure, and intergenerational history can inform a trauma narrative without excusing abuse.',
        whyItMatters:
          'Context can deepen understanding while preserving accountability for harm.',
        practice:
          'Write two separate columns: conditions that shaped the adults involved and actions for which they remained responsible.',
      },
      {
        title: 'Safe relationship can be part of recovery',
        premise:
          'Consistent, boundaried connection may create experiences that differ from expectations formed in unsafe relationships.',
        whyItMatters:
          'Insight alone may not revise relational predictions that are repeatedly reinforced by isolation or instability.',
        practice:
          'Identify one person who demonstrates reliability through observable behavior and one small, reversible act of trust.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Measure the hidden cost',
        description:
          'Notice what achievement requires internally rather than using performance as the only wellbeing measure.',
        nextStep:
          'After one demanding task, record tension, emotional effort, recovery time, and support used.',
      },
      {
        title: 'Hold context and accountability together',
        description:
          'Understand contributing history without converting explanation into permission.',
        nextStep:
          'Write one contextual factor and one clear statement of the boundary or responsibility it does not erase.',
      },
      {
        title: 'Choose a low-risk relational experiment',
        description:
          'Gather evidence about safety through a small interaction rather than total disclosure.',
        nextStep:
          'Ask one reliable person for a modest, specific form of support and observe how they respond.',
      },
    ],
    reflectionPrompts: [
      'What distress is hidden by the parts of your life that look successful?',
      'What context helps you understand your history without excusing harm?',
      'Which observable behaviors help you distinguish a safe-enough relationship from a familiar one?',
    ],
    sources: [
      {
        label: 'Penguin Random House: What My Bones Know',
        url: 'https://www.penguinrandomhouse.com/books/658389/what-my-bones-know-by-stephanie-foo/',
        sourceType: 'publisher',
      },
      {
        label: 'VA National Center for PTSD: Treatment basics',
        url: 'https://www.ptsd.va.gov/understand_tx/tx_basics.asp',
        sourceType: 'clinical-context',
      },
    ],
  }),
  defineBook({
    id: 'complex-ptsd-from-surviving-to-thriving',
    title: 'Complex PTSD: From Surviving to Thriving',
    author: 'Pete Walker',
    topic: 'Trauma',
    displayTags: ['Complex trauma', 'Emotional flashbacks', 'Self-protection'],
    readTimeMinutes: 17,
    summary:
      'Pete Walker offers a clinician-author framework for understanding long-term childhood trauma, emotional flashbacks, harsh self-criticism, relational defenses, and grief. Many readers find the language recognizable, but the model and proposed response types are not a diagnostic assessment.',
    centralPremise:
      'Adaptations developed under chronic threat can persist after the original environment has changed. Recovery may involve recognizing present-day activation, reducing internal attack, grieving losses, establishing boundaries, and expanding the range of responses available in relationships.',
    corePremises: [
      {
        title: 'Emotional flashbacks may lack a visual memory',
        premise:
          'A person can abruptly feel young, trapped, ashamed, abandoned, or endangered without experiencing a clear image of a past event.',
        whyItMatters:
          'Recognizing the state as activation may reduce the belief that the current situation fully explains its intensity.',
        practice:
          'Orient to present age, location, available exits, and current sources of support before interpreting the relationship.',
      },
      {
        title: 'Protective styles can become rigid',
        premise:
          'Fighting, fleeing, freezing, or appeasing may have been adaptive under threat but can narrow present choices when used automatically.',
        whyItMatters:
          'A framework is useful when it increases options, not when it becomes a permanent personality label.',
        practice:
          'Name the current protective impulse and add one alternative response that preserves safety.',
      },
      {
        title: 'The inner critic can reproduce threat',
        premise:
          'Harsh internal rules may attempt to prevent rejection or danger by demanding perfection, invisibility, or constant vigilance.',
        whyItMatters:
          'Treating the critic as a protective pattern can make it easier to challenge without debating personal worth.',
        practice:
          'Identify the threat the rule is trying to prevent and replace it with a present-day safety check.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Create a present-orientation card',
        description:
          'Prepare factual reminders for moments when emotional intensity makes the present feel like the past.',
        nextStep:
          'Write your age, location, three current choices, two support contacts, and one grounding action.',
      },
      {
        title: 'Expand one protective response',
        description:
          'Keep the protective intent while increasing behavioral choice.',
        nextStep:
          'For one recurring trigger, list your automatic response and one safer alternative you can test.',
      },
      {
        title: 'Translate a critic rule',
        description:
          'Turn an absolute internal demand into a specific present-day risk question.',
        nextStep:
          'Rewrite “I must never…” as “What is the actual risk now, and what protection is proportionate?”',
      },
    ],
    reflectionPrompts: [
      'Which facts help you recognize that an intense state belongs partly to the past?',
      'What has your default protective response helped you survive, and what does it cost now?',
      'Which internal rule is trying to prevent danger through shame or perfection?',
    ],
    sources: [
      {
        label: 'Pete Walker: Complex PTSD',
        url: 'https://www.pete-walker.com/complex_ptsd_book.html',
        sourceType: 'author',
      },
      {
        label: 'VA National Center for PTSD: Treatment basics',
        url: 'https://www.ptsd.va.gov/understand_tx/tx_basics.asp',
        sourceType: 'clinical-context',
      },
    ],
    medicalCaveat:
      'This author framework is educational and cannot diagnose PTSD, complex PTSD, a dissociative condition, or an attachment pattern. Similar experiences can have multiple causes. Avoid using response-style labels as fixed identities, and seek trauma-informed assessment when symptoms are severe or impairing.',
  }),
  defineBook({
    id: 'trauma-and-recovery',
    title: 'Trauma and Recovery',
    author: 'Judith Lewis Herman',
    topic: 'Trauma',
    displayTags: ['Safety', 'Remembrance', 'Reconnection'],
    readTimeMinutes: 18,
    summary:
      'Judith Herman connects the study of private trauma with the social conditions that allow violence to be recognized or denied. She describes recovery through broad movements toward safety, remembrance and mourning, and reconnection, while emphasizing that recovery is not a rigid sequence.',
    centralPremise:
      'Traumatic harm is shaped by power, captivity, secrecy, and social response. Recovery depends not only on recounting what happened but on restoring safety, agency, trustworthy connection, and participation in present life at a pace the survivor can control.',
    corePremises: [
      {
        title: 'Safety precedes intensive processing',
        premise:
          'Physical safety, symptom stabilization, practical resources, and control over contact are foundational before detailed trauma work.',
        whyItMatters:
          'Premature disclosure or exposure can overwhelm capacity and recreate loss of control.',
        practice:
          'Assess current threats, housing, finances, contact boundaries, sleep, substance use, and support before approaching detailed memories.',
      },
      {
        title: 'Remembrance requires agency and pacing',
        premise:
          'Constructing a trauma narrative may be meaningful when the survivor controls timing, scope, audience, and stopping.',
        whyItMatters:
          'Recovery does not require forced disclosure, recovered-memory searches, confrontation, or a perfectly complete account.',
        practice:
          'Define what you do not want to discuss, your stop signal, and how you will return to the present.',
      },
      {
        title: 'Recovery includes reconnection',
        premise:
          'Healing involves developing a present-day identity, relationships, purpose, and civic or community life beyond the trauma.',
        whyItMatters:
          'A life organized only around symptom management can leave agency and belonging underdeveloped.',
        practice:
          'Choose one activity that expresses a current value unrelated to explaining or repairing the past.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Audit present safety first',
        description:
          'Identify concrete safety and stability needs before opening difficult material.',
        nextStep:
          'List current threats, available protections, support contacts, and one practical gap to address.',
      },
      {
        title: 'Write processing boundaries',
        description:
          'Preserve control over if, when, how, and with whom trauma material is discussed.',
        nextStep:
          'Document one topic boundary, one stop signal, and one grounding plan for any trauma conversation.',
      },
      {
        title: 'Add one identity-expanding action',
        description:
          'Invest in a role, interest, or relationship not defined by trauma.',
        nextStep:
          'Schedule one small activity this week that expresses curiosity, contribution, creativity, or connection.',
      },
    ],
    reflectionPrompts: [
      'What practical condition would increase your sense of present-day safety?',
      'What choice or boundary would make discussing the past feel more under your control?',
      'Which part of your identity deserves attention beyond survival and recovery?',
    ],
    sources: [
      {
        label: 'Hachette: Trauma and Recovery',
        url: 'https://www.hachettebookgroup.com/titles/judith-l-herman-md/trauma-and-recovery/9780465098736/',
        sourceType: 'publisher',
      },
      {
        label: 'VA National Center for PTSD: Treatment basics',
        url: 'https://www.ptsd.va.gov/understand_tx/tx_basics.asp',
        sourceType: 'clinical-context',
      },
    ],
  }),
  defineBook({
    id: 'waking-the-tiger',
    title: 'Waking the Tiger',
    author: 'Peter A. Levine and Ann Frederick',
    topic: 'Trauma',
    displayTags: ['Somatic awareness', 'Titration', 'Trauma theory'],
    readTimeMinutes: 17,
    summary:
      'Peter Levine and Ann Frederick present a body-oriented account of trauma and propose attending to sensation in small, tolerable increments. The book’s animal analogies and claims about stored survival energy are influential but should be read as the authors’ framework, not settled medical fact.',
    centralPremise:
      'Trauma may involve persistent patterns of bodily threat response as well as memory and meaning. Carefully noticing sensation, movement, and shifts between activation and settling may help some people develop more choice, provided the work is paced and does not replace evidence-based assessment or treatment.',
    corePremises: [
      {
        title: 'Sensation can be observed without forcing catharsis',
        premise:
          'The authors encourage noticing temperature, pressure, movement, breath, and impulse rather than immediately constructing a detailed story.',
        whyItMatters:
          'Concrete sensory observation may feel more manageable than full memory immersion for some people, but it can activate others.',
        practice:
          'Notice one neutral or mildly pleasant sensation before approaching any discomfort, and stop if orientation decreases.',
      },
      {
        title: 'Titration means working in small amounts',
        premise:
          'The framework proposes touching activation briefly and returning to support rather than sustaining maximum intensity.',
        whyItMatters:
          'More intensity is not evidence of more healing, and overwhelm can reduce learning and safety.',
        practice:
          'Alternate ten seconds of mild sensation awareness with thirty seconds of looking around the room.',
      },
      {
        title: 'The theory has limits',
        premise:
          'Metaphors about incomplete defensive responses or trauma held in the body should not be treated as literal diagnosis or proof of a hidden event.',
        whyItMatters:
          'Over-literal interpretation can create false certainty, unsafe self-treatment, or pressure to produce a release.',
        practice:
          'Label each explanatory claim as author model, personal experience, research finding, or clinical recommendation.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Establish a neutral anchor',
        description:
          'Find a present sensation that supports orientation before exploring discomfort.',
        nextStep:
          'Notice the contact of your feet, back, or hands for ten seconds while naming the current room and date.',
      },
      {
        title: 'Use a strict dose limit',
        description:
          'Keep body attention brief enough that you retain choice and present orientation.',
        nextStep:
          'Set a two-minute timer, alternate mild sensation with external orientation, and stop at the first sustained increase in distress.',
      },
      {
        title: 'Separate metaphor from evidence',
        description:
          'Use the book’s language provisionally rather than as a factual verdict about your body or history.',
        nextStep:
          'Write one idea that feels useful and one claim you would want a qualified clinician or research source to clarify.',
      },
    ],
    reflectionPrompts: [
      'Which present-day sensation feels neutral or supportive enough to use as an anchor?',
      'How will you know a body-awareness practice has exceeded your workable range?',
      'Which claim in the book are you treating as fact when it is better held as a theory or metaphor?',
    ],
    sources: [
      {
        label: 'Penguin Random House: Waking the Tiger',
        url: 'https://www.penguinrandomhouse.com/books/100541/waking-the-tiger-healing-trauma-by-peter-a-levine-phd-contribution-by-ann-frederick/',
        sourceType: 'publisher',
      },
      {
        label: 'VA National Center for PTSD: Treatment basics',
        url: 'https://www.ptsd.va.gov/understand_tx/tx_basics.asp',
        sourceType: 'clinical-context',
      },
    ],
    medicalCaveat:
      'The book’s somatic model and animal analogies are not a diagnosis and some mechanisms remain debated or broader than established evidence. Do not use sensation practices to recover memories or force discharge. Stop if you feel disoriented, flooded, numb, or less able to stay present.',
  }),
  defineBook({
    id: 'my-grandmothers-hands',
    title: 'My Grandmother’s Hands',
    author: 'Resmaa Menakem',
    topic: 'Trauma',
    displayTags: ['Racialized trauma', 'Embodiment', 'Collective repair'],
    readTimeMinutes: 18,
    summary:
      'Resmaa Menakem explores racialized violence and white-body supremacy through history, lived experience, and body-centered practices. The book asks readers to examine how threat, power, and inherited social patterns are embodied, while its specific nervous-system claims should be distinguished from established clinical evidence.',
    centralPremise:
      'Racism is not only an individual belief problem; it is maintained through institutions, histories, relationships, patterned threat responses, and unequal power. Meaningful repair requires embodied awareness alongside accountability, structural action, and sustained community practice.',
    corePremises: [
      {
        title: 'Racialized harm operates beyond intention',
        premise:
          'Impact can arise from institutions, habits, avoidance, and unequal power even when an individual does not consciously intend harm.',
        whyItMatters:
          'Focusing only on personal innocence can prevent examination of participation and consequence.',
        practice:
          'For one event, separate intention, observable action, impact, power, and repair.',
      },
      {
        title: 'Body awareness can reveal patterned threat',
        premise:
          'The book invites readers to notice contraction, urgency, numbing, or defensive impulses during racial stress.',
        whyItMatters:
          'Recognizing activation may create a pause before reenacting avoidance, aggression, appeasement, or withdrawal.',
        practice:
          'Orient to the present and name the bodily response without assigning it a definitive cause or historical memory.',
      },
      {
        title: 'Settling is not the same as repair',
        premise:
          'Regulation practices may support capacity, but they do not redistribute power, restore losses, change policy, or complete accountability.',
        whyItMatters:
          'A personal wellness frame can depoliticize harm if it replaces material action.',
        practice:
          'Pair any internal practice with one relational, organizational, or civic responsibility.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Map intention, impact, and power',
        description:
          'Analyze a racialized interaction without reducing it to whether someone meant well.',
        nextStep:
          'Write the observable action, likely impact, relevant power difference, and a specific repair or prevention step.',
      },
      {
        title: 'Pause before patterned reaction',
        description:
          'Use brief orientation to preserve choice during activation.',
        nextStep:
          'Name five visible objects, feel both feet, and delay the next message or decision until urgency decreases.',
      },
      {
        title: 'Connect regulation to responsibility',
        description:
          'Ensure body-centered reflection supports rather than substitutes for action.',
        nextStep:
          'Choose one measurable change in policy, resource allocation, feedback, education, or repair that you can influence.',
      },
    ],
    reflectionPrompts: [
      'Where might a focus on good intention be hiding impact or unequal power?',
      'What patterned bodily response appears during racial stress, and what choice could a pause make possible?',
      'What concrete responsibility must remain after the internal discomfort settles?',
    ],
    sources: [
      {
        label: 'Penguin: My Grandmother’s Hands',
        url: 'https://www.penguin.co.uk/books/443125/my-grandmothers-hands-by-menakem-resmaa/9780141996479',
        sourceType: 'publisher',
      },
      {
        label: 'NIMH: Coping with traumatic events',
        url: 'https://www.nimh.nih.gov/health/topics/coping-with-traumatic-events',
        sourceType: 'clinical-context',
      },
    ],
    medicalCaveat:
      'The book combines social analysis, lived experience, and a body-centered author framework; do not treat its nervous-system language as a personal diagnosis or proof that trauma is biologically inherited in a simple deterministic way. Regulation exercises cannot substitute for structural accountability or trauma care.',
  }),
  defineBook({
    id: 'its-ok-that-youre-not-ok',
    title: 'It’s OK That You’re Not OK',
    author: 'Megan Devine',
    topic: 'Grief & loss',
    displayTags: ['Grief', 'Validation', 'Support'],
    readTimeMinutes: 15,
    summary:
      'Megan Devine challenges cultural pressure to treat grief as a problem to solve quickly. She focuses on accompanying pain, reducing secondary harm from invalidating advice, and offering concrete ways for grieving people and supporters to navigate life after loss.',
    centralPremise:
      'Grief after a devastating loss may be a painful response to love and changed reality rather than evidence of defective coping. Support is often more humane when it helps a person carry what cannot be fixed instead of imposing a timeline, lesson, comparison, or demand for closure.',
    corePremises: [
      {
        title: 'Pain and pathology are not identical',
        premise:
          'Intense grief can be expected after profound loss, even though some symptoms or risks may still warrant clinical assessment.',
        whyItMatters:
          'Automatically medicalizing grief can invalidate love and reality, while automatically normalizing everything can miss danger or impairment.',
        practice:
          'Describe what has changed, what hurts, and what support is needed without deciding from a book whether the response is normal or disordered.',
      },
      {
        title: 'Acknowledgment is often more useful than advice',
        premise:
          'Attempts to explain, compare, brighten, or fix grief can add isolation when the loss itself cannot be repaired.',
        whyItMatters:
          'Accurate companionship reduces the burden of defending or minimizing the experience.',
        practice:
          'Use a simple response that recognizes the loss and asks what form of presence would help.',
      },
      {
        title: 'Survival needs can be practical and small',
        premise:
          'Food, sleep, paperwork, transportation, childcare, quiet, and protection from unwanted demands may matter more than insight.',
        whyItMatters:
          'Grief can impair concentration and executive function, making concrete assistance especially valuable.',
        practice:
          'Choose one necessary task and reduce it to the smallest action someone can help complete.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Replace a timeline with a needs map',
        description:
          'Focus on present support rather than whether grief is progressing correctly.',
        nextStep:
          'List one emotional, physical, practical, relational, and administrative need for this week.',
      },
      {
        title: 'Write an acknowledgment response',
        description:
          'Prepare language that does not explain away another person’s loss.',
        nextStep:
          'Use: “This is painful and I am here. Would listening, practical help, or quiet company be most useful?”',
      },
      {
        title: 'Make one concrete request',
        description:
          'Turn a broad offer of help into a task another person can actually do.',
        nextStep:
          'Ask one person for a specific errand, meal, call, ride, form, or protected hour.',
      },
    ],
    reflectionPrompts: [
      'Which expectation about grieving is adding suffering to the loss itself?',
      'What kind of acknowledgment helps you feel accompanied rather than managed?',
      'Which practical task is consuming capacity that someone else could share?',
    ],
    sources: [
      {
        label: 'Macmillan: It’s OK That You’re Not OK',
        url: 'https://us.macmillan.com/books/9781622039074/itsokthatyourenotok/',
        sourceType: 'publisher',
      },
      {
        label: 'American Psychiatric Association: Prolonged grief disorder',
        url: 'https://www.psychiatry.org/patients-families/prolonged-grief-disorder',
        sourceType: 'clinical-context',
      },
    ],
  }),
  defineBook({
    id: 'the-grieving-brain',
    title: 'The Grieving Brain',
    author: 'Mary-Frances O’Connor',
    topic: 'Grief & loss',
    displayTags: ['Grief science', 'Learning', 'Attachment'],
    readTimeMinutes: 16,
    summary:
      'Neuroscientist Mary-Frances O’Connor explains grief as a form of learning after attachment loss. The brain must repeatedly update expectations built around a person who was deeply present in daily life, while the relationship can continue through memory and meaning.',
    centralPremise:
      'Knowing intellectually that someone has died is different from the brain fully learning a world in which they are no longer physically available. Grief reflects repeated encounters between enduring attachment and changed reality, so adaptation can take time without requiring the bond to be erased.',
    corePremises: [
      {
        title: 'Attachment creates durable predictions',
        premise:
          'Close relationships shape expectations about where a person is, how to reach them, and what future interactions will occur.',
        whyItMatters:
          'Automatic searching, expecting, or momentarily forgetting can be understood as learning processes rather than moral or intellectual failure.',
        practice:
          'Notice one daily prediction that still includes the person and name the changed reality with gentleness.',
      },
      {
        title: 'Grief and grieving are distinct',
        premise:
          'The bond and pain of loss may remain, while the process of adapting behavior, roles, and expectations changes over time.',
        whyItMatters:
          'Adaptation does not require forgetting, ending love, or reaching a final emotion called closure.',
        practice:
          'Identify one enduring bond and one present-day task you are learning to do differently.',
      },
      {
        title: 'Scientific explanation does not set a timetable',
        premise:
          'Brain and attachment research can offer a model, but it cannot predict exactly how any individual should feel or when.',
        whyItMatters:
          'A neuroscience account should reduce self-blame, not become another performance standard.',
        practice:
          'Use the learning metaphor only where it clarifies experience and set it aside where it does not fit.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Name one outdated prediction',
        description:
          'Recognize a moment when the relationship model expects physical availability that has changed.',
        nextStep:
          'Write what your mind expected, what reality is now, and what support helps you absorb the difference.',
      },
      {
        title: 'Separate bond from availability',
        description:
          'Preserve meaning and connection without denying physical absence.',
        nextStep:
          'Choose one safe ritual, object, story, or value that carries the relationship forward.',
      },
      {
        title: 'Track adaptation without grading grief',
        description:
          'Notice new learning while allowing pain and love to remain.',
        nextStep:
          'Record one task or situation you navigated differently this month, without calling it moving on.',
      },
    ],
    reflectionPrompts: [
      'Which everyday expectation still assumes your person will be physically available?',
      'What part of the bond do you want to carry forward?',
      'What have you learned to navigate differently without that change reducing the importance of the loss?',
    ],
    sources: [
      {
        label: 'Mary-Frances O’Connor: The Grieving Brain',
        url: 'https://maryfrancesoconnor.org/books/the-grieving-brain',
        sourceType: 'author',
      },
      {
        label: 'American Psychiatric Association: Prolonged grief disorder',
        url: 'https://www.psychiatry.org/patients-families/prolonged-grief-disorder',
        sourceType: 'clinical-context',
      },
    ],
  }),
  defineBook({
    id: 'option-b',
    title: 'Option B',
    author: 'Sheryl Sandberg and Adam Grant',
    topic: 'Grief & loss',
    displayTags: ['Resilience', 'Adversity', 'Support'],
    readTimeMinutes: 15,
    summary:
      'Sheryl Sandberg and Adam Grant combine a personal account of sudden bereavement with psychological research and stories of adversity. They examine how people and communities can support recovery while acknowledging that resources, losses, and trajectories differ.',
    centralPremise:
      'After life changes irreversibly, resilience is not a demand to restore the old life through willpower. It can be developed through compassionate interpretation, practical support, connection, and the gradual construction of workable meaning and possibility in changed circumstances.',
    corePremises: [
      {
        title: 'Personalization, pervasiveness, and permanence can deepen distress',
        premise:
          'After adversity, people may blame themselves entirely, assume every area is ruined, or believe the most acute state will never change.',
        whyItMatters:
          'Testing these conclusions can reduce avoidable secondary suffering without minimizing the loss.',
        practice:
          'For one painful conclusion, identify what is not your fault, what remains outside the affected domain, and what may still change.',
      },
      {
        title: 'Specific support is easier to receive',
        premise:
          'Broad offers may place planning work on the grieving person, while concrete, consent-based help reduces decision load.',
        whyItMatters:
          'People often withdraw because they fear saying the wrong thing, increasing isolation.',
        practice:
          'Offer one specific task with an easy way to decline rather than asking the person to invent a request.',
      },
      {
        title: 'Post-traumatic growth is possible, not required',
        premise:
          'Some people report new meaning, relationships, or priorities after adversity, while growth does not justify the event or measure recovery.',
        whyItMatters:
          'Turning growth into an expectation can shame people whose primary task is surviving.',
        practice:
          'Notice any new value or capacity only if it is genuinely present; do not search for a benefit that must redeem the loss.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Test the three broad conclusions',
        description:
          'Examine self-blame, total-life conclusions, and permanent forecasts separately.',
        nextStep:
          'Write one sentence for what is not solely your fault, what remains, and what could still change.',
      },
      {
        title: 'Offer concrete support',
        description:
          'Reduce the planning burden while preserving choice.',
        nextStep:
          'Offer one task at a specific time and add: “No response or a no is completely okay.”',
      },
      {
        title: 'Protect against compulsory growth',
        description:
          'Allow meaning to emerge without demanding that suffering produce a benefit.',
        nextStep:
          'Write one thing the loss cost that does not need a silver lining and one value you still choose now.',
      },
    ],
    reflectionPrompts: [
      'Which part of the adversity are you holding as entirely your fault?',
      'What remains meaningful or functional even though the loss affects much of life?',
      'Where has resilience language felt supportive, and where has it felt like pressure?',
    ],
    sources: [
      {
        label: 'Adam Grant: Option B',
        url: 'https://adamgrant.net/book/option-b/',
        sourceType: 'author',
      },
      {
        label: 'American Psychiatric Association: Prolonged grief disorder',
        url: 'https://www.psychiatry.org/patients-families/prolonged-grief-disorder',
        sourceType: 'clinical-context',
      },
    ],
  }),
  defineBook({
    id: 'bearing-the-unbearable',
    title: 'Bearing the Unbearable',
    author: 'Joanne Cacciatore',
    topic: 'Grief & loss',
    displayTags: ['Traumatic grief', 'Mindfulness', 'Compassion'],
    readTimeMinutes: 16,
    summary:
      'Joanne Cacciatore draws on bereavement work, research, and personal loss to accompany people through traumatic grief. The book emphasizes compassionate presence, mindful contact with pain, continuing bonds, and resistance to social demands for quick recovery.',
    centralPremise:
      'Profound grief cannot be efficiently removed without also denying the relationship and reality that give it meaning. Healing may involve learning to bear pain in supported, tolerable moments while maintaining connection, dignity, and a life that can slowly expand around the loss.',
    corePremises: [
      {
        title: 'Presence can matter more than explanation',
        premise:
          'Traumatic grief may not have a satisfying lesson, reason, or phrase that makes the event acceptable.',
        whyItMatters:
          'Attempts to explain can shift attention away from the grieving person’s actual experience.',
        practice:
          'Offer acknowledgment, silence, practical care, and consent before questions or interpretations.',
      },
      {
        title: 'Mindful contact must be titrated',
        premise:
          'Turning toward grief can reduce avoidance for some people, but sustained or forced immersion can overwhelm capacity.',
        whyItMatters:
          'A practice should increase the ability to remain present, not become an endurance test.',
        practice:
          'Touch the feeling briefly, return to sensory orientation, and stop when distress remains elevated.',
      },
      {
        title: 'Continuing bonds can coexist with changed life',
        premise:
          'Memory, ritual, values, and relationship meaning may continue after death without denying physical reality.',
        whyItMatters:
          'The demand to detach completely can add another loss and misrepresent how many people adapt.',
        practice:
          'Choose a bounded ritual that honors the bond and supports present functioning.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Prepare a presence response',
        description:
          'Use language that acknowledges pain without searching for a reason or lesson.',
        nextStep:
          'Write: “I remember this matters. I can listen, sit quietly, or help with something practical.”',
      },
      {
        title: 'Set a grief-practice boundary',
        description:
          'Create a beginning, dose, and return-to-present plan for difficult reflection.',
        nextStep:
          'Choose a five-minute window, one grounding object, and one person to contact if activation persists.',
      },
      {
        title: 'Create one continuing-bond ritual',
        description:
          'Give the relationship a deliberate place without requiring constant immersion.',
        nextStep:
          'Plan one repeatable act involving a story, place, object, meal, value, or contribution.',
      },
    ],
    reflectionPrompts: [
      'Which explanations or consolations have made you feel less understood?',
      'What dose of contact with grief remains bearable enough to retain present orientation?',
      'How would you like the relationship or its values to continue in your life?',
    ],
    sources: [
      {
        label: 'Simon & Schuster: Bearing the Unbearable',
        url: 'https://www.simonandschuster.com/books/Bearing-the-Unbearable/Joanne-Cacciatore/9781614292968',
        sourceType: 'publisher',
      },
      {
        label: 'American Psychiatric Association: Prolonged grief disorder',
        url: 'https://www.psychiatry.org/patients-families/prolonged-grief-disorder',
        sourceType: 'clinical-context',
      },
    ],
  }),
  defineBook({
    id: 'anxiety-the-missing-stage-of-grief',
    title: 'Anxiety: The Missing Stage of Grief',
    author: 'Claire Bidwell Smith',
    topic: 'Grief & loss',
    displayTags: ['Grief anxiety', 'Safety', 'Uncertainty'],
    readTimeMinutes: 15,
    summary:
      'Claire Bidwell Smith explores anxiety that can follow bereavement, including heightened awareness of mortality, health fears, panic, separation concerns, and attempts to regain certainty. The phrase missing stage is the author’s framing, not a universal clinical stage model.',
    centralPremise:
      'Loss can disrupt assumptions of safety and predictability, making the mind and body more alert to future danger. Recognizing the connection between grief and anxiety may reduce confusion and open options for support, while symptoms still require individualized assessment.',
    corePremises: [
      {
        title: 'Loss can alter the sense of safety',
        premise:
          'After death or another major loss, ordinary uncertainty may feel newly dangerous because an unimaginable event has become real.',
        whyItMatters:
          'Health checking, reassurance seeking, avoidance, or panic may be attempts to prevent another uncontrollable loss.',
        practice:
          'Name the feared outcome and the loss-related assumption it activated without treating the connection as a diagnosis.',
      },
      {
        title: 'Control strategies can maintain anxiety',
        premise:
          'Repeated checking, reassurance, scanning, or avoidance may provide brief relief while strengthening the belief that uncertainty is unsafe.',
        whyItMatters:
          'The strategy’s immediate comfort can hide its longer-term cost.',
        practice:
          'Track the trigger, control response, short relief, and later return of fear.',
      },
      {
        title: 'Grief stages are not universal steps',
        premise:
          'Calling anxiety a stage can help some readers notice it, but people do not move through a required sequence.',
        whyItMatters:
          'A stage label should not become a timetable or a reason to dismiss medical or mental health evaluation.',
        practice:
          'Use the idea as one question among several possible explanations and discuss persistent symptoms with a qualified professional.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Map one grief-anxiety link',
        description:
          'Identify how a specific loss may have changed a current prediction about safety.',
        nextStep:
          'Write the trigger, feared event, connection to the loss, and what remains uncertain.',
      },
      {
        title: 'Audit one control strategy',
        description:
          'Compare immediate relief with the response’s later effect on fear and functioning.',
        nextStep:
          'Track one episode of checking or reassurance, including relief at five minutes and anxiety one hour later.',
      },
      {
        title: 'Prepare an assessment summary',
        description:
          'Give a clinician enough detail to evaluate grief, anxiety, and possible medical contributors.',
        nextStep:
          'Record onset, frequency, physical symptoms, triggers, avoidance, sleep, medications, substances, and functional impact.',
      },
    ],
    reflectionPrompts: [
      'What assumption about safety changed after the loss?',
      'Which attempt to create certainty offers relief now but more anxiety later?',
      'What symptom or impairment deserves assessment rather than a self-applied stage label?',
    ],
    sources: [
      {
        label: 'Hachette: Anxiety: The Missing Stage of Grief',
        url: 'https://www.hachettebookgroup.com/titles/claire-bidwell-smith/anxiety-the-missing-stage-of-grief/9780738234762/',
        sourceType: 'publisher',
      },
      {
        label: 'NIMH: Anxiety disorders',
        url: 'https://www.nimh.nih.gov/health/topics/anxiety-disorders',
        sourceType: 'clinical-context',
      },
    ],
    medicalCaveat:
      'The “missing stage” phrase is an author framing, not a required or medically established grief stage. New chest pain, fainting, severe shortness of breath, neurologic symptoms, medication changes, or other concerning physical symptoms require medical evaluation rather than being assumed to be grief or anxiety.',
  }),
  defineBook({
    id: 'set-boundaries-find-peace',
    title: 'Set Boundaries, Find Peace',
    author: 'Nedra Glover Tawwab',
    topic: 'Relationships & boundaries',
    displayTags: ['Boundaries', 'Communication', 'Follow-through'],
    readTimeMinutes: 15,
    summary:
      'Nedra Glover Tawwab presents boundaries as clear communication about needs, limits, and the actions a person will take. The book emphasizes direct language, realistic consequences, and repeated follow-through rather than waiting for others to infer discomfort.',
    centralPremise:
      'A boundary is not a strategy for controlling another person’s feelings or choices. It identifies what you need, what you are willing to participate in, and what action you will take when a limit is crossed, with safety and context determining how directly it can be communicated.',
    corePremises: [
      {
        title: 'Boundaries describe your participation',
        premise:
          'A request asks another person to act, while a boundary clarifies what you will do if the situation continues.',
        whyItMatters:
          'A limit that depends entirely on forcing compliance is not within your control.',
        practice:
          'Rewrite one demand as a clear condition and an action you can realistically take.',
      },
      {
        title: 'Clarity reduces hidden contracts',
        premise:
          'Resentment can grow when people expect others to know unspoken limits, needs, or reciprocal obligations.',
        whyItMatters:
          'Direct communication creates information even when the other person does not agree.',
        practice:
          'State the behavior, need, and requested change without a character diagnosis or a long defense.',
      },
      {
        title: 'Follow-through gives a boundary meaning',
        premise:
          'Repeatedly announcing a consequence that will not occur teaches others and oneself that the stated limit is optional.',
        whyItMatters:
          'A smaller enforceable boundary is more protective than a dramatic one that cannot be sustained.',
        practice:
          'Choose the least severe action that protects the limit and that you are prepared to carry out.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Write one controllable boundary',
        description:
          'Move from telling another person what they must feel or do to defining your participation.',
        nextStep:
          'Complete: “If X happens, I will Y” using an action that is safe, legal, and under your control.',
      },
      {
        title: 'Use a concise script',
        description:
          'Communicate the limit without overexplaining or diagnosing motives.',
        nextStep:
          'Draft three sentences: what happened, what you need, and what you will do next.',
      },
      {
        title: 'Choose sustainable follow-through',
        description:
          'Match the response to your actual resources and the seriousness of the issue.',
        nextStep:
          'Rate the proposed consequence for safety, feasibility, proportionality, and dependence on the other person.',
      },
    ],
    reflectionPrompts: [
      'Which current limit is really an attempt to make another person behave?',
      'What need or expectation have you hoped someone would infer without being told?',
      'What is the smallest follow-through that would genuinely protect this boundary?',
    ],
    sources: [
      {
        label: 'Penguin Random House: Set Boundaries, Find Peace',
        url: 'https://www.penguinrandomhouse.com/books/647316/set-boundaries-find-peace-by-nedra-glover-tawwab/',
        sourceType: 'publisher',
      },
      {
        label: 'National Domestic Violence Hotline: Relationship spectrum',
        url: 'https://www.thehotline.org/resources/healthy-relationships/',
        sourceType: 'clinical-context',
      },
    ],
  }),
  defineBook({
    id: 'drama-free',
    title: 'Drama Free',
    author: 'Nedra Glover Tawwab',
    topic: 'Relationships & boundaries',
    displayTags: ['Family', 'Patterns', 'Boundaries'],
    readTimeMinutes: 15,
    summary:
      'Nedra Glover Tawwab examines difficult family patterns, including enmeshment, neglect, addiction, conflict, role pressure, and estrangement. The book focuses on recognizing a pattern, deciding what relationship is realistically available, and setting limits without requiring family agreement.',
    centralPremise:
      'Family history can explain recurring roles and expectations without requiring a person to keep participating in harmful patterns. Healthier involvement may mean clearer communication, lower contact, different topics, practical limits, grief for what is unavailable, or distance when safety requires it.',
    corePremises: [
      {
        title: 'A familiar role is not a permanent identity',
        premise:
          'Families may repeatedly assign members roles such as rescuer, peacekeeper, problem child, secret keeper, or responsible one.',
        whyItMatters:
          'Automatic role performance can continue long after it has become costly or incompatible with adult values.',
        practice:
          'Name the role, what it once protected, and one response available outside that role.',
      },
      {
        title: 'Acceptance may mean revising expectations',
        premise:
          'A relative may not be able or willing to offer accountability, emotional safety, or reciprocity despite repeated explanation.',
        whyItMatters:
          'Continuing to seek a different relationship from the same evidence can prolong exposure and disappointment.',
        practice:
          'Base the next level of contact on observed behavior rather than the relationship you hope will emerge.',
      },
      {
        title: 'Distance has multiple forms',
        premise:
          'Boundaries can involve topic limits, time limits, separate finances, written communication, supported visits, low contact, or no contact.',
        whyItMatters:
          'Binary pressure to remain fully available or sever all ties can hide safer intermediate choices.',
        practice:
          'Choose the least restrictive form of distance that adequately protects wellbeing and safety.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Map one family role',
        description:
          'Identify the expectation you automatically perform and its current cost.',
        nextStep:
          'Write the role, triggering situations, feared consequence of refusing it, and one alternative response.',
      },
      {
        title: 'Use observed-capacity expectations',
        description:
          'Set expectations from repeated behavior rather than promises or family titles.',
        nextStep:
          'List what this person consistently can, sometimes can, and does not currently provide.',
      },
      {
        title: 'Design a contact boundary',
        description:
          'Select the form and dose of contact that matches current evidence.',
        nextStep:
          'Specify channel, duration, topics, exit condition, and aftercare for the next interaction.',
      },
    ],
    reflectionPrompts: [
      'Which family role do you perform before checking whether you still consent to it?',
      'What expectation conflicts with the person’s repeated behavior?',
      'What form of distance would protect you without requiring an all-or-nothing decision?',
    ],
    sources: [
      {
        label: 'Penguin Random House: Drama Free',
        url: 'https://www.penguinrandomhouse.com/books/706826/drama-free-by-nedra-glover-tawwab/9780593539286/',
        sourceType: 'publisher',
      },
      {
        label: 'National Domestic Violence Hotline: Relationship spectrum',
        url: 'https://www.thehotline.org/resources/healthy-relationships/',
        sourceType: 'clinical-context',
      },
    ],
  }),
  defineBook({
    id: 'attached',
    title: 'Attached',
    author: 'Amir Levine and Rachel Heller',
    topic: 'Relationships & boundaries',
    displayTags: ['Attachment', 'Dating', 'Needs'],
    readTimeMinutes: 16,
    summary:
      'Amir Levine and Rachel Heller apply adult attachment ideas to romantic dating and partnership, describing anxious, avoidant, and secure patterns. The framework can help name recurring dynamics, but popular categories simplify a more complex research field and are not diagnoses.',
    centralPremise:
      'People differ in how they seek closeness, respond to uncertainty, and protect autonomy in romantic relationships. Compatibility, clear communication, and consistent responsiveness may matter more than trying to earn security from a chronically unavailable or destabilizing dynamic.',
    corePremises: [
      {
        title: 'Activation can drive protest behavior',
        premise:
          'When connection feels threatened, a person may repeatedly message, withdraw, provoke jealousy, test the relationship, or hide needs.',
        whyItMatters:
          'Recognizing the underlying need creates alternatives to strategies that intensify insecurity.',
        practice:
          'Name the feared loss, the need, and one direct request before acting on an urge to test or punish.',
      },
      {
        title: 'Consistency is meaningful data',
        premise:
          'Reliable availability, repair, clarity, and respect provide stronger evidence than intermittent intensity or promises.',
        whyItMatters:
          'Unpredictability can be mistaken for chemistry while keeping the attachment system activated.',
        practice:
          'Evaluate patterns across time rather than interpreting each peak or rupture in isolation.',
      },
      {
        title: 'Attachment labels are provisional',
        premise:
          'Behavior can vary across relationships, stress levels, cultures, development, and safety conditions.',
        whyItMatters:
          'Fixed labels can excuse harm, pathologize normal needs, or turn a relationship problem into an identity.',
        practice:
          'Describe specific behavior and impact before using any style label.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Translate protest into a request',
        description:
          'Express the underlying need without testing, disappearing, or escalating.',
        nextStep:
          'Draft: “When X happens, I feel Y and need Z. Are you willing to…?”',
      },
      {
        title: 'Score consistency, not intensity',
        description:
          'Review repeated reliability across ordinary situations.',
        nextStep:
          'Record examples of follow-through, clarity, repair, respect, and availability over the last month.',
      },
      {
        title: 'Replace a label with behavior',
        description:
          'Keep the framework from becoming a diagnosis of you or your partner.',
        nextStep:
          'Rewrite “They are avoidant” as a dated, observable behavior and its effect on the relationship.',
      },
    ],
    reflectionPrompts: [
      'What need sits underneath your most common protest or withdrawal behavior?',
      'What does this person consistently do, apart from moments of intensity?',
      'Which attachment label is obscuring a more specific behavior, incompatibility, or safety issue?',
    ],
    sources: [
      {
        label: 'Amir Levine: Attached',
        url: 'https://amirlevinemd.com/books/attached/',
        sourceType: 'author',
      },
      {
        label: 'National Domestic Violence Hotline: Relationship spectrum',
        url: 'https://www.thehotline.org/resources/healthy-relationships/',
        sourceType: 'clinical-context',
      },
    ],
    medicalCaveat:
      'Popular attachment categories are not mental health diagnoses and should not be used to excuse coercion, stalking, threats, violence, or chronic disrespect. Relationship anxiety can also reflect actual inconsistency or danger, not only an internal style. Prioritize safety and qualified support when needed.',
  }),
  defineBook({
    id: 'hold-me-tight',
    title: 'Hold Me Tight',
    author: 'Sue Johnson',
    topic: 'Relationships & boundaries',
    displayTags: ['Couples', 'Attachment', 'Repair'],
    readTimeMinutes: 16,
    summary:
      'Sue Johnson translates emotionally focused couple therapy into conversations about disconnection, recurring conflict cycles, emotional accessibility, responsiveness, engagement, forgiveness, sex, and secure bonding. The exercises assume enough safety for mutual vulnerability.',
    centralPremise:
      'Many couple conflicts are maintained by a recurring interaction cycle in which each person’s attempt to protect connection or self-respect triggers the other. Partners can work against the cycle by identifying it together and responding more accessibly and directly to underlying attachment needs.',
    corePremises: [
      {
        title: 'The cycle is the shared problem',
        premise:
          'Pursuing, criticizing, defending, shutting down, and distancing can form a feedback loop even when both people want connection.',
        whyItMatters:
          'Externalizing the cycle can reduce character attacks and expose the fear or need driving each move.',
        practice:
          'Map the sequence as trigger, Person A response, Person B interpretation and response, then the resulting impact on Person A.',
      },
      {
        title: 'Accessibility and responsiveness build security',
        premise:
          'Partners often seek evidence that the other can be reached, will respond, and will remain emotionally engaged when it matters.',
        whyItMatters:
          'Arguments about chores, timing, or tone may also carry questions about importance, trust, and availability.',
        practice:
          'Name the concrete issue and the attachment question without assuming they are identical.',
      },
      {
        title: 'Repair requires safety and accountability',
        premise:
          'Vulnerable conversation can support repair when both people can listen, take responsibility, and respect limits.',
        whyItMatters:
          'Mutual-cycle language is inappropriate when one person uses coercion, intimidation, violence, or retaliation.',
        practice:
          'Screen for fear and freedom to disagree before attempting a joint vulnerability exercise.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Draw the conflict cycle',
        description:
          'Make the repeated sequence visible without deciding which person is the entire problem.',
        nextStep:
          'Write each trigger, protective move, interpretation, and next move using observable language.',
      },
      {
        title: 'Name the underlying question',
        description:
          'Express the connection need beneath a surface argument.',
        nextStep:
          'Complete: “When this happens, I start to wonder whether…, and what I need is…”',
      },
      {
        title: 'Set conversation safety conditions',
        description:
          'Attempt vulnerable dialogue only when both people can pause and disagree without punishment.',
        nextStep:
          'Agree on duration, pause signal, prohibited behaviors, and how each person can safely leave the conversation.',
      },
    ],
    reflectionPrompts: [
      'What repeated sequence takes over when you and your partner feel disconnected?',
      'What fear or need is hidden beneath your protective move?',
      'Can both people disagree, pause, and set limits without retaliation?',
    ],
    sources: [
      {
        label: 'Sue Johnson: Books',
        url: 'https://drsuejohnson.com/books/',
        sourceType: 'author',
      },
      {
        label: 'National Domestic Violence Hotline: Relationship spectrum',
        url: 'https://www.thehotline.org/resources/healthy-relationships/',
        sourceType: 'clinical-context',
      },
    ],
    medicalCaveat:
      'Couples exercises are not appropriate where there is coercive control, fear, stalking, threats, or violence. Framing abuse as a shared communication cycle can increase danger and obscure responsibility. Seek specialized, individual safety support rather than joint vulnerability work in those situations.',
  }),
  defineBook({
    id: 'nonviolent-communication',
    title: 'Nonviolent Communication',
    author: 'Marshall B. Rosenberg',
    topic: 'Relationships & boundaries',
    displayTags: ['Communication', 'Needs', 'Requests'],
    readTimeMinutes: 16,
    summary:
      'Marshall Rosenberg presents a communication process organized around observations, feelings, needs, and requests. The framework aims to reduce blame and increase clarity, but it should not be used to demand emotional disclosure or to make respectful wording a prerequisite for safety and accountability.',
    centralPremise:
      'Conflict can become more workable when people distinguish observable events from evaluations, identify their own feelings and needs, and make specific requests that permit a genuine no. Empathic listening is a choice, not an obligation to remain in harmful interaction.',
    corePremises: [
      {
        title: 'Observation is narrower than evaluation',
        premise:
          'A concrete description names what could be recorded, while labels and mind-reading add interpretations about character or intent.',
        whyItMatters:
          'Specific observations are easier to confirm, dispute, and address than global accusations.',
        practice:
          'Replace always, never, selfish, and disrespectful with the dated behavior you observed.',
      },
      {
        title: 'Feelings and needs are owned, not weaponized',
        premise:
          'Naming an internal experience can support clarity, while phrases that disguise blame as feeling keep accusation in the sentence.',
        whyItMatters:
          'Ownership reduces pressure on another person to accept a diagnosis of their motives.',
        practice:
          'Use a feeling word and a broadly human need, avoiding “I feel that you…” or “I feel manipulated.”',
      },
      {
        title: 'A request allows refusal',
        premise:
          'A specific, doable request differs from a demand because the other person can decline without punishment or moral condemnation.',
        whyItMatters:
          'Consent and negotiation disappear when compliance is the only safe response.',
        practice:
          'State the requested action, timeframe, and what you will do if the answer is no.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Write a four-part message',
        description:
          'Practice observation, feeling, need, and request using one low-stakes event.',
        nextStep:
          'Draft four short sentences and remove any claim about the other person’s hidden motive.',
      },
      {
        title: 'Test whether it is a request',
        description:
          'Check whether refusal is genuinely permitted without punishment.',
        nextStep:
          'Write how you could respond respectfully to no and what boundary remains available to you.',
      },
      {
        title: 'Set an empathy limit',
        description:
          'Protect against using compassionate listening as compulsory exposure to hostility.',
        nextStep:
          'Define the behavior that ends the conversation and the safe way you will disengage.',
      },
    ],
    reflectionPrompts: [
      'Which part of your statement is observable, and which part assumes motive or character?',
      'What need are you trying to protect or meet?',
      'Can the other person safely say no, and what choice remains yours if they do?',
    ],
    sources: [
      {
        label: 'PuddleDancer Press: Nonviolent Communication',
        url: 'https://nonviolentcommunication.com/product/nvc/',
        sourceType: 'publisher',
      },
      {
        label: 'National Domestic Violence Hotline: Relationship spectrum',
        url: 'https://www.thehotline.org/resources/healthy-relationships/',
        sourceType: 'clinical-context',
      },
    ],
  }),
  defineBook({
    id: 'adult-children-of-emotionally-immature-parents',
    title: 'Adult Children of Emotionally Immature Parents',
    author: 'Lindsay C. Gibson',
    topic: 'Relationships & boundaries',
    displayTags: ['Family patterns', 'Emotional needs', 'Boundaries'],
    readTimeMinutes: 16,
    summary:
      'Lindsay Gibson describes family patterns in which parents have limited emotional availability, self-reflection, reciprocity, or tolerance for a child’s separate inner life. The framework can validate unmet needs, but its categories are descriptive and should not become remote diagnoses.',
    centralPremise:
      'Children often adapt to emotionally limited caregiving by suppressing needs, overfunctioning, scanning others, or pursuing unavailable validation. Adults can recognize these adaptations, revise expectations, build an internally directed life, and choose relationships with greater reciprocity.',
    corePremises: [
      {
        title: 'A family role can hide the authentic self',
        premise:
          'A child may learn to be easy, impressive, invisible, responsible, or emotionally useful in order to preserve connection.',
        whyItMatters:
          'The adaptation can continue automatically even when adult relationships permit more choice.',
        practice:
          'Notice one moment when you perform a role instead of expressing a preference, limit, or feeling.',
      },
      {
        title: 'Emotional loneliness can occur within contact',
        premise:
          'Frequent interaction does not guarantee curiosity, empathy, mutuality, or room for another person’s internal experience.',
        whyItMatters:
          'Naming the missing relational quality can be clearer than blaming yourself for feeling lonely around family.',
        practice:
          'Identify the specific response you seek and whether this person has repeatedly demonstrated capacity to provide it.',
      },
      {
        title: 'Realistic expectations protect energy',
        premise:
          'A person can understand a parent’s limitations while deciding not to keep seeking the same unavailable response.',
        whyItMatters:
          'Acceptance of current capacity can support grief and boundaries without requiring forgiveness, confrontation, or estrangement.',
        practice:
          'Match the depth and topic of contact to observed reliability rather than family role alone.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Identify one inherited role',
        description:
          'Notice the behavior you use to preserve connection at the expense of authenticity.',
        nextStep:
          'Write the role, the feared consequence of dropping it, and one low-risk authentic response.',
      },
      {
        title: 'Name the missing quality',
        description:
          'Replace global disappointment with the specific relational capacity you need.',
        nextStep:
          'Choose one: curiosity, empathy, accountability, consistency, reciprocity, or respect for separateness, and cite recent evidence.',
      },
      {
        title: 'Right-size the interaction',
        description:
          'Choose contact that reflects what is reliably available.',
        nextStep:
          'Set one limit on topic, duration, frequency, financial entanglement, or emotional disclosure.',
      },
    ],
    reflectionPrompts: [
      'Which version of yourself was most rewarded or safest in your family?',
      'What specific relational quality have you kept seeking from someone who rarely shows it?',
      'What level of contact matches observed capacity rather than obligation or hope?',
    ],
    sources: [
      {
        label: 'New Harbinger: Adult Children of Emotionally Immature Parents',
        url: 'https://www.newharbinger.com/9781626251700/adult-children-of-emotionally-immature-parents/',
        sourceType: 'publisher',
      },
      {
        label: 'National Domestic Violence Hotline: Relationship spectrum',
        url: 'https://www.thehotline.org/resources/healthy-relationships/',
        sourceType: 'clinical-context',
      },
    ],
    medicalCaveat:
      '“Emotionally immature” is a descriptive author framework, not a diagnosis to apply to relatives. Similar behavior may arise from many conditions and contexts, none of which excuse harm. Use observable patterns and current impact when making boundaries or care decisions.',
  }),
  defineBook({
    id: 'codependent-no-more',
    title: 'Codependent No More',
    author: 'Melody Beattie',
    topic: 'Relationships & boundaries',
    displayTags: ['Detachment', 'Caregiving', 'Self-direction'],
    readTimeMinutes: 15,
    summary:
      'Melody Beattie’s recovery-oriented book addresses overinvolvement in another person’s substance use, instability, or behavior. It encourages detachment, boundaries, and attention to one’s own life, while codependency itself is not a formal diagnosis and the concept has broad, contested uses.',
    centralPremise:
      'Trying to monitor, rescue, manage, or absorb the consequences of another adult’s behavior can consume a person’s life without creating control over the outcome. Recovery involves returning responsibility, protecting safety, and rebuilding attention to one’s own needs, values, and choices.',
    corePremises: [
      {
        title: 'Caring and controlling are different',
        premise:
          'Support can respect another adult’s agency, while repeated monitoring, covering, rescuing, or coercing attempts to manage outcomes outside one’s control.',
        whyItMatters:
          'Control efforts may temporarily reduce anxiety while increasing exhaustion, secrecy, resentment, or enablement.',
        practice:
          'Classify one action as support, self-protection, natural consequence, rescue, or control, and explain the evidence.',
      },
      {
        title: 'Detachment is not indifference',
        premise:
          'A person can care deeply while declining responsibility for another adult’s choices and consequences.',
        whyItMatters:
          'Without this distinction, boundaries may feel like abandonment and overfunctioning may feel like love.',
        practice:
          'State what you care about, what is not yours to control, and what protective action remains yours.',
      },
      {
        title: 'Attention can return to the self',
        premise:
          'Chronic crisis focus can make personal health, relationships, finances, rest, and goals disappear from awareness.',
        whyItMatters:
          'Rebuilding a life requires more than stopping one behavior; it requires reinvesting in neglected domains.',
        practice:
          'Choose one personal responsibility or source of meaning that will receive protected time this week.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Run a responsibility audit',
        description:
          'Separate another adult’s choices from your safety, property, dependents, and commitments.',
        nextStep:
          'Create “mine,” “theirs,” and “shared” columns for one recurring crisis.',
      },
      {
        title: 'Draft a caring detachment statement',
        description:
          'Hold genuine concern and a clear limit in the same message.',
        nextStep:
          'Write: “I care about you. I cannot do X. I can do Y, and I will take Z action to protect…”',
      },
      {
        title: 'Restore one neglected domain',
        description:
          'Redirect time toward your own health, work, finances, relationships, or rest.',
        nextStep:
          'Schedule one 30-minute action that is unrelated to monitoring or repairing the other person.',
      },
    ],
    reflectionPrompts: [
      'Which action feels like care but is primarily an attempt to control uncertainty?',
      'What consequence belongs to another adult, and what safety issue still belongs to you?',
      'Which part of your own life has been displaced by crisis management?',
    ],
    sources: [
      {
        label: 'Melody Beattie: Codependent No More',
        url: 'https://www.melodybeattie.com/codependentnomore',
        sourceType: 'author',
      },
      {
        label: 'SAMHSA: Find Support',
        url: 'https://www.samhsa.gov/find-support',
        sourceType: 'clinical-context',
      },
    ],
    medicalCaveat:
      'Codependency is not a formal mental health diagnosis, and the label can pathologize caregiving, trauma adaptations, disability support, or culturally valued interdependence. It should never shift responsibility away from a person causing abuse or substance-related harm.',
  }),
  defineBook({
    id: 'the-seven-principles-for-making-marriage-work',
    title: 'The Seven Principles for Making Marriage Work',
    author: 'John Gottman and Nan Silver',
    topic: 'Relationships & boundaries',
    displayTags: ['Couples', 'Friendship', 'Conflict'],
    readTimeMinutes: 17,
    summary:
      'John Gottman and Nan Silver translate decades of couple research and clinical observation into practices involving friendship, fondness, influence, solvable problems, enduring differences, shared meaning, and repair. Population findings do not predict an individual relationship with certainty.',
    centralPremise:
      'Relationship stability depends less on eliminating conflict than on the quality of everyday friendship, respect, repair, responsiveness, and the ability to manage both solvable problems and enduring differences. Skills require mutual participation and cannot make an unsafe relationship safe.',
    corePremises: [
      {
        title: 'Friendship is maintained through current knowledge',
        premise:
          'Partners benefit from continuing to learn each other’s stresses, hopes, preferences, relationships, and inner world.',
        whyItMatters:
          'Familiarity can create the illusion that no further curiosity is needed.',
        practice:
          'Ask one open question about a current concern and summarize the answer before responding.',
      },
      {
        title: 'Conflict patterns matter more than disagreement alone',
        premise:
          'Contempt, global criticism, defensiveness, and withdrawal can make problem-solving harder, while gentle openings and repair attempts reduce escalation.',
        whyItMatters:
          'A recurring process can damage connection even when the original issue is minor or legitimate.',
        practice:
          'Rewrite a global accusation as a specific event, feeling, need, and request.',
      },
      {
        title: 'Some conflicts require management, not solution',
        premise:
          'Differences rooted in temperament, values, family history, or life dreams may persist despite good-faith negotiation.',
        whyItMatters:
          'Demanding permanent resolution can turn a workable difference into chronic gridlock.',
        practice:
          'Identify the value or dream beneath each position and negotiate how both receive some space.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Update a love map',
        description:
          'Learn what is currently happening in your partner’s internal and external world.',
        nextStep:
          'Ask three open questions about current stress, hope, and support, then reflect back what you heard.',
      },
      {
        title: 'Repair one conflict opening',
        description:
          'Reduce escalation by replacing a global attack with a specific request.',
        nextStep:
          'Rewrite your first sentence to name one event, your feeling, and one doable request.',
      },
      {
        title: 'Find the dream beneath the position',
        description:
          'Explore the value each person is protecting in an enduring disagreement.',
        nextStep:
          'Each person names why the issue matters and one flexible area where the other value can be honored.',
      },
    ],
    reflectionPrompts: [
      'What important part of your partner’s current world have you stopped asking about?',
      'Which conflict behavior blocks repair even when your underlying concern is valid?',
      'What value or life dream sits beneath each side of an enduring disagreement?',
    ],
    sources: [
      {
        label: 'Gottman Institute: The Seven Principles',
        url: 'https://www.gottman.com/product/the-seven-principles-for-making-marriage-work/',
        sourceType: 'author',
      },
      {
        label: 'National Domestic Violence Hotline: Relationship spectrum',
        url: 'https://www.thehotline.org/resources/healthy-relationships/',
        sourceType: 'clinical-context',
      },
    ],
    medicalCaveat:
      'Relationship research describes probabilities and patterns, not a deterministic compatibility test. Communication exercises are not appropriate for coercive or violent relationships, and no skill makes one partner responsible for preventing another’s abuse.',
  }),
  defineBook({
    id: 'platonic',
    title: 'Platonic',
    author: 'Marisa G. Franco',
    topic: 'Relationships & boundaries',
    displayTags: ['Friendship', 'Belonging', 'Initiative'],
    readTimeMinutes: 15,
    summary:
      'Marisa G. Franco combines friendship research with attachment-informed interpretation to explain how adult friendships begin, deepen, and endure. She emphasizes initiative, repeated contact, affection, generosity, vulnerability, and the need to treat friendship as worthy of deliberate investment.',
    centralPremise:
      'Adult friendship rarely develops through chemistry alone; it grows through repeated opportunities, explicit bids for connection, mutuality, and dependable care. People can increase the probability of connection while recognizing that rejection, fit, access, and reciprocity are not fully controllable.',
    corePremises: [
      {
        title: 'Connection often requires initiative',
        premise:
          'People may assume friendship should happen spontaneously and interpret the need to reach out as evidence that interest is unequal.',
        whyItMatters:
          'Waiting for certainty can prevent the repeated contact from which closeness develops.',
        practice:
          'Make one specific, low-pressure invitation with a clear time and activity.',
      },
      {
        title: 'Repeated unplanned contact can be recreated',
        premise:
          'School and shared environments naturally produce frequency, while adult life often requires recurring structures.',
        whyItMatters:
          'One enjoyable meeting may not become friendship without another opportunity already on the calendar.',
        practice:
          'Join or create an activity that meets repeatedly rather than relying only on one-off events.',
      },
      {
        title: 'Mutuality distinguishes investment from pursuit',
        premise:
          'Healthy friendship includes some reciprocal initiation, responsiveness, curiosity, repair, and respect for limits.',
        whyItMatters:
          'Advice to be proactive should not become pressure to chase unavailable people or ignore imbalance.',
        practice:
          'Review behavior over time and redirect effort when reciprocity remains consistently absent.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Send one specific invitation',
        description:
          'Reduce ambiguity and planning friction with a concrete, low-pressure proposal.',
        nextStep:
          'Invite one person to a named activity on one of two dates and make declining easy.',
      },
      {
        title: 'Choose a recurring context',
        description:
          'Create the repetition that adult friendship often lacks.',
        nextStep:
          'Identify one class, group, volunteer role, faith community, or routine that meets at least monthly.',
      },
      {
        title: 'Audit reciprocity over time',
        description:
          'Balance initiative with evidence that the relationship has room for both people.',
        nextStep:
          'Note recent examples of initiation, follow-through, curiosity, support, and boundary respect from each side.',
      },
    ],
    reflectionPrompts: [
      'Whom would you contact if you did not require certainty that they would say yes?',
      'What recurring environment fits your interests and access needs?',
      'Which friendship deserves more investment, and which pattern suggests redirecting your energy?',
    ],
    sources: [
      {
        label: 'Penguin Random House: Platonic',
        url: 'https://www.penguinrandomhouse.com/books/676695/platonic-by-marisa-g-franco-phd/9780593331903/',
        sourceType: 'publisher',
      },
      {
        label: 'U.S. Surgeon General: Social connection advisory',
        url: 'https://www.hhs.gov/surgeongeneral/priorities/connection/index.html',
        sourceType: 'research',
      },
    ],
  }),
  defineBook({
    id: 'all-about-love',
    title: 'All About Love',
    author: 'bell hooks',
    topic: 'Relationships & boundaries',
    displayTags: ['Love ethic', 'Care', 'Justice'],
    readTimeMinutes: 17,
    summary:
      'bell hooks examines love across family, romance, community, spirituality, and public life. She argues against reducing love to feeling or attachment and instead treats it as an ethic expressed through care, knowledge, responsibility, respect, trust, and commitment.',
    centralPremise:
      'Love is better evaluated through sustained practice than declared feeling. Affection can coexist with domination, neglect, dishonesty, or harm, but a love ethic requires actions that support growth, dignity, truth, accountability, and freedom in both private and collective life.',
    corePremises: [
      {
        title: 'Love is enacted through multiple qualities',
        premise:
          'Care alone is insufficient when knowledge, responsibility, respect, trust, or commitment is absent.',
        whyItMatters:
          'A multidimensional definition makes it harder to use strong feeling as proof that a relationship is loving in practice.',
        practice:
          'Evaluate one relationship across the distinct qualities instead of issuing a single loved or unloved verdict.',
      },
      {
        title: 'Love and domination conflict',
        premise:
          'Control, humiliation, violence, and disregard for another person’s growth are incompatible with a love ethic even when attachment is intense.',
        whyItMatters:
          'Naming harm clearly resists cultural stories that equate jealousy, possession, or suffering with depth of love.',
        practice:
          'Describe the behavior and its effect without allowing claimed love to settle the question of safety or respect.',
      },
      {
        title: 'Love is also a public ethic',
        premise:
          'The values practiced in intimate life connect to community, education, work, justice, material care, and resistance to domination.',
        whyItMatters:
          'Love becomes more than private sentiment when it shapes how power and resources are used.',
        practice:
          'Choose one collective action that expresses care, accountability, respect, or repair beyond your closest relationships.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Run a love-practice inventory',
        description:
          'Assess observable care, knowledge, responsibility, respect, trust, and commitment separately.',
        nextStep:
          'For one relationship, write one behavior supporting each quality and one gap that needs attention.',
      },
      {
        title: 'Separate intensity from care',
        description:
          'Evaluate whether strong emotion is accompanied by dignity, freedom, safety, and growth.',
        nextStep:
          'List what the relationship consistently makes possible and what it repeatedly restricts.',
      },
      {
        title: 'Choose one public expression of care',
        description:
          'Extend a love ethic into community responsibility.',
        nextStep:
          'Commit to one specific act of mutual aid, advocacy, repair, mentoring, or resource sharing.',
      },
    ],
    reflectionPrompts: [
      'Which quality of loving practice is strongest in this relationship, and which is missing?',
      'Where have you mistaken intensity, need, or possession for evidence of care?',
      'How could your use of time, power, or resources express a love ethic publicly?',
    ],
    sources: [
      {
        label: 'HarperCollins: All About Love',
        url: 'https://www.harpercollins.com/products/all-about-love-bell-hooks',
        sourceType: 'publisher',
      },
      {
        label: 'National Domestic Violence Hotline: Relationship spectrum',
        url: 'https://www.thehotline.org/resources/healthy-relationships/',
        sourceType: 'clinical-context',
      },
    ],
  }),
  defineBook({
    id: 'tiny-habits',
    title: 'Tiny Habits',
    author: 'BJ Fogg',
    topic: 'Habits & growth',
    displayTags: ['Behavior design', 'Prompts', 'Celebration'],
    readTimeMinutes: 15,
    summary:
      'BJ Fogg presents a behavior-design method built around motivation, ability, and prompts. Rather than demanding high motivation, the method shrinks a behavior, anchors it after an existing routine, and uses an immediate positive response to reinforce successful performance.',
    centralPremise:
      'Reliable behavior is easier when the action is simple enough for low-motivation moments, the prompt occurs at the right time, and success feels positive. Lasting change can grow from a very small behavior after the sequence becomes stable.',
    corePremises: [
      {
        title: 'Behavior needs motivation, ability, and a prompt',
        premise:
          'A desired action is less likely when it is too difficult, motivation is low, or no effective cue occurs.',
        whyItMatters:
          'Diagnosing the design problem avoids turning every missed behavior into a character judgment.',
        practice:
          'For one missed action, identify whether motivation, ability, or prompt was the weakest element.',
      },
      {
        title: 'Start smaller than the aspiration',
        premise:
          'An aspiration such as becoming organized must be translated into a tiny action that can happen in seconds.',
        whyItMatters:
          'The tiny version builds consistency while leaving room to do more when capacity is available.',
        practice:
          'Reduce the behavior until it can be performed on a difficult day without special preparation.',
      },
      {
        title: 'Emotion helps a behavior register',
        premise:
          'An immediate authentic feeling of success can reinforce the new sequence more directly than distant rewards.',
        whyItMatters:
          'Harsh evaluation after completion can make even successful practice feel like failure.',
        practice:
          'Use a brief, credible acknowledgment immediately after the behavior rather than exaggerated praise.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Diagnose the design',
        description:
          'Locate the failure point before asking for more willpower.',
        nextStep:
          'Rate motivation, ability, and prompt quality from 1 to 5 for one target behavior.',
      },
      {
        title: 'Write an anchor recipe',
        description:
          'Connect a tiny action to a reliable existing event.',
        nextStep:
          'Complete: “After I…, I will…” with an action that takes less than 30 seconds.',
      },
      {
        title: 'Choose a credible celebration',
        description:
          'Mark completion positively without making the response performative.',
        nextStep:
          'Pick one quiet phrase, gesture, or checkmark you can use immediately after the action.',
      },
    ],
    reflectionPrompts: [
      'Is the missed behavior blocked by motivation, difficulty, or an unreliable prompt?',
      'What is the smallest version that still counts as starting?',
      'What acknowledgment of success feels genuine rather than forced?',
    ],
    sources: [
      {
        label: 'BJ Fogg: Tiny Habits',
        url: 'https://tinyhabits.com/book/',
        sourceType: 'author',
      },
      {
        label: 'Behavior Design Lab at Stanford',
        url: 'https://behaviordesign.stanford.edu/',
        sourceType: 'research',
      },
    ],
  }),
  defineBook({
    id: 'the-power-of-habit',
    title: 'The Power of Habit',
    author: 'Charles Duhigg',
    topic: 'Habits & growth',
    displayTags: ['Habit loop', 'Keystone habits', 'Organizations'],
    readTimeMinutes: 16,
    summary:
      'Charles Duhigg uses research and narrative reporting to describe habits in individuals, organizations, and societies. The cue-routine-reward loop is a useful observation tool, but many habits and health conditions are more complex than a single loop.',
    centralPremise:
      'Repeated behavior often becomes linked to cues and anticipated rewards. Change is more plausible when the cue and function are understood, an alternative routine provides a similar benefit, and the environment and social system support repetition.',
    corePremises: [
      {
        title: 'The reward reveals the function',
        premise:
          'Two identical-looking routines may serve different functions such as stimulation, relief, connection, escape, or transition.',
        whyItMatters:
          'Replacing only the surface behavior may fail when the underlying reward remains unmet.',
        practice:
          'Test several alternative rewards and observe which one reduces the original urge.',
      },
      {
        title: 'Change often preserves part of the loop',
        premise:
          'A practical strategy may keep a familiar cue and reward while introducing a safer or more useful routine.',
        whyItMatters:
          'Complete suppression is not always the easiest or most sustainable first step.',
        practice:
          'Design one replacement response for the exact cue instead of a general intention to stop.',
      },
      {
        title: 'Organizations have routines too',
        premise:
          'Policies, incentives, communication paths, and informal norms can repeatedly produce behavior beyond individual choice.',
        whyItMatters:
          'A habit lens should include the system rather than assigning every outcome to personal discipline.',
        practice:
          'Map the organizational cue, routine, reward, and stakeholder incentives around one recurring problem.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Identify the actual reward',
        description:
          'Test what the routine is providing before selecting a substitute.',
        nextStep:
          'Across three episodes, vary the replacement reward and record whether the urge remains after 15 minutes.',
      },
      {
        title: 'Write a replacement loop',
        description:
          'Pair the known cue with a routine that can meet a similar need at lower cost.',
        nextStep:
          'Document cue, old routine, likely reward, new routine, and how you will measure fit.',
      },
      {
        title: 'Check the system',
        description:
          'Look for policies or incentives that repeatedly trigger the behavior.',
        nextStep:
          'Identify one environmental cue or incentive you can remove, delay, or redesign.',
      },
    ],
    reflectionPrompts: [
      'What reward does the routine reliably provide in the short term?',
      'Which replacement could meet the same function with fewer costs?',
      'What environmental or organizational pattern keeps cueing the behavior?',
    ],
    sources: [
      {
        label: 'Penguin Random House: The Power of Habit',
        url: 'https://www.penguinrandomhouse.com/books/202855/the-power-of-habit-by-charles-duhigg/9780679603856/',
        sourceType: 'publisher',
      },
      {
        label: 'Charles Duhigg: The Power of Habit',
        url: 'https://charlesduhigg.com/the-power-of-habit/',
        sourceType: 'author',
      },
    ],
  }),
  defineBook({
    id: 'four-thousand-weeks',
    title: 'Four Thousand Weeks',
    author: 'Oliver Burkeman',
    topic: 'Burnout & recovery',
    displayTags: ['Time', 'Finitude', 'Priorities'],
    readTimeMinutes: 16,
    summary:
      'Oliver Burkeman critiques the attempt to master time by increasing efficiency without limit. He argues that finitude, uncertainty, and tradeoffs are unavoidable, so meaningful time use requires choosing what to neglect rather than imagining everything important can be completed.',
    centralPremise:
      'Human time is radically limited, and productivity systems become traps when they promise control over an unfinishable supply of demands. Freedom comes from accepting tradeoffs, selecting a small number of commitments, and participating in life before conditions are perfect.',
    corePremises: [
      {
        title: 'Efficiency can create more demand',
        premise:
          'Completing work faster can attract additional tasks, raise expectations, and make more possibilities visible.',
        whyItMatters:
          'Optimization alone does not settle which demands deserve finite time.',
        practice:
          'For one efficiency improvement, decide in advance what the saved time is for and what new demand will not fill it.',
      },
      {
        title: 'Neglect is unavoidable',
        premise:
          'Choosing one meaningful commitment necessarily means not doing many other worthwhile things now.',
        whyItMatters:
          'Treating every omission as failure creates chronic guilt and fragmented attention.',
        practice:
          'Choose in advance which low-priority area will receive an adequate rather than ideal standard.',
      },
      {
        title: 'Meaning happens under uncertainty',
        premise:
          'Waiting for complete readiness, confidence, or control postpones participation in the only time actually available.',
        whyItMatters:
          'A finite-life perspective favors concrete engagement over perfect future conditions.',
        practice:
          'Take one reversible step toward a valued activity before resolving every uncertainty.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Set a fixed work-in-progress limit',
        description:
          'Protect attention by limiting how many substantial commitments are active.',
        nextStep:
          'Choose a maximum of three active projects and place every other idea on a not-now list.',
      },
      {
        title: 'Decide what to neglect',
        description:
          'Make one tradeoff explicit rather than experiencing it as accidental failure.',
        nextStep:
          'Name one domain that will receive a good-enough standard this week and define that standard.',
      },
      {
        title: 'Act before perfect readiness',
        description:
          'Enter a valued experience while some uncertainty remains.',
        nextStep:
          'Schedule one 20-minute first step that cannot be replaced by more planning.',
      },
    ],
    reflectionPrompts: [
      'Which efficiency improvement has mainly allowed more work to enter?',
      'What worthy task will you deliberately not prioritize right now?',
      'What valued experience are you postponing until an impossible state of readiness?',
    ],
    sources: [
      {
        label: 'Macmillan: Four Thousand Weeks',
        url: 'https://us.macmillan.com/books/9781250834386/fourthousandweeks/',
        sourceType: 'publisher',
      },
      {
        label: 'Oliver Burkeman: Books',
        url: 'https://www.oliverburkeman.com/books',
        sourceType: 'author',
      },
    ],
  }),
  defineBook({
    id: 'rest-is-resistance',
    title: 'Rest Is Resistance',
    author: 'Tricia Hersey',
    topic: 'Burnout & recovery',
    displayTags: ['Rest', 'Liberation', 'Systems'],
    readTimeMinutes: 16,
    summary:
      'Tricia Hersey connects rest to resistance against grind culture and the historical extraction of Black labor. The book treats rest as a human right and communal practice rather than a reward earned by productivity or merely a technique for returning to work more efficiently.',
    centralPremise:
      'A culture that measures human worth through output makes exhaustion appear normal and rest morally suspect. Reclaiming rest can challenge internalized productivity demands while supporting imagination, dignity, care, and collective resistance to exploitative systems.',
    corePremises: [
      {
        title: 'Grind culture has history and power',
        premise:
          'Pressure for constant output is not only a personal scheduling problem; it is connected to racial capitalism, labor extraction, and unequal access to safety and leisure.',
        whyItMatters:
          'Individual sleep tips cannot solve structural conditions that deny people time, income, housing, or care.',
        practice:
          'Name one internal demand and one institutional condition contributing to your exhaustion.',
      },
      {
        title: 'Rest is broader than sleep',
        premise:
          'Rest can include pausing, daydreaming, quiet, prayer, boundaries, slowness, art, stillness, and release from performance.',
        whyItMatters:
          'People with limited sleep opportunity or capacity can still explore forms of interruption and restoration.',
        practice:
          'Choose a form of rest that does not require purchasing a product or optimizing a result.',
      },
      {
        title: 'Rest need not justify itself through productivity',
        premise:
          'When rest is valued only because it improves later output, the person remains subordinate to performance.',
        whyItMatters:
          'A right to rest is different from a maintenance strategy for more efficient labor.',
        practice:
          'Take one brief rest period without measuring whether it made you more productive afterward.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Map personal and structural exhaustion',
        description:
          'Separate internalized demands from external constraints that require collective or institutional change.',
        nextStep:
          'Create two columns and add one action, support, or advocacy need to each.',
      },
      {
        title: 'Build a no-cost rest menu',
        description:
          'Expand rest beyond sleep, consumption, and wellness performance.',
        nextStep:
          'List five accessible pauses ranging from 30 seconds to 30 minutes.',
      },
      {
        title: 'Practice non-instrumental rest',
        description:
          'Let a pause have value without proving a later performance gain.',
        nextStep:
          'Schedule ten minutes with no output goal, tracking only whether you respected the boundary.',
      },
    ],
    reflectionPrompts: [
      'Which message taught you that rest must be earned?',
      'What form of rest is accessible without money, special equipment, or perfect conditions?',
      'What workplace, household, or policy condition keeps recreating exhaustion beyond individual choice?',
    ],
    sources: [
      {
        label: 'Hachette: Rest Is Resistance',
        url: 'https://www.hachettebookgroup.com/titles/tricia-hersey/rest-is-resistance/9780316365215/',
        sourceType: 'publisher',
      },
      {
        label: 'The Nap Ministry',
        url: 'https://thenapministry.wordpress.com/about/',
        sourceType: 'author',
      },
    ],
  }),
  defineBook({
    id: 'wintering',
    title: 'Wintering',
    author: 'Katherine May',
    topic: 'Burnout & recovery',
    displayTags: ['Life transitions', 'Rest', 'Seasonality'],
    readTimeMinutes: 15,
    summary:
      'Katherine May uses memoir, nature, travel, and seasonal metaphor to explore periods of illness, loss, withdrawal, and transition. Wintering is presented as a way to recognize and tend difficult seasons rather than treating uninterrupted productivity as the normal shape of life.',
    centralPremise:
      'Lives include recurring periods when ordinary pace and participation are not possible. Naming a winter can permit rest, preparation, support, and a different standard of functioning, while accepting that difficult seasons do not follow a guaranteed calendar.',
    corePremises: [
      {
        title: 'Difficult seasons are part of life',
        premise:
          'Illness, grief, caregiving, job loss, burnout, and transition can interrupt expected progress without representing a personal exception to normal humanity.',
        whyItMatters:
          'Recognizing seasonality can reduce shame about needing a different pace.',
        practice:
          'Name what has changed and which old expectation no longer matches current capacity.',
      },
      {
        title: 'Preparation can be an act of care',
        premise:
          'Simplifying commitments, gathering support, creating warmth, and protecting essentials can make a low-capacity period more inhabitable.',
        whyItMatters:
          'Practical preparation acknowledges reality without requiring certainty about duration.',
        practice:
          'Create a minimum-care plan for food, medication, sleep, money, transport, connection, and obligations.',
      },
      {
        title: 'Metaphor should not replace assessment',
        premise:
          'A wintering frame can offer meaning, but it cannot determine whether fatigue or withdrawal is depression, illness, medication effect, or another condition.',
        whyItMatters:
          'Romanticizing a difficult season could delay care or normalize dangerous loss of functioning.',
        practice:
          'Track duration, severity, physical symptoms, and function, and seek assessment when concerns persist or escalate.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Declare a temporary operating mode',
        description:
          'Adjust expectations explicitly rather than failing an invisible full-capacity standard.',
        nextStep:
          'Write what will continue, pause, be delegated, and be reviewed on a specific date.',
      },
      {
        title: 'Create a minimum-care plan',
        description:
          'Protect essentials during a period of reduced capacity.',
        nextStep:
          'Choose the minimum viable plan for meals, medication, sleep routine, contact, and one administrative task.',
      },
      {
        title: 'Set an assessment threshold',
        description:
          'Keep the seasonal metaphor from obscuring health concerns.',
        nextStep:
          'Write the symptom, duration, severity, or functional change that will prompt professional evaluation.',
      },
    ],
    reflectionPrompts: [
      'What expectation belongs to a higher-capacity season rather than the one you are in?',
      'Which practical preparation would make the next week more inhabitable?',
      'What change should be assessed rather than explained only as a season?',
    ],
    sources: [
      {
        label: 'Penguin Random House: Wintering',
        url: 'https://www.penguinrandomhouse.com/books/634027/wintering-by-katherine-may/',
        sourceType: 'publisher',
      },
      {
        label: 'NIMH: Depression',
        url: 'https://www.nimh.nih.gov/health/topics/depression',
        sourceType: 'clinical-context',
      },
    ],
  }),
  defineBook({
    id: 'mans-search-for-meaning',
    title: 'Man’s Search for Meaning',
    author: 'Viktor E. Frankl',
    topic: 'Grief & loss',
    displayTags: ['Meaning', 'Suffering', 'Responsibility'],
    readTimeMinutes: 17,
    summary:
      'Viktor Frankl combines testimony about Nazi concentration camps with an introduction to logotherapy, his meaning-centered therapeutic approach. The book argues for the importance of meaning while never making suffering necessary, deserved, or automatically transformative.',
    centralPremise:
      'People may retain some capacity to orient toward meaning through work, love, experience, or the stance taken toward unavoidable suffering. That capacity is constrained by real conditions and should not be used to blame people for trauma, illness, oppression, or despair.',
    corePremises: [
      {
        title: 'Meaning is specific rather than generic',
        premise:
          'The relevant question is not one abstract purpose for all life but what a particular situation asks or makes possible now.',
        whyItMatters:
          'A concrete responsibility can be more workable than pressure to discover a grand permanent mission.',
        practice:
          'Ask what person, task, value, or experience calls for your attention in the next day.',
      },
      {
        title: 'Meaning can arise through several paths',
        premise:
          'Frankl describes creating or contributing, encountering love or beauty, and choosing a stance when suffering truly cannot be changed.',
        whyItMatters:
          'The third path applies to unavoidable suffering and must not replace escape, treatment, justice, or practical change where those are possible.',
        practice:
          'First identify what can be changed or left; only then consider how to relate to what genuinely remains unavoidable.',
      },
      {
        title: 'Hope must not become blame',
        premise:
          'Accounts of endurance demonstrate possibility but do not establish that everyone can or should respond similarly under extreme conditions.',
        whyItMatters:
          'Meaning language can become cruel if it suggests that distress reflects insufficient attitude or purpose.',
        practice:
          'Pair every invitation to meaning with acknowledgment of constraint, loss, support needs, and the right not to redeem suffering.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Choose a near-term responsibility',
        description:
          'Translate purpose into one concrete act that matters now.',
        nextStep:
          'Name one person, task, or value that merits 15 minutes of attention tomorrow.',
      },
      {
        title: 'Separate changeable from unavoidable',
        description:
          'Do not use acceptance or attitude to bypass protection, treatment, or justice.',
        nextStep:
          'List what you can change, leave, seek help for, grieve, and only then what must currently be endured.',
      },
      {
        title: 'Remove compulsory redemption',
        description:
          'Allow meaning without requiring the harm to have been worthwhile.',
        nextStep:
          'Complete: “This should not have happened, and I still choose to…”',
      },
    ],
    reflectionPrompts: [
      'What concrete responsibility or relationship asks something meaningful of you now?',
      'Which part of the situation can still be changed, escaped, treated, or challenged?',
      'How can you choose meaning without claiming that suffering was necessary or deserved?',
    ],
    sources: [
      {
        label: 'Penguin Random House: Man’s Search for Meaning',
        url: 'https://www.penguinrandomhouse.com/books/206272/mans-search-for-meaning-by-viktor-e-frankl/9780807000007/',
        sourceType: 'publisher',
      },
      {
        label: 'Viktor Frankl Institute: Logotherapy',
        url: 'https://www.viktorfrankl.org/logotherapy.html',
        sourceType: 'author',
      },
    ],
    medicalCaveat:
      'Logotherapy is one therapeutic framework, not a universal treatment or a demand to find meaning in trauma. Never use the book to compare suffering, praise endurance of preventable harm, or imply that despair is a moral failure. Safety, treatment, material support, and justice remain essential.',
  }),
  defineBook({
    id: 'the-comfort-book',
    title: 'The Comfort Book',
    author: 'Matt Haig',
    topic: 'Mood & self-compassion',
    displayTags: ['Comfort', 'Perspective', 'Short reflections'],
    readTimeMinutes: 13,
    summary:
      'Matt Haig collects brief reflections, lists, memories, stories, and observations that have offered him perspective during difficult periods. The fragments are designed for selective reading and companionship rather than a linear argument or clinical program.',
    centralPremise:
      'When sustained concentration is unavailable, a small piece of language, memory, humor, nature, art, or connection can create a temporary foothold. Comfort need not solve the cause of distress to have value, and readers can keep only what genuinely helps.',
    corePremises: [
      {
        title: 'Comfort can be small and immediate',
        premise:
          'A brief sensory, relational, or imaginative experience may make a difficult interval more bearable without changing the whole situation.',
        whyItMatters:
          'Requiring every support to produce recovery can make ordinary relief seem trivial or undeserved.',
        practice:
          'Notice one thing that reduces distress slightly and record the conditions that made it available.',
      },
      {
        title: 'Short forms reduce cognitive demand',
        premise:
          'Fragments can be entered and left without remembering a long narrative or completing a structured exercise.',
        whyItMatters:
          'Low concentration often accompanies anxiety, grief, exhaustion, and depression.',
        practice:
          'Create a one-screen collection of sentences, images, songs, contacts, and reminders that are easy to access.',
      },
      {
        title: 'Personal comfort is not universal truth',
        premise:
          'A phrase that helps one person may feel false, sentimental, activating, or irrelevant to another.',
        whyItMatters:
          'Selective use protects autonomy and prevents comfort language from becoming invalidation.',
        practice:
          'Sort each item into keep, adapt, or discard without explaining why it should work.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Build a low-demand comfort list',
        description:
          'Prepare supports that remain accessible when concentration and planning are limited.',
        nextStep:
          'Add one sensory item, one person, one place, one piece of media, and one practical reminder.',
      },
      {
        title: 'Measure bearability, not cure',
        description:
          'Let a small support count even when it changes distress only slightly.',
        nextStep:
          'Before and after one comfort item, rate how bearable the next ten minutes feel from 0 to 10.',
      },
      {
        title: 'Remove unhelpful comfort',
        description:
          'Protect yourself from phrases or practices that create pressure or invalidation.',
        nextStep:
          'Delete or rewrite one item that tells you how you should feel rather than supporting what is here.',
      },
    ],
    reflectionPrompts: [
      'What helps the next ten minutes feel slightly more bearable?',
      'Which supports remain accessible when concentration is low?',
      'Which common comfort phrase feels invalidating or false, and what would fit better?',
    ],
    sources: [
      {
        label: 'Penguin Random House: The Comfort Book',
        url: 'https://www.penguinrandomhouse.com/books/672342/the-comfort-book-by-matt-haig/9780143136668/',
        sourceType: 'publisher',
      },
      {
        label: 'NIMH: Depression',
        url: 'https://www.nimh.nih.gov/health/topics/depression',
        sourceType: 'clinical-context',
      },
    ],
  }),
  defineBook({
    id: 'digital-minimalism',
    title: 'Digital Minimalism',
    author: 'Cal Newport',
    topic: 'Habits & growth',
    displayTags: ['Technology', 'Attention', 'Values'],
    readTimeMinutes: 16,
    summary:
      'Cal Newport proposes using digital tools selectively according to clearly defined values rather than accepting every convenient platform or notification. The method includes a temporary declutter followed by intentional reintroduction, but access, work, disability, safety, and community needs may limit abstinence.',
    centralPremise:
      'Attention is finite, and low-friction digital tools can occupy far more of it than their value justifies. A technology deserves a place when it strongly supports something important, has a defined role, and is used under conditions that limit avoidable costs.',
    corePremises: [
      {
        title: 'Utility is not enough',
        premise:
          'A tool can offer some benefit while still consuming disproportionate time, privacy, focus, sleep, or emotional capacity.',
        whyItMatters:
          'Asking only whether a service is useful makes nearly every service impossible to reject.',
        practice:
          'Compare the tool’s strongest value with its full cost and with lower-cost alternatives.',
      },
      {
        title: 'Rules convert values into use conditions',
        premise:
          'A general intention to use technology less is weaker than specifying purpose, timing, place, device, and stopping boundary.',
        whyItMatters:
          'Clear constraints reduce repeated in-the-moment negotiation with persuasive design.',
        practice:
          'Write one operating rule for a high-cost tool, including exceptions that reflect real needs.',
      },
      {
        title: 'High-quality alternatives must replace default use',
        premise:
          'Removing a digital behavior without restoring connection, leisure, information, or rest leaves the original need available.',
        whyItMatters:
          'An empty space increases the chance of rebound and can deepen boredom or isolation instead of improving life.',
        practice:
          'Schedule an accessible offline or lower-cost alternative before reducing the tool.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Complete a technology value audit',
        description:
          'Judge one tool by value delivered per cost, not by whether it has any benefit.',
        nextStep:
          'List the tool’s value, costs, alternatives, required access, and the smallest role that preserves its benefit.',
      },
      {
        title: 'Write a specific use rule',
        description:
          'Turn a vague reduction goal into observable conditions.',
        nextStep:
          'Specify when, where, why, for how long, and on which device you will use the tool.',
      },
      {
        title: 'Schedule a replacement',
        description:
          'Meet the original need before removing the habitual digital response.',
        nextStep:
          'Choose one replacement for connection, stimulation, rest, or information and put it on the calendar.',
      },
    ],
    reflectionPrompts: [
      'Which digital tool offers a real benefit at a disproportionate attentional or emotional cost?',
      'What precise role should that tool have in a life organized around your values?',
      'What need would go unmet if you reduced it without a replacement?',
    ],
    sources: [
      {
        label: 'Penguin Random House: Digital Minimalism',
        url: 'https://www.penguinrandomhouse.com/books/575667/digital-minimalism-by-cal-newport/9780525536543/',
        sourceType: 'publisher',
      },
      {
        label: 'Cal Newport: Digital Minimalism',
        url: 'https://calnewport.com/on-digital-minimalism/',
        sourceType: 'author',
      },
    ],
  }),
  defineBook({
    id: 'essentialism',
    title: 'Essentialism',
    author: 'Greg McKeown',
    topic: 'Habits & growth',
    displayTags: ['Priorities', 'Tradeoffs', 'Execution'],
    readTimeMinutes: 15,
    summary:
      'Greg McKeown presents essentialism as a disciplined process of exploring what matters, eliminating nonessential commitments, and making chosen work easier to execute. The approach is useful for prioritization but must account for obligations and constraints that cannot simply be declined.',
    centralPremise:
      'When time and energy are distributed across too many competing demands, important work receives partial attention and choice becomes reactive. Deliberately selecting fewer priorities makes tradeoffs visible and allows resources to be concentrated where they matter most.',
    corePremises: [
      {
        title: 'Tradeoffs exist whether acknowledged or not',
        premise:
          'Saying yes to one commitment spends time, energy, money, and attention that cannot be simultaneously assigned elsewhere.',
        whyItMatters:
          'Ignoring the tradeoff does not remove it; it makes the cost appear later as delay, stress, or poor quality.',
        practice:
          'For one new request, identify exactly what current commitment would receive less.',
      },
      {
        title: 'Selection needs explicit criteria',
        premise:
          'Without a standard for importance and fit, urgency, social pressure, and availability decide by default.',
        whyItMatters:
          'Clear criteria make declining less arbitrary and help compare unlike opportunities.',
        practice:
          'Choose three criteria and a minimum score a new commitment must meet.',
      },
      {
        title: 'Execution should remove friction',
        premise:
          'Once a priority is chosen, buffers, routines, preparation, and subtraction can reduce dependence on repeated willpower.',
        whyItMatters:
          'Prioritization that does not change the calendar or environment remains aspirational.',
        practice:
          'Reserve time, remove one obstacle, and define the next physical action.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Name the displaced commitment',
        description:
          'Expose the actual cost before accepting a new request.',
        nextStep:
          'Complete: “If I say yes to this, I will reduce, delay, or drop…”',
      },
      {
        title: 'Create a selection rule',
        description:
          'Use consistent criteria instead of urgency or guilt.',
        nextStep:
          'Score the opportunity for value, fit, timing, and total cost, then set the threshold for yes.',
      },
      {
        title: 'Put the essential item on the calendar',
        description:
          'Translate declared importance into protected execution.',
        nextStep:
          'Reserve one work block, identify the first action, and remove one predictable interruption.',
      },
    ],
    reflectionPrompts: [
      'What current priority would a new yes displace?',
      'Which criterion distinguishes genuinely important work from merely visible or urgent work?',
      'What calendar or environmental change would prove this priority is real?',
    ],
    sources: [
      {
        label: 'Penguin Random House: Essentialism',
        url: 'https://www.penguinrandomhouse.com/books/228364/essentialism-by-greg-mckeown/',
        sourceType: 'publisher',
      },
      {
        label: 'Greg McKeown: Essentialism',
        url: 'https://gregmckeown.com/books/essentialism/',
        sourceType: 'author',
      },
    ],
  }),
  defineBook({
    id: 'laziness-does-not-exist',
    title: 'Laziness Does Not Exist',
    author: 'Devon Price',
    topic: 'Burnout & recovery',
    displayTags: ['Productivity', 'Capacity', 'Self-worth'],
    readTimeMinutes: 16,
    summary:
      'Devon Price challenges the moral category of laziness and examines how overwork, ableism, capitalism, trauma, illness, and hidden barriers shape behavior. The book invites curiosity about unmet needs and capacity rather than using shame as a complete explanation.',
    centralPremise:
      'What is called laziness often contains information about exhaustion, fear, unclear expectations, disability, illness, low reward, inaccessible design, competing demands, or refusal of exploitation. Replacing moral judgment with investigation makes more precise support and accountability possible.',
    corePremises: [
      {
        title: 'Behavior has context',
        premise:
          'Low output does not reveal a person’s motivation, health, resources, safety, executive function, caregiving load, or understanding of the task.',
        whyItMatters:
          'A character label ends inquiry before the actual barrier is known.',
        practice:
          'Describe the observable behavior and list at least five possible barriers without choosing one as fact.',
      },
      {
        title: 'Human worth is not output',
        premise:
          'Productivity can be useful and necessary, but it is not a reliable measure of dignity, care, morality, or right to exist.',
        whyItMatters:
          'Conditional worth can drive chronic overwork and make rest feel dangerous.',
        practice:
          'Identify one valued quality or relationship that is not reducible to production.',
      },
      {
        title: 'Understanding barriers can improve accountability',
        premise:
          'Rejecting shame does not require ignoring commitments, impacts, or shared responsibilities.',
        whyItMatters:
          'Specific barrier removal and repair are more actionable than either condemnation or vague absolution.',
        practice:
          'Name the impact, the barrier, the support or design change, and the next accountable action separately.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Replace the label with data',
        description:
          'Describe what happened without using laziness as the explanation.',
        nextStep:
          'Write the task, expected behavior, actual behavior, timing, context, and known constraints.',
      },
      {
        title: 'Run a barrier inventory',
        description:
          'Look for capacity, clarity, access, safety, emotion, reward, and competing-demand barriers.',
        nextStep:
          'Score each barrier from 0 to 3 and choose one design or support change for the highest score.',
      },
      {
        title: 'Pair compassion with repair',
        description:
          'Address impact without using shame as the mechanism.',
        nextStep:
          'State what was affected, what support is needed, and the smallest credible repair or renegotiation.',
      },
    ],
    reflectionPrompts: [
      'What information disappears when you call yourself or someone else lazy?',
      'Which barrier most directly explains the gap between intention and action?',
      'What accountability or repair remains possible without attacking human worth?',
    ],
    sources: [
      {
        label: 'Simon & Schuster: Laziness Does Not Exist',
        url: 'https://www.simonandschuster.com/books/Laziness-Does-Not-Exist/Devon-Price/9781982140113',
        sourceType: 'publisher',
      },
      {
        label: 'Devon Price: Laziness Does Not Exist',
        url: 'https://drdevonprice.substack.com/p/laziness-does-not-exist',
        sourceType: 'author',
      },
    ],
  }),
];
