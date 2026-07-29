import type {
  LibraryIntegration,
  LibraryTopic,
  PracticalTakeaway,
} from './editorial';

export type StoryTopic = Exclude<LibraryTopic, 'All'>;
export type StorySourceType =
  | 'first-person-essay'
  | 'first-person-talk'
  | 'official-biography'
  | 'official-interview'
  | 'institutional-profile';

export interface StorySource {
  label: string;
  url: string;
  sourceType: StorySourceType;
}

export interface StorySection {
  heading: string;
  body: string;
}

export interface StoryMilestone {
  period: string;
  title: string;
  description: string;
}

export interface CuratedStory {
  id: string;
  title: string;
  creator: string;
  location: string;
  provider: string;
  sourceFormat: 'In-app profile';
  topic: StoryTopic;
  displayTags: string[];
  summary: string;
  centralPremise: string;
  storySections: StorySection[];
  timeline: StoryMilestone[];
  practicalTakeaways: PracticalTakeaway[];
  reflectionPrompts: string[];
  integrations: LibraryIntegration[];
  sources: StorySource[];
  sourceUrl: string;
  contentNote?: string;
  medicalCaveat?: string;
  editorialNote: string;
}

interface StoryDraft
  extends Omit<CuratedStory, 'integrations' | 'editorialNote'> {
  goalContent: string;
  habitName: string;
  habitDescription: string;
}

const STORY_EDITORIAL_NOTE =
  'This original MHtoolkit profile was written from the cited first-person and institutional sources. It highlights selected events and lessons without reproducing an article, speech, memoir, or interview.';

const MENTAL_HEALTH_BOUNDARY =
  'A public story is not medical guidance. Use qualified care for symptoms, diagnosis, treatment, medication, or safety decisions.';

const TRAUMA_BOUNDARY =
  'There is no required way to respond to trauma. A public story cannot determine what support or care is right for you.';

function curateStory(draft: StoryDraft): CuratedStory {
  const {
    goalContent,
    habitName,
    habitDescription,
    ...story
  } = draft;

  return {
    ...story,
    integrations: [
      {
        title: 'Reflect on the story',
        description: 'Keep what resonates and name what is different in your own situation.',
        actionType: 'journal',
        actionLabel: 'Open a story note',
        prompt: [
          `Notes on ${draft.creator}:`,
          ...draft.reflectionPrompts.map((prompt, index) => `${index + 1}. ${prompt}`),
        ].join('\n'),
      },
      {
        title: 'Choose one next step',
        description: 'Turn one useful idea into a bounded priority that fits your situation.',
        actionType: 'goal',
        actionLabel: 'Add as a priority',
        goalContent,
      },
      {
        title: 'Try a small practice',
        description: 'Repeat one practical action long enough to learn whether it helps.',
        actionType: 'habit',
        actionLabel: 'Prefill a habit',
        habitName,
        habitDescription,
      },
    ],
    editorialNote: STORY_EDITORIAL_NOTE,
  };
}

export const CURATED_STORIES: CuratedStory[] = [
  curateStory({
    id: 'story-simone-biles-own-terms',
    title: 'Simone Biles: choosing safety over expectation',
    creator: 'Simone Biles',
    location: 'United States',
    provider: 'Team USA',
    sourceFormat: 'In-app profile',
    topic: 'Anxiety & stress',
    displayTags: ['Pressure', 'Safety', 'Boundaries'],
    summary:
      'At the Tokyo Olympics, the most decorated gymnast of her generation stopped competing when her mind and body fell out of sync, then returned only when she could do so safely.',
    centralPremise:
      'Stepping back can be a disciplined safety decision, not a failure of courage or commitment.',
    storySections: [
      {
        heading: 'The weight behind the performance',
        body:
          'Simone Biles arrived at the Tokyo Olympics carrying expectations built over years of extraordinary results. She had won four gold medals in Rio, accumulated world titles, and become the public face of the U.S. team. That record made her look nearly automatic from the outside. Inside the competition, however, she was still a person performing skills where a lost fraction of spatial awareness could cause serious injury. Public confidence in her abilities could not remove that physical reality.',
      },
      {
        heading: 'A problem she could not safely push through',
        body:
          'During training and the team final, Biles experienced what gymnasts call the twisties: the practiced connection between movement and air awareness stopped working reliably. After an unsafe vault, she told her coach she could not continue. She withdrew from the team final and several individual events. The decision drew criticism because the problem was not visible like a broken bone, but Biles explained that her body and mind were not in sync. Continuing would have put both her health and the team result at risk.',
      },
      {
        heading: 'Returning on different terms',
        body:
          'Biles kept training, simplified part of her beam routine, and assessed what she could perform safely. A week later she returned for the balance beam final and won bronze. She described the outcome as secondary to being able to perform for herself. The sequence matters: she did not prove strength by ignoring a limit. She recognized the limit, accepted public disappointment, adjusted the task, and returned when the risk was manageable.',
      },
    ],
    timeline: [
      {
        period: 'Before Tokyo',
        title: 'Expectation keeps rising',
        description:
          'Olympic and world titles make Biles the athlete many people expect to carry the U.S. team.',
      },
      {
        period: 'Team final',
        title: 'She recognizes a safety problem',
        description:
          'After losing reliable air awareness, she stops competing rather than attempt high-risk skills.',
      },
      {
        period: 'The following week',
        title: 'She rebuilds around what is safe',
        description:
          'Biles continues training and changes her beam routine instead of forcing the original plan.',
      },
      {
        period: 'August 3, 2021',
        title: 'She returns on her own terms',
        description:
          'She completes the beam final and earns bronze, emphasizing the act of performing rather than the medal.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Treat safety as part of the goal',
        description:
          'A plan is not successful if following it requires ignoring a meaningful physical or psychological warning.',
        nextStep: 'Name one condition that would tell you to pause, reduce, or change a demanding task.',
      },
      {
        title: 'Adjust before abandoning',
        description:
          'The useful choice is not always push through or quit; sometimes the next version should be smaller or safer.',
        nextStep: 'Rewrite one pressured commitment as a version you can complete without overriding yourself.',
      },
      {
        title: 'Separate worth from output',
        description:
          'Performance can matter without becoming the measure of whether a person deserves respect.',
        nextStep: 'Write one quality you value in yourself that is not an achievement.',
      },
    ],
    reflectionPrompts: [
      'Where am I treating a warning sign as weakness?',
      'What would returning on my own terms look like?',
      'Which expectation belongs to me, and which one belongs to an audience?',
    ],
    sources: [
      {
        label: 'Team USA: Biles leaves Tokyo on her own terms',
        url: 'https://www.teamusa.com/news/2021/august/03/with-a-bronze-medal-performance-on-beam-simone-biles-leaves-tokyo-on-her-own-terms',
        sourceType: 'institutional-profile',
      },
    ],
    sourceUrl:
      'https://www.teamusa.com/news/2021/august/03/with-a-bronze-medal-performance-on-beam-simone-biles-leaves-tokyo-on-her-own-terms',
    contentNote: 'Mentions intense performance pressure and a potentially dangerous loss of spatial awareness.',
    medicalCaveat: MENTAL_HEALTH_BOUNDARY,
    goalContent: 'Define one safety boundary for a high-pressure commitment',
    habitName: 'Run a pressure check',
    habitDescription: 'Before a demanding task, rate safety, focus, and capacity before deciding how to proceed.',
  }),
  curateStory({
    id: 'story-naomi-osaka-boundary',
    title: 'Naomi Osaka: drawing a boundary in public',
    creator: 'Naomi Osaka',
    location: 'Japan and United States',
    provider: 'TIME',
    sourceFormat: 'In-app profile',
    topic: 'Anxiety & stress',
    displayTags: ['Anxiety', 'Workplace boundary', 'Self-advocacy'],
    summary:
      'Naomi Osaka challenged a routine part of elite tennis when she decided that mandatory press conferences were worsening her mental health.',
    centralPremise:
      'A boundary can be legitimate even when an institution, an audience, or a tradition does not immediately understand it.',
    storySections: [
      {
        heading: 'Success did not remove anxiety',
        body:
          'Naomi Osaka became a Grand Slam champion while still describing herself as naturally introverted and anxious in the spotlight. After her 2018 U.S. Open victory, she later wrote that she experienced long periods of depression. Her public status grew, but the standard post-match routine still placed her alone before rooms of reporters at emotionally exposed moments. The fact that press conferences were normal in tennis did not make their effect on her neutral.',
      },
      {
        heading: 'The boundary carried a cost',
        body:
          'Before the 2021 French Open, Osaka said she would not participate in press conferences because she needed to protect her mental health. She was fined and warned of further consequences. She then withdrew from the tournament. In her first-person TIME essay, she made clear that she was not trying to eliminate journalism or lead a revolt. She was asking whether the format could become more humane and less like a subject being examined.',
      },
      {
        heading: 'She refused a perfect spokesperson role',
        body:
          'Osaka stepped away, spent time with people close to her, and later returned for the Tokyo Olympics. She did not present herself as an expert with universal answers. Instead, she wrote from the narrower authority of her own experience: athletes are human, mental health difficulties are common, and talking about them can help. That refusal to be either silent or perfectly certain made the boundary more credible, not less.',
      },
    ],
    timeline: [
      {
        period: '2018',
        title: 'A major victory changes the spotlight',
        description:
          'Osaka wins the U.S. Open and later describes mental health difficulties that followed.',
      },
      {
        period: 'May 2021',
        title: 'She challenges a workplace norm',
        description:
          'She announces that she will skip French Open press conferences to protect her mental health.',
      },
      {
        period: 'May 31, 2021',
        title: 'She withdraws',
        description:
          'After sanctions and public debate, Osaka leaves the tournament and shares more context.',
      },
      {
        period: 'July 2021',
        title: 'She explains the boundary herself',
        description:
          'Her TIME essay argues for a better format while acknowledging that she does not have every answer.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Name the harmful part precisely',
        description:
          'A boundary is easier to understand when it identifies the specific interaction, timing, or condition that is causing harm.',
        nextStep: 'Write the exact part of a recurring situation that you want to change.',
      },
      {
        title: 'Expect a boundary to create information',
        description:
          'Other people may resist a limit; their response can reveal whether the environment is willing to adapt.',
        nextStep: 'Choose in advance what you will do if a reasonable request is refused.',
      },
      {
        title: 'Speak from experience, not perfection',
        description:
          'You do not need to represent everyone or solve the whole system to describe what you need.',
        nextStep: 'Practice one sentence that begins with “The part that is not working for me is...”',
      },
    ],
    reflectionPrompts: [
      'Which routine demand affects me more than other people realize?',
      'What is the smallest clear boundary I could communicate?',
      'Am I waiting to be perfectly understood before protecting my capacity?',
    ],
    sources: [
      {
        label: "Naomi Osaka: It's O.K. Not to Be O.K.",
        url: 'https://time.com/6077128/naomi-osaka-essay-tokyo-olympics/',
        sourceType: 'first-person-essay',
      },
    ],
    sourceUrl: 'https://time.com/6077128/naomi-osaka-essay-tokyo-olympics/',
    medicalCaveat: MENTAL_HEALTH_BOUNDARY,
    goalContent: 'Communicate one clear boundary around a recurring source of pressure',
    habitName: 'Notice boundary pressure',
    habitDescription: 'Record one situation where your capacity and the expectation placed on you did not match.',
  }),
  curateStory({
    id: 'story-selena-gomez-support',
    title: 'Selena Gomez: turning private confusion into public support',
    creator: 'Selena Gomez',
    location: 'United States',
    provider: 'Rare Impact Fund',
    sourceFormat: 'In-app profile',
    topic: 'Mood & self-compassion',
    displayTags: ['Self-acceptance', 'Help-seeking', 'Access'],
    summary:
      'Selena Gomez has described years of not understanding her mental health, then used what she learned to expand support for young people.',
    centralPremise:
      'Understanding can arrive gradually, and lived experience can become a reason to make support easier for someone else to reach.',
    storySections: [
      {
        heading: 'Not having language for the experience',
        body:
          'Selena Gomez grew up in public, moving from child acting into music, film, and global celebrity. Visibility did not automatically give her a clear explanation for what she was experiencing. In a note for the Rare Impact Fund, she describes going a long time without the support she needed because she did not understand what she was feeling. Periods of emotional highs and lows could take her out of daily life for weeks.',
      },
      {
        heading: 'Help changed the frame, not every day',
        body:
          'Gomez eventually found support that helped her understand more of what was happening. She does not describe this as a clean finish line. Her account emphasizes that caring for mental health remains a daily process and that imperfect days continue. That distinction matters: receiving help can create language, options, and steadier support without turning a person into a permanent success story.',
      },
      {
        heading: 'Building the access she once lacked',
        body:
          'In 2020, Gomez launched Rare Beauty with a social-impact commitment and created the Rare Impact Fund. The fund supports organizations expanding youth mental health services and education. Her public work connects self-acceptance with access: honesty can reduce shame, but people also need affordable, culturally responsive places to turn. The larger lesson is not that disclosure alone fixes distress. It is that personal experience can inform concrete systems of support.',
      },
    ],
    timeline: [
      {
        period: 'Early career',
        title: 'Life becomes highly public',
        description:
          'Gomez moves from child acting into an international entertainment career.',
      },
      {
        period: 'Years later',
        title: 'She seeks clearer support',
        description:
          'After long periods of not understanding what she felt, she finds help and language for the experience.',
      },
      {
        period: '2020',
        title: 'Rare Impact Fund begins',
        description:
          'She builds a funding effort focused on youth mental health services and education.',
      },
      {
        period: '2022 onward',
        title: 'The private story becomes public advocacy',
        description:
          'She shares more of her experience while continuing to describe mental health as an ongoing journey.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Confusion is useful information',
        description:
          'Not understanding a recurring pattern is a reason to seek better language and support, not evidence that the pattern is unreal.',
        nextStep: 'Write the pattern you notice without trying to diagnose it yourself.',
      },
      {
        title: 'Replace the finish line with support',
        description:
          'A difficult day does not erase progress or prove that prior help failed.',
        nextStep: 'List the people, practices, or services that make a hard day safer or more manageable.',
      },
      {
        title: 'Turn experience into one useful action',
        description:
          'Meaning can come from making one part of the path clearer for another person.',
        nextStep: 'Choose one resource, lesson, or kind response you could share without overexposing yourself.',
      },
    ],
    reflectionPrompts: [
      'What recurring experience do I need better language for?',
      'Which form of support has made a real difference, even if it did not fix everything?',
      'How could I help someone else feel less alone without taking responsibility for their care?',
    ],
    sources: [
      {
        label: 'A note from Selena Gomez',
        url: 'https://rareimpactfund.org/',
        sourceType: 'first-person-essay',
      },
      {
        label: 'Rare Impact Fund: about the founder',
        url: 'https://rareimpactfund.org/about/',
        sourceType: 'institutional-profile',
      },
    ],
    sourceUrl: 'https://rareimpactfund.org/',
    medicalCaveat: MENTAL_HEALTH_BOUNDARY,
    goalContent: 'Map the support I can use when a difficult pattern returns',
    habitName: 'One compassionate check-in',
    habitDescription: 'Name how you feel, what you need, and one support option without judging the answer.',
  }),
  curateStory({
    id: 'story-michael-phelps-beyond-medals',
    title: 'Michael Phelps: learning to live beyond the medals',
    creator: 'Michael Phelps',
    location: 'United States',
    provider: 'Michael Phelps Foundation',
    sourceFormat: 'In-app profile',
    topic: 'Mood & self-compassion',
    displayTags: ['Depression', 'Identity', 'Support'],
    summary:
      'Michael Phelps became the most decorated Olympian in history while privately experiencing severe depression and struggling with who he was outside the pool.',
    centralPremise:
      'Achievement can coexist with serious distress, and recovery may require building an identity and support system that performance cannot provide.',
    storySections: [
      {
        heading: 'The scoreboard showed only one part',
        body:
          'Michael Phelps spent much of his life inside a demanding cycle of training, competition, and Olympic attention. He eventually won 28 Olympic medals, more than any other athlete. Yet he has repeatedly described depressive periods around the end of major competitions. The public evidence said he was succeeding at the highest level; his private experience showed that achievement could not answer every question about identity, connection, or mental health.',
      },
      {
        heading: 'Opening the door to support',
        body:
          'Phelps has spoken about reaching a severe low point and entering treatment. Learning to talk honestly became part of how he recognized warning signs and stayed connected to his wife, therapist, and wider support network. He did not frame vulnerability as the opposite of elite discipline. He treated it as another practice: notice what is happening, say it earlier, and let another person help carry what isolation makes heavier.',
      },
      {
        heading: 'Expanding the definition of strength',
        body:
          'The Michael Phelps Foundation began in 2008 with swimming safety and healthy living. Its work later expanded to include mental wellness, emotional resilience, confidence, and goal-setting for young people. Phelps also used interviews and public testimony to challenge the idea that athletes should quietly absorb distress. His story does not suggest that talking is a complete treatment. It shows why honesty and ongoing care belong inside, not outside, a serious performance system.',
      },
    ],
    timeline: [
      {
        period: '2008',
        title: 'The foundation begins',
        description:
          'Phelps establishes a youth foundation after his Beijing Olympic success.',
      },
      {
        period: 'After Olympic cycles',
        title: 'Depression becomes impossible to dismiss',
        description:
          'He later describes severe lows that followed periods of extraordinary public achievement.',
      },
      {
        period: '2016',
        title: 'Retirement changes the identity question',
        description:
          'Leaving competition creates space to build a life not organized only around the next race.',
      },
      {
        period: '2024',
        title: 'He advocates at a systems level',
        description:
          'Phelps gives congressional testimony about athlete mental health and stronger support structures.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Do not use output as a wellbeing test',
        description:
          'A person can perform well while struggling; productivity alone cannot confirm that everything is fine.',
        nextStep: 'Check one area of life that achievement has been masking.',
      },
      {
        title: 'Name warning signs before crisis',
        description:
          'A personal early-warning list gives a support person something concrete to notice and respond to.',
        nextStep: 'Write three signs that usually appear when you are becoming less well.',
      },
      {
        title: 'Build identity outside the main role',
        description:
          'Roles can end, change, or become unavailable; a broader identity creates more than one place to belong.',
        nextStep: 'Choose one relationship, value, or activity that matters even when performance is absent.',
      },
    ],
    reflectionPrompts: [
      'What looks successful from the outside but feels different internally?',
      'Who knows my early warning signs?',
      'Who am I when my main role is unavailable?',
    ],
    sources: [
      {
        label: 'Michael Phelps Foundation: our story',
        url: 'https://michaelphelpsfoundation.org/about-us/',
        sourceType: 'institutional-profile',
      },
      {
        label: 'Michael Phelps: congressional testimony on athlete health',
        url: 'https://docs.house.gov/meetings/IF/IF02/20240625/117453/HHRG-118-IF02-Wstate-PhelpsM-20240625.pdf',
        sourceType: 'first-person-talk',
      },
      {
        label: 'TIME: Phelps on retirement and mental health advocacy',
        url: 'https://time.com/5402066/michael-phelps-mental-health-activism/',
        sourceType: 'official-interview',
      },
    ],
    sourceUrl: 'https://michaelphelpsfoundation.org/about-us/',
    contentNote: 'Discusses severe depression and a period of crisis.',
    medicalCaveat: MENTAL_HEALTH_BOUNDARY,
    goalContent: 'Create an early-warning and support plan for difficult periods',
    habitName: 'Check the person, not the performance',
    habitDescription: 'Rate mood, connection, and capacity separately from what you accomplished.',
  }),
  curateStory({
    id: 'story-wangari-maathai-small-action',
    title: 'Wangari Maathai: how one practical act became a movement',
    creator: 'Wangari Maathai',
    location: 'Kenya',
    provider: 'Nobel Prize',
    sourceFormat: 'In-app profile',
    topic: 'Habits & growth',
    displayTags: ['Persistence', 'Community', 'Agency'],
    summary:
      'Wangari Maathai began with rural Kenyan women planting trees and kept expanding the work until it became a movement for environmental care, dignity, and democracy.',
    centralPremise:
      'Large change can grow from a small repeatable action when people understand why it matters and can participate directly.',
    storySections: [
      {
        heading: 'Listening before designing the answer',
        body:
          'Wangari Maathai trained as a biologist and became the first woman in East and Central Africa to earn a doctorate. Her education helped her see environmental systems, but the starting point for the Green Belt Movement came from listening to rural Kenyan women. They described practical shortages: firewood, clean water, food, shelter, and income. Deforestation was not an abstract issue. It was changing the distance people walked, the water they could use, and the stability of daily life.',
      },
      {
        heading: 'A repeatable action with visible meaning',
        body:
          'In 1977, Maathai organized women to plant trees. The act was simple enough to repeat and concrete enough to observe. A seedling could become shade, fuel, soil protection, water retention, or income. Participants were not treated as passive recipients of a distant plan; they became custodians of the land and contributors to the solution. Repetition built both environmental change and a stronger sense of local agency.',
      },
      {
        heading: 'Growth brought resistance and a wider purpose',
        body:
          'As the movement expanded, environmental protection became inseparable from questions of public accountability and democratic space. Maathai faced opposition, intimidation, and violence, yet continued organizing. By the time she received the Nobel Peace Prize in 2004, the work had mobilized communities across Kenya and influenced projects elsewhere in Africa. The inspiring element is not that one small habit magically solved a national problem. It is that a meaningful act, repeated collectively, created capacity for larger action.',
      },
    ],
    timeline: [
      {
        period: '1971',
        title: 'A barrier in education falls',
        description:
          'Maathai becomes the first woman in East and Central Africa to earn a doctorate.',
      },
      {
        period: '1977',
        title: 'The Green Belt Movement begins',
        description:
          'Tree planting responds directly to needs identified by rural Kenyan women.',
      },
      {
        period: '1980s-1990s',
        title: 'The work expands into civic action',
        description:
          'Environmental care, public accountability, and democratic rights become connected in the movement.',
      },
      {
        period: '2004',
        title: 'The work receives global recognition',
        description:
          'Maathai becomes the first African woman to receive the Nobel Peace Prize.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Start with the lived problem',
        description:
          'A useful routine should answer something people can actually name, not an abstract idea of improvement.',
        nextStep: 'Write the daily problem your new habit is meant to make easier.',
      },
      {
        title: 'Make progress visible',
        description:
          'A repeatable action is easier to sustain when its effect can be noticed or counted.',
        nextStep: 'Choose one visible sign that your habit is producing value.',
      },
      {
        title: 'Let participation build ownership',
        description:
          'People are more likely to sustain change when they help shape and perform it.',
        nextStep: 'Invite one affected person to improve the plan rather than simply receive it.',
      },
    ],
    reflectionPrompts: [
      'What practical problem am I actually trying to solve?',
      'Which small action could make progress visible within a week?',
      'Who should help shape this effort?',
    ],
    sources: [
      {
        label: 'Wangari Maathai: Nobel lecture',
        url: 'https://www.nobelprize.org/prizes/peace/2004/maathai/lecture/',
        sourceType: 'first-person-talk',
      },
      {
        label: 'Wangari Maathai: Nobel biography',
        url: 'https://www.nobelprize.org/prizes/peace/2004/maathai/biographical/',
        sourceType: 'official-biography',
      },
    ],
    sourceUrl: 'https://www.nobelprize.org/prizes/peace/2004/maathai/lecture/',
    goalContent: 'Choose one small repeatable action that solves a real daily problem',
    habitName: 'Plant one practical seed',
    habitDescription: 'Complete one small action whose effect you can observe and build on.',
  }),
  curateStory({
    id: 'story-nelson-mandela-long-horizon',
    title: 'Nelson Mandela: keeping a long horizon',
    creator: 'Nelson Mandela',
    location: 'South Africa',
    provider: 'Nelson Mandela Foundation',
    sourceFormat: 'In-app profile',
    topic: 'Habits & growth',
    displayTags: ['Purpose', 'Patience', 'Reconciliation'],
    summary:
      'Nelson Mandela spent more than 27 years imprisoned, then helped negotiate a democratic transition rather than treating release as the end of the work.',
    centralPremise:
      'A long-term purpose is sustained through repeated choices, relationships, and revisions rather than one dramatic act of will.',
    storySections: [
      {
        heading: 'A purpose formed over time',
        body:
          'Nelson Mandela did not begin as a finished symbol. He studied law, joined the African National Congress in 1944, organized against apartheid, faced trials, and changed tactics as repression intensified. His political choices included conflict and controversy, not a simple sequence of inspirational moments. What remained consistent was the larger aim: a South Africa in which political rights were not determined by race.',
      },
      {
        heading: 'Years when progress was hard to see',
        body:
          'Mandela was sentenced to life imprisonment in 1964 and spent more than 27 years in prison. Confinement removed ordinary freedom, separated him from family, and offered no guarantee that the system outside would change. He continued studying, debating, communicating, and building relationships with fellow prisoners. The long horizon did not make each day easy. It gave difficult daily actions a place inside a purpose larger than the day itself.',
      },
      {
        heading: 'Release became another beginning',
        body:
          'Mandela was released in 1990 into a country still marked by political violence and deep distrust. He participated in negotiations, shared the 1993 Nobel Peace Prize with F.W. de Klerk, and became South Africa’s first democratically elected president in 1994. Reconciliation did not mean pretending injustice had not happened. It meant trying to build a political future without making revenge the organizing principle. His story offers a model of purpose with realism: remember the harm, keep the goal, and choose the next action that can move the system.',
      },
    ],
    timeline: [
      {
        period: '1944',
        title: 'He joins organized resistance',
        description:
          'Mandela joins the African National Congress and helps build its Youth League.',
      },
      {
        period: '1964',
        title: 'A life sentence begins',
        description:
          'After the Rivonia Trial, he is imprisoned for his role in the struggle against apartheid.',
      },
      {
        period: 'February 11, 1990',
        title: 'He walks free after 27 years',
        description:
          'Release begins a difficult period of negotiation, not an immediate resolution.',
      },
      {
        period: '1993-1994',
        title: 'Negotiation becomes democratic transition',
        description:
          'Mandela receives the Nobel Peace Prize and is then elected president in South Africa’s first fully democratic election.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Define the horizon',
        description:
          'A demanding period is easier to organize when you know what larger value the immediate work serves.',
        nextStep: 'Write the purpose behind one long project in a single sentence.',
      },
      {
        title: 'Keep a daily unit of progress',
        description:
          'When the outcome is distant, study, conversation, preparation, and relationship-building can still count as movement.',
        nextStep: 'Choose one daily action that remains useful even when results are delayed.',
      },
      {
        title: 'Do not confuse reconciliation with denial',
        description:
          'Moving forward can include accountability, memory, boundaries, and changed conditions.',
        nextStep: 'Name what must be acknowledged before a damaged relationship or system can move forward.',
      },
    ],
    reflectionPrompts: [
      'What purpose is important enough to outlast a difficult season?',
      'Which daily action still matters when I cannot control the timeline?',
      'What would moving forward require me to remember rather than erase?',
    ],
    sources: [
      {
        label: 'Nelson Mandela Foundation: biography and timeline',
        url: 'https://www.nelsonmandela.org/biography-timeline',
        sourceType: 'official-biography',
      },
      {
        label: 'Nelson Mandela: Nobel lecture',
        url: 'https://www.nobelprize.org/nobel_prizes/peace/laureates/1993/mandela-lecture.html',
        sourceType: 'first-person-talk',
      },
    ],
    sourceUrl: 'https://www.nelsonmandela.org/biography-timeline',
    contentNote: 'Discusses apartheid, political violence, and long-term imprisonment.',
    goalContent: 'Define the long-term purpose and next daily action for one difficult project',
    habitName: 'Keep the long horizon',
    habitDescription: 'Complete one small action that still matters even when the larger result is delayed.',
  }),
  curateStory({
    id: 'story-arianna-huffington-burnout',
    title: 'Arianna Huffington: the collapse that changed her definition of success',
    creator: 'Arianna Huffington',
    location: 'Greece, United Kingdom, and United States',
    provider: 'Thrive Global',
    sourceFormat: 'In-app profile',
    topic: 'Burnout & recovery',
    displayTags: ['Burnout', 'Sleep', 'Redefining success'],
    summary:
      'After collapsing from exhaustion and sleep deprivation, Arianna Huffington rebuilt her routines and challenged a work culture that treats depletion as proof of commitment.',
    centralPremise:
      'Rest is not a reward after the important work; it is part of the capacity required to do important work well.',
    storySections: [
      {
        heading: 'The old definition of success',
        body:
          'Arianna Huffington co-founded The Huffington Post in 2005 and worked inside the constant pace of a growing digital news company. She later described living from one device notification to the next, beginning with her BlackBerry in the morning and ending with it at night. The schedule looked like commitment and ambition. It also normalized chronic sleep loss and made exhaustion feel like the unavoidable price of relevance.',
      },
      {
        heading: 'A physical wake-up call',
        body:
          'On April 6, 2007, Huffington collapsed from sleep deprivation and exhaustion. She struck her head, broke her cheekbone, and required stitches. Medical tests did not reveal a hidden disease that explained the event. Her own conclusion was more ordinary and more disruptive: the way she was living was unsustainable. A career could meet conventional measures of success while the person living it had too little energy to be present inside that success.',
      },
      {
        heading: 'Changing routines and then the conversation',
        body:
          'Huffington gradually increased her sleep, set stronger boundaries around devices, and began treating renewal as a performance input rather than an indulgence. She wrote about sleep and burnout, left The Huffington Post in 2016, and founded Thrive Global to focus on workplace wellbeing. Her story should not be reduced to “sleep fixes burnout”; working conditions, illness, caregiving, and money can constrain people’s choices. The durable lesson is to stop using depletion as evidence that the work matters.',
      },
    ],
    timeline: [
      {
        period: '2005',
        title: 'The Huffington Post launches',
        description:
          'A fast-growing digital company intensifies an already demanding work pattern.',
      },
      {
        period: 'April 6, 2007',
        title: 'Exhaustion becomes an injury',
        description:
          'Huffington collapses, hits her head, and breaks her cheekbone.',
      },
      {
        period: 'The years after',
        title: 'Recovery becomes a redesign',
        description:
          'She changes sleep and device routines and begins challenging the culture of overwork.',
      },
      {
        period: '2016',
        title: 'A new organization follows the lesson',
        description:
          'She leaves The Huffington Post and launches Thrive Global around sustainable performance and wellbeing.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Audit the hidden cost',
        description:
          'A routine can appear productive while quietly reducing judgment, presence, health, and creativity.',
        nextStep: 'Write what your current pace is costing outside the task itself.',
      },
      {
        title: 'Change one transition',
        description:
          'A repeatable boundary around waking, stopping work, or going to bed can be more durable than a total lifestyle reset.',
        nextStep: 'Choose one device-free transition you can repeat for seven days.',
      },
      {
        title: 'Redefine evidence of commitment',
        description:
          'Hours and exhaustion are easy to display; useful output, clear decisions, and sustainable capacity are better measures.',
        nextStep: 'Replace one “how long I worked” measure with a result or quality measure.',
      },
    ],
    reflectionPrompts: [
      'Which sign of depletion have I normalized?',
      'What transition would protect sleep or recovery most?',
      'How would I measure commitment if exhaustion did not count?',
    ],
    sources: [
      {
        label: 'Arianna Huffington: ten years after her collapse',
        url: 'https://thriveglobal.com/articles/10-years-ago-i-collapsed-from-burnout-and-exhaustion-and-it-s-the-best-thing-that-could-have-happened-to-me',
        sourceType: 'first-person-essay',
      },
      {
        label: 'TIME: rules for better sleep',
        url: 'https://time.com/4295181/arianna-huffingtons-rules-for-better-sleep/',
        sourceType: 'first-person-essay',
      },
    ],
    sourceUrl:
      'https://thriveglobal.com/articles/10-years-ago-i-collapsed-from-burnout-and-exhaustion-and-it-s-the-best-thing-that-could-have-happened-to-me',
    contentNote: 'Mentions collapse and injury caused by severe exhaustion.',
    medicalCaveat:
      'Persistent exhaustion can have many causes. Sleep routines do not replace medical care, safer working conditions, or practical support.',
    goalContent: 'Redesign one daily transition to protect recovery',
    habitName: 'Close one open loop before rest',
    habitDescription: 'Write what is done, what can wait, and when work ends before putting the device away.',
  }),
  curateStory({
    id: 'story-oprah-winfrey-next-right-move',
    title: 'Oprah Winfrey: finding the next right move after failure',
    creator: 'Oprah Winfrey',
    location: 'United States',
    provider: 'Harvard University',
    sourceFormat: 'In-app profile',
    topic: 'Burnout & recovery',
    displayTags: ['Failure', 'Identity', 'Next step'],
    summary:
      'After decades at the top of television, Oprah Winfrey launched a network that was publicly labeled a failure and had to rebuild without pretending the loss did not hurt.',
    centralPremise:
      'A setback can be mourned without becoming a permanent identity; the useful question is what the next right move requires.',
    storySections: [
      {
        heading: 'Success became familiar',
        body:
          'Oprah Winfrey built a career from local television into a talk show that led its time slot for more than two decades. The work made her one of the most recognized media figures in the world. That history created confidence, but it also raised the stakes of whatever came next. When she ended the show and launched the Oprah Winfrey Network, the new venture was judged against an unusually long record of visible success.',
      },
      {
        heading: 'A public setback felt personal',
        body:
          'A year after OWN launched, headlines called it a flop. In her 2013 Harvard commencement address, Winfrey described that period as the worst of her professional life. She felt stressed, frustrated, and embarrassed. Her response did not skip directly to a motivational lesson. She first allowed herself to feel bad and mourn what she thought she had lost. That pause kept reframing from becoming denial.',
      },
      {
        heading: 'From the whole future to the next move',
        body:
          'Winfrey began telling herself that failure was movement rather than a final destination. She looked for what each mistake could teach and asked what the next right move was, rather than demanding a complete recovery plan. OWN later stabilized, but the practical value of the story does not depend on that commercial result. The useful shift is scale: when the future feels like a verdict, return to the next decision that aligns with who you want to be.',
      },
    ],
    timeline: [
      {
        period: '1986',
        title: 'A national platform begins',
        description:
          'The Oprah Winfrey Show enters national syndication and grows into a long-running media institution.',
      },
      {
        period: '2011',
        title: 'She leaves a proven format',
        description:
          'Winfrey ends the talk show and launches the Oprah Winfrey Network.',
      },
      {
        period: '2012',
        title: 'The new venture is called a failure',
        description:
          'Low ratings and critical headlines create the worst professional period she says she had experienced.',
      },
      {
        period: 'May 2013',
        title: 'She shares the lesson before the story is tidy',
        description:
          'At Harvard, Winfrey describes mourning the setback, learning from mistakes, and choosing the next right move.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Let a loss be a loss first',
        description:
          'Reframing too quickly can become another demand to perform instead of an honest response to disappointment.',
        nextStep: 'Name what the setback cost without adding a lesson yet.',
      },
      {
        title: 'Separate event from identity',
        description:
          'A project can fail, stall, or disappoint without proving that the person behind it is a failure.',
        nextStep: 'Rewrite one identity statement as a specific event statement.',
      },
      {
        title: 'Reduce the planning horizon',
        description:
          'When a full comeback plan is impossible, one aligned decision can restore movement.',
        nextStep: 'Choose the next right move that can be completed within 48 hours.',
      },
    ],
    reflectionPrompts: [
      'What am I allowed to mourn about this setback?',
      'Which label have I turned into an identity?',
      'What is the next right move, not the entire rescue plan?',
    ],
    sources: [
      {
        label: 'Oprah Winfrey: Harvard commencement address',
        url: 'https://news.harvard.edu/gazette/story/2013/05/winfreys-commencement-address/',
        sourceType: 'first-person-talk',
      },
      {
        label: 'Harvard Gazette: failure is just movement',
        url: 'https://news.harvard.edu/gazette/story/2013/05/winfrey-failure-is-just-movement/',
        sourceType: 'institutional-profile',
      },
    ],
    sourceUrl:
      'https://news.harvard.edu/gazette/story/2013/05/winfreys-commencement-address/',
    goalContent: 'Choose the next right move after one current setback',
    habitName: 'One next-right-move check',
    habitDescription: 'Name the lesson available now and choose one small aligned action.',
  }),
  curateStory({
    id: 'story-malala-yousafzai-voice',
    title: 'Malala Yousafzai: a voice made larger than the attack',
    creator: 'Malala Yousafzai',
    location: 'Pakistan and United Kingdom',
    provider: 'Malala Fund',
    sourceFormat: 'In-app profile',
    topic: 'Trauma',
    displayTags: ['Education', 'Courage', 'Purpose'],
    summary:
      'Malala Yousafzai began advocating for girls’ education as a child, survived an assassination attempt, and chose to continue the work without allowing the attack to become her whole identity.',
    centralPremise:
      'A person can acknowledge what happened, accept support, and choose a future organized by values rather than by the attacker’s intention.',
    storySections: [
      {
        heading: 'The work began before the world knew her',
        body:
          'Malala Yousafzai grew up in Pakistan’s Swat Valley, where her father ran a school. When the Taliban restricted girls’ education, she began speaking and blogging about the right to learn. She was eleven. Her early advocacy was rooted in ordinary attachment to school, friends, books, and a future she believed girls should be free to choose. Public recognition followed, but the purpose came first.',
      },
      {
        heading: 'Survival required other people',
        body:
          'In October 2012, a gunman boarded her school bus and shot her. Malala woke days later in a hospital in Birmingham, England. Her survival depended on emergency response, surgery, rehabilitation, family, and care from many people. The story is often compressed into individual bravery, but recovery was also collective and medical. She did not choose the violence or control its effects.',
      },
      {
        heading: 'She chose what the next chapter would serve',
        body:
          'After months of treatment, Malala decided to continue campaigning. She spoke at the United Nations on her sixteenth birthday, co-founded Malala Fund with her father, and became the youngest Nobel Peace Prize laureate in 2014. She later graduated from Oxford. In her Nobel speech, she resisted being reduced to “the girl who was shot.” She connected her experience to millions of girls denied education and used a global platform to carry their stories with her own.',
      },
    ],
    timeline: [
      {
        period: '2009',
        title: 'She documents life under restriction',
        description:
          'At age eleven, Malala blogs and speaks about girls losing access to school in Swat.',
      },
      {
        period: 'October 2012',
        title: 'She survives an assassination attempt',
        description:
          'A Taliban gunman attacks Malala and two classmates on their school bus.',
      },
      {
        period: '2013',
        title: 'The campaign becomes an institution',
        description:
          'She addresses the United Nations and co-founds Malala Fund with her father.',
      },
      {
        period: '2014-2020',
        title: 'Education remains the organizing purpose',
        description:
          'Malala receives the Nobel Peace Prize and later completes her degree at Oxford.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Do not reduce a person to the harm',
        description:
          'A traumatic event may remain important without becoming the only accurate description of a life.',
        nextStep: 'Write three parts of your identity that exist alongside what happened.',
      },
      {
        title: 'Count the support, not only the courage',
        description:
          'Survival and recovery often depend on care, systems, relationships, and practical help.',
        nextStep: 'Map the people and services that make your next step safer.',
      },
      {
        title: 'Choose a value-sized action',
        description:
          'Purpose does not require a global platform; it can begin with one action consistent with what matters.',
        nextStep: 'Take one safe action this week that expresses a value you want to protect.',
      },
    ],
    reflectionPrompts: [
      'Which parts of me are larger than what happened?',
      'Whose support belongs inside my account of strength?',
      'What value do I want the next chapter to serve?',
    ],
    sources: [
      {
        label: "Malala Fund: Malala's story",
        url: 'https://malala.org/malalas-story.html',
        sourceType: 'official-biography',
      },
      {
        label: 'Malala Yousafzai: my trip home',
        url: 'https://assembly.malala.org/stories/2018/6/19/my-trip-home',
        sourceType: 'first-person-essay',
      },
      {
        label: 'Malala Yousafzai: Nobel acceptance speech',
        url: 'https://malala.org/news-and-voices/malala-nobel-speech',
        sourceType: 'first-person-talk',
      },
    ],
    sourceUrl: 'https://malala.org/malalas-story.html',
    contentNote: 'Discusses political violence, a gun attack, surgery, and rehabilitation.',
    medicalCaveat: TRAUMA_BOUNDARY,
    goalContent: 'Take one safe action that expresses a value I want to protect',
    habitName: 'Name the larger identity',
    habitDescription: 'Record one role, value, relationship, or hope that exists alongside a difficult experience.',
  }),
  curateStory({
    id: 'story-maya-angelou-finding-voice',
    title: 'Maya Angelou: finding a voice after years of silence',
    creator: 'Maya Angelou',
    location: 'United States and Ghana',
    provider: "National Women's History Museum",
    sourceFormat: 'In-app profile',
    topic: 'Trauma',
    displayTags: ['Voice', 'Literature', 'Reinvention'],
    summary:
      'After childhood sexual violence and years of near-silence, Maya Angelou built a life across writing, performance, teaching, and civil-rights work.',
    centralPremise:
      'A period of silence or disruption can become part of a life without setting the limits of what that life may later contain.',
    storySections: [
      {
        heading: 'Silence followed trauma',
        body:
          'Maya Angelou was born Marguerite Johnson in 1928. During childhood she experienced sexual violence by her mother’s boyfriend. After she spoke about it, he was convicted and later killed. Angelou believed her words had caused his death and stopped speaking to almost everyone for several years. Her silence was not a moral lesson or a chosen creative exercise. It was a child’s response to trauma, guilt, and fear.',
      },
      {
        heading: 'Language remained present before speech returned',
        body:
          'During those years, Angelou read widely, memorized poetry, listened closely, and developed an intense relationship with language. A trusted teacher, Bertha Flowers, encouraged her to hear poetry spoken aloud and helped her begin using her voice again. Literature did not erase what happened. It gave Angelou a way to encounter language safely before public speech felt possible.',
      },
      {
        heading: 'One life held many reinventions',
        body:
          'Angelou later became a streetcar conductor, dancer, singer, journalist, organizer, teacher, actor, poet, and memoirist. She lived in Egypt and Ghana, worked with civil-rights leaders, and published I Know Why the Caged Bird Sings in 1969. The book made a Black girl’s interior life, trauma, humor, family, and survival part of mainstream American literature. Her story is inspiring because it leaves room for complexity: voice returned, but the past was not rewritten as necessary or beneficial.',
      },
    ],
    timeline: [
      {
        period: '1930s',
        title: 'Trauma is followed by silence',
        description:
          'After childhood sexual violence and its aftermath, Angelou stops speaking to most people for several years.',
      },
      {
        period: 'Adolescence',
        title: 'Literature helps reopen language',
        description:
          'Reading, memorization, and encouragement from a trusted teacher support her gradual return to speech.',
      },
      {
        period: '1940s-1960s',
        title: 'She builds a life across many forms',
        description:
          'Angelou works in transport, performance, journalism, and civil-rights organizing in several countries.',
      },
      {
        period: '1969 onward',
        title: 'Her own story changes literature',
        description:
          'I Know Why the Caged Bird Sings begins a major career in memoir, poetry, teaching, film, and public life.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Respect the protective response',
        description:
          'Silence, distance, or reduced capacity may have helped someone survive even if those responses later become limiting.',
        nextStep: 'Name one response you can understand with more compassion before trying to change it.',
      },
      {
        title: 'Use a safer bridge',
        description:
          'Direct disclosure is not the only route toward expression; reading, art, movement, or private writing can be intermediate steps.',
        nextStep: 'Choose one private or low-pressure form of expression for what is hard to say directly.',
      },
      {
        title: 'Allow more than one identity',
        description:
          'A life can contain many roles and reinventions without needing one permanent definition.',
        nextStep: 'List three roles or forms of expression you are curious to try, even as a beginner.',
      },
    ],
    reflectionPrompts: [
      'Which response deserves understanding before change?',
      'What form of expression feels safer than direct explanation?',
      'What new role could I try without needing it to become my identity?',
    ],
    sources: [
      {
        label: "National Women's History Museum: Maya Angelou",
        url: 'https://www.womenshistory.org/education-resources/biographies/maya-angelou',
        sourceType: 'institutional-profile',
      },
      {
        label: 'USPS: Maya Angelou memorial biography',
        url: 'https://about.usps.com/news/national-releases/2015/pr15_021.htm',
        sourceType: 'institutional-profile',
      },
    ],
    sourceUrl:
      'https://www.womenshistory.org/education-resources/biographies/maya-angelou',
    contentNote: 'Discusses childhood sexual violence, guilt, and a long period of near-silence.',
    medicalCaveat: TRAUMA_BOUNDARY,
    goalContent: 'Choose one safe form of expression for something that is difficult to say',
    habitName: 'Practice a private voice',
    habitDescription: 'Spend five minutes reading, writing, speaking, or creating without pressure to share it.',
  }),
  curateStory({
    id: 'story-sheryl-sandberg-option-b',
    title: 'Sheryl Sandberg: learning to live inside Option B',
    creator: 'Sheryl Sandberg',
    location: 'United States',
    provider: 'OptionB.Org',
    sourceFormat: 'In-app profile',
    topic: 'Grief & loss',
    displayTags: ['Grief', 'Support', 'Resilience'],
    summary:
      'After the sudden death of her husband, Sheryl Sandberg had to build a life she had not chosen while helping her children live with the same loss.',
    centralPremise:
      'Resilience after loss is not a return to the old life; it is the gradual construction of a life that can hold grief, support, and moments of meaning together.',
    storySections: [
      {
        heading: 'The future changed without permission',
        body:
          'In 2015, Sheryl Sandberg’s husband, Dave Goldberg, died suddenly while they were on vacation. She returned home grieving and responsible for two children who had also lost their father. Sandberg later wrote that she initially felt certain pure joy would never return. The plans she had made belonged to a life that no longer existed, and no amount of professional competence could make the original future available again.',
      },
      {
        heading: 'Support had to become concrete',
        body:
          'Friends, family, colleagues, and psychologist Adam Grant helped Sandberg examine what made grief more isolating and what allowed moments of stability to return. The useful support was often specific: showing up, naming the loss, helping with ordinary tasks, and allowing grief to be present without demanding the right words. Sandberg also learned that people sometimes stayed away because they feared saying the wrong thing, which made direct requests and honest conversations especially important.',
      },
      {
        heading: 'Option B became shared language',
        body:
          'Sandberg and Grant published Option B in 2017, combining her experience with research on adversity and resilience. The related community created space for people facing grief, illness, divorce, abuse, and other losses. The phrase does not mean the unwanted life is secretly preferable. It means that when Option A cannot be restored, a person can still receive help, make choices, parent, work, remember, and eventually encounter meaning within Option B.',
      },
    ],
    timeline: [
      {
        period: 'May 2015',
        title: 'Her husband dies suddenly',
        description:
          'Dave Goldberg’s death changes Sandberg’s family life without warning.',
      },
      {
        period: 'The first months',
        title: 'Grief and parenting happen together',
        description:
          'She navigates her own loss while supporting two children through theirs.',
      },
      {
        period: '2017',
        title: 'Private lessons become a shared resource',
        description:
          'Sandberg and Adam Grant publish Option B and expand an online resilience community.',
      },
      {
        period: 'Ongoing',
        title: 'The loss remains part of the life',
        description:
          'The work emphasizes that resilience can coexist with remembrance and recurring grief.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Ask for specific help',
        description:
          'People who care may not know what to do; a concrete request can turn concern into useful support.',
        nextStep: 'Write one task, check-in, or practical need another person could help with.',
      },
      {
        title: 'Keep the person in the conversation',
        description:
          'Avoiding a name can deepen isolation; remembrance can be welcome when it follows the grieving person’s cues.',
        nextStep: 'Choose one memory, ritual, or object you want to keep present.',
      },
      {
        title: 'Allow mixed moments',
        description:
          'A laugh, productive hour, or good day does not betray the person or erase the loss.',
        nextStep: 'Notice one moment of relief without requiring it to mean that grief is over.',
      },
    ],
    reflectionPrompts: [
      'What specific support would reduce the load this week?',
      'How do I want this person or former life to be remembered?',
      'Which moments am I allowed to receive without treating them as betrayal?',
    ],
    sources: [
      {
        label: 'Option B: about the book',
        url: 'https://optionb.org/book',
        sourceType: 'institutional-profile',
      },
      {
        label: 'OptionB.Org: our story',
        url: 'https://optionb.org/about',
        sourceType: 'institutional-profile',
      },
    ],
    sourceUrl: 'https://optionb.org/book',
    contentNote: 'Discusses the sudden death of a spouse and family grief.',
    medicalCaveat:
      'Grief has no fixed schedule. Seek qualified or emergency support when grief creates safety concerns or makes daily life unmanageable.',
    goalContent: 'Ask for one specific form of support during grief or major loss',
    habitName: 'Make room for remembrance',
    habitDescription: 'Notice one memory, feeling, or moment of relief without deciding what it must mean.',
  }),
  curateStory({
    id: 'story-andrew-garfield-grief-love',
    title: 'Andrew Garfield: giving grief somewhere to go',
    creator: 'Andrew Garfield',
    location: 'United Kingdom and United States',
    provider: 'Sesame Workshop',
    sourceFormat: 'In-app profile',
    topic: 'Grief & loss',
    displayTags: ['Grief', 'Love', 'Remembrance'],
    summary:
      'Andrew Garfield has spoken openly about missing his mother and treating grief as an ongoing expression of the relationship rather than a problem to finish.',
    centralPremise:
      'Grief can remain because love mattered; expressing it can keep a relationship present without denying the reality of the loss.',
    storySections: [
      {
        heading: 'Loss entered an active life',
        body:
          'Andrew Garfield’s mother, Lynn, died from pancreatic cancer in 2019. He had returned from filming to spend her final period with her. Work continued afterward, including performances shaped by themes of time, ambition, love, and death. The public often expects a clean distinction between a private loss and a professional role, but Garfield’s conversations show how the two can remain connected.',
      },
      {
        heading: 'He did not treat grief as a defect',
        body:
          'In a 2021 interview with Stephen Colbert, Garfield described grief as love that no longer has the same place to be expressed. He did not say he wanted the sadness removed. He wanted the connection to his mother to remain meaningful. This framing does not make grief easy or beautiful at every moment. It gives the pain context: missing someone can be evidence of an important bond, not evidence that the grieving person is failing to move forward.',
      },
      {
        heading: 'A public conversation made the idea simpler',
        body:
          'In 2024, Garfield spoke with Elmo in a Sesame Workshop video about missing his mother. The exchange used plain language: sadness can return, memories can make a person feel close, and talking about the person can help. By bringing grief into a familiar children’s setting, he modeled something adults often avoid. Remembering and continuing are not opposites. A life can make room for both.',
      },
    ],
    timeline: [
      {
        period: '2019',
        title: 'His mother dies',
        description:
          'Garfield loses his mother, Lynn, after returning home to spend time with her.',
      },
      {
        period: '2021',
        title: 'He speaks about grief as continuing love',
        description:
          'A Late Show conversation makes his private experience part of a wider public discussion.',
      },
      {
        period: '2024',
        title: 'He discusses grief with Elmo',
        description:
          'A Sesame Workshop conversation gives children and families direct language for missing someone.',
      },
      {
        period: 'Ongoing',
        title: 'Remembrance remains active',
        description:
          'Garfield continues to connect memories of his mother with work, conversation, and gratitude.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Give the relationship a place',
        description:
          'A ritual, story, object, or conversation can create a living place for remembrance.',
        nextStep: 'Choose one way to express the love or meaning that still feels present.',
      },
      {
        title: 'Use direct language',
        description:
          'Simple words such as “I miss them” can be more honest and usable than trying to explain the whole experience.',
        nextStep: 'Complete the sentence “Today I miss...” without trying to resolve it.',
      },
      {
        title: 'Let memories carry more than pain',
        description:
          'Remembering can include humor, habits, gratitude, frustration, and ordinary details as well as the death.',
        nextStep: 'Record one specific memory that shows who the person was in daily life.',
      },
    ],
    reflectionPrompts: [
      'Where does the love connected to this loss go now?',
      'What simple sentence describes today’s grief?',
      'Which ordinary memory do I want to keep available?',
    ],
    sources: [
      {
        label: 'Sesame Workshop: Andrew Garfield and Elmo explain grief',
        url: 'https://sesameworkshop.org/about-us/news/andrew-garfield-and-elmo-explain-grief/',
        sourceType: 'official-interview',
      },
      {
        label: 'Associated Press: Garfield on life, loss, and his work',
        url: 'https://apnews.com/article/9468f8be87b273576b8efd71aa0dd80d',
        sourceType: 'official-interview',
      },
    ],
    sourceUrl:
      'https://sesameworkshop.org/about-us/news/andrew-garfield-and-elmo-explain-grief/',
    contentNote: 'Discusses a parent’s death from cancer and ongoing grief.',
    goalContent: 'Create one small ritual or record for a person or life I miss',
    habitName: 'Keep one memory',
    habitDescription: 'Write one ordinary detail, story, or quality you want to remember.',
  }),
  curateStory({
    id: 'story-lady-gaga-support-network',
    title: 'Lady Gaga: replacing secrecy with support',
    creator: 'Lady Gaga',
    location: 'United States',
    provider: 'Born This Way Foundation',
    sourceFormat: 'In-app profile',
    topic: 'Relationships & boundaries',
    displayTags: ['Support', 'Trauma', 'Kindness'],
    summary:
      'Lady Gaga turned a difficult public disclosure about trauma and mental health into sustained work around kindness, peer support, and access to resources.',
    centralPremise:
      'Being believed, receiving qualified care, and having people who respond with kindness can interrupt the shame that keeps distress isolated.',
    storySections: [
      {
        heading: 'Success did not make the private experience disappear',
        body:
          'Lady Gaga built a global music and acting career while living with depression, anxiety, chronic pain, and the effects of trauma. In a first-person letter published by Born This Way Foundation, she described years of searching for answers and the shame she felt about a post-traumatic stress disorder diagnosis. She also described work periods when her requests for balance and her reports of pain were not taken seriously.',
      },
      {
        heading: 'Disclosure was connected to care',
        body:
          'Gaga’s public story did not present honesty as a cure. She credited doctors, family, friends, and learned practices with helping her understand and regulate what she experienced. Speaking became useful because it was part of a support system rather than a demand to expose everything. Her account also shows why boundaries matter: being famous, available, or grateful does not remove a person’s need for rest, consent, treatment, and limits.',
      },
      {
        heading: 'Kindness became organized work',
        body:
          'In 2012, Gaga and her mother, Cynthia Germanotta, co-founded Born This Way Foundation. The organization works with young people on mental health resources, community, research, and practical acts of kindness. This moves the story beyond celebrity disclosure. Individual kindness cannot replace clinical care or structural change, but it can affect whether a person feels believed, whether asking for help feels possible, and whether a community responds to pain with punishment or support.',
      },
    ],
    timeline: [
      {
        period: 'Early career',
        title: 'Public success grows alongside private distress',
        description:
          'Gaga performs and tours while later describing depression, anxiety, pain, and trauma-related symptoms.',
      },
      {
        period: '2012',
        title: 'Born This Way Foundation launches',
        description:
          'She and her mother create an organization focused on a kinder, braver world for young people.',
      },
      {
        period: '2016',
        title: 'She names her diagnosis publicly',
        description:
          'A first-person letter describes PTSD, shame, care, and the ongoing work of recovery.',
      },
      {
        period: 'Ongoing',
        title: 'Disclosure becomes infrastructure',
        description:
          'The foundation connects storytelling with research, programs, grants, and access to resources.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Choose disclosure, do not default to it',
        description:
          'Sharing can reduce isolation, but privacy and selective disclosure remain valid boundaries.',
        nextStep: 'Decide what one safe person needs to know and what can remain private.',
      },
      {
        title: 'Ask to be believed and helped',
        description:
          'A useful support request can include both emotional response and a concrete next action.',
        nextStep: 'Draft one sentence that asks for listening, practical help, or professional support.',
      },
      {
        title: 'Make kindness operational',
        description:
          'Kindness becomes more reliable when it is a behavior rather than only an intention.',
        nextStep: 'Choose one check-in, accommodation, or resource you can offer without taking over someone’s care.',
      },
    ],
    reflectionPrompts: [
      'What do I want one safe person to understand?',
      'Which boundary would make support feel safer?',
      'What does practical kindness look like in one relationship?',
    ],
    sources: [
      {
        label: 'Lady Gaga: first-person letter on PTSD and recovery',
        url: 'https://bornthisway.foundation/author/ladygaga/',
        sourceType: 'first-person-essay',
      },
      {
        label: 'Born This Way Foundation: mission',
        url: 'https://bornthisway.foundation/our-mission/',
        sourceType: 'institutional-profile',
      },
    ],
    sourceUrl: 'https://bornthisway.foundation/author/ladygaga/',
    contentNote: 'Discusses trauma, PTSD, chronic pain, panic, and dissociation.',
    medicalCaveat: MENTAL_HEALTH_BOUNDARY,
    goalContent: 'Ask one safe person for a specific form of support',
    habitName: 'Turn kindness into an action',
    habitDescription: 'Complete one concrete act that helps you or another person feel supported without crossing a boundary.',
  }),
  curateStory({
    id: 'story-desmond-tutu-community-justice',
    title: 'Desmond Tutu: building connection without abandoning justice',
    creator: 'Desmond Tutu',
    location: 'South Africa',
    provider: 'Nobel Prize',
    sourceFormat: 'In-app profile',
    topic: 'Relationships & boundaries',
    displayTags: ['Community', 'Justice', 'Reconciliation'],
    summary:
      'Desmond Tutu opposed apartheid through faith leadership, public advocacy, and a belief that real community requires both human dignity and justice.',
    centralPremise:
      'Connection is not the absence of boundaries or conflict; healthy community depends on dignity, truth, and conditions that make relationship possible.',
    storySections: [
      {
        heading: 'A career changed by an unjust system',
        body:
          'Desmond Tutu trained and worked as a teacher in South Africa. He left classroom teaching after the government imposed Bantu Education, a system designed to limit Black students. He then studied theology and became a priest. The shift was not an escape from public life. It gave him another platform from which to oppose apartheid and speak about the damage the system caused to families, education, work, and human dignity.',
      },
      {
        heading: 'Nonviolence did not mean quiet',
        body:
          'As a church leader and later General Secretary of the South African Council of Churches, Tutu became a prominent international voice against apartheid. He supported nonviolent resistance and economic pressure while describing injustice in direct terms. In his 1984 Nobel lecture, he argued that peace without justice was not real peace. His approach joined a commitment to shared humanity with a firm boundary: reconciliation could not require oppressed people to accept dehumanizing conditions.',
      },
      {
        heading: 'Community was a responsibility, not a slogan',
        body:
          'Tutu often described people as becoming fully human through relationship and community. After apartheid, he chaired South Africa’s Truth and Reconciliation Commission, where public testimony tried to hold truth, accountability, and a shared future together. The process had serious limits and critics, but the underlying challenge remains useful: connection that suppresses truth is fragile, while truth used only to humiliate can close the door to repair. Sustainable relationship needs both honesty and human worth.',
      },
    ],
    timeline: [
      {
        period: '1950s',
        title: 'He leaves teaching under Bantu Education',
        description:
          'Tutu rejects a system designed to provide Black children with deliberately inferior education.',
      },
      {
        period: '1960-1978',
        title: 'Faith leadership becomes public advocacy',
        description:
          'He becomes a priest, bishop, and leader in the South African Council of Churches.',
      },
      {
        period: '1984',
        title: 'The Nobel Prize amplifies the message',
        description:
          'Tutu receives the Peace Prize for his role in the nonviolent struggle against apartheid.',
      },
      {
        period: '1995 onward',
        title: 'Truth and reconciliation are tested together',
        description:
          'He chairs the commission hearing testimony about apartheid-era human-rights abuses.',
      },
    ],
    practicalTakeaways: [
      {
        title: 'Do not call avoidance peace',
        description:
          'A quiet relationship may still be unsafe or unjust if one person cannot name what is happening.',
        nextStep: 'Write the truth that must be acknowledged before repair can begin.',
      },
      {
        title: 'Protect dignity while setting limits',
        description:
          'A boundary can reject harmful behavior without requiring you to deny another person’s humanity.',
        nextStep: 'State one limit in terms of the behavior that must change, not an attack on the whole person.',
      },
      {
        title: 'Make repair measurable',
        description:
          'Reconciliation needs changed behavior, accountability, and time, not only an apology or shared intention.',
        nextStep: 'Name one observable condition that would make trust safer to rebuild.',
      },
    ],
    reflectionPrompts: [
      'Where have I mistaken silence for peace?',
      'What boundary protects dignity on both sides?',
      'Which changed behavior would make repair credible?',
    ],
    sources: [
      {
        label: 'Desmond Tutu: Nobel lecture',
        url: 'https://www.nobelprize.org/prizes/peace/1984/tutu/lecture/',
        sourceType: 'first-person-talk',
      },
      {
        label: 'Desmond Tutu: Nobel biography',
        url: 'https://www.nobelprize.org/prizes/peace/1984/tutu/biographical/',
        sourceType: 'official-biography',
      },
    ],
    sourceUrl: 'https://www.nobelprize.org/prizes/peace/1984/tutu/lecture/',
    contentNote: 'Discusses apartheid, state violence, family separation, and human-rights abuses.',
    goalContent: 'Define one truthful and dignity-preserving condition for repairing a relationship',
    habitName: 'Practice honest peace',
    habitDescription: 'Name one truth, one boundary, and one respectful next action in a difficult relationship.',
  }),
];
