# iOS everyday support: implementation and verification

Date: 2026-10-02. Scope: iOS only. Status: local implementation, NOT release-ready.

## Added

- Body practices: gentle muscle relaxation, gentle settling, and optional visual focus.
- Visual focus has explicit Start/Stop/Continue/Reset, a 30-second limit, slower/steady speed, smaller/wider travel, and a still alternative. Accessibility preferences are resolved before Start is enabled; Reduce Motion uses still focus.
- Body exercises pause or unmount on interruption/navigation. They do not require a network request, record clinical outcomes, or save partial progress.
- Worry time and My coping card reuse guided reflections, encrypted owner-scoped drafts, and Journal. Dedicated Journal filters and the existing Important action make entries retrievable.
- Worry review time uses the native date/time picker with year. It is a saved plan, NOT a notification.
- Everyday basics uses existing Habits with selectable items, no-selection protection, a rapid-tap guard, and existing duplicate detection. Existing habit points/streaks remain; no new health score is introduced.
- Draft export now includes `local_reflection_draft` in the explicit owner-checked data export.

These are original wellbeing exercises. Visual focus is not clinical EMDR, and gentle settling is not a vagus-nerve treatment or physiological reset. No trauma recall, neck pressure, or breath-holding is requested.

## Automated evidence

- Full repository suite: 211 files, 2,062 tests passed. Log: `/tmp/mhtoolkit-everyday-support-tests.log`.
- Mobile TypeScript: `npx tsc --noEmit` passed.
- Mobile ESLint: `npm run lint` passed.
- `git diff --check` passed.
- iOS QA inventory: version 2026-10-02.3, 39 routes, 843 route/control checks, 155 cross-route workflows, 998 evidence rows. Original checklist requirements retained; no hardware rows marked as passed.
- Tests cover template validation/serialization, owner isolation and encrypted draft lifecycle, subset selection, bounded visual travel, motion/timer cleanup, background/navigation interruption, Reduce Motion, and draft collision preflight.
- Passing tests do NOT cover every interleaving of draft autosave during account migration. See the open blocker below.

## Native simulator evidence

Device: MHtoolkit Redesign Preview, iPhone 17, iOS 26.4, UUID `35502CC3-209F-4A8F-AC62-61848F4C53D4`.

Release-configuration simulator build succeeded using Xcode and local ad-hoc signing. Installed bundle: `com.mhtoolkit.app`. Build log: `/tmp/mhtoolkit-everyday-support-build.log`.

Installed and built hashes matched:

- `main.jsbundle`: `6c9f7a645823e59a4d1f574ed24ccc27103e7520f3776aa69ae077706e4b943e`
- `MHtoolkit`: `0caf44d13381d6d88d8939896aec8ea7e0be67402e961420a9a2055d4d59da1e`

Observed through Device Hub clicks and native accessibility state:

- Tools -> Body practices -> each of the three practices opened correctly.
- Visual focus did not autoplay. Start, Stop, Continue, speed/range changes, completion at zero, still focus, and Reset worked. Backgrounding then reopening showed "Paused while you were away" with the remaining time intact and no automatic resumption. Initial motion checks preceded the final layout-only rebuild; still/reset and the compact screen were rechecked in the final build.
- The selected-practice layout removes the duplicate page header, keeping visual-focus Start/Stop visible beside the exercise without an initial scroll at this simulator size.
- Gentle settling: Begin, Pause, release-tension instruction, manual step navigation, Reset, and return worked.
- Muscle relaxation: selected the Hands step, started/paused, selected the final step, then Stop and return worked.
- Worry time: entered fictional QA text, selected a native calendar date, saw the year retained, removed/re-added the optional time, left/reopened the screen, and resumed the saved draft at step 4. Save succeeded and the entry appeared in Journal's Worries filter.
- Coping card: entered fictional QA words/action, left an optional prompt blank, saved, verified Coping cards filter, edited to mark Important, and verified Important filter.
- Everyday basics: unselected all five items (Add disabled), selected only two, rapidly tapped Add, and saw exactly two habits. Checked one off and undid it; count returned to 0/2. Reinstalling the same selection showed "That routine is already installed."

Test artifacts left in the simulator profile: two clearly fictional QA Journal entries and two unchecked habits (Pause for a drink, Take a screen-free rest). No real personal journal text was used. No records were permanently deleted.

## Review and unresolved blocker

Three read-only reviewers covered content/safety, correctness, and lifecycle integration. Claude Opus CLI was not authenticated; Gemini primary/fallback also required authentication. Neither external model supplied a review. Codex reviewers were used instead.

Fixed review findings: picker dismissal handling, animation-cycle reset jump, accessibility-readiness race, neutral completion wording, PMR pause guidance, draft export omission, and ordinary draft collision detection.

**P1: unfinished-reflection migration remains unsafe under concurrent autosave.** The new preflight detects an existing collision before moving server records, but does not suspend writes. A destination draft appearing during local migration can still cause source loss; one appearing during the server request can trigger a late rejection after the source account was merged/deleted. The second reviewer reproduced both with in-memory execution of production functions. The preflight is not a complete fix.

Needed repair: drain and suspend reflection writes for both owners before preflight, keep that protection through server merge, local transfer, and cleanup, and add race regression tests. Work on this repair paused after the second review per the review-loop instructions; user decision requested. Do not publish this worktree as release-ready.

Other known limits: overlapping active habits across anonymous/account profiles can cause the existing server merge to roll back on its uniqueness constraint; this task did not change that migration. Saved review-time prose does not retain an explicit timezone label. Journal AI sharing remains controlled by existing category-level consent, not a new per-entry setting.

## Not established

No physical iPhone/iPad pass, VoiceOver gesture sweep, Switch Control pass, maximum Dynamic Type pass, offline device/network test, live account-merge test, share-sheet export round trip, deletion flow, or TestFlight artifact validation was performed for these additions. Reduced Motion and interruption edge cases have automated coverage, not a complete hardware accessibility pass. Source links and every original app feature were not clicked in this scoped simulator pass.

No push, upload, App Store review submission, or release was performed.

## Content sources

- NHS worry time: https://www.nhs.uk/every-mind-matters/mental-wellbeing-tips/self-help-cbt-techniques/tackling-your-worries/
- NHS relaxation: https://www.rnoh.nhs.uk/patients-and-visitors/patient-information-guides/relaxation-techniques-pain-management
- NHS comfortable breathing: https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/breathing-exercises-for-stress/
- VA EMDR explanation: https://www.ptsd.va.gov/understand_tx/emdr.asp
- NICE PTSD treatment recommendations: https://www.nice.org.uk/guidance/ng116/chapter/Recommendations

These sources inform technique boundaries; they do not validate or endorse MHtoolkit.
