# Illustrated onboarding QA - September 27, 2026

## Artifact and scope

- Repository base: adb6d06b9ed432106507002f89fa9383ff9869d0 plus the dirty local working tree. Not a signed release artifact.
- Native app: com.mhtoolkit.app, Expo SDK 54 development client on iOS 26.4.
- Simulator: MHtoolkit Redesign Preview, 35502CC3-209F-4A8F-AC62-61848F4C53D4.
- Route: advisor-setup?mode=welcome&returnTo=today.
- Web and Android onboarding unchanged. No push, submission, or publication.

## Automated checks

- 70 mobile test files / 616 tests passed after the illustration changes.
- Mobile TypeScript, test TypeScript, targeted mobile ESLint, and git diff --check passed.
- Registry inventory passed: 38 routes, 776 controls, 126 workflows, 902 evidence rows. This is an inventory check, NOT 902 executed tests.
- Motion tests execute the real preference hook with mocked native events, covering stale query, live preference, rejection, and unmount races.
- Artwork tests cover bundled RGBA assets, focus-to-scene mapping, one static Image for unknown/reduced motion, native-driver configuration, and transition cleanup. The harness is not a React Native renderer and cannot prove native animated-property reconciliation.

## Native actions and observations

- No selection: primary action disabled. Each of the three choices updates its radio and illustration. Artwork is absent from the accessibility tree.
- Routine: first action opens the research step, not Habits and not an immediate save. Study details expand; source launches Safari. Wiley's verification page prevented inspecting the full publisher page in that browser; the source PDF was independently researched earlier.
- Change focus: draft name survives, and evidence/next-action copy follows the new focus.
- Optional name: software keyboard opens; name input, final action, and skip are all visibly above it (`15-keyboard-actions.png`).
- Skip with temporary name Preview: returns to Today. Reopened full setup shows blank name and original Feel steadier / Mood / Sleep priorities, confirming the draft was not saved.
- Goal confirmation: opens the loaded Goals screen (`18-goal-handoff.png`), without creating a goal. Reopening full setup shows Build momentum / Goals. Original test preferences were restored via UI and saved.
- Earlier two-step native checks in this work session covered the routine-to-Habits and steady-to-Mood destinations, Support/Back, and saved profile after cold relaunch. Those checks preceded the decorative artwork addition.
- Largest Dynamic Type: decorative art hidden; heading words reflow without splitting after the base-size correction (`16-large-text-heading.png`). Choices, wrapped primary button, and skip are reachable by scrolling (`17-large-text-actions.png`). Selecting Goals and advancing works. Original text size restored.
- Normal motion: native recording `13-illustrated-motion.mp4` shows scene transitions. Short preview `20-illustrated-preview.mp4` is a trimmed/rescaled copy of that recording, not a simulated animation.
- Reduce Motion: `19-illustrated-reduced-motion.mp4` exposed overlapping layers after switching animated opacity to static values. Fixed by replacing the entire animated subtree with one plain Image. After the Mac was unlocked, Settings confirmed Reduce Motion = 1; all three focus choices displayed exactly one matching scene (`23-reduced-motion-fixed.mp4`).
- Motion cycle: Settings confirmed Reduce Motion = 0 and normal crossfade/settle returned (`24-normal-motion-fixed.mp4`). Enabled it again; the routine scene remained single, and switching Goals then Steadier stayed clean (`25-reduced-cycle-fixed.png`). Restored Reduce Motion = 0 and verified the value in Settings. These toggles retained the running app process.
- Final capture `26-illustrated-final.png` shows routine selected with normal motion restored. Full comparison `27-illustrated-final-comparison.png` and focused selector comparison `28-illustrated-final-choice-comparison.png` were generated from this capture and visually inspected. All choices and both actions remain visible. `29-illustrated-final-preview.mp4` is a 17-second trimmed/rescaled native recording from `24`, not a simulated animation.

## Review

- Independent Codex correctness review: original two-step issues included keyboard obstruction, stage accessibility focus, and button-label wrapping; these were patched and rechecked in that unit.
- Artwork review: no static correctness finding in the initial implementation. Native testing subsequently found the Reduce Motion bug. Final review found no bug in the single-Image correction and required the native retest, now completed above. No third review pass was run.
- Claude CLI could not authenticate. Gemini primary and fallback did not return a review. No Opus or Gemini approval is claimed.

## Remaining gates

- Complete physical VoiceOver/assistive gestures, compact iPhone and iPad layouts, and the exact signed-build release checklist separately. No app-wide QA completion is implied.

Current native visual gate: passed for the illustrated onboarding at the tested simulator size, including the documented largest-text and motion checks. Original text size, profile preferences, and Reduce Motion setting restored. Preview left open; no push or release performed.
