# MHtoolkit — Motion & Screen Design Proposal

**Author:** Senior mobile product designer / motion director (review pass)
**Scope:** All 12 captured native iOS screens in `/tmp/mhtoolkit-opus-screens/`
**Status:** Proposal only — no app code changed.
**Codebase facts this proposal is built on (verified 2026-07-31):**

- Mobile app is Expo / React Native, expo-router (`mobile/app/**`).
- **No animation library is installed.** `node_modules` and `package-lock.json` contain **no** `react-native-reanimated`, `react-native-gesture-handler`, `expo-haptics`, or `react-native-worklets`. Only `expo-av` (audio) is present. There is **no `babel.config.js`**.
- Motion exists in exactly **one** file, `mobile/app/voice.tsx`: an `Animated.loop` scaling the mic `1 → 1.3 → 1` at 800ms/leg, `useNativeDriver: true`, **with no Reduce-Motion guard.**
- There is a shared design system, `mobile/components/AppUI.tsx`, exporting `AppScreen`, `PageHeader` (eyebrow + title + description + circular icon — the hero repeated on every sub-screen), and `AppCard` (has a `quiet` variant). Color tokens live in `mobile/lib/constants` (`Colors.primary` = dark green).

**Consequence:** almost the entire motion system below is achievable with **built-in RN `Animated` + `LayoutAnimation` + `AccessibilityInfo` (zero new dependencies)**. Reanimated is a deliberate, native-rebuild-gated addition reserved for a handful of physics/gesture surfaces. That distinction is called out per item.

---

## 1) Blunt audit of all 12 screens

### The two axes that matter for this app
Every motion and restraint decision runs on **two orthogonal axes** — do not collapse them:

- **Axis A — OS Reduce Motion** (`AccessibilityInfo.isReduceMotionEnabled()`): a global per-user fallback.
- **Axis B — Surface motion policy** (`full | reduced | none`): hard-coded per screen, applies to *everyone*. Grounding, crisis/support, an in-progress assessment, low-mood/affirmation, and the meditation player are **always restrained** regardless of the OS setting.

Effective policy = the more restrained of the two.

### Per-screen findings

**`01-dashboard.jpeg` — Dashboard.** *Strong.* The "7-DAY PRIVATE CHECK-IN — 2 of 7" card with "A missed day does not reset your progress" is exactly the non-punitive framing this app needs; the segmented bar reads as progress, not a streak at risk. Affirmation card is calm. *Problems:* the week strip (Sat–Fri) is scroll-clipped at the very top edge — looks broken, not intentional; it needs a settled resting position. Quick Actions is a 6-tile grid with no visual priority — "Ground me" (a calm/safety action) sits with the same weight as "Focus." Nothing on this screen has any entrance or state motion, so the numbers ("2 of 7") just appear with no acknowledgment of the check-in the user presumably just made.

**`02-mood.jpeg` — Mood Tracker.** *Strong.* "Your emotional journey over time," clean history list, tag chip model is clear. *Problems:* ~40% of the screen below the history list is dead cream space — the screen looks unfinished on a 3-entry account. The "+ Add" is the primary job of the screen but is a small top-right button; the add→save→appears-in-history loop (the core loop) has no transition, so a new entry just pops into the list with no continuity. Filter has a single real tag (`native-final-qa`, obviously QA data).

**`03-ai-chat.jpeg` — AI Chat.** *Strong.* The "Context for this chat" disclosure with a lock icon and an itemized list of exactly what the model can see ("3 mood check-ins · 1 mood note · 2 assessments…") is a genuinely excellent, trust-building privacy pattern — and the pink "AI can make mistakes. You choose what context it receives" line is honest. *Problems:* that context string is a dense middot-run that's hard to parse; the disclosure is a collapsible whose expand/collapse will jump without animation (and **cannot** use the native driver — it's a height change). The pink banner is not obviously dismissible and will re-assert on every visit. The empty state is good but the four prompt chips + input + 3 top pills (Voice/Ground me/Support) is a lot of chrome around an empty canvas.

**`04-assess.jpeg` — Assess.** *Strong.* Best clinical hedging in the app: "Check a pattern, not a label," "they cannot diagnose you," "Results can support a conversation with a qualified professional." The dark-green hero and the "VALIDATED SYMPTOM SCREENER / Past 2 weeks / 7 scored + 1 impact" metadata read as serious and sourced. "View published source" is a real differentiator. *Problems:* this is a **restrained surface** — it must never receive celebratory or gamified motion (no progress-bar fanfare between questions, no score reveal flourish). Nothing signals that today. The subtle per-card tint (blue on Anxiety, green on the peeking "D") is nice but undocumented as a system.

**`05-more.jpeg` — More (tool directory).** *Strong.* "Everything in one place," grouped into "Plan and progress" / "Calm and reflect" — the grouping is meaningful and the row+chevron pattern is scannable. *Problems:* it's a static list; tapping a row jumps to a stack screen with the OS default push and no continuity of the icon/label the user just tapped. Long screen, no sense of where sections begin on scroll.

**`06-habits.jpeg` — Habit Tracker.** *Strong.* "Build momentum without all-or-nothing rules… streaks that help you learn rather than judge yourself" is on-message. The "Partner check-ins" toggle microcopy — *"Share scheduled/completed counts, never the habit name"* — is the aggregate-only privacy contract stated inline. Excellent. *Problems (the app's central tension lives here):* the screen ships **XP (13 Total XP), Momentum level, and day-streak** simultaneously. These are exactly the mechanics that, if animated with count-ups / level-up bursts / streak-loss shakes, would violate the no-pressure/no-shame constraints. The stats card change (1/5 → 2/5) has no calm acknowledgment path designed. The hero headline wraps to **four lines** ("Build / momentum / without all-or- / nothing rules.") and pushes the actual tracker far down.

**`07-grounding.jpeg` — Grounding.** *Strong, and the most safety-critical screen.* "Stay with this moment," "Choose the closest match. You can stop, switch, or contact someone at any time," and especially **"No explanation is required"** are model trauma-informed copy. The state list (Panic / Detached / Flashback / Overwhelmed / Spiraling) with plain-language body text is exactly right. *Problems:* this is a **`none`/`reduced` surface** — it must have zero decorative motion, zero countdown urgency, zero haptics on selection. Any "premium" flourish here is a defect. The list rows are visually heavy (icon + 3 lines each) so five barely fit; a person in acute distress has to scroll. Selecting a state must transition *calmly and instantly-legible*, never with a spring or slide that implies momentum.

**`08-library.jpeg` — Library.** *Strong.* "Ideas, talks, and real stories," "107 reviewed items," source tags (TEDx). Curated and honest. *Problems:* **filter overload** — a search field, then a row of type chips (All / Books / Talks / Stories / Saved), then "Up next," then a *second* "All" plus seven topic chips. Two "All" chips in two rows is genuinely confusing. This is the "clutter" the brief warns about. Filtering the list has no transition, so results will hard-swap.

**`09-accountability.jpeg` — Accountability (logged-out gate).** *Weakest screen.* Above the fold: a good hero ("Create an account to connect," "A permanent account keeps partner controls tied to you across devices") and Create/Sign-in buttons. Below: **~55% of the screen is empty cream** with a floating capture-cursor artifact. There is no explanation of *what accountability does*, *what a partner can and cannot see*, or *why the privacy model is safe* — precisely the reassurance a hesitant user needs before creating an account. The privacy contract ("aggregate-only, never your journal/mood/goals") is the reason to trust this feature and it is absent from the one screen selling it.

**`10-focus.jpeg` — Focus Mode.** *Strong.* "One outcome. One block," "By the bell, I will…," Focus/Break/Cycles steppers with sane ranges, 15/3 · 25/5 · 50/10 quick setups, "Optional focus sound (Quiet / Low noise)." Clear and calm. *Problems:* the **"Begin focus block" button is rendered in low-contrast sage and reads as disabled** even though a preset (25/5) is selected — state ambiguity; a user can't tell if it's tappable or blocked on the outcome field. Focus is a **productivity** surface, so a bounded countdown timer *is* allowed here (unlike grounding) — but that distinction isn't yet designed, and if the timer is later styled with red-as-time-runs-out it would import the "countdown urgency" this app bans elsewhere.

**`11-journal.jpeg` — Private Journal.** *Strong.* "Think on paper," "Write without perfecting it," "Private by default. You choose when AI uses your journal," a 0/12,000 counter, gentle prompt placeholder. The privacy stance is explicit and correct. *Problems:* the green privacy banner + dark hero + "+ New entry" + the immediately-open entry card is a lot stacked vertically before the writing surface; the textarea (the actual job) is below the fold. Opening/closing "New entry" (the X) will jump without a calm expand/collapse. Banner not obviously dismissible.

**`12-meditation.jpeg` — Meditation.** *Strong.* "A practice for this moment," **"Eyes-open and movement options are included"** and an explicit "Eyes-open / trauma-sensitive" filter chip is genuinely thoughtful and rare. Durations shown (3 min, 4 min) in terracotta. "Name and unhook" copy is ACT-flavored and careful. *Problems:* **restrained surface** — the *player* (not shown) must pace with breath, never count *down* with urgency, never use a shrinking/red ring. The filter row is long (9 chips wrapping to 3 rows) and, like Library, hard-swaps the list on selection.

### Repeated problems (systemic — fix once, benefit everywhere)
1. **The hero (`PageHeader`) eats 30–40% above the fold on every sub-screen** and sometimes wraps to 4 lines (`06`, and hero-heavy `04`,`11`). It's **one component** — one collapse-on-scroll fix propagates to all.
2. **No entrance, state, or continuity motion anywhere** except the one over-aggressive `voice.tsx` pulse. Every screen hard-cuts.
3. **Collapsibles/accordions/filters hard-jump** (`03` context, `08`/`12` filters, `11` new-entry) — all height changes, so all need `LayoutAnimation` or Reanimated (**not** native-driven `Animated`).
4. **List mutations pop in** (`02` mood history, `06` habits) with no insert transition — breaks the core add→save→see loop.
5. **Dead space / thin empty states** (`02`, `09` badly) make screens feel unfinished.
6. **Gamification (XP / streak / momentum) ships without a safe motion policy** — the single largest risk of drifting into pressure/shame.
7. **Safety/privacy banners aren't dismissible** and re-assert every visit (`03`, `11`).
8. Capture-cursor triangles are QA artifacts — make sure they never reach App Store screenshots.

### Repeated strengths (protect these — motion must not undermine them)
- Consistently non-punitive, trauma-informed, agency-preserving copy (`01` "does not reset," `06` "learn rather than judge," `07` "No explanation is required," `10` "the break you planned").
- Best-in-class privacy signaling: the AI context disclosure (`03`), the aggregate-only habit toggle (`06`), journal "private by default" (`11`).
- Honest clinical hedging with published sources (`04`) and trauma-sensitive practice options (`12`).
- Restrained earthy palette (dark-green / cream / sage / terracotta), no noisy gradients, no generic-AI aesthetic. **Motion's job is to stay inside this discipline, not decorate over it.**

---

## 2) Motion tokens (exact)

Proposed home: a new `mobile/lib/motion.ts` (constants + `useMotion()` resolver) and small wrappers in `mobile/components/AppUI.tsx`. Values below are the contract.

### 2.1 Durations
| Token | ms | Use |
|---|---|---|
| `instant` | 0 | Restrained-surface commits; reduced-motion state changes |
| `micro` | 120 | Press-in feedback, toggle flip |
| `fast` | 180 | Chip/segment select, small state swap |
| `base` | 240 | Card first-paint, tab-content cross-fade, list insert |
| `slow` | 320 | Sheet/modal present, hero settle |
| `exit` | 160 | Any dismissal (always faster than its enter) |
| `ambient` | 4200 (in) / 6000 (out) per cycle | Breath pacing **only** (grounding/meditation), opt-in, pacing not decoration |

Rationale: enters at 240/320 read as "settling," not "snapping" — calmer than Material's 200/250 defaults without feeling sluggish. Exits are always shorter than enters so the UI never feels sticky.

### 2.2 Easing
| Token | RN `Animated` | Reanimated | Use |
|---|---|---|---|
| `enter` (decelerate) | `Easing.bezier(0.16, 1, 0.3, 1)` | `Easing.bezier(0.16, 1, 0.3, 1)` | Everything entering/settling |
| `exit` (accelerate) | `Easing.bezier(0.4, 0, 1, 1)` | same | Dismissals |
| `standard` | `Easing.bezier(0.4, 0, 0.2, 1)` | same | In-place state change |
| `breath` (organic, symmetric) | `Easing.inOut(Easing.sin)` | `Easing.inOut(Easing.sin)` | Breath pacer, skeleton "breathe" |

No linear easing on anything a human watches. No `Easing.bounce` / `Easing.elastic` anywhere in the app.

### 2.3 Springs — **Reanimated only**, and only critically-damped
RN `Animated.spring` may be used for press micro-feedback; all "surface" springs are Reanimated `withSpring`. **Damping ratio ≥ 1 everywhere — zero overshoot, zero bounce.**
| Token | stiffness | damping | mass | Use |
|---|---|---|---|---|
| `gentle` | 120 | 20 | 1 | Sheets, large surfaces settling (~380ms visual) |
| `press` | 300 | 26 | 1 | Button/tile press release |

Hard rule: **no `withSpring` with damping < 15 ships.** If it overshoots, it's wrong for this app.

### 2.4 Transform / distance / scale / opacity
- **Rise on enter:** `translateY 10 → 0` (range 8–12; **never > 16** — larger reads as "flying in").
- **Sheet present:** `translateY 28 → 0` (or full bottom-sheet for true modals).
- **Press scale:** `1 → 0.97` in, back to `1` out. Never scale **above** 1.0 on tap on any calm surface. (This also replaces the `voice.tsx` `1.3×` loop — see §3.)
- **No horizontal content slide** (reads as a carousel). Horizontal slide is reserved for OS navigation push only.
- **Opacity enter:** `0 → 1` over `base`.
- **Skeleton loading:** opacity **breathe** `0.45 ⇄ 0.85`, `breath` easing, ~900ms/leg — **not** a diagonal shimmer sweep (that's the generic look the brief bans).
- **Disabled state:** `opacity 0.45` **plus** a reason (never opacity alone — see Focus fix).

### 2.5 Haptics (Tier 2 — requires `expo-haptics`)
Gated behind a **Settings → Haptics** toggle (default on) and the rules below. Haptics are independent of Reduce Motion but must honor the app's own toggle.
| Event | Haptic | Notes |
|---|---|---|
| Chip / segment / toggle select | `selectionAsync()` | The only high-frequency one |
| Mood saved · journal saved · focus block *completed* | `notificationAsync(Success)` | One quiet tap, not a pattern |
| Pull-to-refresh threshold, "Add" confirm | `impactAsync(Light)` | — |

**Forbidden haptics (hard):** none on grounding/support state selection; none on crisis actions; none tied to XP/streak/level changes; none on individual assessment answers (at most one `Light` "saved" on final submit, never `Success` fanfare); no haptic loops; never as urgency. When in doubt on a restrained surface: **no haptic.**

### 2.6 Reduced-motion & restrained-surface variants (per token)
Resolution: `effective = min(surfacePolicy, osReduceMotion ? 'reduced' : 'full')`.
| Full | `reduced` (OS Reduce Motion, or `policy:'reduced'`) | `none` (grounding/crisis/active-assessment) |
|---|---|---|
| fade + `translateY 10→0` | **opacity-only** fade, same duration | **instant** (set final state) |
| press scale `0.97` | opacity dip `1→0.9` | none (color/elevation state only) |
| spring settle | `withTiming(base, standard)` | instant |
| loop (voice pulse, breath pacer) | **static** state + **text** indicator ("Listening…" / breath steps as text) | static + text |
| skeleton breathe | static skeleton, no loop | static skeleton |
| `LayoutAnimation` height | `LayoutAnimation.Presets.easeInEaseOut` shortened, or none | instant set |

**Non-negotiable:** nothing conveys state through motion alone. Every animated state has a static tell (label, color, filled/empty, count). Reduce Motion must never hide information.

### 2.7 Restrained-screen registry (bake into the primitive)
`AppUI` primitives read a `motionPolicy` prop so restraint is enforced at the injection point, not per-screen goodwill:
- `none` → **Grounding** (`ground.tsx`), **Support/Crisis** (`support.tsx`), **active assessment run** (`assessments/**`).
- `reduced` → **Meditation player** (`GuidedPractice.tsx`), **Affirmations** (`affirmations.tsx`), **low-mood entry paths**, the **Assess** hub (`(tabs)/assessments.tsx`).
- `full` → everything else (Dashboard, Mood, Chat shell, More, Habits, Library, Focus planner, Journal shell, Accountability, first-run).

---

## 3) Existing-screen animation backlog (prioritized)

Format: **Trigger → Behavior → Purpose → Tier → Fallback**. Tier 1 = built-in RN `Animated`/`LayoutAnimation`/`AccessibilityInfo` (zero deps). Tier 2 = adds `expo-haptics`. Tier 3 = adds `react-native-reanimated` (+ gesture-handler, `babel.config.js`, native rebuild).

### P0 — foundational + high-value, low-risk (Sprint 1)
1. **Motion infrastructure.** *App start →* build `useReducedMotion()` (via `AccessibilityInfo.isReduceMotionEnabled()` + `reduceMotionChanged` listener) and `useMotion(surfacePolicy)` returning resolved tokens. *Purpose:* one source of truth; makes every later item honor both axes. **Tier 1.** *Fallback:* if the API throws, default to `reduced`.
2. **Fix `voice.tsx` pulse (defect).** *Listening →* replace the `1→1.3` 800ms loop with an opacity/`1→1.06` breathe **gated by `useMotion`**; on `reduced`/`none` show a static dot + "Listening…" text. *Purpose:* removes a 30% scale loop that currently ignores Reduce Motion. **Tier 1.** *Fallback:* static text.
3. **`AppCard` first-paint entrance.** *Card mounts on a `full` surface →* fade `0→1` + `translateY 10→0`, `base`/`enter`, **first paint only**, 20–40ms stagger cap of 3 items, and **suppressed on `reduced`/`none`**. *Purpose:* calm arrival without the "everything fades in" generic look — gated, subtle, once. **Tier 1** (`useNativeDriver: true`). *Fallback:* opacity-only, then instant.
4. **`PressableScale` primitive.** *Press-in/out →* scale `1→0.97` (`micro`). *Purpose:* tactile feedback on every tile/button/row from one wrapper. **Tier 1.** *Fallback:* opacity dip; `none` → color state only.
5. **Hero collapse-on-scroll (`PageHeader`).** *Scroll down →* description fades, title shrinks to a compact bar; *scroll to top →* restores. *Purpose:* reclaims the 30–40% every sub-screen loses; **one component fixes all of `04`–`12`.** **Tier 1** — drive it native-driver by animating **opacity + `translateY` inside a fixed-max-height container** (with matching scroll content-inset) so the animated part never touches layout; the actual **height/reflow** step is a layout change, so it runs through `LayoutAnimation` (per rule §2.6 and item 6), **not** the native driver. *Fallback:* static compact header at all times under Reduce Motion.
6. **Accordion / disclosure height.** *Toggle "Context for this chat" (`03`), "New entry" (`11`) →* `LayoutAnimation.configureNext` on `base`/`standard`. *Purpose:* height changes **cannot** use the native driver; `LayoutAnimation` is the correct Tier-1 tool. **Tier 1.** *Fallback:* instant show/hide (Reduce Motion).
7. **List insert continuity.** *Mood saved (`02`), habit added (`06`) →* `LayoutAnimation.easeInEaseOut` as the new row takes its place. *Purpose:* the add→save→see loop feels continuous. **Tier 1.** *Fallback:* instant.
8. **Tab-content cross-fade.** *Switch tab in `(tabs)` →* incoming content opacity `0→1` (`fast`). *Purpose:* softens the 5-tab hard-cut. **Tier 1.** *Fallback:* instant.
9. **Dismissible safety/privacy banners.** *Tap dismiss on `03` pink / `11` green →* `LayoutAnimation` collapse, persist dismissal. *Purpose:* honors "concise and dismissible at 456px"; stops re-asserting. **Tier 1.** *Fallback:* instant collapse.
10. **Commit haptics.** *Mood/journal saved, focus block complete →* one `Success`; *chips/toggles →* `selectionAsync`. *Purpose:* quiet acknowledgment on allowed surfaces only. **Tier 2.** *Fallback:* none (feature-flag off if `expo-haptics` absent).

### P1 — per-screen refinement (Sprint 1 tail → Sprint 2)
11. **7-day check-in fill (`01`).** *Returning after a check-in →* the newest segment fills with a `base` width/opacity tween (no bounce, no confetti). *Purpose:* acknowledges the check-in without gamifying it. **Tier 1.** *Fallback:* pre-filled static.
12. **Week strip resting position (`01`).** *Mount →* strip settles to a defined offset instead of clipping mid-scroll. **Tier 1.** *Fallback:* static.
13. **Filtered-list swap (`08` Library, `12` Meditation).** *Chip select →* outgoing list opacity `1→0` (`exit`) then incoming `0→1` (`fast`); heights via `LayoutAnimation`. *Purpose:* stops the hard result-swap; also nudges deduping the two-"All"-rows clutter. **Tier 1.** *Fallback:* instant.
14. **Focus "Begin" state clarity (`10`).** *Outcome empty →* button is *explicitly* disabled (opacity 0.45 **+** helper text "Add an outcome to begin"); *valid →* fades to full-contrast primary (`fast`). *Purpose:* kills the "is this disabled?" ambiguity. **Tier 1.** *Fallback:* static enabled/disabled with the helper text.
15. **Habit stat change (`06`), safely.** *Mark tiny step done →* the "x/5 today" number cross-fades to the new value; the momentum bar eases to new width (`base`). **No count-up spin, no XP burst, no streak flourish.** *Purpose:* progress you can see, pressure you can't feel. **Tier 1.** *Fallback:* instant number swap.
16. **Assessment question advance (`04`, restrained).** *Answer selected →* **instant** advance or a plain opacity cross-fade of the question block; **no progress-bar fanfare, no score reveal animation.** *Purpose:* keeps a clinical surface clinical. **Tier 1, `none` policy.** *Fallback:* instant (already the default here).

### P2 — delighters, Tier-3-justified (Sprint 2)
17. **Breath pacer (`07` grounding exercises, `12` meditation player).** *Practice runs →* a slow expand/contract ring paced to inhale/hold/exhale, `ambient`, `breath` easing, **no numbers counting down, no color-shift-to-red, stop always one tap away.** *Purpose:* the one place organic motion *is* the therapy. **Tier 3** (Reanimated for frame-accurate pacing) **— but `reduced`/`none` shows breath **as text steps**, no ring.** *Fallback:* text-only pacing, fully functional.
18. **Gesture-dismiss sheets.** *Swipe-down on a bottom sheet →* `gentle` spring dismiss. *Purpose:* native-feel modals. **Tier 3** (gesture-handler + Reanimated). *Fallback:* Tier-1 button-dismiss + `LayoutAnimation`.
19. **`More` → detail continuity (`05`).** *Tap a row →* shared icon/label settles into the destination hero. *Purpose:* spatial continuity. **Tier 3** (shared element). *Fallback:* OS default push (Tier 1) — perfectly acceptable; only build if Reanimated lands for §17.

---

## 4) Six new screens / flows

Each includes the required trio (weekly review, accountability celebration/request, first-run) plus three high-value additions. Motion for all restrained flows defaults to `reduced`/`none`.

### 4.1 First-run personalization — *(required)*
- **User problem:** a wellbeing app that opens on a generic dashboard feels like a form. New users need to feel *met* and to set the emotional/privacy tone before any data is asked for.
- **Hierarchy:** (1) one-line promise + stacked-stone logo settling into place; (2) "What brings you here right now?" — 4–6 low-pressure chips (Anxiety · Low mood · Focus · Sleep · Habits · Just looking); (3) "How much do you want to share with the AI?" — a plain 3-option privacy default (Nothing / Aggregates only / Ask each time) mapping directly to the `03` context model; (4) "Skip — I'll explore myself."
- **Actions:** pick 0–N focus areas (reorders Quick Actions + Meditation/Library filters); set AI-context default; optional name; **no account required** to start.
- **Empty/loading/error:** no data yet by definition; if focus areas fail to persist, proceed anyway and re-ask later (never block entry). Skippable at every step.
- **Privacy:** the AI-context default set here is the *same* control surfaced in `03`; state "You can change this anytime in Settings → Privacy." Nothing is uploaded during onboarding.
- **Motion:** `full`. Stacked-stone logo pieces settle once with `gentle` (Tier 3) or a Tier-1 staggered fade+rise fallback — **calm, one-time, no bounce.** Chip selection = `selectionAsync` + scale `0.97`. Step transitions = opacity cross-fade (`base`), **no horizontal wizard slide.** Reduce Motion → instant steps, logo static.

### 4.2 Weekly Reflection / Review — *(required; low-mood-adjacent → handled as restrained)*
- **User problem:** people want to notice patterns without being graded. A week "in review" is where wellbeing apps quietly become report cards.
- **Hierarchy:** (1) "Your week, described" — plain-language, **descriptive not evaluative** ("You checked in on 4 days. You grounded twice. You wrote 3 journal entries."); (2) one gentle, optional pattern observation framed as a question ("Mornings had more check-ins than evenings — worth noticing?") — never a verdict; (3) a single forward action ("Pick one small thing for next week") that flows into the existing planner/goals; (4) "Not this week" dismissal.
- **Actions:** expand any line to its source screen; accept/skip the one suggestion; export nothing by default.
- **Critical constraint resolution:** **no scores, no grades, no "you only…" framing.** And the **motion is identical whether the week "went well" or not** — there is no performance-contingent flourish. That invariance is the tell that separates this from a streak-loss reskin.
- **Empty/loading/error:** thin week → "A quiet week is a fine week. Here's one gentle idea." (never "you missed…"); load = skeleton breathe; error = show whatever computed locally, omit the rest silently.
- **Privacy:** computed **on-device from local aggregates**; nothing about content leaves. If accountability is on, this screen still shows *only your own* detail — a partner never sees it.
- **Motion:** `reduced`. Lines reveal with a short opacity cross-fade only (no rise, no stagger drama). No haptics. Reduce Motion → instant.

### 4.3 Accountability — request → the mutual moment — *(required "celebration/request")*
- **User problem:** partner accountability is powerful and scary; the fear is exposure. The flow must sell *safety* first, then make honoring each other feel good without leaking anything.
- **Hierarchy (request):** (1) fills the `09` dead space — "What a partner can see" as an explicit two-column **Can see: your scheduled/completed *counts* · Cannot see: habit names, journal, mood, AI chats, assessment scores, goal text**; (2) "Invite a partner" (share link) / "Enter a code"; (3) pending state with a calm "Waiting for X to accept — you can cancel anytime."
- **Hierarchy (the mutual moment / "celebration"):** a periodic, **aggregate, mutual** acknowledgment — *"You both showed up 5 of 7 days this week."* Never a habit name, never a per-item count tied to content, never a leaderboard.
- **Actions:** invite, accept, revoke (revoke is one tap, always visible), toggle per-habit sharing (the `06` toggle), mute the mutual moment.
- **Empty/loading/error:** no partner → the explainer above (not blank cream); pending → non-anxious waiting copy; invite fails → "Couldn't create the link — try again," partner data never half-shown; a revoked partner disappears cleanly with `LayoutAnimation`.
- **Privacy (the whole point):** **database-enforced, aggregate-only, user-toggled.** The celebration text is generated from counts only. Explicit line: *"This only ever shows totals you both agreed to share."*
- **Constraint resolution:** accountability is **not** on the forbidden-motion list, so a **calm** celebration is allowed — but it celebrates **mutual showing-up in aggregate**, styled like the app (sage panel, stones motif), **not** confetti/particles. A celebration that names a habit would be a *privacy* violation, not just a tone miss — so the copy is aggregate by construction.
- **Motion:** `full` but restrained. Mutual moment = a single soft fade-up of one sentence + one gentle stones settle (Tier 1 fade, or Tier 3 `gentle`), **once, no loop, no burst, no sound.** Reduce Motion → the sentence, static.

### 4.4 "Right now" — rapid support / crisis access — *(high-value addition)*
- **User problem:** in acute distress, people can't navigate menus. The safety valve already implied by `07` ("contact someone at any time") deserves a dedicated, always-one-tap surface.
- **Hierarchy:** (1) the two or three things that help *fastest* (a grounding start, a breathing start, "Talk to someone" with user-configured/region hotline); (2) nothing else — no stats, no upsell, no branding weight.
- **Actions:** start grounding, start breathing, reveal support contacts, close. Reachable from a persistent affordance (e.g., long-press the tab bar or a header button on calm screens).
- **Empty/loading/error:** must work **offline** for grounding/breathing (bundled, no network); contacts that need network degrade to cached numbers; never a spinner blocking the calming action.
- **Privacy:** opening it logs **nothing** by default; no "crisis event" is shared with a partner or the AI.
- **Motion:** **`none`.** Instant presentation, no slide, no spring, no haptics, no countdown. Exit is instant. This is the strictest surface in the app — motion here is a bug.

### 4.5 Gentle re-entry after a gap — *(high-value addition; directly counters streak-loss shame)*
- **User problem:** the highest-churn moment is returning after days away. Most apps greet you with what you *lost*. This app promises the opposite ("A missed day does not reset your progress") — that promise needs a screen.
- **Hierarchy:** (1) "Welcome back. Nothing was lost." (2) one small, frictionless re-entry (a single mood check-in or a 3-minute practice); (3) *optional* "Want to see what's new / adjust anything?" — never a guilt recap.
- **Actions:** one-tap check-in; start a short practice; dismiss to dashboard.
- **Empty/loading/error:** this **is** the empty/return state; if history exists, summarize it warmly and factually; on error, still show the welcome and the single action.
- **Privacy:** on-device gap detection; nothing shared.
- **Motion:** `reduced`. One calm fade-up of the welcome line, then the action. **No streak numbers, no "days missed," no re-engagement animation.** Reduce Motion → static.

### 4.6 Privacy & data control center — *(high-value addition; consolidates the app's best pattern)*
- **User problem:** trust cues (lock icons, "private by default," aggregate-only) are scattered across `03`/`06`/`09`/`11`. A skeptical user has no single place to see and control it all — the exact reassurance that converts hesitant wellbeing users.
- **Hierarchy:** (1) "What the AI can see" (the `03` model, editable, with the Nothing/Aggregates/Ask default); (2) "What your partner can see" (mirrors 4.3's two-column contract + per-habit toggles); (3) "Your data" — export, and **delete** (per-domain and all); (4) "On this device only" statement of what never leaves.
- **Actions:** change AI-context default; toggle partner sharing; export; delete (with a calm, reversible-where-possible confirm — no dark-pattern friction, no scare copy).
- **Empty/loading/error:** delete shows a plain confirm and a clear success ("Removed."); export failure keeps data intact and says so; nothing here ever silently fails.
- **Privacy:** this screen **is** the privacy surface; it must be scrupulously honest — only claim guarantees the DB actually enforces (aggregate-only is DB-enforced; say exactly that).
- **Motion:** `reduced`. Toggles = `selectionAsync` + instant state; destructive confirm = **no** dramatic motion (deletion is not a celebration or a punishment). Reduce Motion → identical.

---

## 5) Five ideas to reject

Deliberately spanning the four failure lenses the brief names — **anxiety / privacy / weak clinical signaling / clutter** — with anxiety weighted twice because it's this app's largest drift risk. Each is tempting *because this app already ships the underlying mechanic*; that's exactly why to name and kill it.

1. **[Anxiety/shame] Streak-loss / "you broke your streak" animation.** Habits ships a day-streak (`06`). A shatter/reset/shake on a missed day is the precise shame/pressure the constraints forbid and **directly contradicts the app's own promise** ("A missed day does not reset your progress," `01`). **Reject outright** — there must be no streak-loss state at all.
2. **[Anxiety/pressure] XP level-up burst / count-up spinner.** The app ships "13 Total XP" and "Momentum level" (`06`). Animating them (numbers spinning up, a level-up flash, confetti on habit-complete) converts *learning* into *performance* and makes low-XP days feel like failure — the opposite of "learn rather than judge yourself." **Reject.** Numbers change with a plain cross-fade or not at all; acknowledgment is one quiet `Success` haptic on allowed surfaces.
3. **[Weak clinical signaling] An animated score gauge/speedometer on assessment results — or a mascot/avatar "guiding" the screener.** A needle that swings to your PHQ/GAD-style score, or a cartoon coach walking you through questions, makes a **validated, published** instrument read as a *quiz or game*. It actively undermines the clinical credibility screens `04` and `12` work hard to establish ("Check a pattern, not a label," "they cannot diagnose you"), and confetti on submit lands on a forbidden restrained surface. **Reject.** Results appear plainly, no reveal flourish, `none` motion policy; the score is a number with published context, never a dial or a character.
4. **[Privacy] Real-time partner activity feed / live presence ("Sam is journaling now").** Violates the aggregate-only, DB-enforced model and the ban on exposing content or timing; even "active now" leaks more than the contract allows, and it imports surveillance anxiety into a trust feature. **Reject.** Accountability stays periodic + aggregate + mutual (4.3).
5. **[Clutter] A persistent animated coach-mark tour / tip carousel, or an ungated "fade every card in on every screen" pass.** Library (`08`) already carries search + two chip rows (two "All"s); layering an animated onboarding overlay or a third moving filter strip compounds the exact clutter the brief warns against, and a blanket per-card fade on every visit is the generic-AI look. **Reject.** First-run teaching lives in the dedicated flow (4.1); card entrances are **first-paint-only and gated** (§3, item 3), never a recurring global animation.

*(Honorable-mention rejects, same lenses: a pulsing/gradient "AI is thinking" orb — generic-AI look the brief bans, and the app already over-pulses at `voice.tsx` 1.3×; use a three-dot fade or plain "Thinking…". Full-screen parallax page transitions and an auto-playing animated-gradient background — clutter/generic. A countdown ring that reddens as focus/meditation time runs out — never on grounding/meditation, and neutral even on Focus.)*

---

## 6) Two-sprint RN execution plan

**Guardrails for both sprints:** ship P0 with **zero new dependencies** (Tier 1) so it's OTA-deployable; treat Reanimated as a discrete, reviewed decision; every item lands with its Reduce-Motion and restrained-surface variants in the *same* PR (never "accessibility later"); QA each item against both axes.

### Sprint 1 — Foundations (Tier 1, + `expo-haptics`)
1. `mobile/lib/motion.ts`: tokens (§2.1–2.4) + `useReducedMotion()` + `useMotion(surfacePolicy)` + the restrained-surface registry (§2.7).
2. `AppUI.tsx` wrappers: `PressableScale`, `AppCard` first-paint entrance (gated), `PageHeader` collapse-on-scroll. **This single file change delivers items 3, 4, 5 across all 12 screens.**
3. Fix the `voice.tsx` pulse defect (item 2) — the clearest existing-bug win.
4. `LayoutAnimation` for accordions/disclosures (`03`, `11`), list inserts (`02`, `06`), banner dismissals (`03`, `11`).
5. Tab-content cross-fade in `(tabs)/_layout.tsx`.
6. Add `expo-haptics` (`npx expo install expo-haptics`) + Settings toggle; wire the three allowed haptic events (§2.5). No babel changes, OTA-safe.
7. Focus "Begin" state fix (`10`, item 14) and the safe habit-stat cross-fade (item 15).
8. **QA gate:** turn on iOS Reduce Motion and walk all 12 screens — verify nothing loses information; audit grounding/support/assess for **zero** motion and **zero** haptics.

### Sprint 2 — Polish, new flows, and the Reanimated decision
1. **Reanimated go/no-go.** If yes: `npx expo install react-native-reanimated react-native-gesture-handler`, create `babel.config.js` with `react-native-reanimated/plugin` **last** (and `react-native-worklets/plugin` if the installed version requires it), rebuild dev clients (**not OTA** — schedule a store/dev-client build). Scope strictly to: **breath pacer** (item 17), **gesture-dismiss sheets** (item 18), and optional **More→detail shared element** (item 19). If no: ship all of those as their Tier-1 fallbacks — the app is fully functional without Reanimated.
2. Build the six flows (§4), each with motion per its policy: **First-run**, **Weekly Review**, **Accountability request→mutual moment**, **Right-now support**, **Gentle re-entry**, **Privacy center**. Prioritize the required trio (First-run, Weekly Review, Accountability) first.
3. Library/Meditation filtered-list transitions + declutter the two-"All"-rows (`08`), check-in fill (`01`).
4. **Final QA:** (a) Reduce-Motion pass on every new flow; (b) restrained-surface audit — grounding/crisis/assessment/meditation-player carry `none`/`reduced` and no celebratory motion or urgency; (c) privacy audit — accountability celebration and weekly review expose **only aggregates**, never habit names / journal / mood / AI / assessment scores / goal text; (d) confirm capture-cursor artifacts are absent from store screenshots.

**Definition of done:** the app feels *settled* rather than *animated*; every state is legible with motion fully off; grounding, crisis, low-mood, and assessment surfaces are visibly calmer than the rest; and nothing about a partner, a journal, a mood, or a score can be inferred from any animation.
