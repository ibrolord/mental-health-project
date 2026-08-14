# Customizable Today Dashboard — Implementation Spec

Status: proposal, implementation-ready. Scope: iOS (`mobile/`). No total redesign — the existing
Today hero, mood check-in, and safety warning are kept byte-for-byte and a customizable zone is
inserted below them.

Verified constraints this spec is built on:

- `mobile/node_modules` has **no** `react-native-gesture-handler` and **no** `react-native-reanimated`.
  Drag must be built on RN core `Animated` + `PanResponder`, or not at all.
- `AppScreen` (`mobile/components/AppUI.tsx:25`) renders a `ScrollView`. Any pan gesture inside Today
  competes with scroll.
- Test idioms available: pure-module vitest with injected storage
  (`tests/mobile/dashboard-preferences.test.ts`), source-contract `toContain` assertions
  (`tests/mobile/core-design-contract.test.ts`), and manual steps in
  `mobile/qa/ios-release-checklist.json`. There is **no** React Native renderer in devDependencies —
  a synthetic drag cannot be unit tested.
- Owner-scoped AsyncStorage pattern exists: `createDashboardPreferences` + the generation-guarded
  `createDashboardPreferenceWriter` (`mobile/lib/dashboard-preferences.ts`).
- Privacy precedent: `createPrivacyEventRpcPayload` freezes `p_metadata: {}` — "taxonomy-only. No
  user content or arbitrary metadata."

---

## 1. Panel

### Consumer product lead

**Risk.** "Customizable dashboard" is where wellbeing apps go to die. The feature gets built, 4% of
users open the editor, and the other 96% inherit a default that is now designed by committee. The
second risk is churn-by-configuration: a user who reorders Today six times is not using the app, they
are decorating it. Third: 20 tools in a picker is a menu, and a menu is a decision, and a decision at
9am is exactly what a person with low energy cannot pay for.

**Recommendation.** Presets are the product; free reorder is the escape hatch. Ship four presets on a
single sheet, with **Mixed selected by default and matching today's shipped Today almost exactly** —
so the default user sees no change and no migration surprise. Free reorder and add/remove live one
level deeper, behind "Customize". Hard-cap the customizable zone at **6** modules and default to
**4**. Do not build a marketplace of widgets — every module is a one-line row that opens an existing
screen. No module renders live data on Today except Advisor, which already does.

### Calm mental-health mobile product designer

**Risk.** The prior feedback ("Today became cluttered") was not about count, it was about *visual
weight variance* — a hero, a card, an inline status, and a list row all competing. Adding six more
cards makes it worse regardless of how few they are. The second risk is drag affordances: handles,
grip dots, and shadows are noise that lives on the screen 100% of the time to serve an action taken
0.1% of the time. Third: reorder mode on the *live* screen means the screen the user relies on for
calm can be visibly broken by a stray finger.

**Recommendation.** The customizable zone renders as **one `RowGroup` of uniform `ListRow`s under a
single "Your day" `SectionHeader`** — one visual weight, one rhythm, no per-module cards. **Today
carries zero drag handles and zero edit affordances**; the only entry point is a single "Customize"
row at the bottom of the group. Reorder happens on a dedicated route with `AppScreen scroll={false}`.
Keep the botanical hero, mood picker, and safety status exactly as-is above the zone. Low-energy mode
renders the **top 3 only** — computed at render, never mutating what is stored.

### Behavioral-science safety specialist

**Risk.** The real hazard is not clutter, it is **avoidance-shaped configuration**. A user in a bad
week removes mood check-in, removes grounding, removes resources, keeps only Focus and Goals, and the
app quietly stops being able to notice they are struggling. `hasUnsafeAdvisorContext` is fed by the
ambient advisor context, and the mood check-in is a primary input; if the check-in is removable the
user can hide the data source of their own safety signal. Second risk: reorder becomes compulsive
tidying for anxious users. Third: any "you customized 12 times this week" analytic is surveillance of
a symptom.

**Recommendation.** **Hero, mood check-in, and the conditional safety warning are permanently fixed
and always render above the customizable zone.** They cannot be removed, reordered, hidden by preset,
or suppressed by low-energy mode. Grounding and Resources are always reachable — Resources stays in
the persistent `SupportAction` in the hero row regardless of layout, so removing the Resources module
never removes access to support. **Advisor is pinned to position 1 in every preset and cannot be
removed** (it is the surface that carries the safety recommendation). No streaks, no completion
meters, no "3 of 6 modules used" — the dashboard is a door, not a scoreboard. Reorder has no undo
history and no per-change confirmation; it is quiet and reversible by doing it again.

### Expo React Native architect

**Risk.** DIY drag is where this ships late. Concretely: (a) `PanResponder` inside `AppScreen`'s
`ScrollView` produces gesture ambiguity and requires toggling `scrollEnabled`, which is fragile on
iOS momentum; (b) any list long enough to need **auto-scroll during drag** roughly triples the
implementation; (c) `LayoutAnimation` on iOS requires no setup but interacts badly with
`ScrollView` content-size changes mid-gesture; (d) VoiceOver users cannot drag at all, so an
accessible path is not optional. Second risk: persisted layout is a new owner-scoped surface, and
Today already has four owner-key render gates — a fifth one done wrong renders another profile's
layout for a frame.

**Recommendation.** Put drag on a **dedicated route** (`mobile/app/dashboard-layout.tsx`) rendered
with `AppScreen scroll={false}`, reordering **only the enabled set, capped at 6**. Six 64pt rows plus
a header fit on every supported iPhone, so **there is no auto-scroll-during-drag requirement at all**
— this is the single decision that makes DIY drag tractable. Add/remove is a separate scrollable
checkbox list with no drag. Keep all layout logic in a pure module, `mobile/lib/dashboard-layout.ts`,
so the gesture layer is a dumb view and 100% of the ordering/migration logic is unit-testable in the
idiom this repo already uses. Version lives **inside** the JSON payload, not in the key, so migration
rewrites in place. Reuse `createDashboardPreferenceWriter`'s generation guard verbatim for
last-write-wins across profile switches. Leave low-energy in its own existing key — folding it in
migrates shipped data for no gain, and `more.tsx` already writes it.

---

## 2. Consensus

### 2.1 Fixed vs customizable

| Zone | Contents | Rule |
|---|---|---|
| **Fixed — above** | `BotanicalHero` (brand, date, greeting, affirmation/low-energy line) + `SupportAction → /resources` | Always renders. Not configurable. |
| **Fixed — above** | "How are you right now?" + `MoodPicker` + `InlineStatus` (save result, "Add context") | Always renders. Not removable, not reorderable. Safety-critical input. |
| **Fixed — above** | Conditional safety `InlineStatus` when `safetyOwnerKey === ownerKey && showAdvisorSafety` | Always renders when true. Renders **above** the customizable zone in all cases. |
| **Customizable** | 2–6 module rows under one "Your day" `SectionHeader`, in one `RowGroup` | Advisor pinned at index 0, undeletable. Order and membership user-controlled. |
| **Fixed — below** | "Customize" `ListRow` (`icon="sliders"`) as the last row of the group | Always renders. Sole entry point to the editor. |

Advisor keeps its current richer treatment: index 0 renders `AdvisorHomeCard` (with its
`lowEnergy` prop), indices 1..n render `ListRow`s. That is the one permitted weight difference and it
is the one that already ships.

### 2.2 Module catalog

Twenty modules. `href` values verified against `mobile/app/`. Tab routes use `router.navigate` (no
stack growth); stack routes use `router.push`. `id` values are the persisted contract — never rename.

| # | id | Title | Description (Today row) | icon | href | nav |
|---|---|---|---|---|---|---|
| 1 | `advisor` | Advisor | *rendered by `AdvisorHomeCard`* | — | `/advisor` | `navigate` |
| 2 | `mood` | Mood history | See how your check-ins have moved. | `activity` | `/(tabs)/tracker` | `navigate` |
| 3 | `assessments` | Assessments | Check in on how things are going. | `clipboard` | `/(tabs)/assessments` | `navigate` |
| 4 | `chat` | AI support | Talk something through. | `message-circle` | `/(tabs)/chat` | `navigate` |
| 5 | `voice` | Voice session | Speak instead of typing. | `mic` | `/voice` | `push` |
| 6 | `accountability` | Together | Share one commitment with someone you trust. | `users` | `/accountability` | `push` |
| 7 | `focus` | Focus | One task, one timer. | `target` | `/focus` | `push` |
| 8 | `goals` | Goals | Keep the longer arc in view. | `flag` | `/goals` | `push` |
| 9 | `grounding` | Grounding | A few minutes to come back down. | `anchor` | `/ground` | `push` |
| 10 | `habits` | Habits | Small things, done often. | `repeat` | `/habits` | `push` |
| 11 | `journal` | Journal | Write it down before it loops. | `edit-3` | `/journal` | `push` |
| 12 | `library` | Library | Read something steady. | `book-open` | `/library` | `push` |
| 13 | `meditation` | Meditation | Sit with it for a while. | `moon` | `/meditate` | `push` |
| 14 | `mind_games` | Mind games | A gentle mental reset. | `grid` | `/mind-games` | `push` |
| 15 | `planner` | Planner | Shape the day before it shapes you. | `calendar` | `/planner` | `push` |
| 16 | `plans` | My plans | Pick up where a plan left off. | `map` | `/plans` | `push` |
| 17 | `reflection` | Reflection | Look back at what actually happened. | `sunrise` | `/reflect` | `push` |
| 18 | `resources` | Find support | Directories and trusted communities. | `life-buoy` | `/resources` | `push` |
| 19 | `saved` | Saved | Things you kept. | `bookmark` | `/saved` | `push` |
| 20 | `yoga` | Yoga | Move a little, gently. | `wind` | `/yoga` | `push` |

Not in the catalog and intentionally so: `/settings`, `/support`, `/research`, `/affirmations`,
`/partner` (reached via `accountability`), `/auth/*`. These stay in the **You** tab.

Copy rule: every description is one sentence, ≤ 52 characters, lowercase after the first word, no
exclamation marks, no imperative pressure ("Do your…", "Don't forget…").

### 2.3 Presets — exact ordered module IDs

```ts
export const DASHBOARD_PRESETS = {
  mixed:      ['advisor', 'accountability', 'grounding', 'planner', 'library'],
  productivity: ['advisor', 'planner', 'focus', 'habits', 'goals'],
  mental_health: ['advisor', 'grounding', 'meditation', 'journal', 'resources'],
  growth:     ['advisor', 'reflection', 'goals', 'library', 'habits'],
} as const;

export const DEFAULT_PRESET = 'mixed';
```

`mixed` is the default and is deliberately the shortest (4). It is a superset of today's shipped
Today (`advisor` + `accountability`), so an existing user who never opens the editor sees two added
rows and nothing removed. Selecting a preset **replaces** the enabled set and order wholesale; the
sheet says so before it applies.

`presetId` is stored alongside the order. Any manual reorder, add, or remove sets
`presetId: 'custom'`. The editor then shows "Custom" as selected; re-tapping a preset restores it.

### 2.4 Customization flow

Entry: Today → last row of "Your day" → **Customize** → `router.push('/dashboard-layout')`.

`mobile/app/dashboard-layout.tsx`, `<AppScreen scroll={false}>`:

```
PageHeader  eyebrow="Your day"  title="Customize"
            description="Pick a starting point, then arrange it."

[ Presets ]        horizontal ChoiceChip row: Mixed · Productivity · Mental health · Growth
                   (a 5th chip "Custom" appears only when presetId === 'custom')

[ On your dashboard ]   the reorder list — enabled modules, order = stored order
                        row 0 = Advisor, greyed drag affordance, "Always first"
                        rows 1..n = long-press-to-drag, plus ▲/▼ buttons (see 2.5)
                        each row has a trailing "Remove" button (hidden on row 0)
                        footer: "4 of 6" counter

[ Add a tool ]     ListRow → router.push('/dashboard-layout/add')

[ Reset ]          ActionRow "Reset to Mixed"  (confirm via Alert)
```

`mobile/app/dashboard-layout/add.tsx`, `<AppScreen>` (scrollable, **no drag**): the 19 non-Advisor
modules as a `RowGroup` of `ListRow`s with a trailing check state. Tapping toggles. When the enabled
count is 6, unchecked rows render `disabled` with the group footer reading "Remove one to add
another." Never silently drop a module to make room.

Persistence is **immediate on every change** — there is no Save button and no dirty state. Every
mutation goes through the generation-guarded writer, so backgrounding mid-edit loses nothing.

Drag mechanics (reorder list only, ≤ 6 rows, no scroll container):

- Long-press 220ms on a row (`onLongPress` on the row `Pressable`) enters drag: the row lifts via
  `Animated.Value` (`scale: 1.02`, `shadowOpacity: 0.12`), `Haptics`-free (no haptics dep — use
  `AccessibilityInfo.announceForAccessibility('Reordering')` instead).
- `PanResponder` is created once with `onMoveShouldSetPanResponder: () => isDragging`, so it never
  claims a gesture unless a long-press already armed it.
- Row height is a fixed constant `ROW_HEIGHT = 64`. Target index = `clamp(round(dy / ROW_HEIGHT) +
  startIndex, 1, len - 1)` — index 0 is Advisor and is not a valid drop target.
- Non-dragged rows translate by ±`ROW_HEIGHT` via `Animated.timing` (150ms). No `LayoutAnimation`.
- Release: `moveModule(ids, from, to)`, persist, reset all `Animated.Value`s to 0.
- Because the list can never exceed 6 rows and the screen does not scroll, **auto-scroll-during-drag
  is out of scope by construction.** If a future change lifts the cap above 6, this must be revisited
  before shipping.

### 2.5 Accessible reorder alternative

Drag is never the only path. Both of these ship in the same release as the drag:

1. **Visible ▲ / ▼ buttons.** Every reorder row (index ≥ 1) has two 44×44 `Pressable`s.
   `accessibilityLabel` = `"Move ${title} up"` / `"Move ${title} down"`. Disabled at the ends
   (`accessibilityState={{ disabled: true }}`). These are visible to everyone, always — not
   revealed by an "accessibility mode". They are the primary path; drag is the shortcut.
2. **VoiceOver adjustable.** Each row is `accessibilityRole="adjustable"` with
   `accessibilityValue={{ text: \`position ${i + 1} of ${len}\` }}` and an `onAccessibilityAction`
   handling `increment` / `decrement` mapped to move-down / move-up. Swipe-up/down with VoiceOver
   focus reorders without any gesture.

After every move by any path: `AccessibilityInfo.announceForAccessibility(\`${title}, position
${to + 1} of ${len}\`)`. Removal announces `\`${title} removed. ${n} on your dashboard.\``

Also required: Dynamic Type. The row uses the existing `ListRow` type ramp with **no**
`maxFontSizeMultiplier` (matching `core-design-contract.test.ts`'s rule). At `fontScale >= 1.35` the
reorder row stacks title above the ▲/▼ pair and `ROW_HEIGHT` becomes `88`; the same constant drives
the drag math, so drag stays correct at large text.

### 2.6 Persistence, version, migration

New module `mobile/lib/dashboard-layout.ts`. Storage injected, same shape as
`dashboard-preferences.ts`.

```ts
const LAYOUT_PREFIX = 'mhtoolkit.dashboard.layout.';   // + ownerKey
export const DASHBOARD_LAYOUT_VERSION = 1;

export type DashboardLayout = {
  version: number;            // inside the payload, NOT the key
  presetId: 'mixed' | 'productivity' | 'mental_health' | 'growth' | 'custom';
  moduleIds: string[];        // ordered, enabled only, moduleIds[0] === 'advisor'
};
```

`createDashboardLayoutStorage(storage)` exposes `readLayout(ownerKey)` and
`writeLayout(ownerKey, layout)`. Writes go through a `createDashboardLayoutWriter` that is a
copy of the existing generation-guarded writer, so a profile switch mid-write cannot land the old
owner's layout.

Low-energy stays in its own existing key (`mhtoolkit.dashboard.low-energy.<ownerKey>`). Not merged.

**`migrateLayout(raw: unknown): DashboardLayout` — never throws, always returns a valid layout.**

| Case | Behaviour |
|---|---|
| key absent | return preset `mixed`, `presetId: 'mixed'` |
| `JSON.parse` throws | return preset `mixed` |
| not an object / is array | return preset `mixed` |
| `moduleIds` not an array | return preset `mixed` |
| `version` missing or `< 1` | treat as v1 payload, run all rules below, rewrite with `version: 1` |
| `version > DASHBOARD_LAYOUT_VERSION` | return preset `mixed` (forward-compat: a downgraded build never honours a future schema) |
| unknown id (module removed in a later build) | drop it silently |
| duplicate ids | keep first occurrence |
| `advisor` missing | unshift `advisor` |
| `advisor` not at index 0 | move it to index 0 |
| length > 6 after cleanup | truncate to 6 (advisor + 5) |
| length < 2 after cleanup | append from `DASHBOARD_PRESETS.mixed`, skipping ids already present, until length 2 |
| `presetId` unknown/missing | derive: exact array match against a preset → that id, else `'custom'` |

Migration result is written back immediately on read when it differs from the raw payload, so a bad
payload self-heals once rather than being re-migrated on every launch.

**Owner-key render gate (required).** Today mirrors the existing pattern exactly:

```ts
const visibleModuleIds = layoutOwnerKey === ownerKey ? layout.moduleIds : DASHBOARD_PRESETS.mixed;
```

with `layoutOwnerKey` cleared to `null` at the top of the loading effect — identical in shape to
`lowEnergyOwnerKey` / `safetyOwnerKey` / `moodOwnerKey`. This is the case added to
`tests/mobile/owner-isolation-screens.test.ts`.

### 2.7 Anti-clutter rules

Enforced in code, not in review.

| Rule | Where enforced |
|---|---|
| R1 — Customizable zone is **min 2, max 6** modules (advisor + 1..5). | `enforceCaps()` in `dashboard-layout.ts`; add-screen disables unchecked rows at 6. |
| R2 — Today renders **exactly one** `SectionHeader` ("Your day") and **one** `RowGroup` below the fixed zone. | source-contract test. |
| R3 — Every module below index 0 is a `ListRow`. No `AppCard`, no `DisclosureCard`, no per-module images, no badges, no counts. | source-contract test asserts `index.tsx` contains no `<AppCard` and no `<DisclosureCard`. |
| R4 — Only Advisor may fetch or render live data on Today. Every other module row is static title/description/icon from the catalog. | catalog is a frozen const with no async fields; source-contract test asserts no `supabase.from(` added beyond the existing mood query. |
| R5 — Low-energy mode renders `visibleModuleIds.slice(0, 3)`, computed at render. Never mutates or persists. | pure fn `visibleModules(ids, lowEnergy)`; unit test asserts stored array is unchanged. |
| R6 — Descriptions are ≤ 52 chars, one sentence. | unit test iterates the catalog. |
| R7 — Zero edit affordances on Today. No handles, no grips, no "long press to reorder" hint text. | source-contract test asserts `index.tsx` has no `PanResponder` and no `onLongPress`. |
| R8 — Total Today scroll height at default text size stays under **2.0 screens** with 6 modules. | QA-gate manual step. |

### 2.8 Analytics without surveillance

Nothing about dashboard layout leaves the device. No new Supabase table, no new RPC, no new column,
no extension of `PRIVACY_EVENT_TYPES` (that taxonomy is for consent/sharing/export/deletion and
stays that way).

`mobile/lib/dashboard-layout-metrics.ts` — owner-scoped, local-only, capped counters:

```ts
export const DASHBOARD_METRIC_EVENTS = [
  'layout_editor_opened',
  'preset_applied_mixed',
  'preset_applied_productivity',
  'preset_applied_mental_health',
  'preset_applied_growth',
  'module_reordered_drag',
  'module_reordered_buttons',
  'module_added',
  'module_removed',
  'layout_reset',
] as const;
```

Rules:

- Closed union of event names. Preset identity is encoded **in the event name**, never as a metadata
  field — same discipline as `p_metadata: Object.freeze({})`.
- Storage: a single counter map per owner at `mhtoolkit.dashboard.metrics.<ownerKey>`, values are
  integers only. No timestamps, no sequence, no module ids, no session ids.
- Counters saturate at **99** per event. Above that the number stops being a behavioural trace and
  starts being a compulsion log; the specialist's objection is answered by making the ceiling
  structural.
- Read path: **only** the user, via Settings → Privacy → "What this app counts", which lists the
  event labels and current values in plain language. Nothing else reads it.
- Cleared by the existing account-deletion and profile-switch cleanup paths (add the key prefix to
  `session-cleanup`).
- Explicitly **not** collected: which modules a user removed, how often they open a given tool, time
  of day, dwell time, mood-correlated layout changes.

If product later needs aggregate preset popularity, the correct move is a one-question in-app prompt
with explicit consent — not silent upload of these counters.

---

## 3. Acceptance test matrix

Idioms: **P** = pure-module vitest (`tests/mobile/dashboard-layout.test.ts`, injected in-memory
storage, `dashboard-preferences.test.ts` pattern) · **S** = source-contract vitest
(`toContain`/`not.toContain`, `core-design-contract.test.ts` pattern) · **Q** = manual step in
`mobile/qa/ios-release-checklist.json`, gated by `npm run qa:ios:verify`.

| # | Assertion | Idiom | File |
|---|---|---|---|
| A1 | `DASHBOARD_PRESETS.mixed` === `['advisor','accountability','grounding','planner','library']` | P | `dashboard-layout.test.ts` |
| A2 | Each of the 4 presets starts with `advisor` and has length 4–6 | P | ″ |
| A3 | Every preset id exists in the catalog; catalog has exactly 20 entries with unique ids | P | ″ |
| A4 | Every catalog description ≤ 52 chars, no `!` (R6) | P | ″ |
| A5 | `applyPreset(layout, 'growth')` replaces order wholesale and sets `presetId: 'growth'` | P | ″ |
| A6 | `moveModule(ids, 3, 1)` reorders correctly; `moveModule(ids, 2, 0)` is a no-op (advisor pinned) | P | ″ |
| A7 | `moveModule` with out-of-range or equal indices returns the input array unchanged | P | ″ |
| A8 | `addModule` at 6 modules returns input unchanged (never silently drops) | P | ″ |
| A9 | `removeModule('advisor')` returns input unchanged; removing down to 1 non-advisor is allowed, to 0 is not | P | ″ |
| A10 | Any manual mutation sets `presetId: 'custom'`; applying a preset restores its id | P | ″ |
| A11 | `migrateLayout` — all 12 rows of §2.6 table, one case each, none throw | P | ″ |
| A12 | `migrateLayout(JSON.stringify({version: 99, ...}))` falls back to `mixed` | P | ″ |
| A13 | Round-trip: write → read returns identical layout; storage holds exactly one key `mhtoolkit.dashboard.layout.<ownerKey>` | P | ″ |
| A14 | Two owner keys hold independent layouts; reading owner B never returns owner A's array | P | ″ |
| A15 | Generation guard: `writeLatest(A,…)` then `writeLatest(B,…)` — only B's result is `current: true` | P | ″ |
| A16 | Storage rejection (throwing stub) leaves in-memory layout intact and surfaces `error` without throwing | P | ″ |
| A17 | `visibleModules(ids, true)` returns `ids.slice(0,3)` and `ids` is not mutated (R5) | P | ″ |
| A18 | Low-energy with only 2 modules returns 2, not a padded 3 | P | ″ |
| A19 | Metrics: unknown event name is rejected; counters saturate at 99; map contains only integers | P | `dashboard-layout-metrics.test.ts` |
| A20 | Metrics key prefix appears in the session-cleanup key list | P | `session-cleanup.test.ts` |
| A21 | `index.tsx` renders `BotanicalHero`, `MoodPicker`, and the safety `InlineStatus` **above** the customizable zone (index-order assertion) | S | `today-dashboard-contract.test.ts` |
| A22 | `index.tsx` contains `layoutOwnerKey === ownerKey` gate (§2.6) | S | `owner-isolation-screens.test.ts` |
| A23 | `index.tsx` contains no `PanResponder`, no `onLongPress`, no `<AppCard`, no `<DisclosureCard` (R3, R7) | S | `today-dashboard-contract.test.ts` |
| A24 | `index.tsx` contains exactly one `SectionHeader` and one `RowGroup` below the hero (R2) | S | ″ |
| A25 | `index.tsx` adds no new `supabase.from(` call (R4) | S | ″ |
| A26 | `dashboard-layout.tsx` uses `<AppScreen scroll={false}` and does **not** import `ScrollView` | S | ″ |
| A27 | `dashboard-layout.tsx` has ▲/▼ `accessibilityLabel="Move ` strings and `accessibilityRole="adjustable"` | S | `interactive-accessibility.test.ts` |
| A28 | `dashboard-layout.tsx` calls `announceForAccessibility` after moves | S | ″ |
| A29 | No file imports `react-native-gesture-handler`, `react-native-reanimated`, or `draggable-flatlist` | S | `today-dashboard-contract.test.ts` |
| A30 | Neither reorder nor add screen sets `maxFontSizeMultiplier` | S | `core-design-contract.test.ts` |
| A31 | Catalog `href` strings all resolve to a file under `mobile/app/` (filesystem check) | S | `navigation.test.ts` |
| A32 | Drag: long-press a row, drop 2 positions down — lands on the intended index, order persists after backgrounding the app | Q | `ios-release-checklist.json` |
| A33 | Drag: begin a drag and release without moving — order unchanged, no visual stutter | Q | ″ |
| A34 | VoiceOver: reorder a module end-to-end using swipe-up/down only; each move is announced | Q | ″ |
| A35 | Dynamic Type at XXL: reorder rows stack, ▲/▼ remain ≥44pt, drag still drops on the intended index | Q | ″ |
| A36 | With 6 modules at default text size, Today scrolls under 2.0 screens (R8) | Q | ″ |
| A37 | Existing user upgrade: no stored layout → Today shows Mixed, mood check-in and hero unchanged from 1.0.4 | Q | ″ |
| A38 | Sign out → sign in as a second profile → Today never flashes the first profile's module list | Q | ″ |
| A39 | Low-energy toggle in You → Today shows exactly 3 modules; toggle off → previous 6 return in the same order | Q | ″ |
| A40 | Safety warning path: with an unsafe advisor context, the warning renders above the module group regardless of layout, and `/resources` is reachable from the hero even with the `resources` module removed | Q | ″ |

Ship gate: A1–A31 green in `vitest`, A32–A40 recorded green via `npm run qa:ios:run` /
`qa:ios:verify` on a physical device.

---

## 4. Files touched

New:
- `mobile/lib/dashboard-layout.ts` — catalog, presets, `applyPreset`, `moveModule`, `addModule`, `removeModule`, `enforceCaps`, `visibleModules`, `migrateLayout`, `createDashboardLayoutStorage`, `createDashboardLayoutWriter`
- `mobile/lib/dashboard-layout-metrics.ts`
- `mobile/app/dashboard-layout.tsx` — reorder screen
- `mobile/app/dashboard-layout/add.tsx` — add/remove screen
- `mobile/components/DashboardModuleRow.tsx` — reorder row (drag + ▲/▼ + adjustable role)
- `tests/mobile/dashboard-layout.test.ts`, `tests/mobile/dashboard-layout-metrics.test.ts`, `tests/mobile/today-dashboard-contract.test.ts`

Modified:
- `mobile/app/(tabs)/index.tsx` — replace the hardcoded Advisor card + Together row with the layout-driven group; fixed zone untouched. Resolve `router.navigate('/advisor')` against the new `(tabs)/advisor.tsx` route while doing so.
- `mobile/lib/session-cleanup` — add the two new key prefixes
- `mobile/qa/ios-release-checklist.json` — A32–A40
- `tests/mobile/owner-isolation-screens.test.ts`, `interactive-accessibility.test.ts`, `core-design-contract.test.ts`, `navigation.test.ts` — new cases

Not touched: `BotanicalHero`, `MoodPicker`, `AdvisorHomeCard`, `advisor-context.ts`,
`advisor-core.ts`, `dashboard-preferences.ts`, tab layout, any Supabase migration.
