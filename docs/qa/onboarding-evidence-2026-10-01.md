# iOS onboarding evidence: 2026-10-01

## Scope and handoff

This change only updates the evidence content/presentation inside the existing
six-step iOS welcome flow. Existing focus, motivation, obstacle, commitment,
review/save behavior, artwork, and motion remain in place. No dependency,
landing-page, Advisor-core, profile-migration, commit, or deployment changes.

The two lead figures for reuse by the parent/landing task are below. They are
independent research/population figures, never MHtoolkit adoption or outcome data.
The existing progress-monitoring review remains the goal-specific alternative;
each onboarding path shows one evidence card, not a stack of statistics.

### Global need: nearly 1 in 7

- Exact presentation: `1 in 7`, followed by `Nearly one in seven people worldwide`
  and `lived with a mental disorder in 2023, according to WHO.`
- Source: [WHO, Mental disorders](https://www.who.int/news-room/fact-sheets/detail/mental-disorders),
  dated 11 September 2026, verified online 1 October 2026.
- Scope: WHO's estimate is 1.2 billion people across the global population in
  2023, not just adults, app users, or people with a current low mood.
- Use: the `Feel steadier` path, to contextualize the need for support.
- Limit: prevalence is not evidence for treatment effectiveness, app engagement,
  individual diagnosis, or a user's likelihood of benefiting.
- Always-visible qualifier: `A global estimate, not MHtoolkit user data.`

### Specific planning: 91% versus 38%

- Exact endpoint: reported at least one exercise session of 20 minutes or more
  in the week after the planning intervention.
- Comparison: 91% in motivation plus when-and-where planning; 38% in the control
  group receiving neither intervention. The motivation-only arm was 35%, not 38%.
- Primary source: [Milne, Orbell & Sheeran (2002), British Journal of Health Psychology,
  7, 163-184](https://bpspsychub.onlinelibrary.wiley.com/doi/pdf/10.1348/135910702169420).
  Study methods are on printed p. 168 (PDF page 6), results on printed p. 173
  (PDF page 11). The original publisher PDF was read, not just a blog summary.
- Population: final analysis of 248 UK undergraduates aged 18-34; 79 in the
  combined arm, 76 controls, 93 motivation-only. The entire study lasted two
  weeks; the displayed endpoint is the week after planning.
- Use: the `Build a routine` path. The UI labels the exercise-specific endpoint,
  intervention groups, population, and reporting method beside the comparison.
- Limit: self-report, one university sample, short duration. Not a general
  habit-success percentage, mental-health outcome, or MHtoolkit effectiveness result.
- Always-visible qualifier: `One short-term, self-reported study. Not MHtoolkit results.`

### Existing goal-specific evidence: 138 studies

- Exact presentation: `138` and `studies, with 19,951 participants`.
- Primary source: [Harkin et al. (2016), Psychological Bulletin, 142, 198-229](https://pubmed.ncbi.nlm.nih.gov/26479070/),
  DOI 10.1037/bul0000025; [publisher paper](https://www.apa.org/pubs/journals/releases/bul-bul0000025.pdf).
- Scope: a meta-analysis of randomized progress-monitoring interventions versus
  controls across differing goals/populations. Goal attainment improved on average.
- The mean effect size of 0.40 is not a 40% improvement or a 40% success rate.
- Use: `Make progress on a goal`, avoiding extrapolating the exercise percentage
  to all goals. Always-visible qualifier: `Across different goals and populations.
  Not MHtoolkit results.`

## UI and behavior

- Large numerical typography; the exercise percentages have proportional static
  bars, explicit group labels, and accessibility labels that include both numbers
  and groups. No animated count-up, invented denominator, or unlabeled score.
- Population/endpoint, short qualifier, and citation are visible without opening
  the disclosure. `Evidence details` expands limitations and `Read the source`.
- Source actions open the exact primary-source URL. Failure is visible and
  retryable; a late failure does not leak into a different step.
- The evidence illustration is still present, at a smaller height so the number
  gets priority. The existing reveal/reduced-motion behavior is unchanged.
- Large-text comparison labels stack rather than being truncated. Existing
  scroll/inline-action behavior handles large text and compact heights.

## Verification

Passed on the local working tree on 2026-10-01:

```text
npx vitest run tests/mobile/onboarding-evidence.test.ts \
  tests/mobile/onboarding-evidence-screen.test.ts \
  tests/mobile/onboarding-journey.test.ts \
  tests/mobile/advisor-welcome-contract.test.ts \
  tests/mobile/welcome-artwork.test.ts \
  tests/mobile/advisor-onboarding.test.ts
6 files, 160 tests passed

cd mobile && npx tsc --noEmit
exit 0

npm run typecheck:tests
exit 0

cd mobile && npx eslint components/AdvisorWelcome.ios.tsx lib/onboarding-evidence.ts
exit 0

npx eslint tests/mobile/onboarding-evidence.test.ts tests/mobile/onboarding-evidence-screen.test.ts
exit 0
```

The new handler tests execute the real iOS component with native views mocked.
They cover all three evidence paths, source expansion/collapse, exact URLs,
link failure/retry, stale asynchronous failure, retained answers, next-step
navigation, skip-without-save, and large-text/reduced-motion render contracts.
They do not establish native layout, gestures, actual OS URL opening, VoiceOver,
or physical-device behavior. The parent integration task owns simulator checks
and exact-artifact release verification. No release-readiness claim is made here.

Environment note: the non-login shell did not expose npm/npx initially. Tests
used the installed runtime by prepending `/opt/homebrew/bin` and
`/Users/ibrobaba/.nvm/versions/node/v22.22.2/bin` to PATH; no install was needed.

The final six-file test run and test TypeScript check were repeated after fixing
the test harness variable names flagged by the repository's Next.js ESLint rule.
All 160 tests passed again. The generic wrapper and artwork/motion files are unchanged.

## Independent review limitations

- Codex read-only CLI review was attempted but failed to initialize its in-process
  app-server inside the sandbox (`Operation not permitted`; state DB read-only).
- Gemini `gemini-3.1-pro-preview` and required `gemini-2.5-flash` fallback both
  required interactive authentication. No reviewer verdict was obtained.
- These are unavailable reviews, not passes. Parent integration/release review
  must not describe the implementation as independently approved by those models.

## Native checks for the parent integration pass

1. Select each focus, reach step 4, and verify its number, scope and citation are
   visible and scrollable. The exercise comparison must show 91% and 38% with the
   correct group labels; no claim says 91% of MHtoolkit users improved.
2. Expand/collapse `Evidence details`, open each source, return to the app, and
   continue to step 5 without losing motivation/obstacle answers.
3. Repeat on compact iPhone and accessibility text sizes with Reduce Motion on.
   Check comparison labels, source controls, and bottom actions for clipping.
4. With VoiceOver, verify each number/group is read together, the endpoint and
   qualifier are reachable, and the source disclosure reports expanded state.
5. Finish and skip paths are still separate. This evidence change must not alter
   any saved profile, consent, or source-sharing choice before `Save my plan`.

No simulator or physical-device result for this change is claimed in this note.
