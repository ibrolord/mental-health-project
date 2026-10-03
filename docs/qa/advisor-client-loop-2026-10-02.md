# Client-first iOS Advisor follow-ups

## Scope

Settings adds an explicit, per-profile, default-off **Follow up on my steps**
choice. A started Advisor step can have one locally scheduled follow-up.
Existing device-reminder and Advisor-category switches, OS notification
permission, quiet hours, and pause preferences still gate delivery. No
background permission or AI consent prompt is opened by this feature.

The mounted iOS loop responds to foregrounding and successful mood, goal,
habit, tool-completion, profile, Health-access, and low-energy preference
changes. It reconciles evidence against the current step rather than adopting
another goal. Completed steps cancel pending automatic follow-ups. Remote
context reads are bounded; offline fallback can only use an already saved
step, never infer a completion or invent a new recommendation.

Preferences and native mutations are serialized separately from remote reads.
Pause, quiet-hour changes, account changes, and deletion invalidate older work.
Lock-screen copy is generic: no mood, goal, Health, or journal content.

## Platform boundary

This is not an always-running AI process. `expo-background-task` requests an
opportunistic 60-minute minimum interval, but iOS decides if and when to run it.
Notifications already scheduled locally do not require the JavaScript process
to remain alive. Background refresh never calls a model or uploads Apple Health
data. Existing foreground AI consent and model behavior are unchanged.

The existing session Keychain policy is deliberately unchanged. A cold task
that cannot read credentials while locked fails safely and waits for another
opportunity; it does not create an anonymous account or bypass device security.
Force-quitting prevents background refresh until the app is reopened. Quiet-hour
or timezone changes need app execution to revise a previously scheduled date.

Official references:
- https://docs.expo.dev/versions/v54.0.0/sdk/background-task/
- https://docs.expo.dev/versions/v54.0.0/sdk/securestore/
- https://developer.apple.com/documentation/usernotifications/scheduling-a-notification-locally-from-your-app

## Verification boundaries

Automated suites cover preference validation, race invalidation, delayed remote
reads, native-adapter registration, denied permissions, deduplication, quiet
hours, lifecycle cancellation, account ownership, and Settings callbacks.
Mocked native modules establish behavior under those inputs, not OS delivery.

The iOS release checklist has additional native workflows for this feature.
Their presence is not completion evidence. Physical locked-device refresh,
real notification delivery/taps, background restrictions, force-quit behavior,
timezone/DST behavior, and accessibility remain separate release gates.

New Expo native modules require a new native binary. A JavaScript export, local
build, or repository push does not ship these modules to the installed App Store
app. This work does not submit or release a build.

## Repair review

The user approved fixing and retesting the prior three findings with "finish".
The Advisor core repair now has an independent read-only review with no
remaining findings:

- Per-owner refresh sequencing rejects older safety and completion snapshots.
- Initial and final preference reads run inside the mutation queue, so a refresh
  started during a quiet-hour or opt-in write uses the committed preferences.
- Daily/due-date remote content reads no longer hold the native mutation queue.
- Settings cleanup evaluates the expected account inside that queue. A different
  or signed-out account skips cleanup; a failed session read reports incomplete
  cleanup instead of silently reporting success. Tests execute the actual
  Settings guard extracted from its TypeScript source.

The notification repair's first independent review additionally reproduced an
account change during the commit permission read and a category-only disable
superseding a pending time change. The final repair revalidates ownership after
awaited preparation, before scheduling, and after persistence. It compensates
newly scheduled IDs when ownership changes or an ownership read fails. A
category-only disable filters compatible pending work instead of stranding its
time update; later time changes, enable/disable, and cleanup still invalidate it.

The final independent notification review reported no actionable findings. It
reproduced both original cases as passing, including a subsequent time change
superseding the preserved rebuild. All 171 focused tests passed. This is a scoped
code-review result, not an App Store or physical-device release verdict.

No manual release checklist rows have been marked complete by this work.

## Initial verification record, before repair

- Full automated suite: 208 files, 2,000 tests passed. Command:
  `npm test -- --reporter=dot --maxWorkers=2`; log:
  `/tmp/mhtoolkit-advisor-client-tests.log`.
- Mobile TypeScript: `npx tsc --noEmit` passed.
- Mobile lint: `npm run lint` passed; log:
  `/tmp/mhtoolkit-advisor-client-lint.log`.
- Checklist inventory: version `2026-10-02.2`, 38 routes, 805 route/control
  checks, 150 workflows, 955 required evidence rows; inventory command passed.
- `git diff --check` passed.
- Expo iOS JavaScript export succeeded at
  `/tmp/mhtoolkit-advisor-client-export`.
- Initial native Release simulator compilation succeeded; launching that
  unsigned binary was blocked by Keychain error `ERR_KEY_CHAIN` / `-34018`
  (missing entitlement), not a proven authentication regression. Rebuilding
  with `CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=-` succeeded and restored
  normal launch. No auth bypass, Keychain reset, or profile deletion was used.
  Build log: `/tmp/mhtoolkit-advisor-client-signed-build.log`.
- Dependency audit: 17 findings (12 high, 5 moderate, no critical). No broad
  dependency upgrades or audit suppressions were made in this change.

Tests use mocked native modules where appropriate. Physical-device release rows
are not passing evidence.

## Repair verification, intermediate artifact

- Automated suite after the initial repairs: 209 files, 2,031 tests passed;
  `/tmp/mhtoolkit-advisor-client-repair-tests.log`.
- Mobile TypeScript and lint passed. Inventory still passes all 955 required
  evidence definitions; this is not 955 completed device tests.
- Native Release simulator build succeeded at 09:19 America/Toronto;
  `/tmp/mhtoolkit-advisor-client-repair-build.log`. The compiled Info.plist
  contains `processing` and `com.expo.modules.backgroundtask.processing`.
- This intermediate artifact does not yet include the final two scheduler
  review repairs. It was installed and launched successfully. Settings allowed
  follow-up opt-in, saving a changed quiet start, and pausing until Oct 3 at
  8 AM. The master notification switch stayed off.
- Live physical-device readiness check: the paired iPhone is reachable, but
  `devicectl device info details` reports Developer Mode is off. No physical
  iPad was listed. No physical app install or background-delivery claim follows
  from the simulator checks.

## Final repair verification

Final source checks, 2026-10-02:

- Full automated suite: **209 files, 2,048 tests passed** after native compilation
  completed, without changing test timeouts. Command:
  `npm test -- --reporter=dot --maxWorkers=2`; log:
  `/tmp/mhtoolkit-advisor-client-final-tests-rerun.log`.
- An earlier concurrent run passed 2,047 tests but timed out after 5 seconds in
  the synchronous attribution-taxonomy test. Its isolated rerun passed all 17
  tests in 259 ms. The full rerun above passed unchanged. The failed run is
  retained in `/tmp/mhtoolkit-advisor-client-final-tests.log`, not counted as a
  pass.
- Final mobile TypeScript and full mobile lint passed; logs:
  `/tmp/mhtoolkit-advisor-client-final-typecheck.log` and
  `/tmp/mhtoolkit-advisor-client-final-lint.log`.
- Final native Release simulator rebuild succeeded; log:
  `/tmp/mhtoolkit-advisor-client-final-build.log`.
- No remaining findings in the bounded independent Advisor-core and scheduler
  repair reviews. No suggestions pending. These reviews were performed by Codex
  agents, not Claude or Gemini.

Final simulator artifact: MHtoolkit Redesign Preview, iOS 26.4, device
`35502CC3-209F-4A8F-AC62-61848F4C53D4`, bundle `com.mhtoolkit.app`.
Both build-output and installed-app hashes were checked and match:

- Executable SHA-256:
  `38d814b2817f287e72a2036335a2248b993082f02eba18a58d8a4ac9198f95ca`.
- Bundled JavaScript SHA-256:
  `5a1891f3f04ff25861f54df24e11c68e6c95f323849086c03ab6e04791d62733`.

Direct Device Hub UI checks, approximately 09:36-09:40 America/Toronto:

1. Final build launched normally into Today. You -> Settings opened normally.
2. The prior enabled choice, saved noon quiet start, 8 AM quiet end, and pause
   until Oct 3 at 8 AM persisted across installation and relaunch.
3. Resume cleared the pause and restored Pause until tomorrow.
4. The native quiet-start picker saved 9 PM; the rendered value matched.
5. Opening the quiet-end picker and cancelling retained 8 AM.
6. Turning follow-ups off collapsed the quiet-hour and pause controls.
7. A second terminate/relaunch and You -> Settings navigation confirmed the
   follow-up switch remained off. The notification master switch remained off.

Original settings were restored: follow-ups off, quiet hours 9 PM-8 AM, no pause,
and master notifications off. No actual notification was sent. No destructive
data deletion or live account-switch test was performed on this profile; those
race regressions are covered by the automated service/callback tests.

Remaining release gates: exact TestFlight artifact on physical iPhone/iPad,
actual delivery and taps, locked-device/background/force-quit behavior,
timezone/DST hardware checks, and device accessibility. The existing 17 audit
findings also remain unresolved dependency debt. No commit, push, TestFlight
upload, App Store submission, or release was performed by this repair turn.

## Prior simulator observations, before repair

Tester: Codex, 2026-10-02, approximately 08:44-08:48 America/Toronto.
Device: MHtoolkit Redesign Preview, iOS 26.4,
`35502CC3-209F-4A8F-AC62-61848F4C53D4`.
Artifact: local Release simulator app built from this dirty worktree, not
TestFlight. Bundled JavaScript SHA-256:
`1b0c7797faa8d407fd1a68daa36b78f90440901291d0bb00fc8fe33168401ba4`.

Direct UI observations were made through Device Hub's accessibility tree and
screenshots, using the actual rendered Settings screen:

1. Normal Today screen rendered after the entitlement-corrected rebuild.
2. You -> Settings opened. Follow-ups were off by default, and the existing
   device notification master switch remained off throughout these tests.
3. Enabling follow-ups revealed quiet hours and Pause until tomorrow.
4. The native quiet-start picker changed 9 PM to 10 PM; Save time updated the
   rendered value without an error.
5. Pause displayed "Paused until Oct 3 at 8:00 AM" and a Resume button.
6. Terminating/relaunching the app and reopening Settings retained enabled,
   10 PM quiet start, 8 AM quiet end, and the pause deadline.
7. Resume removed the pause label and restored Pause until tomorrow.
8. Opening the quiet-end picker and cancelling left 8 AM unchanged.
9. Quiet start was restored to 9 PM; follow-ups were disabled again. The switch
   displayed off and the quiet-hour/pause controls collapsed.

No notification was sent and no master permission was enabled. These are UI
smoke results only, not evidence of actual background execution, cancellation
of a delivered notification, production authentication, or hardware QA.
