# Tool completion write-back

This update records completed activities and reflects them in Today and Advisor using the existing app design. It does not change the app version or constitute an iOS release.

## Behavior

- Grounding, meditation and yoga record a full run after all timed steps finish. Browsing, cancellation, pause, reset or skipping unfinished steps does not count as completion. Meditation can resume saved progress.
- Each game has a completion boundary. Sequence Hold uses an explicit Finish practice action after checking a round.
- New journal entries and reflections count only after the underlying entry saves. Editing an entry does not create another completion.
- Focus counts only after its session update returns the saved row. A failed save can be retried with the original completion time.
- Today shows a brief acknowledgement. Advisor keeps it until the person chooses another step. Existing active steps and safety guidance take priority. The choice is remembered during the mounted Advisor session; the acknowledgement can appear again after restarting the app.
- Only a completion carrying the exact current, started Advisor grounding action ID closes that action. Other activities can be acknowledged without completing an unrelated step. Existing goal and habit completion checks remain in place.

## Persistence and privacy

The ledger contains an owner, UUID, tool kind, fixed item identifier, start/end times and optional Advisor action ID. It does not copy journal text, reflection answers or task titles. Supabase anonymous Auth users own their records through their authenticated user ID. Partners and AI have no access to this domain.

The device saves completion metadata first and retries remote synchronization on later Today/Advisor refreshes. Repeated callbacks retain the same UUID. The local view uses the most recent 90 days; server export includes all completion records. This is not a server retention limit.

Sign-out clears synced cached completions while preserving pending records under the original owner, so offline activity can upload when that same profile returns. It cannot display or upload under another owner. Account upgrade drains source uploads before the server merge, then transfers the pending local metadata. Intentional data/account deletion drains uploads and holds a persistent deletion marker through remote deletion and local erasure, including interrupted or ambiguous responses.

Export includes the remote ledger and the current profile's local mirror, including pending records. Consumers can deduplicate the two by UUID.

## Deployment order

1. Apply `supabase/migrations/20260926115248_add_tool_completions.sql` through the normal database release process. The new API export fails closed when this table is absent; deploy the migration before the API.
2. Deploy and verify the API export/deletion behavior against disposable identities.
3. Build the native candidate from the reviewed commit and run the current `mobile/qa/ios-release-checklist.json` against that exact installed artifact.
4. Pin the completed run SHA-256 outside its mutable file and pass `npm run qa:ios:verify -- --run <path> --expected-run-sha256 <hash>` before claiming the artifact is ready for submission.

The migration was applied to the live `mentalhealthproj` Supabase project on 2026-09-26. Its filename matches the migration version recorded by Supabase. Native upload and App Store submission remain pending.

## Verification

Implementation checks passed: 1,385 tests across 186 files (3 skipped), root/test/mobile TypeScript checks, mobile lint with zero warnings, changed root-file lint, and the 894-row checklist inventory validation. All 43 migrations applied successfully in the disposable SQL harness.

The SQL harness (`bash scripts/verify-tool-completion-rls.sh`) applies every migration to disposable PostgreSQL 16 and checks owner/anonymous access, denied cross-owner access, duplicate retries, immutable records, constraints, account merge, legacy claim, deletion, account cascade and anonymous-account retention guards.

Executable tests cover completion boundaries, duplicate effects, pause/reset/replay, offline retry, exact Advisor linkage, replacement-action races, account switching, deletion during upload, interrupted deletion, local failure recovery, owner-bound export and UI acknowledgement/next-step behavior. The release checklist also requires physical-device coverage of these flows and the existing regression inventory.

Gemini architecture review was attempted with the primary and fallback models; both failed authentication because the installed CLI client is no longer supported. Independent local reviewers checked the code and their concrete findings were addressed. Physical native QA remains pending.
