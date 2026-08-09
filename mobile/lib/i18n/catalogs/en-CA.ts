export const EN_CA_MESSAGES = {
  'nav.today': 'Today',
  'nav.mood': 'Mood',
  'nav.chat': 'AI Chat',
  'nav.assess': 'Assess',
  'nav.more': 'More',
  'today.resume': 'Continue where you left off',
  'today.saved': 'Saved for later',
  'weekly.title': 'This week',
  'weekly.notice': 'Worth noticing?',
  'validation.required': 'This field is required.',
} as const;

export type MobileMessageKey = keyof typeof EN_CA_MESSAGES;
