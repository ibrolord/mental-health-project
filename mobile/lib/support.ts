export const SUPPORT_EMAIL = 'bolajiag10@gmail.com';
export const SUPPORT_URL = 'https://mhtoolkit.vercel.app/support';

export const SUPPORT_EMAIL_URL =
  `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('MHtoolkit Support & Feedback')}`;

const feedbackBody = [
  'What would you like us to improve?',
  '',
  '',
  'What were you trying to do?',
  '',
  '',
  'Anything else you want us to know?',
].join('\n');

export const FEEDBACK_EMAIL_URL =
  `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('MHtoolkit feedback')}` +
  `&body=${encodeURIComponent(feedbackBody)}`;
