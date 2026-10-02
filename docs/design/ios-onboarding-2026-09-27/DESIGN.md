# MHtoolkit iOS: From First Visit to Useful Support

Date: September 27, 2026
Status: User selected option 1, Guided Start. Its native welcome, three tool handoffs, skip/name behavior, and standard-size visual comparison are verified locally. Wider device and signed-release QA remain incomplete.
Scope: The proposal covers iOS onboarding, first useful action, Today/Advisor continuity, later personalization, and low-energy behavior. The current implementation slice is the selected welcome, its direct tool routes, and skip/save behavior. No web redesign, release, or outreach in this pass.

## Selected Direction: Guided Start

The user selected the first displayed concept, `concept-guided-start.png`. Keep its connected three-choice list, live first-step preview, optional collapsed name, and contextual primary action. Remove the generated quote and extra reassurance copy.

Unlike the action-first alternative below, Guided Start explicitly saves one Advisor priority when the user confirms. The preview discloses that priority. It does not infer a second priority, change low-energy essentials, enable AI context, create a task, or mark a task complete. Confirmation opens Mood, Habits, or Goals directly; the optional full profile editor remains in Settings.

The broader journey proposal below is not a claim that every section is implemented or verified. Current evidence is in `GUIDED-START-QA.md` and the latest section of the project-root `design-qa.md`.

## 1. Product Decision

Help a person find something useful before asking them to configure a system.

The first session succeeds when someone can choose and use a relevant tool with little effort. Completing a profile, accepting notifications, granting AI access, or creating an account is not the success event.

MHtoolkit remains a mental-health support app. Routines and goals are ways of supporting everyday life, not a pivot into productivity scoring. The experience should also work for someone who wants to explore, stop, or do nothing more today.

Recommended interaction model: an optional action-first introduction, followed by contextual personalization. Preserve the existing cream, forest-green, serif, and botanical identity. Do not add another onboarding layer over the current one.

## 2. Who and What We Are Designing For

| Situation | Need | Product response |
| --- | --- | --- |
| Overwhelmed or unsure where to begin | A small choice without pressure | A few plain-language starting actions and a clear exit |
| Wants more structure | A routine that fits real life | Choose one existing habit or create a small, editable one |
| Something important is stalled | Help finding a next step | Work with a named goal, not generic motivation |
| Returning after a gap | Continuity without a reprimand | Resume, resize, reschedule, or leave the previous step |
| Curious but unwilling to share | Useful tools without extra disclosure | Explore anonymously without optional AI, Health, or reminders |
| Has limited energy today | Less to process | One chosen action and selected essential tools, not a different identity |

Non-goals: diagnostic intake, personality scoring, clinical triage questionnaires, a feature tour, automatic health monitoring, or a claim of continuous human support.

## 3. Evidence From the Current Native Preview

Captured and inspected in Device Hub on the MHtoolkit Redesign Preview, iOS 26.4. This was the existing development client loading local code, not a new TestFlight artifact. Observations below are visual/navigation evidence only.

| Step | Screen | Health | Finding |
| --- | --- | --- | --- |
| 1 | Advisor | Needs hierarchy changes | Large branding and a notification-off fact precede the useful action; Start is below the initial viewport. |
| 2 | Tune Advisor | Too much upfront configuration | Name, four focus choices, ranked priorities, tone, and essentials form a long preference screen. Useful as later settings, not first value. |
| 3 | Today | Coherent brand, repeated task | The mood row is followed by an Advisor suggestion to choose a mood emoji; this duplicates the immediate task. The large hero delays chosen tools. |
| 4 | Short welcome | Promising structure, incomplete payoff | Optional name, three choices, and skip are clear. The CTA describes saving setup, not what the person can do next. |

Screenshots in actual capture order:

![Current Advisor](/Users/ibrobaba/codex/mhtoolkit/docs/design/ios-onboarding-2026-09-27/01-current-advisor.png)

![Current personalization settings](/Users/ibrobaba/codex/mhtoolkit/docs/design/ios-onboarding-2026-09-27/02-current-settings.png)

![Current Today](/Users/ibrobaba/codex/mhtoolkit/docs/design/ios-onboarding-2026-09-27/03-current-today.png)

![Current short welcome](/Users/ibrobaba/codex/mhtoolkit/docs/design/ios-onboarding-2026-09-27/04-current-welcome.png)

Additional source-grounded concerns, not newly demonstrated UI failures:

- A present-tense choice currently saves enduring priorities. For example, selecting steadiness also assigns sleep and grounding without separately asking.
- Skipping currently waits for persistence. A storage failure must not trap someone in optional setup.
- A name entered before skipping is not saved. That needs explicit behavior, rather than a silent surprise.
- Detailed setup combines supportive tone and action size; those should be separate concepts.
- Today and Advisor must agree about whether a step is merely suggested, accepted, started, or actually completed.
- Current accessibility text reports five visible tabs using positions in a six-tab set. Verify and correct the accessible tab order during implementation.

## 4. Proposed Journey

### Entry Rules

- New user: offer the selected optional entry pattern once after app launch; do not add a mandatory splash delay.
- Existing user with activity or a saved profile: open the expected screen. Do not replay onboarding after an update.
- User who skipped: do not repeat the welcome banner on every launch. Keep Personalize Advisor available in You and Advisor.
- Notification or deep link: preserve its destination. Do not intercept it with setup.
- Immediate support: the existing Support action remains reachable without setup or account creation.

### Step A: Choose Something Useful

Preferred copy for an action-first entry:

- Heading: "Start with something small."
- Supporting copy: "A place to check in, find your footing, and move at your own pace."
- Action: "Check in with myself" / "Name how you feel, without having to explain."
- Action: "Make one routine easier" / "Choose a small habit that fits your day."
- Action: "Take a step on a goal" / "Find a manageable place to begin."
- Alternative: "Explore all tools"
- Existing account: "Already have an account? Sign in"

No choice is preselected. Selecting a row opens its activity; it does not create an object, mark anything complete, infer a diagnosis, or grant AI access.

For the focus-first visual alternative, use one selection screen and an explicit contextual action such as "Choose my habit." Do not ask the same question again in the next screen.

### Step B: Do One Actual Thing

| Path | With existing data | Without existing data | Useful outcome |
| --- | --- | --- | --- |
| Check in | Present the usual mood tool, with recent state accurately labeled | Same emoji tool; details optional | A successfully saved check-in, or another chosen tool used |
| Routine | Choose an active habit; retain its actual schedule | Enter a small action and optional cue, such as "After lunch"; add a custom action | A deliberately saved habit or an explicit completion of an existing habit |
| Goal | Choose an active goal and an unfinished milestone | Enter a goal and one optional next step; dates, notes, tags, and files stay optional | A saved goal/next step, or deliberate work on the selected target |
| Explore | Open the existing Tools catalog with search and categories | Same | A user-selected tool, without personalization being required |

Keep the full editors available through "More options," but do not put every field in this initial path. Native date/time pickers apply if the user adds dates; no forced typing.

Do not auto-create a demo habit, a fictional goal, or a deadline. Template suggestions are previews until the person saves. Opening Goals or a timer is not completion of a goal.

If the person does not want a mood check-in, offer a route to grounding, reflection, or all tools without treating the check-in as a gate. Grounding is one tool, not the answer to every low mood.

### Step C: Acknowledge What Actually Happened

Use the relevant acknowledgement: "Check-in saved," "Habit added," "Next step saved," or "Practice finished." Never use a generic "First step complete" for setup or navigation.

Optional follow-through appears inline, not as another mandatory screen:

- "Would you like Advisor to prioritize routines?" with "Remember this focus" and "Not now."
- "What should we call you?" is optional and independently savable. Prefer a collapsed name row or later You setting; do not open the keyboard automatically.
- A relevant "Remind me" action can request a schedule and then notification permission.

Do not show all three requests at once. Present at most one contextual invitation; keep the rest in settings. A user can return to Today immediately.

### Step D: Today

Hierarchy at standard iPhone type size:

1. Compact brand/support row and greeting, optionally using the explicitly supplied name.
2. Compact emoji check-in. A saved state should not demand another check-in.
3. One current or suggested step with an exact target and visible Start/Continue action.
4. The user's selected tools in their saved order. Do not arbitrarily cap this list to two.
5. Persistent native tab navigation: Today, Mood, Advisor, Tools, You.

The botanical artwork remains an accent, not a large container above every task. Quotes are optional and secondary. Avoid duplicate mood recommendations immediately below the mood selector. Do not use notification permission state as the headline of a daily brief.

### Step E: Advisor

Advisor is the place for synthesis and follow-through; Today is the quick entry point. They share one action state, not two competing plans.

The main Advisor view contains:

1. A compact name/title row and visible "Tune" control.
2. One brief: a short explanation grounded in the current focus and authorized, available information.
3. One next step: verb, real target, realistic size, and exact destination.
4. A primary Start/Continue action, followed by "Make it smaller" and "Something else."
5. Collapsed "Why this suggestion?" and "Your patterns" sections.

Put deeper resources, feedback history, and optional chat below or behind a disclosure. Do not stack a large introduction, summary card, recommendation card, explanation card, and permission banner above the action.

Example using fictional test data: "You chose to work on your course assignment. Your next step is to outline the introduction. Would five minutes fit today?" This is only valid if the selected goal/milestone exists; the example must never become fabricated user context.

### Step F: Returning and Adjusting

- Started step: "Continue" returns to the actual target and preserves its state.
- Done: acknowledge the completed object or explicit user report; optionally ask whether it was useful.
- Partly done: keep the remainder available; do not reset progress.
- Not yet: offer smaller, later, or leave it. Do not count silence as failure.
- Not for me: offer a different approach and optional explanation; do not repeatedly recycle the rejected suggestion.
- Returning after a gap: present the saved step without loss-framed language or broken-streak pressure.
- If a goal was deleted or completed elsewhere, resolve that before navigation. Never open a stale target or manufacture completion.

## 5. What Personalization Actually Means

Separate these concepts in data and in copy:

| Input | Effect | What it does not authorize |
| --- | --- | --- |
| Immediate starting action | Chooses the current route | Permanent priorities or optional data sharing |
| Remembered focus | Ranks future suggestions | Automatic creation/completion of tasks |
| Selected goal or habit | Anchors suggestions to a real object | Editing that object without confirmation |
| Preferred name | Changes greetings | Sending the name to an AI provider automatically |
| Support style | Changes wording | Inferring energy, capacity, or diagnosis |
| Current capacity/low-energy choice | Reduces task size and visible density | Deleting layout choices or overriding priorities |
| Optional feedback | Adjusts future suggestions | A claim of mental-health improvement |
| Health/other context selection | Allows only the specified use | Partner sharing, broader AI sharing, or continuous monitoring |

Detailed personalization belongs in You > Advisor preferences and remains reachable from Advisor > Tune. Save returns to the originating screen, not always Advisor. Use ordinary grouped rows for Name, Focus, Priorities, Support style, Low-energy essentials, Context, and Reminders. Open one editor at a time instead of showing one long form.

Show the meaning of ranked priorities. Provide accessible move-up/down controls, not only drag reordering. Do not silently reject a fourth selection or a deselection; explain the limit and how to replace a choice.

Reuse the existing Advisor profile and migration mechanism. Do not create a second preference store with different answers. A session choice and an unsaved draft need distinct states from an explicitly saved enduring preference.

## 6. Low-Energy View

This is a user-controlled presentation and effort mode, not a clinical inference.

- Keep one selected/current step, with a smaller alternative or "Leave this for later."
- Show only the essential tools the person chose. If none were chosen, allow using any tool without inventing a grounding preference.
- Hide optional quotes, expanded charts, large art, setup prompts, and extra resource suggestions.
- Keep Support, the full Tools catalog, and the off switch reachable.
- Do not erase/reorder the normal layout; switching off restores it exactly.
- Do not turn it on solely because someone chose Low mood or gentle language.
- Do not let hiding a section mark it complete or dismiss its data.

## 7. Consent, Trust, and Failure States

The first usable action does not depend on optional AI processing. An explicit AI action can offer additional synthesis, but the actual recipients and data categories must be explained before transmission. Keep a useful non-AI path.

Health authorization, sharing a Health summary with AI, voice recording/transcription, reminders, partner sharing, and saving a focus are separate decisions. Data not selected is not transmitted. Do not fabricate provider names in copy: derive the real destinations from the deployed integration, including fallbacks.

Avoid repeated disclaimer banners. Put concise explanations at the decision where they matter, with details available on demand. Label local suggestions, cached AI guidance, fresh AI guidance, and unavailable guidance honestly. Never describe a deterministic fallback as a fresh AI answer.

| State | User-facing behavior |
| --- | --- |
| Save fails | Keep draft and old saved state; show "Not saved" with Retry and Continue without saving |
| Skip persistence fails | Leave setup anyway for this session; do not trap the user |
| Slow request | Keep back/exit working; provide retry rather than an indefinite spinner |
| Offline, existing session | Use only authorized cached data and label freshness; distinguish local save from sync |
| Offline, first use | Proposed improvement: a bundled non-recording tool can open without creating a network identity; current auth initialization does not yet guarantee this |
| AI unavailable/declined | Retain ordinary tools and the last relevant step; do not repeatedly prompt |
| Missing Health data | State that no usable data is available; do not interpret missing records as zero sleep or zero activity |
| Account change | Clear previous identity's greeting, drafts, advice, and consent surface before showing the new identity |
| Anonymous account upgrade | Preserve/merge through the existing explicit flow; never overwrite a signed-in profile or broaden consent silently |
| Late save/AI result | Cannot overwrite newer edits, move someone who left the flow, or leak into a different account |
| Unsupported profile version | Preserve it and explain recovery; do not silently reset and overwrite it |

Settings must accurately distinguish device-local preferences from synchronized account data. Do not promise cross-device onboarding/profile persistence until implemented and tested.

## 8. Visual and Interaction Specification

- Existing palette: background `#f6f2e7`, text/primary `#163a32`, card `#fffef8`, selected tint `#edf4ea`, muted text `#4d655d`, accent `#a94d33`.
- Typography: keep Georgia for editorial titles and the existing native sans serif for controls/body. Target 28-30 pt primary heading and 16-17 pt decision/body text at default size; scale with Dynamic Type.
- Layout: 20-24 pt horizontal margins, 8 pt spacing rhythm, natural vertical reflow. Dividers before boxes; one emphasized action area, not nested cards.
- Buttons: minimum 44 x 44 pt hit area, usually 50-54 pt height for primary actions. No overlapping targets.
- Selection: checked state plus tint, not color alone. No automatic advancement after radio selection.
- Large text: allow multi-line options, stacked actions, scrolling, and image removal. Do not shrink text to preserve a mockup's composition.
- Keyboard: no automatic focus. Keep the field, validation, back, and exit reachable. Done dismisses the keyboard instead of silently saving or consenting.
- Motion: brief native transitions; no artificial loading delay. Reduced Motion removes decorative movement without withholding content.
- Names: preserve case, accents, scripts, hyphens, apostrophes, and composed characters. Neutral greeting when blank; independently clearable. No account-provider name imported without an explicit choice.
- VoiceOver: label, description, checked state, and group position for choices; meaningful heading on entry; errors/save state announced once; decorative artwork ignored.
- iPad: readable single-column content width, with touch/keyboard behavior tested; do not stretch the phone form across the full display.

## 9. Visual Concepts and Decision

Three independent concepts were generated from the actual current screenshots. They are not implemented screens or final production assets.

| Display order | Concept | Main tradeoff |
| --- | --- | --- |
| 1 | Guided Start | Explicit selection and next-step preview, but one extra configuration action |
| 2 | Try First | Direct entry into a useful activity; enduring personalization is deferred |
| 3 | Start in Today | No separate onboarding gate; more competing elements on the first screen |

Working recommendation: use the action-first interaction for new users, while keeping an unobtrusive personalization entry for existing users. Visual selection remains the user's decision, not a completed approval.

Concept files:

- [Guided Start](/Users/ibrobaba/codex/mhtoolkit/docs/design/ios-onboarding-2026-09-27/concept-guided-start.png)
- [Try First](/Users/ibrobaba/codex/mhtoolkit/docs/design/ios-onboarding-2026-09-27/concept-try-first.png)
- [Start in Today](/Users/ibrobaba/codex/mhtoolkit/docs/design/ios-onboarding-2026-09-27/concept-start-in-today.png)

Visual quality notes before implementation:

- Guided Start contains generated extra reassurance and a quote not requested in the copy specification. Remove these; the shorter specified copy is authoritative.
- The name action in Guided Start must explicitly say Optional.
- Try First needs a less prominent botanical crop and platform-consistent line icons; the actions themselves are buttons, not decorative labels.
- Start in Today is a first-visit example. The two sample tools do not imply a limit on selected tools. Keep the saved full tool list in real use.
- All concepts require real native safe-area layout, text scaling, contrast measurements, and screenshot comparison at equal viewport size. Image pixels are not measured tappable points.
- Do not use a whole generated screen as a runtime image. Build accessible native components; reuse production brand assets.

## 10. Research Basis and Limits

The following support design principles, not claims that this particular onboarding or app is clinically effective:

- Apple recommends brief optional onboarding, learning through interaction, and contextual instruction: [Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding?changes=_7).
- Apple recommends explaining data collection and permission requests in context: [Design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles) and [User privacy and data use](https://developer.apple.com/app-store/user-privacy-and-data-use/).
- Apple describes accommodating user-selected text sizes through scaling and adaptation: [Get started with Dynamic Type](https://developer.apple.com/videos/play/wwdc2024/10074/). Touch targets are grounded in [UI design tips](https://developer.apple.com/design/tips/).
- NICE's behavior-change guidance includes collaboratively agreed goals, action planning, feedback, monitoring, and tailoring support to individual needs: [PH49 recommendations](https://www.nice.org.uk/Guidance/PH49/chapter/recommendations).

Our choice to use an action-first entry and to defer enduring preferences is a product hypothesis informed by those sources. It still needs usability evaluation with intended users. A goal/habit completion is not a measured change in mental health. Do not reuse broad efficacy claims in launch copy.

## 11. Expert Review Record

- Product-strategy reviewer, read-only: identified over-inference from one welcome answer; recommended action before enduring profile, with optional follow-through and feedback.
- iOS interaction/accessibility/trust reviewer, read-only: specified unconditional skip, drafts, origin-preserving navigation, identity isolation, consent separation, and detailed accessibility criteria.
- Lead review: inspected current native screenshots and navigation, synthesized the proposal, checked brand continuity, and recorded concept defects rather than presenting them as final.
- Claude Opus: attempted via installed CLI; it returned "Not logged in". No Claude design approval occurred.

The reviews are product/source reviews, not clinical evaluation, physical-device QA, or proof that all described behavior already works.

## 12. Validation Before Calling It Finished

First test the selected prototype with a small formative group of intended users, including people who use large text or assistive technology. A first round of 5-8 participants is a practical research plan, not a statistically conclusive study. Do not require diagnoses or sensitive history to participate. Offer stopping and skipping.

Core usability tasks:

1. Find and start something useful without creating an account or granting optional permissions.
2. Try each entry path and explain what it will do before activating it.
3. Choose a goal/routine and see how it changes the next suggestion.
4. Skip setup, return later, and find personalization without being nagged.
5. Make a step smaller, leave it, and return without losing work.
6. Change a focus and optional name, then confirm Today and Advisor agree.
7. Decline AI and reminders while continuing ordinary tools.
8. Enable low-energy view, find the chosen essentials, and restore the original layout.

Capture whether the task succeeds unaided, where people hesitate, whether the next action is relevant, whether they understand data use, and whether they feel pressured. Time-to-first-action is an observation, not a countdown shown to users. Do not equate task completion or retention with wellbeing.

Implementation acceptance checklist:

- [ ] Three entry paths reach the intended task without another tour or required profile page.
- [ ] Skip works from untouched, selected, name-entered, slow-save, and failed-save states.
- [ ] Name-only save, empty name, clearing, long names, and non-Latin/composed characters work.
- [ ] Draft/back/background/termination behaviors match the promise shown to the user.
- [ ] Save returns to the true entry point; deep links and notifications are not hijacked.
- [ ] Session intent is not silently persisted as ranked priorities.
- [ ] Goal/habit creation is explicit, idempotent on repeated taps, and preserves existing data.
- [ ] No duplicate mood recommendation after a successful check-in.
- [ ] Today and Advisor share the same current action, wording, size, target, and status.
- [ ] Completed/deleted target and interrupted lifecycle recovery are reconciled before Continue.
- [ ] Preference changes do not silently replace an in-progress action.
- [ ] No-data, denied, loading, failure, stale, and offline states are distinct.
- [ ] Offline first-use behavior is implemented or its limit clearly stated; no invented offline claim.
- [ ] No optional AI/Health/notification/share prompt occurs merely because setup was saved.
- [ ] AI data preview and provider disclosures match real request payloads and fallbacks.
- [ ] Revocation and identity change prevent further unauthorized requests and stale UI leakage.
- [ ] Sign-in/anonymous merge preserves correct ownership and does not broaden consent.
- [ ] Every selected Today tool remains available and in saved order.
- [ ] Low-energy mode restores the normal layout unchanged and remains user controlled.
- [ ] Smallest supported iPhone, largest Dynamic Type, keyboard, landscape, and iPad work.
- [ ] VoiceOver focus, choice descriptions, tab positions, labels, and announcements work on device.
- [ ] Controls meet touch-target and measured contrast requirements; no color-only decisions.
- [ ] Reduced Motion does not delay access or require animation.
- [ ] Retry, double taps, save failure, late response, account switch, and app restart have regressions.
- [ ] Exact release artifact receives the existing native QA protocol, not just unit/simulator checks.

Current limitation carried from the previous implementation review: Continue can bypass a pending lifecycle operation. That remains an implementation issue; this design pass did not fix it. Full native behavior, physical-device testing, and the existing release gate remain outstanding.

## 13. Implementation Sequence After Design Selection

1. Refine the selected visual into the complete entry, action, acknowledgement, returning, low-energy, and settings states. Confirm exact copy and data-use behavior.
2. Implement shared intent/draft/preference state and navigation semantics without duplicating profiles or changing unrelated features.
3. Connect existing mood, habit, and goal tools to actual first-use outcomes; fix the known lifecycle recovery issue through the required review process.
4. Connect Today/Advisor continuity and contextual consent, with explicit handling of cached and non-AI content.
5. Run focused automated regressions and native click-throughs, then formative usability/accessibility checks and the exact-artifact release protocol.

No push, App Store submission, or claim of release readiness follows from this document.
