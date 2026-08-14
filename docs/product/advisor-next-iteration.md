# Advisor — Next Iteration Product Direction

Status: **decided**, engineer-ready. Supersedes nothing; extends the current deterministic Advisor. No open questions — every branch below is chosen, not offered.

Target of the change: give Advisor useful *synthesis* — "here is what moved, here is the one thing to do" — without turning it into a dashboard, a surveillance surface, a settings wizard, or a source of clinical claims.

Files this direction touches:

| Concern | File |
| --- | --- |
| Selection, candidates, types | `mobile/lib/advisor-core.ts` |
| Context loading | `mobile/lib/advisor-context.ts` |
| Outcome ledger | `mobile/lib/advisor-outcome-storage.ts` |
| Home card | `mobile/components/AdvisorHomeCard.tsx` |
| Advisor screen | `mobile/app/advisor.tsx` |
| Home screen wiring | `mobile/app/(tabs)/index.tsx` |
| Health features | `mobile/lib/apple-health-core.ts` |
| Safety gate | `mobile/lib/local-safety.ts` |
| AI consent | `mobile/lib/ai-consent.ts`, `mobile/lib/apple-health-ai-consent.ts` |
| Nudges | `mobile/lib/notification-content-core.ts` |
| New: observation ledger | `mobile/lib/advisor-observation-ledger.ts` |
| New: AI phrasing client | `mobile/lib/advisor-phrasing.ts` |

---

## 1. Home vs `/advisor`

**Home is one action. This is a hard invariant, not a default.**

The botanical card renders, in order:

1. Eyebrow — `FOR RIGHT NOW` (unchanged)
2. **At most one** change line — new, optional, one sentence, ≤ 90 chars, rendered in the caption style directly under the eyebrow
3. Heading — first sentence of the selected action (unchanged)
4. Primary button — `resourceLabel` (unchanged)
5. Quiet row — `Try something else` · `Why this?` (unchanged)
6. Source line — `Using Mood · Goal` (unchanged)
7. `Why this?` expansion — now shows **all** selected observations (1–3), not just one

Nothing else. No second card. No counts, no numbers, no charts, no streak badges, no lists on Home. The change line is suppressed entirely under the conditions in §5 and §6.

**`/advisor` is the progressive-disclosure surface.** It renders:

- `WHAT I'M SEEING` — the 1–3 observations, each one sentence, plain text, no numerals except where the numeral *is* the observation (see §2 templates). No icons, no severity colouring. **When there are zero observations (safety, Low Energy), the whole section including its heading is not rendered** — no empty state, no "nothing to report" copy.
- `ONE THING TO DO` — the same recommendation as Home, same id, same route. Never a different action than Home is showing.
- `Try the smaller step` / `Try something else` / `Share with Together` / `Talk this through` (unchanged)
- `Recent outcomes` (unchanged)

The Home/`/advisor` agreement guarantee is a **purity property, not a cross-screen invariant**: given the same context snapshot and outcome list, both screens select the same id. It is not "the same id all day" — both screens reload on focus, and `recommendationOfferedToday` can only pin an action whose id still appears in the freshly built candidate list. Complete the habit at 6pm and `createAdvisorContextSnapshot` filters it out, `habitCandidates` is never generated, the pin cannot match, and a different action legitimately appears. That is correct behavior. Do not add cross-screen caching to "fix" it.

### Together gets the action, and nothing else

Together is a **shared** surface — another human reads it. Everything §2 adds is a reading of the user's private week, and none of it crosses that line.

`shareWithTogether` (`mobile/app/advisor.tsx:146`) already does the right thing: it pushes `/accountability/create` with `params: { title: recommendation.action, source: 'advisor' }`. **Keep it exactly that shape.** As this iteration adds `observations[]` and `changeSignal` to `AdvisorRecommendation`, the temptation to enrich the share payload appears for the first time — refuse it.

Never passed to Together, in params, prefill, or description:

- any observation string, including `observations[0]`
- the change line or any `changeSignal` field
- anything Health-derived, in any wording
- mood label, mood emoji, or mood date
- habit completion counts, goal due dates, or outcome history

The action string carries a goal or habit title, which the user chose and is already sharing by creating the commitment. That is the entire payload. `smallerAction` is also excluded — if the user wants to commit to the smaller step, they tap `Try the smaller step` first, which changes `action`.

Rejected: a second Home tile for "what changed"; an insights/trends screen; a per-signal toggle screen; enriching the Together share with context.

---

## 2. Synthesis model

Pure, deterministic, total. All of it lives in `advisor-core.ts` and takes only the existing `AdvisorContext` plus the outcome list.

### 2.1 Type changes

Extend `AdvisorRecommendation`, do not fork it:

```
observations: readonly string[]   // 1–3, ordered by rank; observations[0] === observation
changeSignal: AdvisorChangeSignal | null
```

Keep `observation: string` as the single Home-facing `Why this?` line and define it as `observations[0]`. This preserves every existing contract test.

New type:

```
AdvisorChangeSignal = {
  id: string;          // stable, see 2.3
  stream: 'sleep' | 'steps' | 'habit' | 'goal' | 'feedback';
  direction: 'up' | 'down' | 'due' | 'stalled' | 'steady';
  severity: 'notable' | 'minor';
  line: string;        // ≤ 90 chars, the Home change line
}
```

`selectAdvisorRecommendation` stays pure and total. It must never throw, never await, and never read a clock other than `context.nowIso`.

### 2.2 Context additions

`loadAmbientAdvisorContext` gains **exactly one field**, loaded in the existing `Promise.allSettled` block and defaulting to a safe empty value on failure:

- `habitWeek: { habitId: string; completedDays: number; habitAgeDays: number } | null` — for the single selected habit: `completedDays` is the count of `habit_logs` rows in the last 7 local days with `completed = true`; `habitAgeDays` is derived from `habits.created_at`, **not** from log-row count. This distinction is load-bearing (see §2.3).

That is the whole list. One field, one extra query, same owner scoping.

> **Cut — do not build.** An earlier draft of this doc also added `goalStaleness: { goalId, lastTouchedDaysAgo }` from `goals.updated_at`. It is removed. No signal in §2.3 consumes it — `goal-due` and `goal-overdue` both read `dueAt`, which is already on `AdvisorGoal`. A `goal-stalled` signal is a separate, later decision, and `updated_at` would be the wrong input for it anyway: any incidental edit refreshes the timestamp without the goal actually moving.

`loadIncompleteHabit` returns `[]` when `!owner.userId`, so habit signals never fire for anonymous sessions. **This is intended** — habits are an authenticated feature. Do not "fix" it.

Nothing else is added. Journal, chat, assessments, mood notes, and raw Health samples remain out of `AdvisorContext` entirely — that exclusion is enforced by the type, not by convention.

### 2.3 Change signals — thresholds are mandatory

A signal that cannot state its numeric threshold does not ship. Each fires only when its coverage gate passes; a failed gate produces *no signal*, never a hedged one.

| id | Fires when | Coverage gate | Severity |
| --- | --- | --- | --- |
| `sleep-down` | `recentAverage` ≤ `baselineAverage − 45` min **and** ≤ 88% of baseline | `recentCoverageDays ≥ 4` and `baselineCoverageDays ≥ 7` | notable |
| `sleep-up` | `recentAverage` ≥ `baselineAverage + 45` min **and** ≥ 112% of baseline | same | minor |
| `steps-down` | `recentAverage` ≤ `baselineAverage − 1500` **and** ≤ 80% of baseline | same | minor |
| `steps-up` | `recentAverage` ≥ `baselineAverage + 1500` **and** ≥ 120% of baseline | same | minor |
| `habit-stalled:<habitId>` | `completedDays ≤ 2` of 7 | `habitAgeDays ≥ 7` | notable |
| `habit-strong:<habitId>` | `completedDays ≥ 5` of 7 | `habitAgeDays ≥ 7` | minor |
| `goal-due:<goalId>` | `dueAt` within 0–3 days ahead | goal has `dueAt` | notable |
| `goal-overdue:<goalId>` | `dueAt` in the past | goal has `dueAt` | notable |
| `feedback-shift` | ≥ 2 outcomes with `helpful === false` in the last 14 days sharing a **family** | ≥ 3 outcomes on record | minor |

**Habit-gate warning — verified against the code.** `habit_logs` rows are written only on user toggle (`mobile/app/habits.tsx:366`, `app/habits/page.tsx:269`, upsert on `habit_id,log_date`). **A missed day writes no row.** Therefore log-row count is a count of *interactions*, never of *tracked days*, and gating on it would make `habit-stalled` unsatisfiable for exactly the habits it is meant to catch. Age must come from `habits.created_at`. `completedDays` counts only rows with `completed = true`; absence of a row means not completed.

**`family` is defined, because "id prefix" is not self-evident against the real ids.** Candidate ids in `advisor-core.ts` are `low-goal:<goalId>`, `low-goal:<goalId>:alternate`, `low-grounding`, `due-goal:<goalId>`, `goal:<goalId>`, `habit:<habitId>`, `health-wellbeing`, `check-in`, `general-start`, `low-energy-grounding`, each with an optional `:alternate` suffix.

```
family(id) = id.split(':')[0]
```

So `low-goal`, `due-goal`, `goal`, `habit`, `health-wellbeing`, `general-start`. This deliberately collapses a base candidate with its `:alternate` twin — rejecting both wordings of the same idea is exactly the signal `feedback-shift` is meant to catch — and deliberately keeps `low-goal` distinct from `goal`, because a low-mood goal nudge and a neutral goal nudge are different offers.

Ranking when several fire: `goal-overdue` > `goal-due` > `habit-stalled` > `sleep-down` > `feedback-shift` > `habit-strong` > `sleep-up` > `steps-*`.

**At most one signal per stream.** At most one signal total is promoted to the Home change line, and only if `severity === 'notable'` **and** it passes the ledger in §6.

### 2.4 Observations

Build up to three, in this order, taking at most one per stream:

1. The top-ranked change signal's sentence, if any signal fired.
2. The state sentence for whichever stream the selected action came from (existing `observation` strings serve this role today).
3. One positive or steadying sentence, if a `*-up` / `habit-strong` signal fired or if the last outcome had `helpful === true`.

If fewer than three qualify, render fewer. **Never pad.** A single observation is a correct and common output. Zero observations is only valid in the safety and Low Energy cases (§5).

### 2.5 Copy templates — closed set

Change lines use only these shapes. No other sentence may be generated deterministically.

- `Your sleep is averaging about {X} less than usual this week.`
- `Your sleep has come back up this week.`
- `You're moving less than your usual week.`
- `You've been more active than your usual week.`
- `"{goal}" is due {in N days | today | and the date has passed}.`
- `"{habit}" has happened {N} of the last 7 days.`
- `The last few suggestions haven't landed, so this one is different.`

`{X}` renders as `40 minutes` / `1 hour`, rounded to the nearest 15 minutes. Never render a raw average or a percentage anywhere in the UI.

**Two existing strings must be rewritten, not grandfathered:**

- `lowMoodCandidates` currently renders `` `Your most recent check-in was ${MOOD_LABELS[emoji]} on ${localDate}.` `` — which produces *"Low on 2026-08-13"*. Replace `${localDate}` with a relative word: `today` / `yesterday` / `earlier this week`. Raw ISO dates never reach the UI, and (see §4) never reach a provider.
- `healthCandidates` renders `availableCategoryCount` (*"across 2 wellbeing areas"*). Rewrite to drop the count: *"Your recent Apple Health summary has enough to work with."* The coverage-count ban is a UI ban; the count stays available to the selection logic.

### 2.6 The one recommended action

Unchanged mechanism: `recommendationCandidates` → safety short-circuit → `preserveToday` → suppression → first unsuppressed. Two additions:

- A fired `goal-overdue` / `goal-due` signal raises the goal candidates above the low-mood candidates **only when mood is not low today**. Low mood keeps precedence, always.
- A fired `habit-stalled` signal rewrites the habit candidate to use `smallerAction` as the *primary* action (see §7).

---

## 3. Deterministic vs AI

**Selection is always deterministic. AI never chooses anything.**

AI's only job is to re-voice already-selected strings so Advisor doesn't read like a template after the third day. Concretely, `advisor-phrasing.ts` may take the selected `observations[]` and `action` and return alternate wordings of the *same content*.

AI must never:

- pick the action, the route, the observations, or which signals fire
- introduce a number, date, metric, or fact not present in the input strings
- add a second recommendation, a question, or a follow-up
- exceed the input's length by more than 20%

**Phrasing is per-sentence, one string in / one string out.** Each observation and the action are sent and validated independently, not as an array. This matters because §4 can exclude an unconfirmed Health observation from the payload — sending 2 of 3 must not break the response-to-observation mapping. Any string that fails validation falls back individually; the others still render their AI phrasing.

**Validation, applied to every AI response string before render.** Reject and fall back to the deterministic string if: any numeral appears that was not in the input; length > 1.2× input or > 120 chars; terminal-punctuation count differs from the input's; the output contains `?`; any banned-language term from §5 matches; `hasExplicitUrgentSafetyLanguage` matches. (Deliberately *not* "more than one imperative verb" — not reliably detectable without a parser.) Rejection is silent.

**Offline / provider failure / no consent / timeout (> 1200 ms):** render the deterministic strings. No banner, no spinner, no "AI unavailable" copy, no retry button. The deterministic text is the product; AI is invisible polish. This is why there is no degraded state to design.

**Caching:** one phrasing call per `(recommendationId, localDate)`, cached locally. `Try something else` does not trigger a new call for the same id.

**Where it runs — verified, not assumed.** The mobile app has no server output and no `mobile/app/api` directory. The Next.js API routes live at the **repo root**: `app/api/{chat,affirmations,ai-reports,…}`. Mobile reaches them over the network through `mobile/lib/api.ts`, which posts to `API_URL` (`process.env.EXPO_PUBLIC_API_URL`, default `https://mhtoolkit.vercel.app`) with the existing `fetchWithTimeout` wrapper.

Therefore: add `app/api/advisor-phrasing/route.ts` at the repo root, alongside `app/api/affirmations`. `mobile/lib/advisor-phrasing.ts` calls it through the same `mobile/lib/api.ts` helper — same auth headers, same timeout mechanism. Set the timeout to the §3 budget of 1200 ms rather than the default. No new provider surface, no new transport.

---

## 4. Privacy and consent boundary

**Nothing leaves the device unless AI phrasing is on, and AI phrasing requires the existing consent gate.**

- Advisor AI phrasing requires `ensureAiDataSharingConsent`. No consent → deterministic-only, permanently, silently.
- Any observation derived from Apple Health follows the existing per-request preview-and-confirm pattern (`apple-health-ai-consent.ts`, `apple-health-ai-preview.ts`). If the user has not confirmed for this request, the Health-derived observation is **rendered deterministically and excluded from the AI payload** — it is not dropped from the UI.

**Payload allowlist — closed list.** Only these may be sent:

- the selected observation strings (already sanitized, ≤ 80 chars each, already user-visible), minus any Health-derived one withheld per the rule above
- the selected `action` string
- the `stream` and `direction` of the change signal

**`smallerAction` is not sent.** It sits behind an extra tap, so re-voicing it buys nothing, and when `habit-stalled` fires §2.6 promotes it into `action` — where it gets phrased anyway. Excluding it keeps #17's key-set assertion exact. Three keys, no more.

**Explicitly excluded, restated:** journal entries, chat history, assessment scores, mood notes, mood emoji, **any date or timestamp in any form**, raw or windowed Apple Health values, goal/habit ids, due dates, owner key, user id, session id, device or locale identifiers.

**What does travel inside observation sentences — stated precisely, because §2.5's strings carry more than the allowlist's field names suggest:**

- The mood **label** (`Low`, `Okay`, `Good`) reaches the provider as ordinary words inside a sentence. The mood **emoji** and the **date** do not. This is only true once the `lowMoodCandidates` date fix in §2.5 lands; until it does, Advisor AI phrasing must stay off for low-mood contexts.
- Goal and habit **titles** reach the provider inside action strings. Same exposure the Together share flow already has, disclosed in `AI_DATA_SHARING_DISCLOSURE`.
- Sleep and step **deltas** reach the provider as rounded natural language (`about 45 minutes less`). Absolute values, averages, and coverage counts never do.

Acceptance test #17 asserts on the serialized body against this list — including that no `\d{4}-\d{2}-\d{2}` substring appears anywhere in it.

**Outcome ledger and observation ledger stay local and owner-scoped.** No server sync, no telemetry on which observations fired.

---

## 5. Safety and evidence language

**Safety precedence is absolute.** When `recommendationCandidates` returns `kind === 'safety'`:

- `observations` is `[]`
- `changeSignal` is `null`
- the Home change line is not rendered
- no AI call is made
- `Try something else`, `Try the smaller step`, and `Share with Together` remain hidden, as today

The same suppression applies in Low Energy mode: zero observations, no change line, no AI call. Low Energy is a "less, not more" mode, and this keeps it out of untested combinations.

### The cross-stream rule — flat prohibition

`AdvisorHealthFeatures.history.moodComparison` is currently the literal string *"Mood check-ins are not compared with Apple Health."* and `createAdvisorHealthFeatures` deliberately ignores its `_moods` argument. **That is a designed boundary and this iteration does not open it.**

Advisor may state a change *within one stream* over time. It may not state, imply, or arrange copy to suggest a relationship *between* streams — not causal, not correlational, and not by adjacency. Concretely, this is forbidden:

- "Your mood is lower on days you sleep less."
- "Low sleep may be affecting your mood."
- Rendering a sleep observation and a mood observation as the first two lines in a way that reads as cause and effect.

Enforcement: observations must include **at most one** of `{sleep, steps}` and **at most one** of `{mood}`, and when both are present the mood line is ordered first with no connective. `moodOverlapDays` stays 0. Co-occurrence phrasing is deferred, not "coming later" — it needs a separate decision with clinical review.

### Evidence language

Banned everywhere in Advisor copy: *should*, *need to*, *risk*, *symptom*, *diagnos\**, *treat\**, *clinically*, *research shows*, *studies show*, *proven*, *healthy range*, *normal*, *deficient*, *disorder*. Add these as a lint fixture over the candidate strings so they cannot be reintroduced.

No comparison to population norms. No target values. No "recommended 8 hours". Comparisons are only ever to the user's own baseline, and only in the templates in §2.5.

---

## 6. Staying on track without nagging

The mechanism is a **separate observation ledger**. Reusing `suppressedRecommendationIds` would be wrong: actions rotate daily, but a sleep dip persists for a week and would re-announce itself every session.

`mobile/lib/advisor-observation-ledger.ts`, AsyncStorage, owner-scoped, same shape and retention discipline as `advisor-outcome-storage.ts`:

```
{ signalId: string; state: 'firing' | 'clear'; lastEvaluatedDay: string;
  consecutiveClearDays: number; lastShownAt: string | null; shownCount: number }
```

Entries whose underlying goal or habit no longer exists are dropped on read, not left permanently `firing`.

**Evaluation unit is the local day, not the focus event.** `useFocusEffect` fires arbitrarily often; a rule counting "evaluations" would be satisfied by opening Home twice in ten seconds. The ledger records **at most one evaluation per `signalId` per `localDateKey`**; repeat focuses within the same local day re-read the ledger and change nothing. All rules below count distinct local days.

Rules:

0. **Absent ledger entry ≡ `clear`.** A first-ever evaluation, a new owner, or a cleared ledger all start from `clear`, so a signal that is already true on day one does fire. Any other reading makes signals unreachable for new users — this is the most likely divergence between two implementations, so it is rule zero.
1. **Edge-triggered, not level-triggered.** A signal is shown only on a `clear → firing` transition. Continued presence is silent.
2. **Cooldown 7 local days** per `signalId`, even across a genuine re-crossing.
3. A signal returns to `clear` only after **2 consecutive distinct local days** evaluated below threshold — prevents flapping at the boundary. One day below threshold is not enough.
4. **At most 2 distinct Home change lines in any rolling 7-local-day window**, regardless of how many signals fire.
5. `goal-overdue` is exempt from rule 4 but still bound by rules 1–3.
6. If the user answers `Not for me` on an action that carried a change line, that `signalId` is suppressed for 14 days.

### Notifications

The existing category controls own delivery; Advisor adds one category and no new scheduling mechanism.

- **Opt-in, off by default** (decision 2 below). Nothing is scheduled until the user enables the Advisor category.
- **At most one** Advisor nudge per local day.
- **Deterministic only, never AI-phrased.** The body is the change line verbatim — the same string §2.5 allows on Home. A push is the one place a user cannot re-read the context, so it gets the audited copy, not the re-voiced copy.
- Fires **only** on a `clear → firing` transition of a `notable` signal — i.e. the nudge and the Home change line have the same trigger. If §6 rules 1–5 suppress the change line, they suppress the nudge.
- **No nudge on a low-mood-today context**, and none in Low Energy mode, and none for a safety context.
- No streak-loss, catch-up, or "you haven't opened the app" framing. That language is already absent from the habit candidates and must stay absent.
- The nudge body **is the change line, verbatim** — including its number where §2.5's template has one (`about 45 minutes`, `2 of the last 7 days`). An earlier draft also banned numbers in nudges; that rule is deleted, because it was unsatisfiable against the two `notable` templates most likely to fire, and because the number *is* the observation. One audited string, reused, beats a second numberless template set that no §2.5 rule governs.
- What the nudge still never contains, because the change line never contains it either: a date, a mood emoji, a raw average, a percentage, or a coverage count. This follows from §2.5 rather than being a separate rule — if a change line would violate it, that is a §2.5 bug, not a notification bug.

---

## 7. Interaction and copy

**After the user starts an action.** Unchanged: route push, `markAdvisorStarted`. On next Home focus, the existing completion prompt appears. If `helpful === true`, the next day's observation may include the positive line *"That helped last time, so this one is similar."* — once, then never repeated for that family.

**After dismissal (`Try something else`).** The action changes; the observations **do not**. The user rejected the suggestion, not the reading. Do not re-run signal evaluation. If every candidate is exhausted, the existing fallthrough applies and Advisor says so plainly rather than looping: *"That's everything I have for today."*

**Low mood today.** Mood precedence is unchanged and unconditional. No change line renders on Home, even for `notable` signals. `/advisor` shows the mood observation only. No goal or habit pressure, no due-date language.

**Goal due dates.** `due` and `overdue` render as fact, never as failure. `"{goal}" is due today.` / `"{goal}" is past its date — you can move it or start small.` The overdue action always offers rescheduling as the smaller step.

**Stalled habits.** When `habit-stalled` fires, the *primary* action becomes the tiny step and `Try the smaller step` is hidden (there is nothing smaller). Copy: `"{habit}" has happened 1 of the last 7 days.` + action `Do the smallest version of "{habit}" once.` Never "you missed 6 days".

**Conflicting signals.** Resolution is by the §2.3 rank order, deterministically, with no hedging copy. Advisor never says "on one hand… on the other". If `habit-strong` and `sleep-down` both fire, the ranked signal is `sleep-down` and `habit-strong` may appear as observation #3 — that is the whole conflict-resolution story.

**Verbosity ceiling.** Home change line ≤ 90 chars. Each observation ≤ 120 chars, one sentence. Action ≤ 120 chars. `/advisor` never exceeds 3 observations. These are enforced in the contract tests, not by review.

---

## 8. Acceptance criteria

Written to match the existing idiom in `tests/mobile/advisor-core.test.ts`, `advisor-home-contract.test.ts`, `advisor-screen-contract.test.ts`.

**Core selection**
1. Any valid `AdvisorContext` yields exactly one action and between 0 and 3 observations; `observations[0] === observation` whenever observations is non-empty.
2. **Stability under context drift**, not purity (purity is free and tests nothing). Given a morning context that pins action A: (a) if the context changes midday but A's candidate still generates, `preserveToday` returns A; (b) if the underlying item is completed or deleted so A's candidate no longer generates, a *different* action is returned and this is not a failure. **Product call: the observation array is allowed to drift under a pinned action** — observations read current context, the action stays pinned. Assert that this is what happens rather than asserting they move together.
3. `selectAdvisorRecommendation` never throws for: malformed `nowIso`, empty goals/habits, `null` health, `null` mood, outcomes containing legacy string entries.

**Home contract**
4. Home renders exactly one primary action.
5. Home renders at most one change line, and none when severity is `minor`.
6. Home renders no change line for a safety context, a low-mood-today context, or Low Energy mode.

**Safety**
7. A context whose goal or habit text trips `isUnsafeActionText` yields `observations: []`, `changeSignal: null`, and makes no AI call.
8. No Advisor string in any fixture matches the banned-language lint fixture.
9. No fixture produces an observation containing both a Health term and a mood term in the same sentence.

**Signals and ledger**
10. Health coverage below gate (`recentCoverageDays < 4` or `baselineCoverageDays < 7`) yields no Health signal, even with a large delta.
10b. **The habit-gate test — the one that protects §2.3's verified warning.** A habit with `created_at` 30 days ago and only 2 `habit_logs` rows in total, both `completed = true`, fires `habit-stalled`. It must not be gated out as insufficient data. `habitAgeDays` comes from `habits.created_at`; the 7-day denominator is fixed at 7; absence of a row counts as not-completed. Deriving age or the denominator from log-row count makes this case unreachable — which is precisely the bug, since a stalled habit is *defined* by its missing rows. Assert on the fired signal, not on prose.
11. A signal firing on consecutive days produces a change line on day 1 only.
12. A signal that clears for one evaluation and re-fires does not re-show (needs 2 consecutive clear evaluations plus 7-day cooldown).
13. Three or more `notable` signals in a week produce at most 2 Home change lines, except `goal-overdue`.

**AI**
14. Provider failure, timeout, offline, and no-consent all render text byte-identical to the deterministic path.
15. An AI response containing a numeral absent from the input is rejected and the deterministic string renders.
16. Exactly one phrasing request per `(recommendationId, localDate)`; `Try something else` on the same id issues none.
17. The outbound payload contains no key outside the §4 allowlist, and the serialized body contains no `\d{4}-\d{2}-\d{2}` substring and no mood emoji codepoint.
18. Sending 2 of 3 observations (one Health observation withheld for lack of per-request confirmation) returns 2 phrased strings that map to the correct 2 slots; the withheld one renders deterministically in its original position.

**Together**
19. `shareWithTogether` passes exactly `{ title, source }`, and `title === recommendation.action`. Assert on the router params object, so adding a key fails the test.
20. Given a recommendation carrying a `changeSignal` and 3 observations, the Together params object is byte-identical to the same recommendation with `changeSignal: null` and `observations: [observations[0]]`.

**Notifications**
21. With the Advisor nudge category never enabled, no Advisor notification is scheduled under any signal combination.
22. With it enabled: at most one Advisor nudge per local day; none on a low-mood-today context; none for a `minor` signal; none for a signal that is `firing` but was not newly shown per §6 rule 1; and the nudge body is byte-identical to the deterministic change line.

### Risky edge cases to cover explicitly

- Owner switch mid-load (auth ⇄ anonymous): observation ledger must be re-read for the new owner; the existing `stateOwnerKey` guard must gate observations too, or a signed-out user briefly sees the previous account's change line.
- Timezone / DST boundary: `localDateKey` uses local components; a signal evaluated at 23:59 and again at 00:01 must not double-show.
- Health authorized but zero categories: `loadAuthorizedHealth` returns `null`; no signal, no crash, no "no data" copy.
- Goal with `dueAt` far in the past (imported/abandoned): `goal-overdue` fires forever without the 7-day cooldown — the cooldown must apply and the reschedule action must be reachable.
- Clock skew / `nowIso` before `offeredAt`: existing code guards with `age >= 0`; the ledger must do the same.
- Deleted goal or habit while its signal is `firing`: ledger entry must be dropped, not left permanently firing.
- User with no data at all: exactly one observation (the check-in prompt), no signals, no AI call.

---

## Rejected alternatives

| Rejected | Why |
| --- | --- |
| Settings wizard / per-signal toggles | The previous Advisor was removed for this. Thresholds are the product's judgment; exposing them makes the user the tuner. |
| Second Home card for "what changed" | Violates the one-action invariant. Two cards is a dashboard with extra steps. |
| Mood × Health correlation | Implicit clinical claim with no evidence base and no clinical review. Currently a deliberate refusal in code; keep it. |
| AI chooses the action | Makes offline behavior a degraded state, makes safety unverifiable, and makes the same context produce different advice on reload. |
| Trends / charts screen | Surveillance framing, and it answers a question the user didn't ask. |
| Streak and catch-up mechanics | Manufactures failure. Absent from the current habit copy; keep it absent. |
| Server-side outcome sync | No product need at this scope; adds a data-retention obligation for behavioral data. |

## Decisions made — do not reopen

These were the draft's open questions. They are resolved. Recorded with reasoning so the next reader does not re-litigate them.

1. **Goal/habit titles in the AI payload → disclosed exposure.** Titles ride inside the action string to the provider. Rejected: strip-and-reinject placeholders client-side. Reasoning: a title is the *noun the sentence is about*; re-voicing `Do one small round of "{TITLE}"` with the noun hidden is exactly the case where a model produces something that no longer fits when the title is put back. The exposure is already live and disclosed — `AI_DATA_SHARING_DISCLOSURE` covers it, chat sends far more, and Together shares the same string to another human. Titles are `sanitizeDisplayText`-capped at 80 chars. Acceptance #17 therefore asserts on the *key set* plus the date and emoji regexes, not on the absence of free text.

2. **Nudge default → opt-in.** Advisor's one-per-day nudge ships off. The user turns it on inside the existing notification categories. Reasoning: an unrequested push that says the app noticed something about your sleep is the single most likely way this feature reads as surveillance, and it would arrive before anyone has seen the change lines in-app and decided they are worth trusting. Opt-out is cheap to switch to later if adoption says so; the reverse is not. All other §6 rules bind regardless.

3. **Observation drift under a pinned action → allowed.** Observations read current context; the action stays pinned. Rejected: snapshotting observations alongside the pinned action. Reasoning: more state to own and it makes Advisor stale by evening — a sleep dip that recovered should stop being narrated even if the morning's action is still the right one. Acceptance #2 asserts the drift rather than forbidding it.

## Build order

1. §2.5 copy fixes (mood date, coverage count) + banned-language lint fixture. No behavior change, unblocks §4.
2. §2.2 context addition (`habitWeek`, with `habitAgeDays` from `habits.created_at`). `goalStaleness` is cut — do not build it.
3. §2.1 type extension + §2.3 signals + §2.4 observations, deterministic only. Ship here — this is already the product.
4. §6 observation ledger.
5. §3/§4 AI phrasing. Last, because everything works without it.
