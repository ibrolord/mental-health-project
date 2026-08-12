export const LOCAL_SAFETY_MESSAGE =
  "Thank you for telling me. I can’t provide emergency help, but I can help you reach a person now.";

const NEGATED_INTENT = [
  /\b(?:i\s*(?:am|'m)\s+)?not\s+suicidal\b/i,
  /\bi\s+(?:do\s+not|don't|dont)\s+(?:want|plan|intend|need)\s+to\s+(?:die|kill|hurt|harm|end|overdose|shoot|stab|hang|drown|poison)\b/i,
  /\bi\s*(?:am|'m)\s+not\s+(?:going|planning|about)\s+to\s+(?:kill|hurt|harm|end|overdose|shoot|stab|hang|drown|poison)\b/i,
  /\bi\s+have\s+no\s+(?:plan|intention)\s+to\s+(?:die|kill|hurt|harm|end)\b/i,
] as const;

const URGENT_INTENT = [
  /\bi\s*(?:am|'m)\s+suicidal\b/i,
  /\bi\s+(?:want|plan|intend|need|might|will)\s+to\s+(?:die|kill\s+myself|hurt\s+myself|harm\s+myself|end\s+my\s+life|take\s+my\s+life|commit\s+suicide)\b/i,
  /\bi\s+will\s+(?:die|kill\s+myself|hurt\s+myself|harm\s+myself|end\s+my\s+life|take\s+my\s+life|commit\s+suicide)\b/i,
  /\bi\s*(?:am|'m)\s+(?:going|planning|about)\s+to\s+(?:kill\s+myself|hurt\s+myself|harm\s+myself|end\s+my\s+life|take\s+my\s+life|commit\s+suicide)\b/i,
  /\bi\s+have\s+(?:a\s+)?plan\s+to\s+(?:die|kill\s+myself|hurt\s+myself|harm\s+myself|end\s+my\s+life|take\s+my\s+life|commit\s+suicide)\b/i,
  /\bi\s+(?:have|made)\s+(?:a\s+)?(?:suicide|self[- ]harm)\s+plan\b/i,
  /\bi\s+(?:cannot|can't|cant)\s+keep\s+myself\s+safe\b/i,
  /\bi\s+(?:(?:want|plan|intend|need|might)\s+to|will)\s+(?:overdose|shoot\s+myself|stab\s+myself|hang\s+myself|drown\s+myself|poison\s+myself)\b/i,
  /\bi\s*(?:am|'m)\s+(?:going|planning|about)\s+to\s+(?:overdose|shoot\s+myself|stab\s+myself|hang\s+myself|drown\s+myself|poison\s+myself)\b/i,
  /\bi\s+(?:(?:already|just)\s+)?overdosed\b/i,
  /\bi\s+(?:just\s+)?(?:took|swallowed)\s+(?:an\s+overdose|too\s+many\s+(?:pills|tablets|medications?))\b/i,
  /\bi\s*(?:am|'m)\s+(?:going|planning|about)\s+to\s+kill\s+(?:someone|somebody|him|her|them|you)\b/i,
  /\bi\s+(?:(?:want|plan|intend|need|might)\s+to|will)\s+kill\s+(?:someone|somebody|him|her|them|you)\b/i,
  /\bi\s*(?:am|'m)\s+(?:going|planning|about)\s+to\s+(?:hurt|harm)\s+(?:someone|somebody|him|her|them)\b(?!\s*(?:['’]s\s+)?(?:feelings?|reputation|career|property)\b)(?!\s+(?:emotionally|financially|professionally)\b)/i,
  /\bi\s+(?:want|plan|intend|need|might|will)\s+to\s+(?:hurt|harm)\s+(?:someone|somebody|him|her|them)\b(?!\s*(?:['’]s\s+)?(?:feelings?|reputation|career|property)\b)(?!\s+(?:emotionally|financially|professionally)\b)/i,
] as const;

function clauses(text: string): string[] {
  return text
    .replace(/[’]/g, "'")
    .split(/(?:[,!?.;\n]+|\bbut\b|\bhowever\b|\band\s+(?=i\b))/i)
    .map((value) => value.trim())
    .filter(Boolean);
}

/**
 * Detects only explicit, first-person statements that need an immediate,
 * non-network safety path. It is not a risk score or diagnostic classifier.
 */
export function hasExplicitUrgentSafetyLanguage(text: string): boolean {
  return clauses(text).some((clause) => {
    if (NEGATED_INTENT.some((pattern) => pattern.test(clause))) return false;
    return URGENT_INTENT.some((pattern) => pattern.test(clause));
  });
}
