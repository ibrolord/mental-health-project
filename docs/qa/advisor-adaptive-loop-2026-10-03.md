# Advisor Adaptive Loop: Implementation and Review

Date: 2026-10-03. Scope: iOS and its existing Advisor API. This is not a release approval.

## Implemented locally

- Model input now includes up to five recent, timestamped outcomes: completion,
  partial progress, skipped steps, explicit barriers, and helpfulness feedback.
- Accepted commitments remain the only model candidate. Action text and routes
  are not rewritten; the model selects a grounded follow-through message.
- Personal-plan text stays local. Health-derived candidates require a freshly
  confirmed aggregate summary. Background tasks do not call AI.
- Foreground refresh handles owner-scoped changes even when automatic reminders
  are disabled, and coalesces changes arriving during an in-flight request.
- Cache keys include current commitment state and all retained feedback. Local
  fallbacks expire after one minute; matching model briefs expire after six hours.
  Refresh is event-driven, not continuous model polling.
- Completed habit signals say marked done rather than still open.
- Draft transfer now reserves both owners, drains storage work, copies and verifies
  the destination draft before server merge, and avoids restoring a deleted source
  session after confirmed server success. Follow-up repairs are listed below.

## Prior Verification

- Full suite: 213 files / 2,100 tests passed, including the five QA inventory
  workflows and their preservation test. Log: `/tmp/mht-advisor-all-tests-release-scope.log`.
- Updated release-gate tests: 28 passed. Log: `/tmp/mht-advisor-gate-tests-final.log`.
- Mobile TypeScript, targeted backend lint, and full mobile lint passed.
- Live model function smoke test sent fictional data only. Gemini failed;
  the configured Claude fallback returned the known accepted action and a valid
  follow-through ID in 3,446 ms. Log: `/tmp/mht-advisor-live-network.log`.
  This is not evidence of the deployed API, device flow, or model quality over time.
- Claude Opus completed a design-requirements review. Gemini architecture-review
  CLI primary and fallback required login; no Gemini review was completed.
- Simulator build was started, then deliberately stopped at the required review
  pause. No updated artifact was installed or clicked through in this turn.

## Authorized Follow-up Repairs

The user authorized another repair cycle with "fix all of that and release it".

1. Explicit helpfulness now queues a refresh even during an active commitment.
   Actual screen callback regressions cover yes, no, and skip. Independent
   correctness review found no remaining bug in this repair; 101 focused tests
   passed. Model tests pin their clock so the 90-day feedback window stays stable.
2. Reflection screen edits register immediately with the storage queue. There is
   no screen-local promise queue or debounce gap outside migration's drain.
3. Editor callbacks use the token from hydration. A stale editor must reload
   before editing, saving, or discarding; it cannot borrow a fresh token.
4. Provisional target drafts carry encrypted provenance. Retries can update an
   unchanged staged copy, including after restart, but cannot overwrite an
   independently edited destination. Normal saves remove provenance.

5. If the source draft is discarded after a failed merge, retry removes only the
   unchanged provisional destination copy. Independently edited destinations
   survive. The same handling covers saving the source draft to Journal.
6. Missing start timestamps are omitted from model feedback, not reported as
   failure to start. An older unhelpful result does not tell the user to abandon
   a newly accepted commitment.

Draft-focused tests: 192 passed, including 55 migration cases, with both
TypeScript checks passing. Final independent draft review found no remaining
issue in the targeted correction and reran 88 tests successfully.

## Latest Verification

- Full suite after these repairs and dependency patches: 213 files / 2,136 tests
  passed. `/tmp/mht-release-all-tests-final-retry.log`. An earlier run had one
  filesystem-heavy migration test exceed five seconds; the complete rerun with
  four workers passed without changing assertions or timeouts.
- Mobile TypeScript and full mobile lint passed. Production API build passed.
- Resource links: 101 directly reachable; the remaining AP article rendered its
  headline and full body in the browser, despite automated 403 responses.
  `/tmp/mht-release-links-verified.log`.
- Simulator Release build succeeded and was installed on iPhone 17 / iOS 26.4,
  device `35502CC3-209F-4A8F-AC62-61848F4C53D4`. Installed JS SHA-256:
  `e9f50be8c21d11c250bd1f95ba66985039beb093dbe2e79b0d412d745e621bb2`.
  Installed executable SHA-256:
  `da87d5e14d34c920692680e04003002e8cf2d5d12af34a8d26c97195504150a0`.
  This artifact predates the final draft-discard correction and dependency
  updates. Do not represent it as the final release artifact.
- Clicked Advisor Start, completed the fictional "Pause for a drink" habit,
  observed 1/2 habits completed, returned with Back, and observed a Claude-guided
  next suggestion for "Take a screen-free rest". Started that step, returned
  without completing it, answered that the previous step did not help, and
  observed the same active step and follow-up time remain after refresh. Feedback
  controls disappeared and the acknowledgement appeared. This is narrow
  simulator evidence, not complete native QA or proof of every model response.
- Opus confirmed the missing-start and negative-feedback fixes. Its conditional
  fingerprint concern was checked locally: optional arguments default to null,
  and helpfulness/feedback timestamps are included. No sustained refresh cycle
  was found. The remaining findings below were not silently fixed after pass 2.
- Independent dependency compatibility review found no concrete API, peer-range,
  or lockfile inconsistency. Expo 54, React Native 0.81.5, React 19.1.0 and Expo
  Router 6.0.24 remain unchanged. Nine targeted navigation/package checks passed.

## Review Pause and Authorized Final Repairs

The second Opus pass identified two additional edge cases. Per the user's
two-pass limit, approval was requested before another repair cycle:

1. An optional `recordAdvisorOffered` write can fail after lifecycle completion
   already succeeded, producing a misleading failure while the UI reconciles.
   Sites: `mobile/app/(tabs)/advisor.tsx:893` and `:987`.
2. `queued` survives backgrounding in `mobile/lib/advisor-loop-refresh.ts:60`,
   allowing a redundant refresh after returning to the foreground.

The user then instructed: "ignore physiclal test, complete the rest". Both
repairs are now implemented: optional offer-history writes are non-fatal in
completion/replacement callbacks, and backgrounding discards the obsolete
queued refresh. Actual screen callback and refresh-gate regressions passed:
41 tests across two files after also covering optional history-read failures and
next-suggestion failures following a committed completion. Completion success is
now preserved independently of optional next-step generation.

Final Opus review confirmed the error handling and refresh-state fixes. Its
remaining conditional concern assumed a populated `toolCompletion` while Done
is available. The full screen clears that state when an active action is loaded;
choosing another step records dismissal separately. Done completes the active
commitment, not an unrelated unconsumed tool acknowledgement. No additional
functional defect was established by that conditional finding.

Final automated verification: 214 files / 2,148 tests passed, mobile TypeScript
and lint passed, and a normal clean `npm ci` ran the compatibility postinstall
successfully before all 18 Expo Doctor checks passed. Logs:
`/tmp/mht-release-waiver-all-tests-final.log`,
`/tmp/mht-release-waiver-mobile-tsc-final.log`,
`/tmp/mht-release-waiver-mobile-lint-final.log`, and
`/tmp/mht-release-waiver-clean-install.log`.

Final simulator Release build succeeded, version 1.0.8, on the same iPhone 17 /
iOS 26.4 simulator. Installed JS SHA-256:
`02677ac82fdc3058ca62c0ba4ede6b4602b021a6551ba8fc380ccee19c9e59d3`.
Installed executable SHA-256:
`f7ebbec4e2bdda86832fe7143b97b7076487327f46687f92095886f1370b619a`.
Direct UI actions: opened Advisor with its preserved fictional current step,
pressed Done, observed the completion acknowledgement and Start replacing
Continue, expanded Recent steps and observed Completed, submitted Yes feedback,
and observed Helped in history plus the feedback acknowledgement. These are
narrow simulator checks, not full native QA.

Further dependency repair pins image-size 2.0.4 and decode-uri-component 0.5.0,
with version-checked Metro and query-string compatibility adaptations. An
independent reviewer returned SHIP for that patch, ran five benign compatibility
tests, and verified the iOS Babel export interoperability. Normal clean install
and the final simulator Metro/Hermes bundle succeeded afterward. The audit still
has 21 high transitive findings, rooted in braces and node-forge advisories with
no published fixes. No claim of a clean audit or accepted residual risk is made.

Public Google/Apple/anonymous settings passed again. The six management-only
checks remain blocked: Chrome's Supabase session expired, and the existing
dashboard attestations are stale. App Store Connect also requires sign-in.
The user was asked to sign in to both Chrome tabs. Expo and Vercel accounts are
authenticated. No authentication setting was changed.

Physical-device execution is explicitly excluded from this pass. This is not
physical QA evidence, and does not turn the existing exact-artifact release
checker green. Its checklist and acceptance rules remain unchanged. Do not
describe the release as fully tested, or substitute simulator evidence for
physical audio, accessibility, Apple sign-in, or notification delivery.

## Current Release Preparation

- Apple lookup on 2026-10-03 reports public version 1.0.7, released
  2026-09-28T13:34:32Z. The candidate is now 1.0.8 in Expo, package metadata,
  Fastlane, review notes, and the version baseline.
- EAS latest completed build is 1.0.7 (67), ID
  `1e7dfda6-fe80-4713-8874-2a2830e30cc6`; it does not contain these repairs.
- Production API build passed. Expo Doctor passed all 18 isolated checks again
  with the final patched lockfile. `/tmp/mht-release-isolated-doctor-final.log`.
  The in-place run detects the web and mobile projects' separate React copies;
  the isolated layout matches the mobile EAS build context.
- Live public Supabase settings enable Google, Apple, and anonymous auth.
  Management-only redirects/linking checks and signed-device login remain open.
- The connector reports all 43 local migration versions present in production,
  with no extra remote versions. The CLI migration check stalled and was stopped;
  this is alternative evidence, not a passing CLI verification.
- Physical preflight found an iPhone 17 Pro Max on iOS 27.0.1, but inspection was
  blocked because it was locked. No paired available physical iPad was found.
- Compatible npm patches and fast-uri 3.1.8 reduced the mobile audit from 34 to
  25 dependency findings: 22 high, 3 moderate, zero critical. Remaining roots
  include braces, decode-uri-component, image-size and node-forge. No forced
  Expo downgrade or framework-major upgrade was applied. Findings are not
  declared unreachable or accepted risks. `/tmp/mht-mobile-prod-audit-after.json`.

## Next Verification

- Finish final review and full verification of the two authorized edge-case fixes.
- Rebuild the exact simulator artifact, install it, verify its JS/binary hashes,
  and click through the adaptive guidance, current-step feedback, and reminder
  opt-out flows using disposable data.
- Local preview API was `http://127.0.0.1:3012`; production artifacts must not use it.
- Deploy the backward-compatible API contract before shipping the new iOS client.
  An old backend rejects the new optional request fields; iOS safely falls back
  locally, but that does not demonstrate model-backed guidance.
- Physical-device/TestFlight gate remains unexecuted under the user's waiver. Current checklist
  is `2026-10-03.1`, with 39 routes, 843 route checks, 160 workflows and 1,003 rows.
  Canonical digest: `f858552edf631280e799fb2a9722a532f24012aedac1274c3a7a5d20d2fe18d3`.
  No earlier checklist row or requirement was removed or rewritten.
