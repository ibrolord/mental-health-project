# Physical iOS QA Runbook

This runbook closes the hardware-only release gates in `QA_PROTOCOL.md`. It
does not replace the 645-row artifact-bound run.

## 1. Prepare both devices

Use one physical iPhone and one physical iPad. On each device:

1. Update to the intended supported iOS/iPadOS version.
2. Connect by cable, unlock the device, tap **Trust This Computer**, and keep it
   awake during setup.
3. Enable **Settings > Privacy & Security > Developer Mode** when Xcode device
   inspection or Accessibility Inspector will be used. TestFlight itself does
   not require Developer Mode; if it remains off, record the installed version
   and build manually in the TestFlight checklist row.
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

## 4. Apple Health proof

Use an iPhone with Health data available. Record only permission and UI outcomes;
never put Health samples, screenshots of Health details, or derived values in the
QA repository.

1. From Settings, start Apple Health setup and confirm the system sheet lists
   only steps, exercise minutes, workouts, sleep, mindful sessions, and State of
   Mind. Confirm there is no write permission.
2. Allow every category, save a fresh sample in Health, refresh Mood, and confirm
   the collapsible 7-day and 30-day context updates without a network request.
3. Repeat after allowing one category and denying the rest, then after denying
   every category. Mood tracking must remain usable and the app must not claim it
   can identify which read categories were denied.
4. Revoke access in Health after setup, force quit, relaunch, expand the card, and
   confirm a private empty or recoverable state with no crash.
5. Switch between two MHtoolkit owners and confirm the local display preference
   does not cross accounts. Delete saved data and confirm the preference clears.
6. Exercise loading, empty, populated, refresh, collapse, background, and relaunch
   states with VoiceOver and the largest Dynamic Type setting.
7. In AI Chat, confirm Apple Health is off, excluded from "Use all my app
   context," and not restored on relaunch. Enable it, inspect the exact preview,
   cancel, and prove no request was sent. Repeat with Share once and prove the
   request contains only the bounded aggregate, never samples, dates, source
   devices, or identifiers. A second message must ask again.
8. Capture a redacted network trace and device log search proving raw Health
   samples never leave the device and the derived aggregate never reaches
   Supabase persistence, partner sharing, analytics, advertising, logs, or backups.
9. On the oldest supported iOS version, confirm unavailable State of Mind access
   is omitted while the remaining available categories still work.

## 5. Seven-role identity matrix

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

## 6. Supabase management verification

Prefer a short-lived Supabase OAuth credential with the official `auth:read`
scope. Store it only in the ignored repository `.env.local`:

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

If the account UI only offers a broad personal access token, do not create it.
Inspect Authentication > Providers and URL Configuration in the authenticated
Supabase dashboard, then store a non-secret attestation in the ignored
`mobile/qa/runs/` directory. It must be less than 24 hours old, match the
production project ref, and confirm all six management-only checks. Run:

```bash
npm run verify:social-auth -- \
  --dashboard-evidence mobile/qa/runs/<build>-social-auth.json
cd mobile
npm run qa:ios:physical-preflight -- \
  --run qa/runs/<build>.json \
  --social-auth-evidence qa/runs/<build>-social-auth.json
```

## 7. Final gate

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
