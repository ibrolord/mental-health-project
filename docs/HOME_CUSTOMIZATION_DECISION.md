# Today Home Customization — Panel Decision

Status: **Decided, implementation-ready.** Scope: additive to the existing Today screen. No redesign.
Date: 2026-08-14. Release train: iOS 1.0.4.

---

## 0. Panel positions

**Consumer product lead (dashboards & activation).**
Risk: "customizable home" usually ships as an empty canvas, and empty canvases kill activation — the median user never opens the editor, and the ones who do end up with a worse screen than the default. Recommendation: presets are the product, drag is the escape hatch. Ship four one-tap presets, make Mixed byte-identical to today's screen, and put the editor behind a single low-salience entry point at the bottom of "Your day."

**Mobile product designer (calm MH UX & accessibility).**
Risk: the calm identity is carried by whitespace and a single focal point. Adding an editable region invites handles, badges, and counts onto the one screen that must stay quiet. Recommendation: modules are **rows only** — same `ListRow` primitive already in `Your day`, one line of title, one line of description, no numbers rendered on Today. Edit mode is a separate screen, not an inline state on Today. Drag handles exist only inside edit mode.

**Behavioral-science specialist.**
Risk: a customizable dashboard is where streaks, completion rings, and "you missed 3 days" creep in. On a mental-health surface those convert a self-management tool into a compliance instrument, and preset naming ("optimized for productivity") risks overclaiming clinical effect. Recommendation: hard veto on any streak, score, percentage, or progress ring inside a Today module. Presets are described as *starting points*, never as optimized/recommended-for-you. No module may be added or reordered automatically based on inferred user state — the user is the only mutator of their layout.

**React Native / iOS architect.**
Risk: `node_modules` has **no** `react-native-gesture-handler`, `react-native-reanimated`, or `react-native-draggable-flatlist`. Adding drag via a library means two new native modules, a Babel plugin, a `GestureHandlerRootView` root wrap, new vitest mocks, and a fresh dev-client build — mid release train. Recommendation: implement drag with core `PanResponder` + `Animated` over a ≤6-row non-virtualized list. Zero new dependencies, zero native surface. All ordering/preset/merge/migration logic goes in an RN-free pure module so the existing node/vitest contract suite can test it.

**Convergence:** presets-first, rows-only, editor on its own screen, drag in core RN, logic in a pure module.

---

## 1. Information architecture — fixed vs customizable

Today's vertical order is **fixed** and is not user-reorderable:

| Zone | Content | Customizable? |
|---|---|---|
| 1. Hero | `BotanicalHero` — date, greeting, affirmation, Support | No |
| 2. Primary check-in | `MoodPicker` + `InlineStatus` | No |
| 3. Safety | Conditional `InlineStatus` → Find support | No (conditional only) |
| 4. Next action | `AdvisorHomeCard` | No |
| 5. **Your day** | Ordered module rows | **Yes** |
| 6. Customize entry | `Customize your day` row | No (always last) |

Rationale: the product principle — one primary check-in, one next action — lives entirely in zones 1–4. Customization is confined to zone 5, which is exactly the region the user asked to expand. Nothing above zone 5 can be removed, reordered, or hidden.

Zone 5 renders **rows only** and is capped at **6** modules.

---

## 2. Module catalog

A module is a `ListRow` (icon, title, one-line description, chevron) that navigates to an existing route. Nothing more. Every `route` below was verified against `mobile/app/`.

| id | Title | Route | Icon | Description (default) |
|---|---|---|---|---|
| `together` | Together | `/accountability` | `users` | Share one commitment with someone you trust. |
| `journal` | Journal | `/journal` | `edit-3` | Write down what today actually felt like. |
| `reflect` | Reflection | `/reflect` | `sunset` | Close the day with one honest note. |
| `ground` | Ground me | `/ground` | `wind` | A short exercise to come back to now. |
| `meditate` | Meditate | `/meditate` | `feather` | A guided pause, as long as you have. |
| `yoga` | Yoga | `/yoga` | `activity` | Gentle movement you can do anywhere. |
| `focus` | Focus | `/focus` | `target` | One session on one thing. |
| `planner` | Planner | `/planner` | `calendar` | Lay out today before it lays out you. |
| `goals` | Goals | `/goals` | `flag` | What you are working toward. |
| `habits` | Habits | `/habits` | `repeat` | The small things you are keeping up. |
| `plans` | My plans | `/plans` | `map` | Your saved plans and next steps. |
| `library` | Library | `/library` | `book-open` | Reading and practices worth your time. |
| `saved` | Saved | `/saved` | `bookmark` | Everything you kept for later. |
| `mind-games` | Mind games | `/mind-games` | `grid` | Light cognitive practice, not a test. |
| `affirmations` | Affirmations | `/affirmations` | `sun` | Words to carry into the day. |
| `assessments` | Check your wellbeing | `/(tabs)/assessments` | `clipboard` | Structured self-assessments, on your terms. |
| `chat` | AI support | `/(tabs)/chat` | `message-circle` | Talk it through. Processed by a provider. |
| `voice` | Voice session | `/voice` | `mic` | Speak instead of typing. |
| `tracker` | Add context | `/(tabs)/tracker` | `bar-chart-2` | Add detail to today's check-in. |

**Every module in this catalog is a plain navigation row.** There is no composite, data-bearing, or embedded-widget module in v1.

**Deliberately excluded: `go-to` actions.** `mobile/components/GoToActions.tsx` and its store `mhtoolkit.go_to_actions.v1` exist but the component is rendered by **no route** — only `clearGoToActions` is wired up (`auth-context.tsx`, `settings.tsx`). Re-homing it here would require inventing a host screen for its edit mode (TextInputs, `GO_TO_CUE_LIMIT`) and would put a second data-bearing surface on Today. It is **out of scope for v1**. Reviving go-to actions is a separate decision; when it happens it gets a host route first, and only then a catalog entry pointing at that route. No module in this catalog targets `/plans` other than `plans` itself.

**Module behavior rules (no exceptions):**
- Exactly one tap target per row; `onPress` navigates. No inline actions, no toggles, no counts.
- Description is a static string from the catalog. It is never personalized, never derived from user data, never a status readout.
- A module renders whether or not the user has data behind it. There is no per-module loading, no per-module error, no per-module empty state — because a module fetches nothing.
- **No two catalog entries may share a `route`.** Enforced by unit test (§10).

---

## 3. Presets — exact ordered module IDs

```ts
export const HOME_PRESETS = {
  mixed:       ['together'],
  productivity:['focus', 'planner', 'goals', 'habits'],
  mental_health:['ground', 'journal', 'reflect', 'together'],
  growth:      ['reflect', 'goals', 'library', 'journal'],
} as const;
```

- `mixed` is the **default** and is deliberately a single row — it reproduces the current Today screen exactly. An existing user who upgrades sees no change whatsoever. This is the concrete form of "no loss of existing user data."
- Preset labels shown in UI: `Mixed`, `Productivity`, `Mental health`, `Growth`. Sub-copy for each is a neutral description of *contents*, e.g. "Focus, planner, goals, habits." Never "optimized for", "recommended for you", or "best for".
- Applying a preset **replaces** `order` wholesale and sets `presetId`. Any manual edit afterwards sets `presetId` to `'custom'`; the previously applied preset is not remembered.

---

## 4. Customization interaction flow

Entry: a permanent final row in `Your day` — `Customize your day` / "Choose your tools and their order." → `router.push('/customize-day')`.

`mobile/app/customize-day.tsx` — a full screen, not a modal, not an inline mode on Today.

```
PageHeader: "Your day" / "Pick the tools you want on Today, in the order you want them."

[ Start from a preset ]           ← RowGroup, 4 rows, current one shows a check trailing
  Mixed          Together
  Productivity   Focus, planner, goals, habits
  Mental health  Ground, journal, reflection, together
  Growth         Reflect, goals, library, journal

[ On your Today screen ]  (n of 6)   ← the draft list
  ≡  Ground me            [↑] [↓] [–]
  ≡  Journal              [↑] [↓] [–]
  ...
  (empty)  "Nothing here yet. Add a tool below."

[ Add a tool ]                       ← remaining catalog, alphabetical by title, [+]
                                       disabled with "Your day is full (6)." at cap

[ Reset to Mixed ]                   ← destructive-styled row, confirm dialog

Footer (sticky):  [ Cancel ]   [ Save ]
```

Flow rules:
- **Draft/apply.** The screen edits a local draft. Nothing persists until **Save**. **Cancel** and hardware/gesture back with a dirty draft both raise the existing discard-confirm pattern (`goals.tsx` "discard-unsaved"). This is the "preview/apply" model — the draft list *is* the preview, since Today modules are the same `ListRow` primitive rendered identically.
- **Drag.** Long-press (250 ms) on the `≡` handle lifts the row (`Animated` scale 1.02, shadow), `PanResponder` tracks `dy`, rows below shift by a fixed row height, drop commits the reorder. Implemented with core `Animated` + `PanResponder` only. The list is ≤6 rows and non-virtualized, so fixed row height is measured once via `onLayout`.
- **Scroll-gesture arbitration (the hard part — read before starting step 5).** `AppScreen` wraps a `ScrollView`, which will win the vertical pan unless the row claims it explicitly. Required handling:
  - The `PanResponder` lives **on the handle only**, never the whole row.
  - `onStartShouldSetPanResponderCapture` returns `false`; the responder is claimed in `onMoveShouldSetPanResponderCapture`, and only once the 250 ms long-press timer has fired. Before that, the parent scroll keeps the gesture — so a fast flick over a handle scrolls, it does not drag.
  - `onPanResponderTerminationRequest` returns `false` for the duration of the lift, so the ScrollView cannot reclaim mid-drag.
  - On lift, set `scrollEnabled={false}` on the enclosing scroll view; restore it in both `onPanResponderRelease` and `onPanResponderTerminate`. `AppScreen` must therefore expose a `scrollEnabled` prop (additive, defaults `true` — no behavior change for existing callers).
  - No auto-scroll-while-dragging in v1. The list is ≤6 rows; if the draft does not fit on screen the user reorders with `[↑]`/`[↓]`. Auto-scroll is explicitly out of scope.
- **Move up/down.** `[↑]` `[↓]` buttons are always visible — not a fallback revealed under VoiceOver. They are the primary mechanism for anyone who wants determinism; drag is the shortcut.
- **Remove.** `[–]` removes from the draft and returns the module to "Add a tool". Removing the last module is allowed; the empty state explains it.
- **Add.** `[+]` appends to the end of the draft. At 6 modules the add list is disabled with an explanatory line, not hidden.
- **Reset.** "Reset to Mixed" → `Alert.alert` confirm → draft becomes `HOME_PRESETS.mixed`, still requires Save.
- **Save.** Writes the payload, then `router.back()`. On write failure: stay on screen, `InlineStatus tone="error"` — "Could not save your layout. Your Today screen is unchanged." Draft is preserved.

**Low-energy mode.** When `lowEnergyMode` is on, Today renders only the **first 2** modules of the stored order plus the Customize row. Stored order is never mutated. The customize screen shows a note: "Low-energy view is on, so Today shows your first two tools."

---

## 5. Empty / loading / error states

| State | Behavior |
|---|---|
| Layout not yet loaded for the current owner | `Your day` renders **nothing** in the module zone — no spinner, no skeleton. Matches the existing `visibleTodayMood` / `visibleLowEnergyMode` idiom. The `Customize your day` row still renders. |
| Owner key is null (profile not ready) | Same as above; customize row is present but disabled. |
| Stored layout read fails | Fall back to `HOME_PRESETS.mixed`. No error surfaced on Today — a failed preference read must never put an error on the calm surface. |
| Saved order is empty (user removed everything) | `Your day` shows one muted line: "No tools on Today yet." plus the Customize row. |
| Save fails on customize screen | `InlineStatus tone="error"`, draft preserved, no navigation. |
| Stored ID no longer in catalog | Silently dropped at parse time (see §7). |

---

## 6. Accessibility & reduced motion

- Every row: `accessibilityRole="button"`, `accessibilityLabel={title}`, `accessibilityHint={description}` — inherited from `ListRow`.
- In edit mode each row exposes `accessibilityLabel={`${title}, position ${i + 1} of ${n}`}`.
- `[↑]` / `[↓]` / `[–]` / `[+]` are real focusable buttons with ≥44 pt targets and explicit labels: "Move Journal up", "Move Journal down", "Remove Journal from Today", "Add Journal to Today". Disabled at list bounds via `accessibilityState={{ disabled }}`, not hidden.
- After every reorder or add/remove: `AccessibilityInfo.announceForAccessibility('Journal moved to position 3 of 5.')` / `'Journal added to Today.'` / `'Journal removed from Today.'`
- Drag handle carries `accessibilityElementsHidden` — VoiceOver users get the buttons, not a pan target.
- **Reduced motion:** subscribe with the exact pattern at `mobile/components/GoalDetailModal.tsx:127-140` (`AccessibilityInfo.isReduceMotionEnabled()` + `reduceMotionChanged` listener). When enabled: no lift animation, no shift animation, no drop spring — reorder applies instantly on drop, and `[↑]`/`[↓]` apply with zero duration. Drag remains functional.
- No `maxFontSizeMultiplier` anywhere in the new UI; rows must wrap at accessibility text sizes. This is already asserted by `core-design-contract.test.ts`.

---

## 7. Persistence, versioning, migration

New pure module `mobile/lib/wellbeing/home-layout.ts` (RN-free) + storage wrapper `mobile/lib/home-layout-storage.ts`, mirroring the `go-to-actions` pair exactly.

```ts
export const HOME_LAYOUT_VERSION = 1 as const;
export const HOME_MODULE_LIMIT = 6;

export type HomeLayoutPayload = {
  version: typeof HOME_LAYOUT_VERSION;
  presetId: 'mixed' | 'productivity' | 'mental_health' | 'growth' | 'custom';
  order: HomeModuleId[];
};
```

Key: `mhtoolkit.dashboard.home-layout.v1:${encodeURIComponent(ownerKey)}` — owner-scoped, same prefix family as `mhtoolkit.dashboard.low-energy.`.

**Parse/merge rules** (all three are required, all pure, all unit-tested):
1. **Absent or unparseable** → `HOME_PRESETS.mixed`, `presetId: 'mixed'`. So a fresh install and a failed read both reproduce today's screen.
2. **Unknown stored IDs are dropped**, remaining relative order preserved, duplicates collapsed, truncated to 6. A module removed from the catalog in a future build never crashes or leaves a dead row.
3. **New catalog modules are NOT auto-added.** A module added to the catalog in a later build appears only in "Add a tool". A curated Today screen can never be re-cluttered by a release. This is the single most important anti-regression rule in the spec.
4. **Version mismatch** → treat as absent (rule 1). Same policy as `parseGoToActions`.

**Write concurrency:** reuse `createDashboardPreferenceWriter`'s generation-counter pattern from `mobile/lib/dashboard-preferences.ts` so a rapid Save→navigate→Save sequence cannot land a stale write.

**Owner isolation:** Today gates the module zone on `layoutOwnerKey === ownerKey`, identical to `visibleTodayMood` / `visibleLowEnergyMode` / `visibleAdvisorSafety`. Extend `tests/mobile/owner-isolation-screens.test.ts`.

**Identity transitions:** the layout does **not** carry from anonymous to authenticated, matching the `low-energy` and `go-to-actions` precedent. `clearHomeLayout(ownerKey)` must be added to all five existing `clearGoToActions` call sites — `mobile/lib/auth-context.tsx:279, 552, 589, 639` and `mobile/app/settings.tsx:336` — so sign-out, session expiry, and account deletion clear it. A `subscribeHomeLayoutCleared` listener mirrors `subscribeGoToActionsCleared` so a mounted Today resets without a remount.

---

## 8. Analytics

Route through the existing `recordOperationalEvent` channel in `mobile/lib/observability.ts`. That API takes a **closed enum and no payload** — it is content-free by construction, which is exactly the property needed here. Add four members to `IOS_OPERATIONAL_EVENT_TYPES`:

- `home_customize_opened`
- `home_preset_applied`
- `home_layout_saved`
- `home_layout_reset`

**A migration is mandatory — the client enum alone is not enough.** `supabase/migrations/20260809010838_add_privacy_safe_operational_events.sql` constrains the table with `operational_events_type_check` (`event_type IN (...)`) and `operational_events_source_type_check` (which values are legal per `source`). `recordOperationalEvent` swallows every error, so without a migration these four writes fail **silently** and §8 ships as dead code. Required migration:
- Extend `operational_events_type_check` with the four new values.
- Extend `operational_events_source_type_check`'s `source = 'ios'` branch with the same four. Do **not** add them to the `'web'` branch — this is an iOS-only surface, and `recordOperationalEvent` already early-returns on non-iOS.

**Known and accepted coverage gap:** `operational_events.user_id` is `UUID NOT NULL REFERENCES auth.users(id)`, so **anonymous users emit nothing**. These four counters measure authenticated users only. Do not attempt to close this gap — widening the table to anonymous sessions is a privacy-surface change well beyond the value of the metric.

**Explicitly not tracked:** which modules a user chose, their order, how many they have, which preset they picked, how often they open a given tool. Module selection on a mental-health app is a proxy for symptom profile — "user added ground + go-to + journal" is inferable clinical signal, and it is not ours to collect. The four counters above answer the only questions worth answering (is the editor discoverable, do saves succeed, do people reset) and nothing else.

Do **not** emit these through `privacy-events.ts` — that table is a user-facing consent audit log and layout edits are not consent events.

---

## 9. Acceptance criteria

1. A user who upgrades with no stored layout sees Today **pixel-identical** to 1.0.4 pre-change, plus one new `Customize your day` row.
2. Applying a preset, reordering by drag, reordering by button, adding, and removing all survive a full app restart.
3. Signing out and back in as a different identity never shows the previous identity's layout, at any point including first frame.
4. The whole flow is completable with VoiceOver on, without ever performing a drag gesture.
5. With Reduce Motion enabled, no reorder is animated and every reorder still works.
6. Every module `id` in the catalog resolves to an existing file under `mobile/app/`.
7. No streak, count, score, percentage, or progress indicator renders inside `Your day`.
8. `Your day` never exceeds 6 modules regardless of stored payload.
9. Zero new entries in `mobile/package.json` dependencies.

---

## 10. Test matrix

Existing suite is node/vitest source-contract + pure-logic. Follow it.

**New — `tests/wellbeing/home-layout.test.ts` (pure logic):**
| Case | Expect |
|---|---|
| `parseHomeLayout(null)` | mixed preset, `presetId: 'mixed'` |
| `parseHomeLayout('{not-json')` | mixed preset |
| `version: 99` payload | mixed preset |
| order containing `'deprecated-tool'` | dropped, others keep relative order |
| order with duplicates | collapsed, first occurrence wins |
| order of 9 valid ids | truncated to 6 |
| catalog gains a module, stored order lacks it | stored order unchanged |
| `moveModule(order, i, -1)` at index 0 | returns input unchanged |
| `applyPreset('growth')` | exact `['reflect','goals','library','journal']`, `presetId: 'growth'` |
| every catalog `route` | unique across the catalog — no two modules share a destination |
| every preset's IDs | all present in the catalog; length ≤ 6 |
| any manual mutation after a preset | `presetId === 'custom'` |
| round-trip `serialize`→`parse` | identity |
| every catalog `route` | resolves to an existing file under `mobile/app/` |

**New — `tests/mobile/home-customization-contract.test.ts` (source contract):**
- `app/(tabs)/index.tsx` gates the module zone on `layoutOwnerKey === ownerKey`.
- `app/(tabs)/index.tsx` contains no `streak`, `%`, `count`, or progress-ring token inside the `Your day` section.
- `app/customize-day.tsx` contains `isReduceMotionEnabled`, `reduceMotionChanged`, `announceForAccessibility`, `PanResponder`, and move-up/move-down accessibility labels.
- `app/customize-day.tsx` contains no `maxFontSizeMultiplier`.
- `package.json` has no `react-native-reanimated`, `react-native-gesture-handler`, or `*draggable*` dependency.

**Extend existing:**
- `tests/mobile/owner-isolation-screens.test.ts` — add the layout owner gate.
- `tests/wellbeing/go-to-actions.test.ts` — the existing "every cleanup file includes `clearGoToActions`" assertion pattern, replicated for `clearHomeLayout` across the same five files.
- `tests/mobile/core-design-contract.test.ts` — add an assertion that Today still renders exactly one `<MoodPicker` and one `<AdvisorHomeCard`, so customization can never introduce a second focal point. **This is an addition, not an amendment; no existing assertion in that file is relaxed.**
- `tests/mobile/navigation.test.ts` — `/customize-day` reachable from Today; back returns to Today.

**QA release gate (`mobile/qa/ios-release-checklist.json` + `mobile/scripts/qa-release-gate.mjs`):**
- Add `customize-day` to `routes`.
- Add to `REQUIRED_ROUTE_CONTROLS`: `dashboard` gains `'customize-day'`; new `'customize-day': ['preset-apply', 'move-up', 'move-down', 'remove-module', 'add-module', 'reset-mixed', 'save', 'discard-unsaved']`.
- Add a workflow row `home.customize-layout` with `deviceRequirements: ['physical-iphone']` and `identityRequirements: ['fresh-anonymous', 'email-owner']` — physical-device drag cannot be simulator-verified.
- **All four `EXPECTED_INVENTORY` values must be recomputed, not two.** Current frozen values are `{routes: 35, routeChecks: 698, workflows: 110, total: 808}`. `routes` → 36; `routeChecks` moves by the 8 new `customize-day` controls **plus** the 1 added to `dashboard`; `workflows` → 111; `total` is the sum. Derive them by running the gate rather than hand-arithmetic — the script computes the inventory and will report the mismatch.
- Recompute `EXPECTED_CHECKLIST_SHA256` (currently `1e969c45…`) and bump `checklistVersion` from `2026-08-14.2`.

---

## 11. Anti-clutter rules (binding)

1. **Zone 5 only.** Nothing above `Your day` is ever customizable, removable, or reorderable.
2. **Rows only.** A Today module is a `ListRow` that navigates. Never a card, chart, dashboard, form, or embedded widget. `go-to` chips are the single, bounded exception.
3. **Hard cap 6.** Enforced at parse, at add, and at render.
4. **No numbers on Today.** No streak, count, score, percentage, ring, or badge inside a module. Non-negotiable.
5. **Static descriptions.** Module copy is a catalog constant. Never personalized, never a status readout.
6. **Never auto-add.** No release, no heuristic, no Advisor, no engagement rule may add a module to a user's Today. The user is the only mutator.
7. **Default is today.** `mixed` = `['together']`. If a future proposal wants to enrich the default, it is a separate decision requiring the same panel.
8. **Editor is elsewhere.** No inline edit mode, no long-press-to-edit, no wobble state on Today itself.
9. **No preset claims.** Preset sub-copy lists contents. It never says optimized, recommended, best, or personalized.
10. **One focal point.** Exactly one primary check-in and exactly one next action remain on Today, enforced by contract test.

---

## 12. Implementation order

1. `mobile/lib/wellbeing/home-layout.ts` (pure) + `tests/wellbeing/home-layout.test.ts` — no UI.
2. `mobile/lib/home-layout-storage.ts` + wire `clearHomeLayout` into the five cleanup sites.
3. Today renders the stored order behind the owner gate; add the `Customize your day` row. Default path verified pixel-identical.
4. `mobile/app/customize-day.tsx` with move-up/down buttons only — fully functional, no drag.
5. Add `scrollEnabled` to `AppScreen`, then `PanResponder` drag with the arbitration rules in §4 and the reduced-motion branch.
6. Observability enum members **and** the `operational_events` CHECK-constraint migration, together in one change.
7. QA gate: checklist rows, all four `EXPECTED_INVENTORY` values, checklist SHA, `checklistVersion`.

Steps 1–4 are independently shippable. If the release train tightens, cut at step 4 and ship without drag — buttons already satisfy every acceptance criterion except #2's drag clause.
