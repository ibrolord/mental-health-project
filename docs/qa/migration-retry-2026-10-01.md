# Advisor profile migration retry

Date: 2026-10-01 (America/Toronto)

## Follow-up: edit during an active attempt (2026-10-02)

This follow-up supersedes the original unit's handling of source edits during
finalization. Only these four files were edited:

- `mobile/lib/advisor-profile-storage.ts`
- `mobile/lib/auth-context.tsx`
- `tests/mobile/advisor-profile-migration.test.ts`
- `docs/qa/migration-retry-2026-10-01.md`

The revised integration regression reproduced the confirmed bug before the fix:
**64 passed, 2 failed**. For both absent and legacy destinations, an anonymous
answer saved while audio migration was paused remained under the inactive source
owner, while the caller resolved with the old destination answer and provenance.

Finalization now explicitly returns `complete` or `retry-required`. Under both
owner locks, a source revision/byte change refreshes only the same unchanged
provisional copy, retains the source, and requires a fresh finalization check.
The auth caller allows two checks total, then throws an actionable retry error
instead of treating an unfinished migration as success. A successful check removes
the source and provenance before reporting completion. An initially absent source
that appears during the attempt also requires retry rather than silently succeeding.

Explicit target saves, including identical saves and empty plans, stay authoritative.
A cleared target or a changed/foreign provisional copy blocks completion without
recreating or overwriting that destination. Tests also cover target saves/clears
queued by the refresh notification, repeated source edits, and refresh writes
that fail before or after committing.

The existing tool-completion migration wrapper and account/UI behavior were
preserved. Refresh/recheck stays inside its local migration callback; it does not
repeat server merge, generic local moves, or audio migration. Extracted-auth tests
verify that pending merge state and completion migration cannot finish while the
refresh write is blocked. Exhausted retries and write failures propagate through
the existing anonymous-session restoration path. This is mocked integration
evidence, not real account or native UI verification.

Final scoped verification: **12 files passed, 339 tests passed**, including
**80 profile migration tests**. The command below uses installed binaries only:

```sh
env PATH=/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin node_modules/.bin/vitest run \
  tests/mobile/advisor-profile-migration.test.ts \
  tests/mobile/advisor-profile.test.ts tests/mobile/advisor-onboarding.test.ts \
  tests/mobile/onboarding-journey.test.ts tests/mobile/advisor-personal-plan.test.ts \
  tests/mobile/auth-resilience.test.ts tests/mobile/auth-validation.test.ts \
  tests/mobile/social-auth.test.ts tests/mobile/tool-completion.test.ts \
  tests/mobile/tool-completion-runtime.test.ts tests/mobile/tool-completion-retry.test.ts \
  tests/auth/anonymous-profile-switch.test.ts
```

Additional checks (same PATH prefix):

- Mobile `tsc --noEmit -p mobile/tsconfig.json`: passed.
- Focused migration-test TypeScript check: passed using the TypeScript compiler
  API, `tsconfig.test.json` options, and this test as the sole root file.
- ESLint for both production files from `mobile/`, and the migration test from
  the repository root: passed.
- Scoped `git diff --check`: passed.
- Repository test `tsc --noEmit -p tsconfig.test.json`: failed in concurrent,
  unowned `tests/mobile/advisor-completion-ui.test.ts:338` with TS2322
  (`Promise<void>` is not assignable to `Promise<undefined>`). Not repaired here.

Existing merge-conflict entries and concurrent tool-completion work were left
untouched. No staging, commits, pushes, external requests, account changes, or
external reviewer runs were performed. The original report below is historical;
its checks, review status, and hashes are not follow-up verification.

## Scope

Targeted repair of the local anonymous-to-account Advisor profile migration.
Implementation and tests only; no commit, push, deployment, App Store submission,
or production data changes. The parent task owns landing-page work, integration,
native release verification, and release decisions.

Files changed in this unit:

- `mobile/lib/advisor-profile-storage.ts`
- `tests/mobile/advisor-profile-migration.test.ts`
- This report

The pre-existing deferred-finalization changes in `mobile/lib/auth-context.tsx`
were retained without further edits. Other dirty work was not reverted or edited.

## Reproduction and repair

The two new integration regressions initially failed against the prior local
implementation (42 passed, 2 failed). They execute the actual extracted
`migrateAnonymousLocalState` function, inject a failure in the later audio-store
migration, edit the retained anonymous profile, reconstruct profile storage, and
retry. Both a missing target and a legacy target incorrectly retained the old
answer while deleting the source.

The copied target now contains a private, versioned `_ownerMigration` marker with
the source owner and scope (`profile` or `personalPlan`). Marker and profile are
persisted in the same AsyncStorage `setItem`, avoiding a separate journal-write
window. Reads and subscriber notifications return normalized profiles without
this internal metadata.

- A retry refreshes a provisional copy from the latest retained source. A legacy
  target keeps its own settings; only its provisional personal plan is refreshed.
- An explicit target save strips provenance in that same write. Its values remain
  authoritative, including an identical save or an intentionally empty plan.
- Identical provisional retries do not rewrite the copy or duplicate successfully
  delivered notifications. A committed-but-rejected write is published on recovery
  if this storage instance never acknowledged it.
- Finalization locks both owners, checks the source revision and stored bytes,
  validates the current destination, and will not remove the source if the target
  disappeared or its provisional copy changed.
- Source removal precedes provenance cleanup. Failed removal preserves recovery
  information. A later attempt cleans a leftover marker when source removal
  committed before acknowledgement or cleanup was interrupted.
- Malformed/unsupported provenance and another source owner's pending migration
  fail closed. No consent keys, other profile owners, or unrelated stores change.

## Automated verification

Final scoped run: **8 files passed, 287 tests passed**, including **65 profile
migration tests**. This adds 23 cases to the prior 42-case migration suite.

```sh
env PATH=/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin npx vitest run \
  tests/mobile/advisor-profile-migration.test.ts \
  tests/mobile/advisor-profile.test.ts \
  tests/mobile/advisor-onboarding.test.ts \
  tests/mobile/onboarding-journey.test.ts \
  tests/mobile/advisor-personal-plan.test.ts \
  tests/mobile/auth-resilience.test.ts \
  tests/mobile/auth-validation.test.ts \
  tests/mobile/social-auth.test.ts
```

Coverage includes later-store failure, restart, source edits between attempts,
explicit target edits/clears, unchanged retries, stale finalizers, concurrent saves
and clears, committed-but-rejected writes/removals, failed copy refresh, failed
source deletion, interrupted metadata cleanup, malformed metadata, and foreign
pending-owner isolation.

Additional checks passed:

- `npx tsc --noEmit -p mobile/tsconfig.json` (repository root).
- `npx tsc --noEmit -p tsconfig.test.json` (repository root).
- `npx eslint lib/advisor-profile-storage.ts lib/auth-context.tsx` (mobile directory).
- `npx eslint tests/mobile/advisor-profile-migration.test.ts` (repository root).
- `git diff --check -- mobile/lib/advisor-profile-storage.ts mobile/lib/auth-context.tsx`.

All commands used the same PATH prefix shown above. The root ESLint config ignores
mobile code, so the production files were checked again from the mobile directory
with its own config; an ignored-file warning was not counted as lint evidence.

## Independent review

Correctness round 1: independent Codex CLI, enforced read-only sandbox. It
reproduced one additional P2: an unchanged retry after a committed-but-rejected
target write could finish without notifying mounted target consumers. Fixed with
per-instance acknowledged-copy tracking and two same-/new-instance regressions.

Correctness round 2: pending at report creation. Maximum two rounds for this unit.

Architecture: Gemini `gemini-3.1-pro-preview` and the prescribed
`gemini-2.5-flash` fallback both failed before review with
`IneligibleTierError: UNSUPPORTED_CLIENT` for the installed Gemini CLI/account.
No architecture approval is claimed, and no auth/client configuration was changed.

Reviewed source SHA-256 values:

```text
9c8b72984ff9cdc4b954a61f06ecdf225e4a7130d5068464c2295c06998a6568  mobile/lib/advisor-profile-storage.ts
3385e5d2033933ff134a13e2a86f3c044ed609f0c4ee0fa2eb204c69edd02fae  mobile/lib/auth-context.tsx
eec9b7dde9c2bb47e18bd544217b4e280d48e90157d4b32040fa74df4f31cd51  tests/mobile/advisor-profile-migration.test.ts
```

## Limits and handoff

- This is local storage and extracted-caller integration evidence, not a live
  Apple/Google/email sign-in or simulator/physical-device pass. Exact-artifact
  native QA and the repository release gate remain the parent task's responsibility.
- Concurrency protection uses the production singleton in one JS runtime. It is
  not a cross-process compare-and-swap system. Profile mutations must use this
  store; direct concurrent AsyncStorage writes are outside that guarantee.
- The protocol assumes a single-key storage write commits wholly or not at all;
  tests cover failure before commit and loss of acknowledgement after commit.
- A historical unmarked target cannot reliably be distinguished from an explicit
  target edit. The fix prevents this failure for newly attempted copies; it does
  not reconstruct already-deleted data or infer provenance for older unmarked
  copies. Existing explicit target precedence is preserved.
- If the source changes during the current migration, its newer data stays under
  the source owner for a subsequent retry rather than being deleted by a stale
  finalizer. This unit does not redesign account-switch conflict UX or the other
  local stores' migration policies.
