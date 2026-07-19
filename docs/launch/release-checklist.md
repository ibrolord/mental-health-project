# Release and Distribution Checklist

Last updated: July 19, 2026

## Web

- [x] Landing page presents the seven-day challenge and one primary CTA.
- [x] Support page is available at `https://mhtoolkit.vercel.app/support`.
- [x] Privacy page describes coarse campaign attribution accurately.
- [x] Social share card is generated without sensitive data.
- [x] Production build completes across all routes.
- [x] Deploy the current commit to production.
- [x] Verify `/`, `/onboarding`, `/privacy`, `/support`, and the Open Graph image
  on the production URL.

## Measurement

- [x] Attribution values are allowlisted and arbitrary free text fails closed.
- [x] Attribution is recorded only after a successful first check-in.
- [x] Referral links do not contain a user identifier.
- [x] Aggregate report excludes moods, notes, assessments, and chat content.
- [x] Apply both privacy-preserving growth migrations to production.
- [x] Run Supabase security and performance advisors: zero notices.
- [x] Run the first `npm run growth:report`: zero launch activations and zero
  unattributed activations.
- [x] Verify complete export, transactional deletion, attribution deletion, and
  account deletion against production using `npm run verify:data-lifecycle`.

## iOS

- [x] EAS production build 27 succeeded.
- [x] Build ID: `66f9a0a5-20db-4c4d-a140-1422c94d1e42`.
- [x] Local iOS Hermes export succeeds.
- [x] Download and inspect the build 27 IPA.
- [x] Verify iPhone-only device family, fullscreen compatibility mode, production
  configuration, current support metadata, and absence of excluded
  notifications/device native symbols.
- [ ] Apple Account Holder accepts the updated Apple Developer Program License
  Agreement.
- [x] Attempt one submission without creating duplicates.
- [ ] Submit build 27 after the agreement is accepted.
- [ ] Confirm App Store Connect processing and select build 27 for review.

Current blocker: submission `f7fecc40-7a85-46d3-82e7-b4ec32747055` for build 27
failed before upload with Apple HTTP 403
`FORBIDDEN.REQUIRED_AGREEMENTS_MISSING_OR_EXPIRED`. EAS marks this submission
non-retryable.

The app is free. Banking, tax, and the Paid Apps agreement are not required for
this release; the updated developer license agreement is.

## Android

- [x] EAS Android build version code 8 succeeded.
- [x] Build ID: `44fecaef-171b-4d04-afba-d3bdc0803a6c`.
- [x] Local Android Hermes export succeeds.
- [x] Verify the AAB signature, package, notification permission, and presence
  of Android notification/device modules.
- [x] AAB:
  `https://expo.dev/artifacts/eas/SLEcQ8KXVxnulcFcXJ7frz5l8tvYISxR1NdpI6ZxJ9I.aab`
- [ ] Confirm the correct Google Play developer account.
- [ ] Create and configure a least-privilege Google Play service-account key.
- [ ] Upload to an internal testing track.
- [ ] Complete Play data-safety and store-listing declarations.
- [ ] Promote only after internal install and check-in verification.

## Launch

- [x] Prepare the launch plan, partner one-pager, canonical campaign links,
  content calendar, outreach copy, prospect list, and scorecard.
- [x] Prepare the first three personalized partner email drafts.
- [ ] Send the first 10 personalized partner messages.
- [ ] Publish the founder LinkedIn post.
- [ ] Record the 20-second product demonstration.
- [ ] Start weekly scorecard review.
- [ ] Interview 10 users after their seventh day.
