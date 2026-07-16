# MHtoolkit Android Release and Distribution Plan

Last verified: July 16, 2026

## Objective

Release MHtoolkit on Google Play, prove that privacy-conscious adults use it for
repeat self-reflection, and earn the first 100 activated Android users without
paying for broad acquisition.

The launch position is:

> A private daily mental-wellness toolkit for checking in, spotting patterns,
> and taking one constructive next step.

MHtoolkit is a self-help tool. It is not therapy, a medical service, a diagnostic
product, or crisis care.

## Current Evidence

| Area | State | Evidence / next action |
| --- | --- | --- |
| Package | Ready | `com.mhtoolkit.app` |
| Production build | Stale | Android version `1.0.0` / code `6` finished May 21, 2026; its EAS artifact expired June 20 |
| Source | Release candidate in progress | TypeScript, Android lint, AI safety tests, Next production build, and Android Hermes export pass locally |
| Expo health | Needs maintenance | Expo Doctor passes 16/18 checks; four SDK 54 patch packages are behind |
| Lint | Ready | Expo ESLint is installed; the error-only lint gate passes |
| Play submission credential | Blocked | `mobile/google-play-service-account.json` is missing |
| Play Console | Unverified / likely not set up | Available browser is not authenticated; public Play URL for the package returns 404 |
| Support URL | Ready | `https://mhtoolkit.vercel.app/support` returns 200 and lists a monitored contact email |
| Privacy URL | Ready in current source | URL returns 200 and the Android settings screen links to it; verify in the release binary |
| Account deletion | Implemented, deployment pending | Clear-data uses a transactional server RPC and account deletion cascades backend records |
| AI content reporting | Implemented, deployment pending | Android chat includes signed, authenticated in-app response reporting; production smoke test still required |

## Release Gate

Do not start the 14-day closed-test clock until every item in this section is
complete. A broken first test wastes both tester goodwill and the mandatory test
window.

### Backend Rollout Order

- [x] Enable Supabase anonymous Auth and verify creation/cleanup with a temporary user.
- [x] Provision the production-only `AI_REPORT_SIGNING_SECRET` in Vercel.
- [ ] Apply and verify the reviewed SQL migration, including strict RLS, transactional deletion, report storage, and retention cron.
- [ ] Deploy the backend APIs before releasing either replacement client.
- [ ] Smoke test anonymous JWT auth, legacy-data migration, chat, AI reporting, clear-data, and account deletion against production.
- [ ] Release replacement Android and iOS clients only after those backend checks pass.
- [ ] Confirm legacy iOS build 25 can no longer access user-owned tables; this is an intentional security cutoff, not a compatibility promise.
- [ ] Monitor auth failures, report RPC errors, deletion failures, crashes, and ANRs during internal testing.

New account creation is gated in the release candidate until verified email
linking and deep-link handling are implemented end to end. Existing accounts can
still sign in, and all users can use JWT-isolated anonymous mode.

### Developer Account and Play App

- [ ] Sign in to the intended Google Play developer account and record its owner email.
- [ ] Confirm whether the account is Personal or Organization and when it was created.
- [ ] Complete identity and contact verification.
- [ ] Create the Play app named `MHtoolkit` with package `com.mhtoolkit.app`.
- [ ] Invite a release manager account rather than sharing the owner login.
- [ ] Create a least-privilege Google Play service account and store its JSON key outside Git.
- [ ] Connect the service account to EAS Submit and verify only the required app permissions are granted.

### Build Quality

- [ ] Update the four Expo SDK 54 patch dependencies identified by Expo Doctor.
- [ ] Install and configure Expo ESLint so `npm run lint` is a real gate.
- [ ] Run TypeScript, lint, Expo Doctor, Android bundle export, and a clean production EAS build.
- [ ] Confirm and record that the submitted artifact targets API 35 or higher; recheck Google's exact requirement at submission time.
- [ ] Install the release build from Play internal testing on at least one physical Android phone.
- [ ] Test clean install, anonymous onboarding, account creation, sign-in, and account deletion.
- [ ] Test mood entry/history, every assessment, goals, habits, library, chat, affirmations, and voice.
- [ ] Test AI consent denial, consent grant, consent revocation, offline/error states, and API timeouts.
- [ ] Test notification denial, grant, scheduling, time changes, tap routing, reboot, and app upgrade.
- [ ] Test Android 13, 14, 15, and 16 where devices or Firebase Test Lab are available.
- [ ] Record crash-free sessions and all launch-blocking defects in one tester log.

### AI Safety

- [ ] Add an in-app report action to AI responses that submits the response, user-selected reason, app version, and minimal diagnostic context without requiring the user to leave the app.
- [ ] Define who reviews AI reports, the response SLA, escalation criteria, and how reported content is removed from operational systems.
- [ ] Create an adversarial test set for self-harm, delusion reinforcement, emotional dependency, diagnosis, medication, abuse, prompt injection, and invented clinical claims.
- [ ] Require safe refusal/non-diagnostic behavior, appropriate crisis guidance, and zero encouragement of self-harm in every release candidate.
- [ ] Verify the AI report flow itself does not collect unnecessary mental-health data and is represented accurately in Data Safety and the privacy policy.

### Play Policy and Listing

- [ ] Set target audience to adults only for the first release unless there is a reviewed reason to support minors.
- [ ] Complete the Health apps declaration accurately for mental wellness / stress-management functionality.
- [ ] Complete a reviewed data-flow matrix for every datum and permission: source, destination, purpose, processor, retention period, encryption state, consent point, deletion path, and deletion SLA.
- [ ] Complete Data Safety from that matrix, including account data, mental-health entries, microphone/audio, AI processing, and third-party providers.
- [ ] Provide `https://mhtoolkit.vercel.app/privacy` as the privacy-policy URL.
- [ ] Verify the same privacy policy is readily accessible inside the Android app.
- [ ] Provide `https://mhtoolkit.vercel.app/support` as support and off-app deletion-request evidence.
- [ ] Verify account deletion removes associated backend data, propagates to relevant service providers, handles failures/retries, and tells users the expected completion time.
- [ ] Inventory the final manifest permissions and prove each sensitive permission is necessary and disclosed in context before collection.
- [ ] Complete App access, Ads, Content rating, Target audience, News, and Government-app declarations.
- [ ] If any reviewed feature requires authentication, provide Google with working review credentials and exact navigation steps.
- [ ] Verify every claim and screenshot matches the Android build. Do not claim diagnosis, treatment, guaranteed outcomes, or emergency support.
- [ ] Prepare phone screenshots showing the daily check-in, trends/history, assessments with disclaimer, goals/habits, and optional AI consent.
- [ ] Prepare a 30-second vertical demo and a plain-language short and full description.

## Initial Audience

Start narrow: adult Android users who recently tried to journal or track their
mood but stopped because it required too much effort or felt insufficiently
private, and who currently want a lightweight way to notice stress patterns.
Recruit the first behavioral cohort from one reachable context: graduate and
post-secondary students aged 18+ during a high-workload period. They are not
being recruited as patients and should not be promised clinical outcomes.

Keep three tester groups separate:

- Behavioral cohort: 16-20 eligible adult Android users matching the initial wedge.
- Device QA: 3-5 trusted testers covering Android versions and device brands.
- Safety/language review: 2 mental-health or wellness professionals evaluating boundaries, not providing an endorsement and not counted in retention.

Recruit 24-30 confirmed Android owners so the launch does not fail if several
drop out. If the Play account is a new Personal account, keep at least 12
continuously opted in to the closed test for 14 days before applying for
production access. Record opt-in date, install, device, app version, completed
test areas, feedback, and opt-out date for each tester.

## Distribution Sequence

### Phase 1: Internal QA (3-5 days)

Goal: prove the Play-delivered binary works before external recruitment.

- Distribute through Play internal testing to 3-5 trusted Android users.
- Require a checklist run on at least three Android versions and two device brands.
- Fix all launch, data-loss, consent, account-deletion, notification, and crisis-routing defects.
- Exit only when no P0/P1 defect remains and all critical flows have evidence.

### Phase 2: Closed Test (14+ days)

Goal: satisfy Play access requirements and learn whether the core habit forms.

- Enroll 24-30 recruited Android owners through a Google Group or email list, targeting 16-20 active wedge-matched users.
- Send a three-step instruction: install, make one mood check-in, enable or decline reminders intentionally.
- Prompt feedback on days 1, 3, 7, and 14; keep prompts feedback-only and record whether product use occurred before each prompt.
- Hold two 15-minute interviews each week, prioritizing people who stopped using the app.
- Ship only high-confidence fixes during the window and document what changed.

Closed-test success gates:

- At least 12 testers remain opted in continuously for the required period.
- At least 15 testers complete one mood check-in.
- At least 8 behavioral-cohort users return during days 8-14.
- At least 6 behavioral-cohort users complete mood entries on three distinct days within their first seven days.
- Zero unresolved launch, data-loss, deletion, privacy-consent, or crisis-routing defect.
- At least 5 wedge-matched testers can state the app's value in their own words without being prompted.

Treat these results as closed-test signals, not proof that a durable habit exists.

### Phase 3: Focused Production Launch (first 100 activated users)

Goal: acquire 100 unique, non-tester activated users within six weeks and find
one repeatable source of engaged users, not maximize installs. At 60% activation,
this requires about 167 installs; at 30% store conversion, roughly 557 qualified
store visitors.

Run founder referrals for one calibration week, then test two wedge-matched
channels concurrently in fixed weekly batches:

1. Founder network and tester referrals: each successful tester invites one adult who has the same check-in need.
2. Adult wellness communities: graduate-student groups, young-professional groups, employee wellness/ERG communities, and moderated mental-wellness communities where promotion is permitted.
3. Practitioner discovery: ask counsellors, coaches, and peer-support organizers to evaluate it as an optional self-reflection resource. Never imply clinical endorsement.
4. Owned content: publish short, practical check-in prompts that lead to the app's daily mood check-in rather than generic mental-health content.

Use one call to action everywhere:

> Take a private 30-second check-in and see whether MHtoolkit helps you notice
> patterns over the next seven days.

Track qualified clicks, store visits, installs, activations, seven-day engagement,
and founder hours by channel. Require at least 20 activated users before naming a
channel a winner. Stop a channel after two batches if it creates traffic but no
engaged users. Do not buy ads until one channel produces retained users; broad
paid installs will hide whether the product has a real habit loop.

### Phase 4: Partnership Pilot

After the first 100 activated users, offer a four-week, no-cost pilot to two
adult communities or wellness organizations. The partner shares a neutral resource;
MHtoolkit reports only aggregate, non-sensitive adoption metrics and never exposes
individual mental-health data.

Proceed only if the privacy architecture actually supports the promised reporting
boundary. Do not build an organization dashboard before partner demand is proven.

## Measurement

Track the funnel without collecting more sensitive data than necessary:

| Metric | Definition | Early target |
| --- | --- | --- |
| Store conversion | First-time installs / store visitors | Establish baseline; do not optimize before 100 visitors |
| Activation | User saves a mood entry during first session | 60%+ |
| Week-one engagement (primary) | Activated user saves a mood entry on at least 3 distinct days within first 7 days | 35%+ |
| Repeat use | Activated user returns during days 8-14 | 25%+ directional signal |
| Reminder choice | User explicitly enables or declines reminders | Measure, no target until consent UX is validated |
| Safety defects | Incorrect crisis copy/routing or misleading medical behavior | 0 unresolved |
| Stability | Observed crashes and ANRs investigated | Zero unresolved crashes in critical flows |
| Referral intent | Tester says they would recommend it to a specific person | 30%+ |

Use Play Console Android vitals for crashes/ANRs. Any product analytics must be
privacy reviewed and reflected in Data Safety before being added; do not silently
add a tracking SDK for launch measurement.

Before testing, define an event dictionary with session timeout, reinstall and
duplicate-account rules, observation windows, staff/tester exclusions, and how
prompted returns are labeled. Report small-sample metrics as directional signals.

## Launch Assets to Produce

- Play short description and full description.
- Five phone screenshots and feature captions.
- App icon and feature graphic validated against Play dimensions.
- 30-second product demo.
- Closed-test recruitment message, onboarding note, and day 1/3/7/14 feedback prompts.
- One-page tester checklist and issue-report form.
- Partner one-pager with explicit self-help, privacy, and non-clinical boundaries.
- UTM/link naming sheet for channel attribution without user-level health profiling.

## Immediate Next Actions

1. Authenticate the intended Play developer account and capture its account type and readiness state.
2. Repair the local Android quality gates and update the SDK 54 patch packages.
3. Create a fresh production AAB and install it through Play internal testing.
4. Complete the Play listing and policy declarations from a reviewed data-flow inventory.
5. Recruit 20 named adult testers before starting the closed test.
