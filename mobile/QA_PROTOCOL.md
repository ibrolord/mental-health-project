# Exhaustive iOS QA Protocol

This is the required release gate for MHtoolkit. It exists because a visible
control, passing build, static test, or happy path does not prove that the
installed app works.

## Non-negotiable rule

Do not say **QA complete**, **release-ready**, **safe to submit**, or equivalent
unless this command exits zero for the exact installed artifact:

```bash
cd mobile
npm run qa:ios:verify -- \
  --run qa/runs/<build>.json \
  --expected-run-sha256 <hash-pinned-outside-the-run-file>
```

The verifier rejects missing, pending, failed, blocked, duplicated, unknown,
stale, dirty-checkout, wrong-artifact, wrong-device, and evidence-free results.
There is no required-item waiver or `not_applicable` status.

## Evidence standard

Every manual result must record:

- The exact artifact ID shared by the run.
- The absolute path to the exact IPA; verification hashes the file again.
- The tester's name or agent identity.
- A declared device ID, model, and OS version.
- The time tested.
- A structured evidence type and reference: screenshot, screen recording
  timestamp, device log, database query receipt, or direct observation record.
- A concrete observed outcome of at least 20 characters.
- The resulting route, persisted state, external destination, or error state.

Every automated result must use `qa:ios:run`. The gate executes the allowlisted
command itself, captures its exit code and output, and binds a receipt to the
commit and artifact. The verifier re-hashes the non-empty regular output file,
rejects symlinks and hard-link aliases, and prevents one filesystem object from
proving multiple checks. A
screenshot of a button before it is pressed is not evidence. A toast is not
persistence evidence. A local build is not TestFlight evidence.

A successful deep link, running process, or screenshot capture does not prove
that a route rendered correctly. Route-render evidence must be inspected by a
human or OCR/visual assertion and must reject startup error, blank, crash,
fallback, and stale-screen content. An unsigned or ad hoc simulator build is
not valid evidence for SecureStore, Keychain restoration, or authentication;
those rows require the signed TestFlight artifact on the declared devices.

Supplemental dev-client tests that load bundled assets must prove Metro is
available before the first observation:

```bash
curl --fail --silent http://127.0.0.1:8081/status
```

The response must be exactly `packager-status:running` and must be attached to
the supplemental evidence. A dev client can display cached JavaScript while
audio and image asset requests fail against an offline Metro server; that state
is a blocked test environment, not valid pass or failure evidence for the
release artifact. This requirement does not apply to an installed TestFlight
build, whose assets must be packaged in the IPA.

## Required identities and devices

Use disposable data and declare each identity in `metadata.identities` with a
non-PII ID and one of these exact roles:

1. Fresh anonymous user.
2. Anonymous user with saved mood, goal, habit, journal, and planner data.
3. Email/password owner upgraded from that anonymous identity.
4. Google owner upgraded from an anonymous identity.
5. Apple owner upgraded from an anonymous identity on a signed physical device.
6. Separate accountability partner.
7. Removed/revoked former partner.

Every route and control row requires the exact processed TestFlight artifact on
a physical iPhone and an iPad compatibility device. Hardware-specific workflows
require the physical iPhone. Simulator results may supplement but cannot replace
signed physical-device authentication, Keychain, microphone, share-sheet,
telephone, SMS, email, or TestFlight checks.

## Run procedure

1. Commit the intended source and require a clean worktree.
2. Build and process the exact release artifact.
3. Record its version, build, EAS UUID, SHA-256, expo.dev receipt, and install
   source. Only `TestFlight` is accepted.
4. Generate a new run. Never reuse a run from another build.

```bash
cd mobile
npm run qa:ios:inventory
npm run qa:ios:init -- \
  --output qa/runs/build-35.json \
  --version 1.0.2 \
  --build 35 \
  --tester "QA Engineer" \
  --artifact <EAS-build-UUID> \
  --ipa </absolute/path/to/the-exact.ipa> \
  --sha256 <64-character-sha256> \
  --receipt <expo.dev-build-receipt-containing-the-UUID> \
  --install-source TestFlight
```

5. Add the exact devices to `metadata.devices` in the generated run. Each device
   needs `id`, `type`, `model`, and `osVersion`. Type must be
   `physical-iphone`, `physical-ipad`, `simulator-iphone`, or `simulator-ipad`.
   Release rows that require iPad coverage must reference a physical iPad running
   the signed TestFlight build; simulator evidence is supplemental only.
   Add all seven disposable roles to `metadata.identities`; duplicate device or
   identity IDs are rejected.
   Before recording results, run the physical readiness diagnostic:

```bash
npm run qa:ios:physical-preflight -- --run qa/runs/<build>.json
```

   It verifies the exact IPA hash, required identity declarations, available
   physical iPhone/iPad devices, installed TestFlight bundle metadata, and
   either a scoped Supabase management credential or fresh ignored dashboard
   evidence. Developer Mode enables automated Xcode inspection; when it is off,
   the TestFlight version/build check is recorded manually instead.
   Follow `QA_HARDWARE_RUNBOOK.md` to resolve every reported blocker.
6. Execute every route, control, state boundary, workflow, privacy matrix, and
   regression row from `qa/ios-release-checklist.json`.
7. Record each result immediately. Example:

```bash
npm run qa:ios:record -- \
  --run qa/runs/build-35.json \
  --id route.grounding.back-direct \
  --status pass \
  --devices iphone-physical-1,ipad-compat-1 \
  --actors identity-fresh-anonymous \
  --evidence-type video \
  --evidence "ios35-nav.mov 00:42" \
  --observed "Back returned to Dashboard without resetting tab state"
```

Automated example:

```bash
npm run qa:ios:run -- \
  --run qa/runs/build-35.json \
  --id external.links \
  --actors identity-email-owner \
  --evidence-type log \
  --evidence "qa-gate:external.links:build-35" \
  --observed "The gate verified every allowlisted production resource link." \
  --command "npm run verify:resource-links" \
  --output-ref /tmp/mhtoolkit-build-35-external-links.log
```

8. Set `metadata.completedAt` only after the last observation. Once set, the
   recorder refuses further changes.
9. Run `qa:ios:digest` and pin its SHA-256 outside the mutable run file in the
   release record. Then run `qa:ios:status` and `qa:ios:verify` with that hash:

```bash
npm run qa:ios:digest -- --run qa/runs/build-35.json
npm run qa:ios:verify -- \
  --run qa/runs/build-35.json \
  --expected-run-sha256 <pinned-hash>
```

   Any later edit to the run invalidates the pinned digest.
10. Fix every failure. Build a new artifact if source changed, generate a new
    run, and rerun the affected route plus all related workflows and regression
    checks. Source changes invalidate artifact-specific evidence.

## Coverage model

The manifest and its reviewed SHA-256 enforce all native route files. Its exact
38-route, 759 route/control, 121 workflow, and 880 total-row inventory cannot
silently shrink. Each route requires render,
control, state-boundary, restoration, and navigation evidence appropriate to
its tab, stack, or modal type. Every named control is a separate required row.

Cross-route coverage includes:

- Exact artifact identity, signing, production environment, native modules,
  privacy manifest, clean prebuild, tests, and dependency state.
- Clean install, upgrade install, TestFlight install, iPhone/iPad launch stress,
  backgrounding, offline, slow network, reconnect, and server failures.
- Anonymous, email, Google, and Apple authentication, cancellation, linking,
  identity preservation, Keychain restoration, and provider-disabled behavior.
- Mood, goals, habits, journal, planner, focus, assessments, AI, voice,
  grounding, meditation, mind games, library, resources, and external links.
- Accountability invite, accept, every scope, aggregate-only reads,
  celebrations, rewards, duplicate prevention, leave, remove, revoke, and
  post-revocation denial across separate accounts.
- Export, saved-data deletion, account deletion, RLS, log privacy,
  accessibility, layouts, keyboard, timezone, locale, and App Store metadata.
- Every previously observed rejection or regression, including iPad launch,
  iOS notification permission/delivery/tap launch, support URL, back navigation,
  mood save, goal duplication, account creation, accountability, and live AI chat.

## Adding features

Any new `mobile/app/**/*.tsx` route makes the manifest test fail until that
route and its controls are inventoried. A feature added inside an existing route
must add its controls and cross-route state transitions before release QA.
The checklist version, reviewed inventory, and SHA-256 baseline must then be
updated together and independently reviewed; old runs will no longer verify.
