# Onboarding and Advisor integration verification

## Scope

Integrated local onboarding, personal-plan follow-through, and landing-page work
from `c1f79f1` with remote `main` at `b59dd41`. Retained tool-completion writeback,
completion acknowledgement, feedback, owner isolation, and both QA inventories.

## Corrections during integration

- Display safety guidance before serialized lifecycle and notification work.
  Failed or stalled reminder cleanup cannot hide support on foreground refresh.
- Refresh a provisional anonymous-profile copy when the source changes during
  sign-in. Retry finalization once; preserve explicit target edits and restore
  anonymous authentication if safe finalization is still impossible.
- Use the same recommendation exclusions and personal-plan cache precedence on
  Today and Advisor so completed or negatively rated steps are not resurfaced.
- Pass the saved Advisor action ID when grounding starts from Today, allowing
  the tool completion to close the intended step.
- Clear stale active-step and brief state before showing completion feedback.
- Update campaign tests to distinguish canonical direct links from attributed
  links without widening the URL or attribution allowlists.

## Verification

- `npm test`: PASS, 203 files and 1,798 tests, including test TypeScript checks.
  This local total includes a gitignored private-ledger test, which stays local.
- `npx tsc --noEmit -p mobile/tsconfig.json`: PASS.
- Mobile `npm run lint`: PASS.
- Scoped web, mobile-test, and campaign-test ESLint: PASS.
- `npm run build`: PASS; Next.js compiled and generated 51 static pages.
  The initial restricted-network attempt could not fetch Google Fonts; the
  authorized network retry passed.
- `npx expo export --platform ios --output-dir /tmp/mhtoolkit-ios-merge-final-20261002`:
  PASS; 1,903 modules, 66 assets, and a 6.3 MB Hermes bundle.
  Bundle: `entry-8acbc3dc50abb98178f85deea1fa2d20.hbc`.
- `npm run qa:ios:inventory`: PASS, checklist `2026-10-02.1`, 38 routes,
  796 route/control checks, and 133 workflows: 929 required evidence rows.
- Conflict-marker scan and `git diff --check`: PASS.

Reviewers identified the safety, migration, and Today recommendation bugs above.
Final Today integration review found no issues. The safety review's additional
foreground-while-cleanup-is-stalled finding was fixed and covered by two new
passing screen-logic regressions. Gemini review was unavailable because both
configured model attempts required authentication; no Gemini approval is claimed.

## Release boundary

The screen harness replaces native hosts; these results are not physical-device
or complete click-through evidence. No new TestFlight build, App Store submission,
or final exact-artifact physical iPhone/iPad QA was performed in this integration
pass. The 929-row inventory is a checklist, not a completed QA run. This report
supersedes earlier pending test-typecheck results for the final integrated tree.
