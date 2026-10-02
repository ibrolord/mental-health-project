# iOS onboarding implementation and scoped verification

Status: local implementation, not release-ready. Not committed, pushed, or submitted.

## Scope

- Optional Today invitation opens a short support-focus setup with an optional name.
- Three choices reuse the existing Advisor profile: steadier, manageable routine, follow-through.
- Explore for now persists per owner without marking personalization complete.
- Completed profiles do not repeat onboarding. Advisor no longer forces setup on entry.
- Today uses the shared recommendation engine and existing cache, with no new model call or consent prompt.
- Today and Advisor share the explicit action-start coordinator and gentle-step sizing.
- Existing home layout and anonymous access remain intact. Settings links to the full Advisor editor.
- Profile writes no longer publish optimistic success before persistence.

## Automated checks

- `node node_modules/typescript/bin/tsc --noEmit -p mobile/tsconfig.json`: pass.
- `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.test.json`: pass, including the final read-model test file.
- ESLint on changed mobile sources: pass, no warnings in the final run.
- Mobile suite: 579 passed at the checkpoint before the five read-model tests were added.
- Mobile + AI + selected account-boundary suites: 733 passed at that checkpoint.
- `tests/mobile/today-advisor.test.ts`: five additional read-model tests passed.
- `git diff --check`: pass.
- QA inventory: 38 routes, 768 route/control rows, 124 workflows, 892 total required evidence rows. Existing physical-device release requirements were preserved.

These automated results do not establish native functional QA or App Store readiness.

## Native observations

Device: MHtoolkit Redesign Preview, iOS 26.4, simulator UUID `35502CC3-209F-4A8F-AC62-61848F4C53D4`.

Installed development client: 1.0.7 (1), Expo SDK 54. Native debug dylib SHA-256:
`14bde4a60427dd4d62c31d703e76aab35ea97101a324db0eed6a80b9eb1f277c`.

Source base: `adb6d06b9ed432106507002f89fa9383ff9869d0` plus the current uncommitted onboarding changes. This is not a new signed release artifact.

Expo `run:ios` could not recognize the new Device Hub app. The existing compatible development client was connected to Metro via its development URL. Metro `/status` returned `packager-status:running`; the iOS bundle loaded successfully. Actions below were executed through native UI automation, not inferred from source:

1. Today rendered the botanical header, emoji check-in, optional setup card and existing tool choices.
2. Choose my focus opened the short setup screen; Continue was disabled with no focus selected.
3. Each of the three focus choices was clicked. Selecting a new one deselected the previous one and enabled Continue.
4. Explore for now returned to Today and removed the setup invitation without saving the selected focus as a completed profile.
5. The Advisor tab opened its loading state after skip. The Mac locked before the final rendered Advisor result could be observed.

The final hydration/quote-clamp refinements have not been re-observed in the simulator.

## Review and remaining work

Independent correctness review, pass one: four findings addressed (read-side mutation after owner cleanup, repeated alternate suggestions, inconsistent gentle-step sizing, missing Settings entry).

Pass two: one unresolved P2. `mobile/lib/advisor-start.ts` returns immediately for an `in_progress` action. If a previous completion recorded its outcome but action removal failed, Today can continue the already-completed action before Advisor replays the lifecycle journal. Recommended fix: reconcile on the explicit start/continue path, reload and validate the action, then navigate only if it remains current. Add a fault-injection regression. Approval requested under the project's two-pass review rule; no third review loop was run.

Claude Opus could not review because its CLI was signed out. Gemini primary and fallback could not complete authentication; their task-owned processes were stopped. No Claude or Gemini approval is claimed.

Still required after approval/unlock:

- Fix and test interrupted completion recovery.
- Save name/focus from welcome and verify persistence across a native reload.
- Verify skip persistence and no forced setup after a native relaunch.
- Start/continue/review the same saved action from Today and Advisor.
- Reconfigure in Settings and confirm Today updates.
- Save a mood and observe the refreshed suggestion.
- Toggle low-energy and verify essentials plus restoration of the full saved layout.
- Test native back, keyboard, offline/error and larger-text states on the final bundle.
- Full exact-artifact physical-device release gate remains separate and unexecuted.

Pre-existing `docs/launch/campaign-links.csv` changes were left untouched.
