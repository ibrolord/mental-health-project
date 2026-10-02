# Advisor profile migration retry

Date: 2026-10-01 (America/Toronto)

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
