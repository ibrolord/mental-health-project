# Physical iOS QA Runbook

This runbook closes the hardware-only release gates in `QA_PROTOCOL.md`. It
does not replace the 629-row artifact-bound run.

## 1. Prepare both devices

Use one physical iPhone and one physical iPad. On each device:

1. Update to the intended supported iOS/iPadOS version.
2. Connect by cable, unlock the device, tap **Trust This Computer**, and keep it
   awake during setup.
3. Enable **Settings > Privacy & Security > Developer Mode**, restart, and
   confirm Developer Mode after the restart.
4. Install the release through **TestFlight**. Do not sideload the IPA or use an
   Xcode development build.
5. Open TestFlight and confirm the exact marketing version and build from the
   QA run.

Run the diagnostic from `mobile/`:

```bash
npm run qa:ios:physical-preflight -- --run qa/runs/<build>.json
```

Do not begin the evidence run until every preflight line passes.

## 2. Spoken voice hardware proof

Record one continuous screen video on the physical iPhone:

1. Start from a terminated TestFlight app.
2. Open Voice Support and accept the AI disclosure.
3. Grant microphone permission on the first attempt.
4. Say a unique, harmless phrase that is not present elsewhere in the app.
5. Confirm the transcript preserves the meaning of the spoken phrase.
6. Confirm the response is audible through the speaker.
7. Interrupt playback by speaking, confirm playback stops, and confirm the new
   turn is transcribed and answered.
8. Move the app to the background during recording and playback; return and
   confirm the microphone and audio session recover without duplicate messages.
9. Deny microphone permission in Settings and confirm the app provides a
   recoverable error without crashing. Restore permission and repeat once.

Attach the recording timestamp and a redacted direct-observation note to the
voice rows. Never include the actual private transcript in QA evidence.

## 3. VoiceOver and Dynamic Type sweep

Run every route using only VoiceOver. Each visible control must have a concise
name, role, state, and action; focus order must follow the visual task order.
Record any unlabeled, duplicated, unreachable, or misleading element as a
failure.

Repeat the route/layout sweep at these text sizes:

- Default
- Extra Large
- Accessibility Large
- Accessibility Extra Extra Extra Large

At every size verify reflow, scrolling, keyboard avoidance, modal dismissal,
tab visibility, no clipped text, and no overlapping controls. Also test Reduce
Motion, Increase Contrast, and Button Shapes. Use Xcode Accessibility Inspector
as a supplement, then repeat every failed flow with VoiceOver on the device.

## 4. Seven-role identity matrix

Use non-PII labels in the run and private credentials outside the repository:

| Role | Required state |
| --- | --- |
| `fresh-anonymous` | New install, no saved data |
| `saved-anonymous` | Mood, goal, habit, journal, and planner data saved |
| `email-owner` | The saved anonymous profile upgraded in place |
| `google-owner` | Saved anonymous profile linked to a real Google identity |
| `apple-owner` | Saved anonymous profile linked on the signed physical device |
| `partner` | Separate non-anonymous account with an accepted active link |
| `revoked-partner` | Separate account whose prior link is revoked |

For each provider upgrade, record the Supabase user ID before and after. The IDs
must match. Validate active partner aggregates, every sharing toggle, raw private
row denial, celebration/reward actions, duplicate invite handling, and denial
after revocation. Run these automated supplements before the device matrix:

```bash
cd ..
npm run verify:auth-partner-live
npm run verify:partner-rls
```

## 5. Supabase management verification

Create a short-lived, least-privilege Supabase access token with
`auth_config_read` access. Store it only in the ignored repository `.env.local`:

```text
SUPABASE_ACCESS_TOKEN=<redacted>
```

The verifier reads the token from the process environment or `.env.local` and
never prints it:

```bash
cd ..
npm run verify:social-auth
```

Revoke the token after the release evidence is complete.

## 6. Final gate

After every row has evidence and `metadata.completedAt` is set:

```bash
cd mobile
npm run qa:ios:digest -- --run qa/runs/<build>.json
npm run qa:ios:status -- --run qa/runs/<build>.json
npm run qa:ios:verify -- \
  --run qa/runs/<build>.json \
  --expected-run-sha256 <digest-pinned-outside-the-run-file>
```

Only the final zero exit closes the physical QA gate.
