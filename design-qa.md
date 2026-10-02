# Yoga Design QA

## Evidence

- Source visual truth: `/var/folders/81/3jk89wyx1_90jf69l47zg2nc0000gn/T/TemporaryItems/NSIRD_screencaptureui_jdRBPt/Screenshot 2026-08-06 at 4.36.59 PM.png`
- Browser-rendered implementation: `/tmp/mhtoolkit-yoga-restorative-final-desktop.png`
- Side-by-side comparison: `/tmp/mhtoolkit-yoga-comparison-final.png`
- Mobile implementation: `/tmp/mhtoolkit-yoga-restorative-mobile-after.png`
- State: Restorative yoga, step 1, timer idle, safety disclosure collapsed.
- Desktop CSS viewport: 1600 x 1200 at device scale 1.
- Source pixels: 1674 x 1606. Implementation pixels: 1585 x 1057 after browser chrome and scrollbar. The comparison normalizes both captures to 800 pixels wide and pads only the shorter canvas; no content is stretched.

## Findings

No actionable P0, P1, or P2 issues remain.

- Fonts and typography: Existing MHtoolkit display and body families, weights, hierarchy, and wrapping remain consistent. The pose title and instructions are readable without crowding.
- Spacing and layout rhythm: The media and instruction areas are now independent cards. The pose artwork no longer inherits the taller instruction-card height, and the previous blank lower-left area is gone.
- Colors and visual tokens: Existing cream, forest, sage, and rust tokens are preserved. The soft blurred media backdrop fills the frame without competing with the pose.
- Image quality and asset fidelity: The full square illustration is shown with `object-contain`; the replacement depicts a recognizable floor-based Supported Child's Pose over a bolster with the complete body and prop visible.
- Copy and content: Equipment, alt text, safety modification, and step instructions now match the floor-based pose. Safety detail is available in a collapsed disclosure rather than dominating the task.
- Responsiveness: At the mobile viewport, the page has no horizontal overflow and the media, instruction card, and fixed navigation stack correctly.
- Interactions and accessibility: Practice selection, safety expand/collapse, Begin, Pause, Continue, Reset, and step navigation were exercised. A fresh browser pass produced no console warnings or errors.

## Comparison History

1. Earlier P1: the chair-supported image did not read clearly as restorative yoga and was severely cropped inside a tall media track.
2. Earlier P2: one shared card forced the image column to follow the instruction column height, creating dead space and an unbalanced composition.
3. Fixes: generated a floor-based Supported Child's Pose over a bolster; synchronized it across web and iOS; separated media and instruction cards; preserved the full asset with a contained foreground and soft background fill; collapsed the long safety notice.
4. Post-fix evidence: the desktop and mobile captures show the entire pose, accurate matching instructions, balanced independent cards, and no horizontal overflow.

## Focused Comparison

The full-view comparison keeps the complete source card readable at 800 pixels wide, so an additional focused crop was not needed. The pose, title, equipment, safety treatment, timer, and step controls are all visible in the same comparison.

## Implementation Checklist

- [x] Replace ambiguous chair variation with floor-based restorative yoga.
- [x] Prevent pose-art cropping on web and iOS.
- [x] Remove shared-column dead space.
- [x] Keep safety guidance accessible without permanent clutter.
- [x] Verify desktop and mobile responsive states.
- [x] Verify primary controls and browser console.

final result: passed

---

# iOS Experience Redesign QA

## Evidence

- Selected design direction: `/Users/ibrobaba/.codex/generated_images/019d90ff-c6ec-7f71-bba9-3628d8f9926e/exec-03b072e8-4854-4bf8-9154-5a147726902e.png`
- Final iPhone Simulator capture: `/tmp/mhtoolkit-redesign-iphone-final-3.png`
- Final side-by-side comparison: `/tmp/mhtoolkit-design-comparison-final.png`
- iPad compatibility-mode capture: `/tmp/mhtoolkit-redesign-ipad.png`
- Devices: iPhone 17 simulator and iPad Air 11-inch (M3) simulator, iOS/iPadOS 26.4.

## Findings

No actionable P0, P1, or P2 visual issues remain in the redesigned high-frequency experience.

- Hierarchy: Today now presents one emotional check-in, one adaptive next action, and a simple day list instead of competing dashboard cards.
- Navigation: The five primary destinations are Today, Mood, Talk, Tools, and You. Secondary capabilities remain discoverable through grouped disclosures.
- Typography and color: The existing forest, parchment, sage, and clay palette is retained. Editorial serif display type is used for calm hierarchy, with sans-serif body copy for legibility.
- Density: The initial implementation pushed Your Day below the first viewport. Header spacing, the mood control, and the botanical card were tightened while preserving 44-point-or-larger interactive targets.
- Mood: Today and Mood share one five-choice picker and the same saved state. Optional detail remains progressively disclosed.
- Goals: Goal rows expose completion and details as distinct actions. The details sheet has one save action, milestone due dates, collapsed notes/files, and a direct pending-goal focus handoff.
- Talk: Conversation is primary; data-context controls are optional and closeable.
- Tools and You: Yoga, member sharing, accountability, support, research, and low-energy preference remain available without returning them to Today.
- Accessibility: Status changes announce through `AccessibilityInfo`; modal motion respects Reduce Motion; tabs permit font scaling; touch targets and labels are present in the inspected accessibility tree.

## Interaction Coverage

- [x] Today mood save and adaptive next-action change.
- [x] Mood details expand/collapse and history disclosure.
- [x] Talk context expand/collapse.
- [x] Tools group expand/collapse and route navigation.
- [x] You account/support navigation.
- [x] Goals list, detail sheet, milestone create/edit/clear due date, close, and back navigation.
- [x] iPhone launch and five-tab navigation.
- [x] iPad iPhone-compatibility launch and primary tab navigation.
- [x] 28-route, 575-control, and 102-cross-route inventory generation.

## Remaining Release-Specific Evidence

- Physical-device VoiceOver, largest Dynamic Type, spoken audio, and TestFlight artifact execution remain separate release gates. Simulator and source evidence do not replace them.
- Signed IPA inspection is intentionally deferred until a new build number and IPA exist.
- Production social-auth management verification still requires the scoped Supabase auth-read credential or a fresh dashboard attestation.

## Correctness Review

- Independent review found and closed anonymous-account discoverability and low-energy preference ordering issues.
- Goal details now guard unsaved Focus handoff, milestone/file mutations, milestone-date edits, and visible delete failures.
- Talk now serializes context selection and consent changes, rejects stale hydration, and prevents stale save completions from changing the current conversation state.
- Mood labels no longer cap Dynamic Type scaling.
- Final automated verification: 142 test files and 903 tests passed; mobile TypeScript and ESLint passed.

final result: passed

---

# Mood Tracker Design QA

## Evidence

- Source layout: `/tmp/mhtoolkit-mood-audit/figma-opus-refined-v2.png`
- Mobile implementation: `/tmp/mhtoolkit-mood-audit/current-mobile-emoji.png`
- Desktop implementation: `/tmp/mhtoolkit-mood-audit/current-desktop-emoji.png`
- Side-by-side comparison: `/tmp/mhtoolkit-mood-audit/reference-vs-current.png`
- Browser viewports: 390 x 844 and 1024 x 900.

## Findings

No actionable P0, P1, or P2 visual issues remain.

- The five mood choices stay on one row at the mobile viewport without horizontal overflow.
- Emoji are the primary mood cue, while labels and a visible check mark preserve clarity and selection state.
- The card follows the source hierarchy and spacing without the former two-column mobile stack.
- Emotion words and suggested actions now adapt to the selected mood, including positive language for positive moods.
- History, export, and the sleep diary remain available without dominating the primary check-in flow.
- The trend card is compact and renders a visible point when only one check-in exists.
- Context and the secondary history disclosure were exercised in the browser with no console warnings or errors.

## Intentional Differences

- The source used text-only mood chips. The implementation restores emoji at the user's request.
- The source showed a selected neutral mood. Current evidence preserves the user's saved positive check-in rather than changing private mood data for a screenshot.

## Verification

- [x] Mobile layout at 390 x 844.
- [x] Desktop layout at 1024 x 900.
- [x] Context expand and collapse.
- [x] History and sleep expand and collapse.
- [x] Positive, neutral, and lower mood vocabularies covered by tests.
- [x] No browser console warnings or errors.

final result: passed

---

# Guided Start iOS Onboarding QA - September 27, 2026

## Evidence

- Source visual truth: `/Users/ibrobaba/codex/mhtoolkit/docs/design/ios-onboarding-2026-09-27/concept-guided-start.png`.
- Final native implementation: `/Users/ibrobaba/codex/mhtoolkit/docs/design/ios-onboarding-2026-09-27/19-guided-start-final.png`.
- Final full-view combined comparison: `/Users/ibrobaba/codex/mhtoolkit/docs/design/ios-onboarding-2026-09-27/20-guided-start-comparison-final.png`.
- Final focused choice-list comparison: `/Users/ibrobaba/codex/mhtoolkit/docs/design/ios-onboarding-2026-09-27/21-guided-start-choice-comparison-final.png`.
- Largest Dynamic Type captures: `16-largest-text-top.png`, `17-largest-text-actions.png`, and `18-largest-text-choice.png` in the same evidence directory.
- State: Build a routine selected, optional name collapsed, no entered name, cream theme, `/advisor-setup?mode=welcome&returnTo=today`.
- Environment: actual React Native iOS 26.4 development client in Device Hub; not a browser mockup or TestFlight build.
- Source is 853 x 1844 pixels. Native window capture is 790 x 1720 pixels. The comparison crops the native image at x61/y327 to 668 x 1233, excluding desktop/device chrome and native status/back regions, then scales both to 393 pixels wide without stretching height. Combined canvas: 802 x 850. Native logical point width was not instrumented; 393 is comparison width, not a claimed measured device viewport.
- The source has no native safe area/back header and contains extra quote/reassurance copy intentionally removed in implementation. Heights are therefore not identical; do not interpret canvas padding or remaining rounded screen corners as app layout differences.

## Findings

- [P2, fixed and verified] Skip fell below the initial native viewport. Reduced gaps and row padding preserve touch sizes while exposing both actions in final capture `19`.
- [P2, fixed and verified] Artwork had an interior rectangular left boundary, then disappeared after the first sizing correction. An explicit full-width frame and image dimensions restore the existing raster; final comparison `20` confirms the result.
- [P2, fixed and verified] At the largest Dynamic Type size, Optional squeezed the name label into broken word fragments. The labels now stack at accessibility sizes, verified in capture `17`.
- [P3, fixed and verified] The selected radio now uses the source's filled indicator with a white check, verified in comparison `21`.

No actionable P0/P1/P2 visual finding remains in the final standard-size welcome state. This is not a full-device accessibility or release certification.

## Required Fidelity Surfaces

- Fonts/typography: Native Georgia headings and serif brand retain the source hierarchy; native sans-serif body text uses the existing app typography. The generated raster's exact font cannot be established. Final default-size text is readable. Largest text reflows vertically, with stacked name labels and reachable actions; full VoiceOver/form testing remains separate.
- Spacing/layout: Connected list, preview, name disclosure, and full-width pill CTA match the selected structure. Native back navigation is intentionally retained. Both primary and skip actions are visible without scrolling at the captured standard size.
- Colors/tokens: Existing cream, forest, sage selection, rust eyebrow, and outlined borders retained. Native choice rows are slightly lighter than the generated image, intentionally using the app's card token.
- Image quality: Reuses the existing watercolor branch raster rather than inventing new vector artwork. Its orientation differs from the generated concept but preserves the established brand asset. Final header framing and blend were visually inspected; decoration is hidden at large text sizes.
- Copy/content: Main heading, three options, preview, and primary action follow the selected concept. Removed decorative quote and extra reassurance intentionally. Preview instead explicitly explains the saved Advisor priority; name is visibly optional. Skip copy changes when an unsaved name or pending save exists.

## Comparison History

1. Captured native first pass with routine selected; opened source and implementation together.
2. Created and inspected normalized full-view and focused choice-list comparisons.
3. Found skip visibility and artwork seam issues above. Applied spacing, artwork, and radio fixes.
4. The Mac initially locked, delaying native checks. After unlocking, capture `08` confirmed skip visibility but exposed missing artwork; explicit sizing corrected it.
5. Captured and inspected comparisons `14` and `15`. Tested all three destinations, optional name, skip, Support/Back, and cold-relaunch persistence in the native client.
6. Largest text revealed name-label crowding; stacked the labels and verified the corrected layout and skip. Restored original text size and preview preferences.
7. Captured final state `19`; generated and inspected full-view comparison `20` and focused comparison `21` after the last edit. Passed the scoped visual gate based on these images, not unit tests alone.

## Implementation Checklist

- [x] Selected concept implemented using native components and existing artwork.
- [x] Preview and primary label update on native routine selection.
- [x] Automated routing, save-failure, owner-isolation, and stale-navigation checks pass.
- [x] Both independent correctness-review findings fixed and rechecked.
- [x] Recapture post-fix screen and compare again.
- [x] Click all three native destinations, skip, name, back, and Support.
- [x] Verify saved name/focus after a native cold relaunch.
- [x] Check welcome choices and exit at largest Dynamic Type; restore original setting.
- [ ] Physical VoiceOver, full large-text form sweep, compact iPhone, and iPad.
- [ ] Native fault-injection/owner-switch integration and exact signed-release QA.

Detailed implementation/verification record: `/Users/ibrobaba/codex/mhtoolkit/docs/design/ios-onboarding-2026-09-27/GUIDED-START-QA.md`.

final result: passed

Scope of this result: selected welcome visual fidelity at the captured standard size, with the documented largest-text checks. Remaining device, integration, and release checks above are not implied to pass.

---

# Illustrated Quiet Momentum iOS QA - September 27, 2026

## Evidence

- Source: `/Users/ibrobaba/codex/mhtoolkit/docs/design/ios-onboarding-motion-2026-09-27/selected-quiet-momentum.png`.
- Implementation: `26-illustrated-final.png` in the same directory; actual native iOS 26.4 development client, not a browser clone.
- Full comparison: `27-illustrated-final-comparison.png`; focused selector comparison: `28-illustrated-final-choice-comparison.png`. Both inspected after the final motion fix.
- State: routine selected, first stage, cream theme, normal text size.
- Source 853 x 1844; native window 790 x 1720. Native app-content crop x61/y327, 668 x 1233. Both normalized to width393 without stretching height; combined canvas802 x850. The native logical viewport was not instrumented; comparison393 is not a measured native point width.
- Native safe-area/back controls intentionally retained. Shorter native content height is an explicit adaptation, not a one-to-one pixel match.

## Findings And Iterations

- [P2 fixed, observed] Initial illustration pushed the third option behind the footer. Reduced hero height to a viewport-bounded size; all choices and both actions are fully visible in capture14.
- [P2 fixed, observed] Largest-text heading split a word across lines. Smaller display base size continues to scale while preserving whole words; captures16 and17 show the heading and reachable controls.
- [P1 fixed, native recheck passed] Live Reduce Motion exposed inactive animated layers, overlapping illustrations. Replaced the animated subtree with one plain selected Image. Post-unlock native reduced/normal/reduced tests showed single static scenes when enabled and restored animation when disabled. Recordings23/24 and capture25 document the fix; recording19 remains failure evidence. Original Reduce Motion = 0 was restored and verified in Settings.

## Required Fidelity Surfaces

- Typography: Georgia display heading/brand and native sans copy match the editorial hierarchy. Choice descriptions were removed visually as in the selected concept, retained in accessibility labels. Heading and CTA wrap at large text.
- Spacing: selected connected list and one primary action preserved. Art is intentionally smaller to retain existing native Back controls and keep all three choices visible. Corners and gaps use existing tokens.
- Colors: existing cream, forest, pale sage, and clay Support action retained. No purple or new palette. Selection is indicated by text and filled check, not color alone.
- Image quality: original generated RGBA illustrations, same character and gouache palette. Routine shows writing rather than the concept's generic pause scene, intentionally responding to the selected focus. Subject, transparent edges, hands, and crop were visually inspected. No CSS/SVG replacement art.
- Copy: headline, supporting sentence, focus labels and first CTA match the selected concept. Research remains on stage two with study context and source, not an invented app success claim.

## Verification

- 616 mobile tests; TypeScript and targeted lint passed.
- Native selection, first-stage progression, optional-name keyboard, skip-without-save, final Goals handoff and saved priority verified.
- Artwork absent from the native accessibility tree. Large text and normal-motion recording inspected.
- Independent reviewer found no bug in the Reduce Motion correction; the required native reconciliation retest passed. Final full and selector comparisons inspected; no actionable P0/P1/P2 visual issue remains within this captured welcome-state scope.
- No full VoiceOver, compact iPhone/iPad, or exact signed-release claim.

final result: passed

Scope: illustrated onboarding fidelity at the captured simulator size and the documented motion/large-text checks only. Final preview is open; original test settings restored. Physical accessibility, compact iPhone/iPad layouts, and exact signed-artifact release QA remain separate gates. No push, submission, or release was performed.

---

# Six-Step Personal Onboarding QA - September 27, 2026

## Findings

- **[P2 open, functional] Retrying an account migration after a later-store failure
  can discard newly edited anonymous answers.** The provisional target copy is
  treated as an intentional target plan on retry, then the newer source is
  cleared. Independent reproduction is recorded in the journey QA report. Track
  provisional-copy provenance or roll back an unchanged provisional target;
  cover failure, source edit, and retry. Further runtime edits are paused pending
  user confirmation because the configured two-round review limit was reached.
- **[P2 fixed, visual] Header/safe-area duplication and undersized opening art.**
  Welcome now handles its safe-area inset without a redundant native stack header;
  opening art has a larger viewport-bounded frame. Post-fix capture `01-focus.png`
  and comparison `14-final-design-comparison.png` show all focus choices and exits.
- **[P2 fixed, behavior] Restored custom-action editing and completion navigation.**
  Clearing/reselecting a custom action no longer unmounts/erases its field. Final
  save dismisses to Advisor rather than retaining setup in a duplicate tabs stack.
  Both rechecked through native interactions after the changes.

## Evidence And Normalization

- Source visual truth: `/Users/ibrobaba/codex/mhtoolkit/docs/design/ios-onboarding-motion-2026-09-27/selected-quiet-momentum.png`.
- Implementation: `/Users/ibrobaba/codex/mhtoolkit/docs/design/ios-onboarding-journey-2026-09-27/01-focus.png`.
- Full comparison: `14-final-design-comparison.png`; focused choice-list comparison:
  `16-final-choice-comparison.png` in the journey directory. Both opened together
  and inspected after the final art-size change.
- Source853x1844; native window790x1720. App-content crop x61/y238,w668,h1301;
  both normalized to width393 without height stretching. Combined full-view
  canvas802x850. This is native React Native, not CSS; logical viewport/density
  were not instrumented. Bottom rounded screen corners remain in the crop and
  are not implementation defects. Source has no native status/safe-area regions.
- Focused source crop x43/y1086,w767,h435; native x101/y1007,w588,h264; both
  normalized to width393. Different row heights are an intentional native fit.
- State: routine selected, normal text, motion allowed, cream theme, iOS26.4
  ExpoSDK54 development client. Six progress segments replace two intentionally.
- Screens `02` through `06` show the new motivation, obstacle, research, action,
  and review states. Some are scrolled so options or actions can be inspected;
  screenshot contact sheet `15` is an overview, not uniform-scroll proof.

## Required Fidelity Surfaces

- Typography: existing Georgia heading and wordmark with native sans controls.
  Default headings and choices are legible; native row density is intentionally
  tighter than the generated source. Large-text evidence/action/review and name
  keyboard remain reachable; a complete physical VoiceOver sweep was not done.
- Spacing/layout: original connected selector and single primary footer retained.
  Later screens scroll, with Back and Skip available. Artwork is smaller on the
  five question/review screens; it is hidden at accessibility text sizes.
- Colors/tokens: cream, forest, sage selected state, clay support/research labels.
  Checked radio and text communicate selection without relying only on color.
- Image quality: bundled original transparent gouache scenes, same character and
  palette. Routine shows writing, motivation a photo, obstacle clearing a desk,
  evidence reading, and review a doorway. No vector/emoji approximations.
- Copy/content: benefits and personal motivation precede the plan; real study
  metrics include the measured outcome and expandable sources. No fabricated
  MHtoolkit success percentage. Optional name, custom answers, and skip work.

## Iterations And Verification

1. Implemented six stages using the previously selected art direction and four
   additional original assets. Fixed safe-area layout and Unicode plan-ID collision.
2. Native click-through found/prompted keyboard and custom-field checks; corrected
   transient custom-action editing and final navigation. Retested save, Settings
   editing, replay-without-save, and Advisor's visible use of motivation/action/cue.
3. Initial comparison `11` showed smaller first-screen art and mismatched selected
   state. Enlarged art, selected routine, recaptured `01`, and compared `14`/`16`.
   No actionable visual P0/P1/P2 remains in the captured standard-size state.
4. Native Reduce Motion uses one static scene; largest-text evidence/commitment/
   review and keyboard checked. Original simulator preferences and demo profile
   restored. Preview reopened without saving new draft choices.
5. 828 mobile tests, TypeScript, scoped ESLint, and iOS JavaScript export passed.
   Full-repo run has three unrelated outreach-data failures. Independent review
   still found the migration retry bug above; tests do not override that evidence.

## Checklist

- [x] Six illustrated/animated native screens with sourced evidence.
- [x] Personal motivation/action/cue persistence and visible Advisor integration.
- [x] Preset/custom editing, back/skip, Settings replay, and saved-plan preservation.
- [x] Combined source/render comparison and post-fix recapture.
- [x] Scoped Reduce Motion, Dynamic Type, and keyboard tests.
- [ ] Fix and retest the confirmed migration retry data-loss sequence.
- [ ] Physical accessibility, compact iPhone/iPad, live auth migration, and full
  signed-artifact release checklist.

final result: blocked

Blocker is the confirmed migration retry defect, not a remaining captured visual
mismatch. No commit, push, App Store submission, or release was performed.
Details: `/Users/ibrobaba/codex/mhtoolkit/docs/design/ios-onboarding-journey-2026-09-27/QA.md`.
