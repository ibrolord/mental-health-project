export type AffirmationRecord = {
  id: string;
};

export type AffirmationDisplayRecord = AffirmationRecord & {
  content: string;
  category: string;
  kind: 'affirmation' | 'quote';
  attribution_name: string | null;
  source_title: string | null;
  source_url: string | null;
  mood_tags?: string[];
  historyEligible?: boolean;
};

export const SOURCED_QUOTE_FALLBACKS: AffirmationDisplayRecord[] = [
  {
    id: 'a11f0000-0000-4000-8000-000000000001',
    content:
      'I learned that courage was not the absence of fear, but the triumph over it.',
    mood_tags: ['😐', '😞'],
    category: 'capability',
    kind: 'quote',
    attribution_name: 'Nelson Mandela',
    source_title: 'Nelson Mandela Foundation statement',
    source_url:
      'https://www.nelsonmandela.org/news/entry/media-statement-foundation-supports-national-lockdown',
    historyEligible: false,
  },
  {
    id: 'a11f0000-0000-4000-8000-000000000002',
    content: 'A time when we have to shed our fear and give hope to each other.',
    mood_tags: ['😐', '😞'],
    category: 'growth',
    kind: 'quote',
    attribution_name: 'Wangari Maathai',
    source_title: 'Nobel Lecture',
    source_url:
      'https://www.nobelprize.org/prizes/peace/2004/maathai/lecture/',
    historyEligible: false,
  },
  {
    id: 'a11f0000-0000-4000-8000-000000000003',
    content: 'One child, one teacher, one pen and one book can change the world.',
    mood_tags: ['🙂', '😐'],
    category: 'capability',
    kind: 'quote',
    attribution_name: 'Malala Yousafzai',
    source_title: 'Malala Fund: UN speech',
    source_url: 'https://malala.org/news-and-voices/malala-un-speech',
    historyEligible: false,
  },
  {
    id: 'a11f0000-0000-4000-8000-000000000004',
    content:
      "Being honest about how we feel doesn't make us weak - it makes us human.",
    mood_tags: ['😞', '😢'],
    category: 'self-compassion',
    kind: 'quote',
    attribution_name: 'Sangu Delle',
    source_title:
      'TED: There is no shame in taking care of your mental health',
    source_url:
      'https://www.ted.com/talks/sangu_delle_there_s_no_shame_in_taking_care_of_your_mental_health',
    historyEligible: false,
  },
  {
    id: 'a11f0000-0000-4000-8000-000000000005',
    content: 'The opposite of depression is not happiness, but vitality.',
    mood_tags: ['😞', '😢'],
    category: 'self-compassion',
    kind: 'quote',
    attribution_name: 'Andrew Solomon',
    source_title: 'TED: Depression, the secret we share',
    source_url:
      'https://www.ted.com/talks/andrew_solomon_depression_the_secret_we_share',
    historyEligible: false,
  },
  {
    id: 'a11f0000-0000-4000-8000-000000000006',
    content:
      "They're going to move forward. But that doesn't mean that they've moved on.",
    mood_tags: ['😞', '😢'],
    category: 'rest',
    kind: 'quote',
    attribution_name: 'Nora McInerny',
    source_title:
      'TED: We do not move on from grief. We move forward with it',
    source_url:
      'https://www.ted.com/talks/nora_mcinerny_we_don_t_move_on_from_grief_we_move_forward_with_it',
    historyEligible: false,
  },
  {
    id: 'a11f0000-0000-4000-8000-000000000007',
    content:
      'Narrative is radical, creating us at the very moment it is being created.',
    mood_tags: ['🙂', '😐'],
    category: 'growth',
    kind: 'quote',
    attribution_name: 'Toni Morrison',
    source_title: 'Nobel Lecture',
    source_url:
      'https://www.nobelprize.org/prizes/literature/1993/morrison/lecture/',
    historyEligible: false,
  },
  {
    id: 'a11f0000-0000-4000-8000-000000000008',
    content:
      'Stories have been used to dispossess and to malign, but stories can also be used to empower and to humanize.',
    mood_tags: ['🙂', '😐'],
    category: 'growth',
    kind: 'quote',
    attribution_name: 'Chimamanda Ngozi Adichie',
    source_title: 'TED: The danger of a single story',
    source_url:
      'https://www.ted.com/talks/chimamanda_ngozi_adichie_the_danger_of_a_single_story',
    historyEligible: false,
  },
  {
    id: 'a11f0000-0000-4000-8000-000000000009',
    content:
      'I believe that unarmed truth and unconditional love will have the final word in reality.',
    mood_tags: ['😐', '😞'],
    category: 'capability',
    kind: 'quote',
    attribution_name: 'Martin Luther King Jr.',
    source_title: 'Nobel Peace Prize acceptance speech',
    source_url:
      'https://www.nobelprize.org/prizes/peace/1964/king/acceptance-speech/',
    historyEligible: false,
  },
  {
    id: 'a11f0000-0000-4000-8000-000000000010',
    content:
      'What you do makes a difference, and you have to decide what kind of difference you want to make.',
    mood_tags: ['🙂', '😐'],
    category: 'growth',
    kind: 'quote',
    attribution_name: 'Jane Goodall',
    source_title: 'Jane Goodall Institute',
    source_url:
      'https://janegoodall.org/news/eatmeatless-for-people-other-animals-and-the-environment/',
    historyEligible: false,
  },
  {
    id: 'a11f0000-0000-4000-8000-000000000011',
    content:
      "With self-compassion, we give ourselves the same kindness and support we'd give to a good friend.",
    mood_tags: ['😞', '😢'],
    category: 'self-compassion',
    kind: 'quote',
    attribution_name: 'Kristin Neff',
    source_title: 'Self-Compassion',
    source_url: 'https://self-compassion.org/',
    historyEligible: false,
  },
  {
    id: 'a11f0000-0000-4000-8000-000000000012',
    content:
      'When people show you - or tell you - who they are, believe them the first time.',
    mood_tags: ['😐', '😞'],
    category: 'boundaries',
    kind: 'quote',
    attribution_name: 'Maya Angelou',
    source_title: 'Oprah on lessons from Maya Angelou',
    source_url:
      'https://www.oprahdaily.com/life/a38746686/maya-angelou-lessons-oprah-self-acceptance/',
    historyEligible: false,
  },
];

export function normalizeLegacyAffirmations(
  records: readonly { id: string; content: string; category: string }[]
): AffirmationDisplayRecord[] {
  return records.map((record) => ({
    ...record,
    kind: 'affirmation',
    attribution_name: null,
    source_title: null,
    source_url: null,
    historyEligible: true,
  }));
}

export function quoteFallbacksForMood(
  mood: string | null | undefined
): AffirmationDisplayRecord[] {
  if (!mood) return SOURCED_QUOTE_FALLBACKS;
  const matchingQuotes = SOURCED_QUOTE_FALLBACKS.filter(({ mood_tags }) =>
    mood_tags?.includes(mood)
  );
  return matchingQuotes.length > 0 ? matchingQuotes : SOURCED_QUOTE_FALLBACKS;
}

export function resolveAffirmationCatalog(
  records: readonly AffirmationDisplayRecord[],
  mood: string | null | undefined
): AffirmationDisplayRecord[] {
  return records.length > 0 ? [...records] : quoteFallbacksForMood(mood);
}

type RandomAffirmationOptions = {
  excludeIds?: Iterable<string>;
  currentId?: string | null;
  random?: () => number;
};

function randomIndex(length: number, random: () => number): number {
  const value = random();
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return length - 1;
  return Math.floor(value * length);
}

export function chooseRandomAffirmation<T extends AffirmationRecord>(
  affirmations: readonly T[],
  {
    excludeIds = [],
    currentId = null,
    random = Math.random,
  }: RandomAffirmationOptions = {}
): T | null {
  const uniqueAffirmations = Array.from(
    new Map(affirmations.map((affirmation) => [affirmation.id, affirmation])).values()
  );
  if (uniqueAffirmations.length === 0) return null;

  const excluded = new Set(excludeIds);
  const unseen = uniqueAffirmations.filter(
    (affirmation) =>
      !excluded.has(affirmation.id) && affirmation.id !== currentId
  );
  const notCurrent = uniqueAffirmations.filter(
    (affirmation) => affirmation.id !== currentId
  );
  const pool =
    unseen.length > 0
      ? unseen
      : notCurrent.length > 0
        ? notCurrent
        : uniqueAffirmations;

  return pool[randomIndex(pool.length, random)] ?? null;
}
