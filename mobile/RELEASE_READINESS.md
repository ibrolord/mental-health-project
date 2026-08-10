# Mobile Release Readiness

Last updated: August 9, 2026

This file separates verified source behavior, packaged artifacts, store
uploads, and public release. A successful build is not a store submission.

## Shared Release Gates

- [x] Main branch contains feature release `ce5b201` and Android backup
  hardening `be21314`.
- [x] Root tests pass: 54 files and 287 tests.
- [x] Root and mobile lint pass.
- [x] Production web build passes across 39 routes.
- [x] All 22 primary production routes return HTTP 200.
- [x] Live AI probe returns a valid Claude response with no private context.
- [x] Atomic check-in and attribution RPC exists; anonymous execution is denied.
- [x] Export, saved-data deletion, attribution deletion, and account deletion
  pass against an isolated production test account.
- [x] Partner authorization passes 49/49 checks and exposes only user-enabled
  aggregate counts and fixed-format celebrations.
- [x] Anonymous cleanup safeguards pass 18/18 checks and fail closed.
- [x] Resource links pass 102/102 direct reachability checks.
- [x] Production growth report shows 9 activated users and 0 unattributed
  activations.
- [x] Supabase security advisors and live privileged-function definitions were
  reviewed.
- [ ] Enable Supabase leaked-password protection if the project is on Pro or
  above. This is an external Auth setting, not a code migration.

The Supabase anonymous-sign-in warnings are expected because anonymous sessions
are an intentional feature and their policies remain owner-scoped. The five
authenticated SECURITY DEFINER warnings are also expected RPC entry points.
Live inspection confirmed they deny `anon`, use an empty search path, bind work
to `auth.uid()`, and perform object-level authorization.

## iOS 1.0.1 (34)

- [x] EAS production build finished.
- [x] Build ID: `9e21c6c6-0064-41c2-bc3a-b3268b1eb902`.
- [x] IPA:
  `https://expo.dev/artifacts/eas/vLmMTZzSaEeRwUboVa8TFUrQCqjQKW9ylVDI9HEdk2o.ipa`
- [x] Complete `review:ios` artifact gate passes.
- [x] Bundle is `com.mhtoolkit.app`, version 1.0.1, build 34.
- [x] iPhone-only device family, fullscreen compatibility mode, encryption
  declaration, privacy manifest, production URLs, and support metadata verified.
- [x] Submitted build 34 omits both `expo-notifications` and `expo-device` under
  the previous iOS launch-crash workaround.
- [x] Clean simulator installs render on iPhone and iPad Air 11-inch (M3).
- [x] Launch stress passes 20/20 on iPhone and 20/20 on iPad with no crash,
  fatal, exception, abort, keychain, or auth-init log pattern.
- [x] Apple agreements are active in App Store Connect.
- [x] Build 34 uploaded to App Store Connect.
- [ ] Install the processed build from TestFlight on a physical iPhone and, if
  available, an iPad in compatibility mode.
- [x] Build 34 selected for version 1.0.1 and submitted for review.

App Store Connect submission `1d9febf2-6e1d-4350-b798-ececd1c53025` is
Waiting for Review. EAS upload `72330965-7667-4889-a32d-122e582e50cd`
completed successfully. The refreshed icon and store screenshots are prepared
for the next version and are not part of build 34.

## iOS 1.0.2 notification-enabled update

- [x] Source uses Expo SDK 54's fixed `expo-notifications` 0.32.17 package.
- [x] The unnecessary `expo-device` dependency and old iOS exclusion plugin are removed.
- [x] Settings exposes permission-aware daily reminders, target-date alerts,
  attributed affirmations, library picks, and a test notification.
- [x] Clean iOS prebuild and signed Release simulator build contain
  `expo-notifications` 0.32.17 and omit `expo-device`.
- [x] Release simulator launch stress passes 20/20 on iPhone and 20/20 in iPad
  compatibility mode with no matching crash or fatal log pattern.
- [x] Version 1.0.2 is higher than the documented last approved version 1.0.1;
  Apple processed build 41 on the 1.0.2 train before reporting the separate
  camera-purpose-string issue.
- [x] The explicit audio-only WebRTC camera API disclosure is generated into
  Info.plist and checked in the signed IPA after Apple rejected build 41.
- [ ] Physical notification permission, delivery, tap-routing, denial,
  later-enable, force-quit, target-date, affirmation, and library-pick checks pass.
- [x] Build 42 passes the complete signed-IPA review gate.
- [ ] Build 42 is uploaded and accepted by App Store Connect processing.

Build 42 artifact:

- EAS build ID: `23508566-be5a-46c4-af43-a7b0d8dd3971`
- Source commit: `74b02b3124270a6a483a42f574165b90be8a199f`
- IPA: `https://expo.dev/artifacts/eas/UC1bt3oo_knCSVE8gnRpfiqsEPx_Y-cZrezREdKrhlY.ipa`
- SHA-256: `8b93ac5143f8861724499cfc333f963d9edafb57c233113c8ea6b4b5c4b37304`
- Signed artifact gate: passed for version 1.0.2, build 42.
- EAS submission ID: `b2fbab8d-d5be-456d-8c49-8a8bfefa4685`
- Transporter result: upload accepted by App Store Connect.
- Apple processing observation: no build-42 issue email was present after the
  stated 5-10 minute window; direct TestFlight status remains to be verified.

## iOS 1.0.3 Apple Health update

- [x] Integration is opt-in, read-only, and limited to six disclosed categories.
- [x] Raw samples are processed in memory and excluded from every network path.
  A strict aggregate can enter AI context only after a per-request preview and
  is not persisted to Supabase, partner sharing, analytics, or operational events.
- [x] Settings and Mood expose owner-scoped setup, disable, collapse, empty,
  retry, refresh, and populated states without blocking mood tracking.
- [x] Privacy policy, App Store description, release notes, and review notes
  describe the same categories and data boundary.
- [x] Unit tests and TypeScript pass for the integration source.
- [x] Clean Expo prebuild emits the HealthKit entitlement, the read usage string,
  Apple's required honest update-purpose string, and no background-delivery
  entitlement. The app still requests read types only and never writes samples.
- [x] Native Release simulator build links HealthKit 14.0.2 and Nitro 0.36.5
  successfully with the legacy React Native architecture.
- [ ] The 645-row QA checklist is completed against the exact TestFlight build.
- [ ] Physical iPhone permission, partial-denial, revocation, data-state,
  per-request AI consent, network minimization, owner-isolation, older-iOS,
  VoiceOver, and Dynamic Type checks pass.
- [ ] App Store Connect App Privacy answers declare the optional derived Health
  aggregate and its app-functionality purpose consistently with the in-app
  disclosure and privacy policy.
- [ ] Current Google and Anthropic data-processing and retention settings are
  verified for the production project before Health summaries are enabled in a
  submitted build.
- [ ] `HEALTH_AI_ENABLED=true` is set on the production backend and
  `EXPO_PUBLIC_HEALTH_AI_ENABLED=true` is baked into iOS only after those
  provider and App Store privacy gates pass; both default to disabled.
- [ ] A new signed 1.0.3 artifact is uploaded, processed, selected, and submitted.

This section tracks new source work only. It is not included in the already
submitted 1.0.2 build 44.

## Android 1.0.1

- [x] Local Android Hermes export succeeds.
- [x] Isolated native prebuild emits `android:allowBackup="false"`.
- [x] Broad storage and overlay permissions are removed.
- [x] Notification and microphone permissions remain intentional.
- [x] Production build 12 was inspected and quarantined because its packaged
  manifest still had `android:allowBackup="true"`.
- [x] Backup hardening has a regression test and is pushed.
- [ ] Replacement EAS build 13 is terminal.
- [ ] Inspect build 13 with bundletool and require
  `android:allowBackup="false"`, package `com.mhtoolkit.app`, version code 13,
  the expected signer, production URLs, and no broad permissions.
- [ ] Install the exact build-13 artifact on an Android device or Play internal
  test device. No local Android emulator or `adb` runtime is currently
  available.
- [ ] Confirm the correct Google Play developer account.
- [ ] Configure a least-privilege Play service-account key.
- [ ] Upload build 13 to an internal testing track.
- [ ] Complete Play data-safety and store-listing declarations.
- [ ] Promote only after internal install, sign-in, check-in, notification,
  account-deletion, and offline smoke tests pass.

Replacement build:

- Build ID: `d1e5ed18-9653-471a-9b71-a2f151446849`
- Status at checklist update: queued
- Source commit: `be213143eea0e3e9891dd4f223b4d311b7edd3a0`

No Google Play upload has been performed.

## Dependency Audit

- [x] The root `postcss` dependency is patched to `8.5.25`.
- [x] Mobile audit exceptions and mitigations are recorded in
  `SECURITY_DEPENDENCY_EXCEPTIONS.md`; they affect build tooling, not the native
  Hermes runtime bundle.
- [x] No critical advisory is present in either production dependency audit.
- [ ] Upgrade the root and mobile `nanoid` override to `3.3.17` after the
  repository's seven-day package-age gate opens at `2026-08-10T10:39:22Z`,
  then rerun both audits and remove the temporary exception.
- [ ] Re-check Metro's transitive `image-size` advisory before every build; no
  patched release currently exists, so Metro must process trusted repository
  assets only.
- [ ] Do not use `npm audit fix --force`; its proposed Expo / React Native
  changes are incompatible and do not patch `image-size`.

## Release Decision

The iOS artifact is submitted and Waiting for Review. Android is not releasable
until replacement build 13 finishes and the exact AAB passes artifact
inspection plus an installed-device smoke test. TestFlight/Play installation,
store review, and public release remain separate states.
