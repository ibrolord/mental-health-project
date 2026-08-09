export const EN_CA_MESSAGES = {
  'nav.today': 'Today',
  'nav.mood': 'Mood',
  'nav.goals': 'Goals',
  'nav.chat': 'Chat',
  'nav.ground': 'Ground',
  'nav.more': 'More',
  'today.title': 'Welcome back.',
  'today.subtitle': 'Check in, notice the pattern, and choose one next step.',
  'today.resume': 'Continue where you left off',
  'today.saved': 'Saved for later',
  'weekly.title': 'This week',
  'weekly.notice': 'Worth noticing?',
  'validation.required': 'This field is required.',
} as const;

export type MessageKey = keyof typeof EN_CA_MESSAGES;
