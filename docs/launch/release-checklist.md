# Release and Distribution Checklist

Last updated: July 19, 2026

## Web

- [x] Landing page presents the seven-day challenge and one primary CTA.
- [x] Support page is available at `https://mhtoolkit.vercel.app/support`.
- [x] Privacy page describes coarse campaign attribution accurately.
- [x] Social share card is generated without sensitive data.
- [x] Production build completes across all routes.
- [ ] Deploy the current commit to production.
- [ ] Verify `/`, `/onboarding`, `/privacy`, `/support`, and the Open Graph image
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

- [x] EAS production build 26 succeeded.
- [x] Build ID: `e3785def-56e0-4401-bbf7-00b5cd7ce69c`.
- [x] Local iOS Hermes export succeeds.
- [ ] Apple Account Holder accepts the updated Apple Developer Program License
  Agreement.
- [ ] Retry submission once, without creating duplicate submissions.
- [ ] Confirm App Store Connect processing and select build 26 for review.

Current blocker: submissions `b12c3bc1-c5ae-4baa-8f8e-9eec94735d51` and
`237dfde5-7ad8-48ca-83d8-652319033cea` failed before upload with Apple HTTP 403
`FORBIDDEN.REQUIRED_AGREEMENTS_MISSING_OR_EXPIRED`.

The app is free. Banking, tax, and the Paid Apps agreement are not required for
this release; the updated developer license agreement is.

## Android

- [x] EAS Android build version code 7 succeeded.
- [x] Build ID: `c867676b-b2fd-4afa-948d-50eeaadf0c4a`.
- [x] Local Android Hermes export succeeds.
- [x] AAB:
  `https://expo.dev/artifacts/eas/Gnb9z44nGeNrgJr6z8cg8oFvznhYff-XPmDZN18FRtI.aab`
- [ ] Confirm the correct Google Play developer account.
- [ ] Create and configure a least-privilege Google Play service-account key.
- [ ] Upload to an internal testing track.
- [ ] Complete Play data-safety and store-listing declarations.
- [ ] Promote only after internal install and check-in verification.

## Launch

- [ ] Send the first 10 personalized partner messages.
- [ ] Publish the founder LinkedIn post.
- [ ] Record the 20-second product demonstration.
- [ ] Start weekly scorecard review.
- [ ] Interview 10 users after their seventh day.
