/**
 * Shared deterministic crisis phrase patterns.
 *
 * KEEP IN SYNC: `lib/ai/crisis-patterns.ts` (server) and
 * `mobile/lib/crisis-patterns.ts` (on-device) must stay byte-identical. The
 * mobile bundle cannot import from the repository root, so the file is
 * duplicated and `tests/ai/crisis-parity.test.ts` fails if the copies drift.
 *
 * Rules for edits:
 * - Only add patterns. Removing one, or adding a negation guard that stops an
 *   existing phrase from matching, weakens the safety path.
 * - Stay within ES2017 regex features (no `\p{...}` and no lookbehind). The
 *   mobile copy runs on Hermes and a syntax error here would break chat,
 *   voice and Advisor at module load.
 * - JavaScript `\b` is ASCII-only. Non-Latin phrases are built from plain
 *   strings by `phrase()` so they use whitespace boundaries instead.
 */

const ZERO_WIDTH = /[​-‍⁠﻿]/g;
const LATIN_COMBINING_MARKS = /[̀-ͯ]/g;
// Punctuation, symbols and control characters only. Letters in every script
// are kept so non-English text is still checked. `'` and `-` are kept because
// patterns use them (for example "don't" and "self-harm").
const PUNCTUATION =
  /[\u0000-&(-,./:-@[-`{-¿×÷‐-‧‰-⁞　-〿।॥！-／：-＠［-｀｛-･]/g;

/**
 * Normalises text for crisis matching without discarding any script.
 * NFKD folds compatibility forms (for example full-width letters), and Latin
 * diacritics are removed so "não" matches "nao". Combining marks in other
 * scripts (such as Devanagari vowel signs) are kept because they carry meaning.
 */
export function normalizeCrisisText(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(LATIN_COMBINING_MARKS, '')
    .replace(ZERO_WIDTH, '')
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(PUNCTUATION, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds a pattern from a literal phrase in any script. The phrase goes
 * through the same normalisation as user text, so authored and typed forms
 * compare equally.
 */
function phrase(value: string, options: { wordBoundary: boolean }): RegExp {
  const normalized = escapeRegExp(normalizeCrisisText(value)).replace(/ /g, '\\s+');
  return options.wordBoundary
    ? new RegExp(`(?:^|\\s)${normalized}`)
    : new RegExp(normalized);
}

const ENGLISH_PATTERNS: readonly RegExp[] = [
  // Indirect statements about life having no point.
  /\b(?:don'?t|do\s+not|can'?t|cannot|can\s+not)\s+see\s+(?:the|any)\s+(?:point|reason)\s+(?:in|of|to)\s+(?:living|life|being\s+alive|staying\s+alive|existing|going\s+on|carrying\s+on|keep\s+living)\b/,
  /\b(?:no|not\s+any|isn'?t\s+any|there'?s\s+no)\s+(?:point|reason|purpose)\s+(?:in\s+|of\s+)?(?:living|to\s+live|being\s+alive|staying\s+alive|existing|to\s+keep\s+living|to\s+go\s+on|to\s+be\s+alive)\b/,
  /\bwhat(?:'?s|\s+is)\s+the\s+point\s+(?:of|in)\s+(?:living|being\s+alive|staying\s+alive|existing)\b/,
  /\bnothing\s+(?:left\s+)?to\s+live\s+for\b/,
  /\b(?:tired|sick|exhausted)\s+of\s+(?:living|being\s+alive|life|existing)\b/,
  // Burdensomeness.
  /\bbetter\s+off\s+without\s+me\b/,
  /\bbetter\s+off\s+if\s+i\s+(?:(?:was|were)\s+(?:gone|dead|not\s+(?:here|around|alive|born)|never\s+born)|(?:wasn'?t|weren'?t)\s+(?:here|around|alive|born))\b/,
  /\b(?:would|will|'d)\s+be\s+(?:happier|easier)\s+(?:for\s+everyone\s+)?without\s+me\b/,
  // Shorthand. "kms" is not treated as kilometres after a number.
  /(?:^|[^0-9\s])\s*\bkms\b(?!\s+(?:away|from|per|an?\s+hour|a\s+day|run|walk|drive|ride|today|yesterday|this\s+week))/,
  // "kys" only when the speaker is talking about themselves.
  /\bi\s*(?:'ll|will|should|wanna|want\s+to|might|could|may|am\s+(?:gonna|going\s+to|about\s+to)|'?\s*m\s+(?:gonna|going\s+to|about\s+to))\s+(?:just\s+)?(?:go\s+)?kys\b/,
  /\b(?:wanna|wana|want\s+2)\s+(?:just\s+|literally\s+|honestly\s+)?die\b/,
  /\bwant\s+to\s+(?:just|literally|honestly)\s+die\b/,
  /\b(?:want|wanna|going|gonna|ready|planning|about)\s+(?:to\s+)?end\s+(?:it|it\s+all|everything|things)\b(?!\s+(?:with|between|for\s+(?:the\s+)?(?:day|night|now|today)))/,
  // Wishing not to wake up. Anchored so "I never wake up on time" is ignored.
  /\b(?:hope|wish|want|wanna|pray|praying)\s+(?:to\s+)?(?:i\s+)?(?:could\s+|would\s+|will\s+|can\s+)?(?:just\s+)?(?:go\s+to\s+sleep\s+and\s+|sleep\s+and\s+|fall\s+asleep\s+and\s+)?(?:never|not|don'?t|won'?t|wouldn'?t)\s+wake\s+up\b/,
  /\b(?:go\s+to\s+sleep|sleep|fall\s+asleep)\s+(?:and\s+)?(?:never|not)\s+wake\s+up\b/,
  /\bnever\s+wake\s+up\s+again\b/,
  /\bun-?aliv(?:e|ing)\s+(?:my\s*self|me)\b/,
  /\b(?:wanna|want\s+to|going\s+to|gonna|should|will|might|plan\s+to|thinking\s+(?:about|of))\s+(?:just\s+)?un-?aliv(?:e|ing)\b/,
  // Misspellings of "kill myself".
  /\bk[i1y]l{1,2}\s*(?:my\s*s[e3]lf|myslef|mysefl|meself|my\s+slef)\b/,
  // Stockpiling means.
  /\b(?:pills|tablets|meds|medication|medicine)\s+(?:saved|stocked|stockpiled|hoarded|stashed)(?:\s+up)?\b/,
  /\b(?:saving|saved|stockpiling|stockpiled|hoarding|hoarded|stashing|stashed)\s+(?:up\s+)?(?:my\s+|all\s+my\s+|some\s+)?(?:pills|tablets|meds|medication|sleeping\s+pills)\b/,
  /\b(?:can'?t|cannot|can\s+not|unable\s+to)\s+keep\s+myself\s+safe\b/,
  /\b(?:thinking|thought|think|thoughts)\s+(?:about|of)\s+(?:suicide|sucide|suicde|suiside|killing\s+myself|ending\s+(?:my\s+life|it\s+all|it)|taking\s+my\s+(?:own\s+)?life|being\s+dead)\b/,
  /\b(?:commit|committing|commiting|attempt|attempting)\s+(?:suicide|sucide|suicde|suiside)\b/,
  /\b(?:feel|feeling|felt|am|i'?m|been|getting)\s+(?:so\s+|really\s+|very\s+|kind\s+of\s+|kinda\s+|a\s+bit\s+)?(?:suicidal|sucidal|suisidal|suicidle)\b/,
  /\bsuicidal\s+(?:thoughts|feelings|urges|ideation)\b/,
  /\b(?:don'?t|do\s+not)\s+want\s+to\s+be\s+(?:here|around|alive)\s+(?:anymore|any\s+more|any\s+longer)\b/,
  /\bwish\s+i\s+(?:was|were|had\s+been)\s+(?:dead|never\s+born|gone)\b/,
  /\bwant\s+to\s+be\s+dead\b/,
  /\b(?:wanna|want\s+to)\s+disappear\s+(?:forever|for\s+good|permanently)\b/,
];

// Patterns below are written in folded form (accents removed), matching the
// output of normalizeCrisisText.
const SPANISH_PATTERNS: readonly RegExp[] = [
  /\b(?:quiero|me\s+quiero|deseo|voy\s+a|tengo\s+ganas\s+de)\s+(?:morir(?:me)?|matarme|suicidarme|quitarme\s+la\s+vida)\b/,
  /\bme\s+(?:quiero|voy\s+a)\s+(?:matar|suicidar|morir)\b/,
  /\bno\s+quiero\s+(?:seguir\s+)?vivir\b/,
  /\bno\s+(?:vale\s+la\s+pena|tiene\s+sentido)\s+(?:seguir\s+)?vivir\b/,
  /\b(?:pensando|pienso)\s+en\s+(?:el\s+)?(?:suicidio|suicidarme|matarme)\b/,
  /\b(?:pensamientos|ideas)\s+suicidas\b/,
];

const FRENCH_PATTERNS: readonly RegExp[] = [
  /\bje\s+(?:veux|voudrais|vais)\s+(?:mourir|me\s+tuer|me\s+suicider|en\s+finir)\b/,
  /\bj'?\s*ai\s+envie\s+(?:de\s+(?:mourir|me\s+tuer|me\s+suicider)|d'?\s*en\s+finir)\b/,
  /\bje\s+(?:ne\s+)?veux\s+plus\s+vivre\b/,
  /\b(?:pense|pensee|pensees|penser)\s+au\s+suicide\b/,
  /\bje\s+suis\s+suicidaire\b/,
  /\bidees\s+suicidaires\b/,
  /\bmettre\s+fin\s+a\s+(?:mes\s+jours|ma\s+vie)\b/,
];

const GERMAN_PATTERNS: readonly RegExp[] = [
  /\bich\s+(?:will|mochte|moechte|werde)\s+(?:sterben|mich\s+umbringen|mich\s+toten|mir\s+das\s+leben\s+nehmen)\b/,
  /\bich\s+(?:will|mochte|moechte|kann)\s+nicht\s+mehr\s+leben\b/,
  /\bich\s+bringe?\s+mich\s+um\b/,
  /\bmich\s+umbringen\b/,
  /\b(?:selbstmordgedanken|suizidgedanken)\b/,
  /\bich\s+bin\s+suizidal\b/,
  /\bleben\s+hat\s+keinen\s+sinn\s+mehr\b/,
];

const PORTUGUESE_PATTERNS: readonly RegExp[] = [
  /\b(?:quero|vou|desejo)\s+(?:morrer|me\s+matar|me\s+suicidar|tirar\s+(?:a\s+)?minha\s+(?:propria\s+)?vida)\b/,
  /\bnao\s+quero\s+(?:mais\s+)?viver\b/,
  /\bpensando\s+em\s+(?:suicidio|me\s+matar)\b/,
  /\bpensamentos\s+suicidas\b/,
];

const HINDI_PATTERNS: readonly RegExp[] = [
  // Romanised Hindi.
  /\b(?:marna|mar\s+jana|mar\s+jaana)\s+(?:chahta|chahti|chahata|chahati)\b/,
  /\b(?:khudkushi|khud\s+kushi|aatmahatya|atmahatya)\b/,
  /\b(?:jeena|jina)\s+nahi\s+(?:chahta|chahti)\b/,
  // Devanagari.
  ...[
    'मरना चाहता',
    'मरना चाहती',
    'मर जाना चाहता',
    'मर जाना चाहती',
    'आत्महत्या',
    'जीना नहीं चाहता',
    'जीना नहीं चाहती',
    'खुद को मार',
    'ख़ुद को मार',
    'अपनी जान ले',
    'जीने का कोई मतलब नहीं',
    'जीने की कोई वजह नहीं',
  ].map((value) => phrase(value, { wordBoundary: true })),
];

const CHINESE_PATTERNS: readonly RegExp[] = ['不想活了', '我想死', '想自杀', '活不下去'].map(
  (value) => phrase(value, { wordBoundary: false })
);

/**
 * Patterns shared by the server crisis check and the mobile on-device check.
 * They are matched against `normalizeCrisisText(text)`.
 */
export const SHARED_CRISIS_PATTERNS: readonly RegExp[] = [
  ...ENGLISH_PATTERNS,
  ...SPANISH_PATTERNS,
  ...FRENCH_PATTERNS,
  ...GERMAN_PATTERNS,
  ...PORTUGUESE_PATTERNS,
  ...HINDI_PATTERNS,
  ...CHINESE_PATTERNS,
];

/** `normalized` must already be the output of `normalizeCrisisText`. */
export function matchesSharedCrisisPattern(normalized: string): boolean {
  if (!normalized) return false;
  return SHARED_CRISIS_PATTERNS.some((pattern) => pattern.test(normalized));
}
