# Evidence-led iOS onboarding

## Direction

Evolve the selected Guided Start design, not the app's identity. Keep the existing
forest/cream/sage palette, Georgia headings, and Feather icons.
Replace the single page with two short, optional stages: choose a focus, then see
a relevant approach and open the corresponding tool. Avoid a long questionnaire,
artificial loading, testimonials, default permissions, and invented success rates.

The user then requested illustrations AND animation and delegated the choice.
Selected the first displayed concept, Quiet Momentum (`selected-quiet-momentum.png`).
Its human editorial artwork replaces the faint botanical backdrop. Three original
bundled PNG scenes show pausing, writing a routine, and planning a small goal; the
scene follows the focus selection. Concise connected choice rows preserve the
single primary action. Native back navigation remains; artwork is smaller than
the concept so all choices and actions fit the captured native viewport.

## Pattern research

- [Apple onboarding guidance](https://developer.apple.com/design/human-interface-guidelines/onboarding): focused, optional, interactive learning rather than a mandatory tour.
- [Finch's new-user guide](https://help.finchcare.com/hc/en-us/articles/42149821015693-New-User-Guide): small initial actions and gradual discovery. MHtoolkit does not copy Finch's automatically created goals.
- [Fabulous journeys](https://help.thefabulous.co/en/support/solutions/articles/101000427409-what-is-a-journey-): outcome-oriented choices and small routines.

These are observable design patterns, not evidence that this particular flow has
better conversion or retention. No comparative onboarding experiment was found.

## Evidence rules

The typed registry in `mobile/lib/onboarding-evidence.ts` is the copy source of
truth. Every card includes a primary study, population/outcome context, and an
expandable limitation. Numbers describe the original research, not MHtoolkit users.

- Mood: [Lieberman et al., 2007](https://pubmed.ncbi.nlm.nih.gov/17576282/), a laboratory emotion-labeling task. No clinical percentage is claimed.
- Routine: [Milne et al., 2002](https://bpspsychub.onlinelibrary.wiley.com/doi/10.1348/135910702169420), motivation plus specific exercise planning, compared with controls. The full paper's Results and Limitations were checked, not a popular summary.
- Goals: [Harkin et al., 2016](https://doi.org/10.1037/bul0000025), a progress-monitoring meta-analysis. Effect size is not represented as a success percentage.

Do not use another app's product-specific results as proof for MHtoolkit.

## Behavior and motion

1. Focus choices update local draft state only. The first CTA advances without saving.
2. The second stage shows one relevant card, the actual next tool, optional name, and the Advisor priority that confirmation saves.
3. Change focus preserves the name draft; study details collapse on stage changes.
4. Only the final CTA uses the existing owner/visit-protected save and route handoff.
5. Skip and Support remain available during hydration or saving. Skipping does not save a changed name or chosen focus.
6. A 320 ms native-driver opacity/12-point entrance transition gives a clear stage change. Choice checkmarks use the same brief reveal. Artwork crossfades over 360 ms with a restrained 900 ms settling motion. No loops, timer, or delayed navigation.
7. Reduce Motion, unknown preference, and preference-query failure all render static, fully visible content. Live preference changes cancel animation.
8. Large text and short windows use scrolling actions rather than a viewport-consuming fixed footer. Study detail, source, and name are progressively disclosed.
9. At accessibility text sizes the decorative illustration is removed, not the user's choices. Display headings use a smaller base size while still scaling. Keyboard avoidance keeps the optional-name field and both actions above the software keyboard.
10. Static artwork uses one plain Image, not animated images with literal opacity. Native testing exposed an iOS animated-property detach bug; the static branch now unmounts the animated layers entirely.

## Scope

Native iOS resolves `AdvisorWelcome.ios.tsx`; other platforms retain their prior
component. No new permissions, analytics, AI calls, account creation, real goals,
habit records, or Health data are introduced by the onboarding itself.

Claude CLI design review was attempted but could not run because the CLI is not
authenticated. Do not label this an Opus-approved design. Independent Codex review
and native simulator evidence are recorded separately in QA.md.
