export type EvidenceStrength = 'strong' | 'moderate' | 'emerging' | 'limited';

export type EvidenceSource = {
  id: string;
  title: string;
  summary: string;
  strength: EvidenceStrength;
  url: string;
  citation: string;
};

export const EVIDENCE_SOURCES: EvidenceSource[] = [
  {
    id: 'habit-repetition',
    title: 'Repeat a small action in a stable context',
    summary:
      'Real-world habit formation followed repeated action in a consistent context and varied widely between people. Missing one opportunity did not materially derail the process.',
    strength: 'moderate',
    url: 'https://doi.org/10.1002/ejsp.674',
    citation: 'Lally et al., European Journal of Social Psychology (2010)',
  },
  {
    id: 'implementation-intentions',
    title: 'Use a specific if-then plan',
    summary:
      'Implementation intentions connect a recognizable situation with a concrete response. Meta-analytic evidence finds small-to-moderate improvements in goal follow-through.',
    strength: 'moderate',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8149892/',
    citation: 'Wang et al., Frontiers in Psychology (2021)',
  },
  {
    id: 'behavioral-activation',
    title: 'Schedule one meaningful or useful action',
    summary:
      'Internet-delivered behavioral activation has reduced depressive symptoms in randomized trials. MHtoolkit borrows activity scheduling, not clinical treatment.',
    strength: 'strong',
    url: 'https://pubmed.ncbi.nlm.nih.gov/37227760/',
    citation: 'Huguet et al., Journal of Medical Internet Research (2023)',
  },
  {
    id: 'cbti',
    title: 'Use evidence-based sleep behavior, not sleep hacks',
    summary:
      'CBT-I is the recommended behavioral treatment for chronic insomnia. A simple routine can support consistency, but persistent insomnia deserves clinical assessment.',
    strength: 'strong',
    url: 'https://aasm.org/wp-content/uploads/2021/08/Behavioral-and-Psychological-Treatments-for-Insomnia-Patient-Guide.pdf',
    citation: 'American Academy of Sleep Medicine patient guide (2021)',
  },
  {
    id: 'slow-breathing',
    title: 'Slow breathing can shift short-term physiology',
    summary:
      'A systematic review found voluntary slow breathing affects heart rate variability associated with parasympathetic activity. It is an optional regulation tool, not a cure.',
    strength: 'moderate',
    url: 'https://pubmed.ncbi.nlm.nih.gov/35623448/',
    citation: 'Laborde et al., Neuroscience & Biobehavioral Reviews (2022)',
  },
  {
    id: 'working-memory-training',
    title: 'Cognitive practice has narrow, modest effects',
    summary:
      'Working-memory practice can improve trained performance, but average effects are small and real-life transfer may be minimal. Games here are short practice, not brain treatment.',
    strength: 'limited',
    url: 'https://pubmed.ncbi.nlm.nih.gov/39590641/',
    citation: 'Syed et al., Journal of Intelligence (2024)',
  },
  {
    id: 'microbreaks',
    title: 'Short breaks support energy more reliably than output',
    summary:
      'A meta-analysis found small improvements in vigor and fatigue from micro-breaks. Overall performance gains were not statistically significant.',
    strength: 'moderate',
    url: 'https://pubmed.ncbi.nlm.nih.gov/36044424/',
    citation: 'Albulescu et al., PLOS ONE (2022)',
  },
  {
    id: 'nature-sound',
    title: 'Natural sound may help some stress markers',
    summary:
      'Evidence is mixed: natural sounds improved some physiological measures compared with quiet, but not perceived stress. Sound remains optional and preference-led.',
    strength: 'emerging',
    url: 'https://pubmed.ncbi.nlm.nih.gov/39285764/',
    citation: 'Fan & Baharum, Stress (2024)',
  },
  {
    id: 'notifications',
    title: 'A reminder can prompt action now, not guarantee adherence',
    summary:
      'A micro-randomized trial found a strong near-term engagement effect from notifications but no overall difference in time to disengagement. Reminders should be sparse and user-controlled.',
    strength: 'emerging',
    url: 'https://pubmed.ncbi.nlm.nih.gov/37294612/',
    citation: 'Bell et al., JMIR mHealth and uHealth (2023)',
  },
  {
    id: 'yoga-safety',
    title: 'Begin with gentle forms and qualified guidance',
    summary:
      'Yoga is generally safe when practiced appropriately, but sprains and strains can occur. Beginners should avoid extreme poses and use qualified guidance when health needs require modification.',
    strength: 'moderate',
    url: 'https://www.nccih.nih.gov/health/yoga-effectiveness-and-safety',
    citation: 'National Center for Complementary and Integrative Health (2023)',
  },
  {
    id: 'yoga-depression',
    title: 'Mental-health findings are promising but inconsistent',
    summary:
      'A review of randomized trials found short-term improvements compared with passive controls, while results against active controls and overall evidence quality were inconsistent. Guided movement here is optional support, not treatment.',
    strength: 'emerging',
    url: 'https://pubmed.ncbi.nlm.nih.gov/40226719/',
    citation: 'Moosburner et al., Depression and Anxiety (2024)',
  },
  {
    id: 'physical-activity',
    title: 'Some activity is better than none',
    summary:
      'WHO guidance supports regular physical activity and reducing sedentary time, with adaptations for ability, health conditions, pregnancy, and age. A short sequence is only one small movement option.',
    strength: 'strong',
    url: 'https://www.who.int/publications/i/item/9789240014886',
    citation: 'World Health Organization physical activity guidelines (2020)',
  },
];

const evidenceById = new Map(EVIDENCE_SOURCES.map((source) => [source.id, source]));

export function evidenceFor(ids: string[]): EvidenceSource[] {
  return ids.flatMap((id) => {
    const source = evidenceById.get(id);
    return source ? [source] : [];
  });
}

export const EVIDENCE_STRENGTH_LABELS: Record<EvidenceStrength, string> = {
  strong: 'Established',
  moderate: 'Supported',
  emerging: 'Early evidence',
  limited: 'Limited transfer',
};
