# Security Policy

MHtoolkit stores mental health data: mood entries, private journal entries,
and responses to published screeners including PHQ-9, which contains a
self-harm item. Please treat vulnerability reports here as sensitive.

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Report privately through
[GitHub Security Advisories](https://github.com/ibrolord/mental-health-project/security/advisories/new),
or by email to **bolajiag10@gmail.com** with `SECURITY` in the subject.

Please include:

- What the issue is and roughly how severe you think it is
- Steps to reproduce, or a proof of concept
- Affected area: web app, Expo mobile app, or Supabase schema and policies
- Whether you accessed any data that was not your own

You should get an acknowledgement within 72 hours. If you do not, please
email again rather than assuming it was received.

Please give a reasonable window to ship a fix before disclosing publicly.
Because approved releases publish to the App Store automatically, a mobile
fix can take several days longer than a web one.

## What we care about most

Findings in these areas are the highest priority:

- **Cross-account data access.** Every table is owner-scoped via row level
  security (`auth.uid() = user_id`). Anything that reads another user's
  moods, assessments, goals, habits, or journal entries is critical.
- **Accountability partner leakage.** Partners must only ever receive
  derived counts through the `partner_snapshot` function. Journal entries,
  AI chat history, assessment scores, and the free-text notes on mood
  entries are never shareable under any combination of scopes. A path that
  exposes any of those is critical. `npm run verify:partner-rls` asserts
  this against a real Postgres instance.
- **Invite token handling.** Partner invite tokens are generated client side
  and only their SHA-256 hash is stored. Anything that makes a stored value
  replayable, or lets an invite be accepted by an unintended party, matters.
- **Anonymous session boundaries.** Anonymous users hold real JWTs. A way to
  read or write another anonymous session's data is in scope.
- **AI consent bypass.** Chat, voice, and personalized affirmations must not
  transmit user content to a third-party model provider before explicit
  consent is recorded.

## Out of scope

- Missing security headers with no demonstrated impact
- Rate limiting on unauthenticated endpoints, absent a concrete attack
- Vulnerabilities in third-party dependencies without a working exploit path
  through this application. Dependabot already tracks these.
- Social engineering, physical access, or denial of service

## Not a security issue, but still tell us

If you find an **incorrect crisis helpline number** anywhere in the app,
please report it with the same urgency. It is not a vulnerability, but it is
the highest-harm defect this project can carry. See `lib/resources.ts` for
the verification rules that numbers must satisfy.
