# Guided Start implementation and verification

Date: September 27, 2026
Status: Implemented locally; selected welcome flow and standard-size visual comparison verified in the native iOS development client. Wider device and release QA remain incomplete.
No commit, push, deployment, TestFlight upload, or App Store submission was made.

## Scope

The user selected the first displayed concept, `concept-guided-start.png`.

- Connected three-choice list, contextual preview and primary action, collapsed optional name, and always-available skip.
- Confirmation saves only the disclosed priority and optional name; existing low-energy preferences remain unchanged.
- Routes: Feel steadier -> Mood; Build a routine -> Habits; Make progress on a goal -> Goals.
- Opening a tool does not create a goal/habit, record a check-in, or mark an activity complete.
- No AI call, data-sharing consent, notification permission, Health permission, or account requirement added.
- Skip does not wait for storage; session dismissal is owner-isolated. A typed but unconfirmed name is not saved.
- In-flight writes are owner-isolated. Duplicate taps, stale cleanup, owner changes, and leaving during a save cannot cause late navigation.
- This does not implement every later-stage feature in DESIGN.md.

## Automated evidence

All commands below exited zero after the final source changes, including the botanical sizing and large-text name-row fixes. The mobile test run began at 16:20:41 local time:

| Check | Result |
| --- | --- |
| `./node_modules/.bin/vitest run tests/mobile --reporter=dot` from repo root | 68 files, 597 tests passed |
| `./node_modules/.bin/tsc --noEmit` from mobile | Passed |
| `./node_modules/.bin/tsc -p tsconfig.test.json` from repo root | Passed |
| Mobile ESLint on AdvisorWelcome, advisor-setup, advisor-onboarding, and Today | Passed, no warnings |
| `git diff --check` | Passed |
| `node mobile/scripts/qa-release-gate.mjs inventory` | Checklist 2026-09-27.2 passed: 38 routes, 771 controls/route checks, 126 workflows, 897 evidence rows |

The release inventory now includes the name disclosure, support, back, stalled storage, account switching during saves, and VoiceOver/Dynamic Type checks. Inventory validation is not execution of these 897 checks.

## Independent review

Codex reviewer Kant reviewed this implementation unit twice. First pass found two bugs: Today dismissal held the Advisor interaction lock during persistence, and a pending save could lock a different account's setup. Both were fixed.

Second pass reported no remaining findings in scope. Its source-handler harness verified nonblocking skip, concurrent owner isolation, double-tap prevention, stale-token cleanup, blur/refocus, and skip during a pending save. The verdict covers these code paths, not native release readiness.

Claude Opus was unavailable because its CLI was not logged in. Gemini 3.1 Pro and the required 2.5 Flash fallback also required authentication; neither completed a review. No Claude/Gemini approval is claimed.

## Native observations and limits

Device Hub: MHtoolkit Redesign Preview, iOS 26.4, simulator ID `35502CC3-209F-4A8F-AC62-61848F4C53D4`. Existing development client, not a newly built release binary. Metro was restarted and `GET http://127.0.0.1:8081/status` returned exactly `packager-status:running`.

The earlier locked-Mac blocker was cleared. The following were executed through native UI, not inferred from source or unit tests:

| Interaction | Observed outcome | Evidence |
| --- | --- | --- |
| Initial welcome | Three unselected choices; primary disabled; no keyboard | Native accessibility state |
| Select routine | Checked radio, habit preview, disclosed priority, and Choose my habit | `19-guided-start-final.png` |
| Support and native Back | Resources opened; Back retained the selected welcome choice | Native accessibility state; no support service contacted |
| Optional name | Expanded, typed Preview, used keyboard Return/Done, collapsed with draft retained | Native accessibility state |
| Skip with unsaved name | Continue without saving returned to Today; greeting did not contain Preview | Native accessibility state |
| Confirm routine | Habits opened with 0/0 and empty state; no habit auto-created | `10-habits-handoff.png` |
| Confirm goal with name | Goals opened; returning Today showed Good afternoon, Preview and a goal-focused suggestion | `11-goals-handoff.png` |
| Cold relaunch | Terminated and launched the native app; saved name/focus remained, welcome was not forced | `12-name-focus-persisted.png` |
| Confirm steadiness | Mood opened with 0 check-ins; no check-in auto-created | `13-mood-handoff.png` |
| Restore preferences | Cleared test name; restored steadiness, Mood then Sleep, Gentle, and Grounding; neutral greeting returned | Native setup and Today accessibility state |
| Largest Dynamic Type | Header decoration hidden, choices readable, routine selectable, actions scroll-reachable, skip returned to Today | `16-largest-text-top.png`, `17-largest-text-actions.png`, `18-largest-text-choice.png` |
| Return to standard text | Original `large` text setting restored; final welcome remained readable with both actions visible | `19-guided-start-final.png` |

No mood, habit, or goal records were created by this test. The preview's original preference values were restored, but its setup is now marked completed after the deliberate save tests. Storage was not destructively reset to manufacture a first-run state.

Visual iterations:

1. First pass (`05` through `07`) revealed skip below the initial viewport and an interior rectangular artwork edge. Spacing and full-width artwork framing were revised.
2. Post-unlock capture `08` confirmed the visible skip but revealed that the image lacked an explicit rendered size. An explicit frame with full-width/full-height image restored the existing botanical asset (`09`).
3. Largest text exposed the Optional label squeezing Add your name into broken word fragments. Stacking those labels at accessibility sizes corrected this (`17`); source-contract assertions preserve that branch.
4. Final native capture `19` and combined source/native comparisons `20` and `21` were inspected after the last source edit. No actionable P0/P1/P2 visual issue remained in this standard-size selected welcome state.

Still required before broader QA or release claims:

- Failed/stalled storage and owner-switch native integration checks; only automated source/handler coverage exists for these paths.
- Physical VoiceOver gesture and announcement execution. Accessibility-tree labels are not a VoiceOver pass.
- Smallest supported iPhone and iPad layouts, and a complete keyboard/form sweep at accessibility sizes. The largest-text check covered the welcome choices/actions, not every screen.
- Exact signed-artifact release QA. The release verifier has not passed; these captures are from a development client, not a new TestFlight build.

Unrelated known pre-existing issue remains documented in `docs/qa/ios-onboarding-2026-09-27.md`: interrupted Advisor completion recovery can expose a completed step through Today. This welcome change does not fix or certify the broader Advisor lifecycle.

## Source fingerprints

Base commit: `adb6d06b9ed432106507002f89fa9383ff9869d0`, plus the existing uncommitted work and this change. SHA-256 values bind this report to the current source, not a signed artifact:

```text
ffd72ae046d7ef168da9742c0289e41122a8fbe42514191dc717b221cf800017  mobile/components/AdvisorWelcome.tsx
bbd998a83b93acfaa2983e8e5a5ab4c69ffb9c116bd938c062b4594a82e9a9df  mobile/app/advisor-setup.tsx
c748d7900af31cab78102e9b505b4d0491f7ada09c282720f100feb482b58d4f  mobile/lib/advisor-onboarding.ts
fd3f0bd16f9902267d65accd895c51a3018306960635ae1ac8158bb694eb95a1  mobile/app/(tabs)/index.tsx
c9a8acf6a105d1706dafaaaf6da7bceed6ae37976831236fc528cdd9a2329076  tests/mobile/advisor-welcome-contract.test.ts
```
