# First 500 Activated Users

## Objective

Reach 500 unique activated users within eight weeks of public web launch while
protecting the product's privacy and non-clinical positioning.

An activation is a first completed check-in. The primary retention signals are:

- 175 users complete check-ins on at least three distinct days in their first
  seven days (35% of activations).
- 125 users return during days 8-14 after activation (25% of activations).
- At least 10 partners distribute a tracked link to an audience they already
  serve.

## Funnel Math

| Stage | Target rate | Required volume |
| --- | ---: | ---: |
| Qualified landing-page visits | - | 2,800 |
| Challenge starts | 30% | 840 |
| First check-ins | 60% | 504 |
| Three-of-seven-day users | 35% of activations | 176 |
| Days 8-14 returning users | 25% of activations | 126 |

The launch should optimize activation and repeat use, not raw traffic. Pause a
channel after 100 qualified visits if it activates fewer than 10 users, unless
there is strong qualitative evidence that the landing message is the problem.

## Initial Audience

Start with adults in Canadian post-secondary and early-career communities who
want a lightweight way to notice patterns in how they are doing.

Do not lead with minors, crisis populations, clinical treatment, classroom
mandates, or employer monitoring. MHtoolkit should be offered as an optional,
private self-reflection tool.

## Channel Allocation

| Channel | Activation target | Mechanism |
| --- | ---: | --- |
| Campus and student organizations | 200 | 10 partners x 20 activations |
| Wellness and peer-support practitioners | 100 | 10 partners x 10 activations |
| Small aligned creators | 100 | 10 creators x 10 activations |
| Member referrals | 75 | In-product share after a completed check-in |
| Founder-led organic distribution | 25 | LinkedIn, X, email, and direct outreach |

Paid acquisition is intentionally excluded. Do not buy traffic until one
organic channel produces both activation above 20% and days 8-14 return above
20%.

## Eight-Week Sequence

### Week 0: Release Foundation

- Deploy the new landing page and social share card.
- Apply the privacy-preserving attribution migration.
- Confirm `/`, `/onboarding`, `/privacy`, and `/support` on desktop and mobile.
- Run `npm run growth:report` and archive the zero-state output.
- Resolve the Apple agreement and Google Play credential blockers separately;
  the web challenge does not wait for them.

### Weeks 1-2: 100-User Pilot

- Send 10 personalized partner requests per weekday.
- Ask five existing contacts per weekday to try the check-in themselves.
- Publish the founder launch post and two product-demonstration posts.
- Onboard the first three campus or community partners with one tracked link
  each.
- Interview 10 activated users after day seven. Ask what made them start, what
  made them return, and what felt unclear.

### Weeks 3-4: Repeat the Winning Partner Motion

- Keep only partner segments that activate at least 20% of qualified visitors.
- Ask each successful partner for one introduction to a similar organization.
- Publish partner-specific copy and a 20-second screen recording.
- Reach 300 cumulative activations.

### Weeks 5-6: Creator and Referral Expansion

- Brief 10 creators with 5,000-50,000 followers whose content is about student
  life, early-career stress, journaling, or practical wellbeing.
- Use demonstration-first content, not testimonials or health claims.
- Prompt activated users to invite one person after a check-in.
- Reach 450 cumulative activations.

### Weeks 7-8: Close the Gap

- Re-run the two highest-retention channels.
- Follow up with every partner who opened or replied but did not distribute.
- Publish an honest progress update with aggregate counts only.
- Stop at 500 activations and complete the retention review before scaling.

## Weekly Operating Cadence

| Day | Work |
| --- | --- |
| Monday | Run growth report, update scorecard, choose one channel constraint |
| Tuesday | 10 partner outreaches, one founder post, user interviews |
| Wednesday | 10 partner outreaches, creator outreach, landing-copy review |
| Thursday | Partner enablement, follow-ups, one product demonstration |
| Friday | Score replies, activations, and retention; stop weak experiments |

## Decision Gates

- **Scale:** 20%+ visit-to-activation and 20%+ days 8-14 return.
- **Repair:** 10-19% activation with user feedback showing a fixable message or
  onboarding problem.
- **Stop:** Under 10% activation after 100 qualified visits.
- **Safety stop:** Any partner asks for user-level mood data, compulsory use, a
  clinical claim, or an endorsement MHtoolkit cannot substantiate.

## Measurement Boundaries

Launch measurement starts at `2026-07-19T13:00:00Z`. A person whose first-ever
check-in predates that boundary is an existing user and is not counted toward
the 500-user launch goal.

The acquisition table stores only an allowlisted source, medium, campaign,
content label, platform, user ID, and timestamp after a first check-in. It does
not store referrer URLs, ad identifiers, notes, moods, assessments, chat
content, or creator-specific free text. Reports use aggregate cohorts only.
Missing attribution is reported as `unattributed`, never relabeled as direct.
Any nonzero unattributed count makes `npm run growth:report` exit with a warning
so channel claims stop until measurement is repaired.
