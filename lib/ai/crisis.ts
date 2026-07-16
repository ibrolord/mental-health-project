import type { Message } from './claude';

export const CRISIS_RESPONSE = `I’m really sorry you’re facing this. Your immediate safety matters more than continuing this chat.

If you may act on these thoughts or someone is in immediate danger, call your local emergency number now or go to the nearest emergency department. In the U.S. or Canada, call or text 988 to reach the Suicide & Crisis Lifeline. If you are elsewhere, contact your local crisis service or emergency number.

If you can, move away from anything you could use to hurt yourself or someone else and contact a trusted person who can stay with you. Are you in immediate danger right now?`;

const explicitIntentPatterns = [
  /\b(?:kill|hurt|harm|cut)\s+(?:myself|me)\b/,
  /\b(?:end|take)\s+my\s+(?:own\s+)?life\b/,
  /\b(?:want|wish|need|plan|planning|going|gonna|about)\s+to\s+(?:die|kill\s+myself|end\s+my\s+life|hurt\s+myself)\b/,
  /\b(?:i\s+will|i[' ]?m\s+going\s+to|i\s+am\s+going\s+to|planning\s+to)\s+(?:kill|shoot|stab|seriously\s+hurt)\s+(?:him|her|them|someone|people|my\s+\w+)\b/,
  /\b(?:overdose|end\s+it\s+all|better\s+off\s+dead|no\s+(?:point|reason)\s+(?:in\s+)?living|can(?:not|'t)\s+go\s+on)\b/,
  /\b(?:don'?t|do\s+not)\s+want\s+to\s+(?:live|be\s+alive|exist)\b/,
  /\b(?:thinking|thought)\s+(?:about|of)\s+(?:suicide|killing\s+myself|ending\s+my\s+life|jumping\s+off)\b/,
  /\b(?:jump|jumping)\s+off\s+(?:a\s+)?(?:bridge|building|roof|cliff)\b/,
  /\b(?:took|swallowed)\s+(?:all|too\s+many|a\s+handful\s+of)\s+(?:my\s+)?(?:pills|tablets|medication)\b/,
  /\b(?:have|got)\s+(?:a\s+)?(?:gun|weapon|knife|pills)\s+(?:and|that)\s+(?:i\s+)?(?:will|can|am\s+going\s+to|plan\s+to)\s+(?:use|take)\b/,
  /\b(?:going|planning|want|intend|about)\s+to\s+(?:hang|drown|poison|shoot|stab|burn)\s+(?:myself|me)\b/,
  /\b(?:just\s+)?(?:took|swallowed|drank|injected)\s+\d+\s+(?:[a-z]+\s+)?(?:pills|tablets|capsules|tylenol|acetaminophen|ibuprofen)\b/,
  /\b(?:want|going|planning|intend|about)\s+to\s+(?:kill|murder|shoot|stab|poison|seriously\s+hurt)\s+(?:my\s+)?(?:wife|husband|partner|girlfriend|boyfriend|mother|father|mom|dad|child|son|daughter|friend|neighbor|coworker|boss)\b/,
  /\b(?:want|going|planning|intend|about)\s+to\s+(?:kill|murder|shoot|stab|poison|seriously\s+hurt)\s+(?:him|her|them|someone|people|my\s+family|my\s+family\s+members)\b/,
  /\b(?:have|made)\s+(?:a\s+)?plan\s+to\s+(?:kill|murder|shoot|stab|poison|seriously\s+hurt)\s+(?:him|her|them|someone|people|my\s+\w+|my\s+family)\b/,
];

const crisisTerms = /\b(?:suicide|suicidal|self[ -]?harm(?:ing)?|cutting\s+myself)\b/;
const nonCurrentContexts = [
  /\b(?:not|never)\s+suicidal\b/,
  /\bno\s+longer\s+suicidal\b/,
  /\bused\s+to\s+be\s+suicidal\b/,
  /\bsuicide\s+(?:prevention|awareness|statistics|research)\b/,
];

function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function containsExplicitCrisis(messages: Message[]): boolean {
  const recentUserText = messages
    .filter((message) => message.role === 'user')
    .slice(-3)
    .map((message) => message.content)
    .join(' ');
  const normalized = normalize(recentUserText);

  if (!normalized) return false;
  if (explicitIntentPatterns.some((pattern) => pattern.test(normalized))) return true;
  if (!crisisTerms.test(normalized)) return false;

  const withoutNonCurrentContext = nonCurrentContexts.reduce(
    (text, pattern) => text.replace(pattern, ''),
    normalized
  );
  return crisisTerms.test(withoutNonCurrentContext);
}
