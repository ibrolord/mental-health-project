# iOS Personal Onboarding Journey

Status: local implementation and scoped simulator verification complete, but
handoff is blocked by the migration retry finding below. This is not release QA
or an App Store submission. The two-round review limit was reached; permission
to continue fixing this bounded issue was requested before further runtime edits.

Scope: six illustrated screens, local personal-plan persistence, Advisor integration,
Settings editing, sourced evidence, motion, keyboard, and larger text.

Runtime: MHtoolkit Redesign Preview, iOS 26.4 simulator, Expo SDK 54 development client.
Simulator: 35502CC3-209F-4A8F-AC62-61848F4C53D4.

New original artwork: welcome-motivation.png, welcome-obstacle.png,
welcome-evidence.png, welcome-ready.png. Generated with imagegen; transparent
gouache scenes matching the selected Quiet Momentum concept. No rendered text.

Research statistics describe the cited interventions, not MHtoolkit outcomes.
The personal plan is stored on-device and does not expand AI sharing consent.

## Delivered

- Six steps: focus, motivation, obstacle, research, first action/cue, and review.
- Preset and custom answers, optional name, backward editing, and skip without
  saving a draft over an existing plan.
- Settings editing and replay. Saved motivation, action, cue, and obstacle inform
  the local Advisor recommendation/brief. Safety and urgent context keep priority.
- Free-text onboarding answers are excluded from model requests. Existing AI
  consent is unchanged. Profile data is included in local export/deletion paths.
- Single-image reduced-motion rendering, stopped animations on teardown, and
  large-text/keyboard layouts. Illustrations are bundled for offline use.

## Native Verification

Observed in the development client, not inferred from unit tests:

- All three focus options and their different evidence content.
- Custom motivation and obstacle validation; keyboard reachability.
- Preset/custom action selection, empty-action validation, timing-cue disclosure.
- Restored custom action survives reselect, clearing, and replacement.
- Back/edit preserves answers; replay exit preserves the previously saved plan.
- Save opens Advisor without a retained setup header; the saved custom action,
  motivation, cue, and name appear in the brief. Settings edits update it.
- Completed setup does not reopen on returning to Today.
- Reduce Motion enabled in native Settings produces one static illustration.
- Largest Dynamic Type: evidence, commitment, review, name keyboard, and exit.
- Test answers were removed through Settings and the original demo focus,
  priorities, support style, and low-energy essentials restored. Original text
  size and Reduce Motion were restored. Optional AI consent was declined.

## Automated Verification

- Final mobile suite: 74 files, 828 passing tests. The retry sequence identified
  below is not yet covered, so this result is not proof that migration is correct.
- Mobile TypeScript, test TypeScript, targeted ESLint, and diff checks passed.
- iOS Hermes production-mode JavaScript export passed (1,896 modules, 66 assets)
  to `/private/tmp/mhtoolkit-onboarding-journey-ios-export`. This is not a signed
  binary or TestFlight installation. Existing WebRTC package-export warning remains.
- Checklist inventory passes: version 2026-09-27.4, 38 routes, 786 route/control
  checks, 129 workflows, 915 required evidence rows. Inventory validity does not
  mean all 915 rows have been executed.
- Final full repository run: 1,626 pass, three failures in untouched growth
  tests. Two assertions expect website campaign URLs/canonical reconciliation;
  one expects 94 external outreach actions but observes 298. The pre-existing
  dirty `docs/launch/campaign-links.csv` was not edited as part of this work.

## Review And Fixed Regressions

- Unicode plan-ID collision: use full code points rather than surrogate halves.
- Safe-area/header overlap: native welcome owns the safe-area inset and omits the
  redundant stack header. Enlarged first-step artwork after visual comparison.
- Custom action disappeared on clearing/reselect: explicit custom-mode state.
- Completed welcome retained duplicate navigation: dismiss to Advisor.
- Account changed while token lookup awaited: verify owner and session immediately
  before request dispatch; stale-account probes dispatch no requests.
- Profile migration originally lost answers against legacy targets and missed
  subscribers: profile-aware migration preserves explicit target plans/settings.
- Concurrent-save and later-store-failure migration cases were fixed with
  serialized mutations and revision-checked deferred source cleanup. The second
  independent review confirmed those single-attempt cases, but found the retry
  sequence below. No third review loop or additional runtime fix was initiated.

## Open Finding

**P2: migration retry can discard newer anonymous answers.**

`mobile/lib/advisor-profile-storage.ts:99`: copying into a legacy target adds a
personal plan. If another local store then fails, the anonymous profile is kept.
If the user edits that source and retries, the provisional target is treated as
authoritative; finalization deletes the source with its newer answers. The
independent reviewer reproduced the newer answer being absent from both stores.

Required fix: retain provisional-copy provenance, or roll back an unchanged
provisional target after failure. Add copy -> later failure -> source edit ->
retry coverage, preserving newer answers and genuine pre-existing target plans.
This is a blocker for declaring the overall feature ready, even though the
visible onboarding and normal save/replay paths passed.

Independent correctness review cleared the bounded UI/request-ownership fixes.
Claude Opus CLI was unavailable because it was not authenticated; no Claude review
or approval is claimed. Two implementation/test workers and an independent Codex
reviewer were used.

## Evidence

- `01-focus.png` through `06-review.png`: native step screenshots. Some images show
  a deliberately scrolled position; not every option fits above the fold.
- `07-keyboard.png`: custom-answer keyboard.
- `08-advisor-personal-plan.png`: final saved-plan brief and recommendation.
- `10-six-step-motion.mp4`: actual six-step replay and custom-action regression
  check. `09-native-journey.mp4` is an idle intermediate capture, not final proof.
- `12-reduced-motion.png` and `13-large-text-keyboard.png`: accessibility states.
- `14-final-design-comparison.png` and `16-final-choice-comparison.png`: combined
  source/native comparisons after the final art-size fix.
- `15-six-step-preview.png`: contact sheet, not a replacement for individual
  screenshots or interaction evidence.

## Not Verified In This Pass

Physical iPhone/iPad; spoken VoiceOver gestures; compact-device/iPad layouts; all
large-text steps; live provider sign-in and anonymous-account migration; real
export/deletion; cold first-ever identity entry; all release-checklist rows; signed
artifact review. Account/storage failure paths have automated evidence, not a live
multi-account certification. No commit, push, submission, or release performed.
