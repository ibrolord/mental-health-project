# MHtoolkit Riverstone Redesign

Design direction produced by Claude Opus after reviewing 12 current native iOS screens.

## Product Thesis

MHtoolkit is a pocket regulation tool, not a wellness dashboard. Its job is to get someone from "I feel bad" to "I did one thing" quickly, then get out of the way. Each screen should lead with one clear action and create calm through restraint: one hero, generous space, and a stacked-stone identity that communicates steadiness rather than achievement.

## Visual Direction

Riverstone is warm, editorial, and still. Typography does the work; ornament is intentionally limited.

### Typography

- Display: serif, 30-34px, for one screen thesis line.
- Title: sans-serif, 20px semibold, for section headings.
- Body: sans-serif, 16px/24px, dark neutral on cream.
- Meta: sans-serif, 12px uppercase with restrained tracking and terracotta color, no more than once per screen.
- Avoid stacking an uppercase eyebrow, oversized serif heading, and long paragraph above every screen.

### Layout

- Use an 8px base rhythm with 8, 16, 24, and 40px vertical intervals.
- Use 20px screen and card padding.
- Leave at least 24px between the hero and first control.
- Do not fill intentional whitespace with decorative cards.

### Card Hierarchy

1. Hero content uses the cream canvas and is defined by typography and space, not a container.
2. Action rows use a sage-tinted fill, 16px radius, and no shadow.
3. Inputs and secondary insets use a one-pixel neutral hairline.

Remove drop shadows and boxed quick-action grids. Use surface contrast rather than elevation.

### Color Roles

- Cream `#F5F1E6`: canvas.
- Deep green `#1F3D30`: primary text, buttons, and active states.
- Sage `#8FA396` and tint `#EDEFE8`: calm surfaces.
- Terracotta `#B5512E`: eyebrows, progress, and rare accents.
- Amber `#C68A2E`: gentle warnings only.

Do not use gradients or full terracotta backgrounds.

### Identity

Use rounded 1.5px line icons paired with labels. The stacked-stone mark appears in the app icon, launch experience, and as a 28px mark on tab roots only. It must not become a decorative empty-state illustration or looping animation.

## Information Architecture

Use no more than five bottom tabs:

1. Home: daily check-in, affirmation, and Right Now access.
2. Reflect: mood, weekly reflection, and journal.
3. Practice: grounding, meditation, focus, and habits.
4. Learn: library and assessments.
5. You: profile, accountability, life planner, settings, and AI Chat entry.

Provide a persistent Right Now action above the tab bar. AI Chat remains reachable from Home and You instead of occupying a permanent tab.

## Screen Specifications

### Home

Above the fold: brand mark, one-line greeting, unboxed seven-day check-in strip, and today's affirmation. The single primary action is "Check in today." Remove the six-tile Quick Actions grid and move Invite someone to Accountability.

### Grounding

Above the fold: short heading, one supporting sentence, then symptom-first choices immediately. Use sage action rows with an icon, bold state, and one short description. Keep "You can stop or switch anytime" once under the header and a quiet, persistent Talk to someone action at the bottom.

### Library

Above the fold: display line, search input, and real results. Replace stacked format and topic filters with one horizontal row and a Filters sheet. Lead with one Up next resource. Show the reviewed-resource count once.

### Accountability

Above the fold: one-line value statement, sharing toggle, and exact aggregate-only partner preview. Show the privacy boundary as concise Shared and Never shared rows. Use one account CTA with a text sign-in link rather than two equal buttons.

### Focus

Above the fold: timer, 15/25/50 presets, and an enabled deep-green Start action. Move advanced controls behind Adjust or a gear. Optional preparation must never block starting.

### Journal

Above the fold: one prompt and the writing field. Keep a single New entry action. Remove the second hero and duplicate CTA. Render previous entries as a quiet reverse-chronological list.

### Meditation

Above the fold: one recommended practice with duration and Play. Put practices before filters, and move topic filtering into a sheet. Resume an unfinished session at the top when applicable.

### Mood

Above the fold: today's mood selector and a seven-day pattern strip. The primary action logs today's mood. A weekly summary may describe observed patterns neutrally but must not diagnose or imply causation.

### AI Chat

Above the fold: one collapsed context-transparency row and the composer. Replace stacked warning banners with one short boundary line and three starter prompts. Keep immediate-help access visible without turning the empty state into a warning wall.

### Assessments

List plain instrument names, purposes, question counts, expected time, and last-taken date. Replace cryptic letter badges. Frame assessments as reflection tools and avoid medical claims or diagnosis language.

## Motion System

Motion confirms state and calms. It does not entertain.

### Tokens

- Instant: 120ms.
- Base: 220ms.
- Enter: 320ms.
- Standard easing: cubic-bezier(0.2, 0, 0, 1).
- Exit easing: cubic-bezier(0.4, 0, 1, 1).
- Stone settle easing: cubic-bezier(0.16, 1, 0.3, 1), used only at launch.
- Small entrance shift: 8px.

### Behavior

- Route content fades and rises 8px over 320ms.
- Action rows scale to 0.98 on press over 120ms.
- Check-in and mood confirmation fills one dot over 220ms.
- Progress dots may stagger by 40-60ms, with no more than three staggered elements.
- Bottom sheets rise over 320ms while the backdrop fades to 40 percent.
- The stone mark settles once at launch over 500ms and then remains still.

Total chained motion should not exceed 400ms.

### Reduced Motion

Honor `AccessibilityInfo.isReduceMotionEnabled`. Replace translate and scale with opacity-only transitions of 120ms or less. Render progress and the stacked-stone mark directly in their final state.

### Prohibited Motion

- Confetti or celebration bursts.
- Bounce or spring overshoot.
- Parallax and looping ambient animation.
- Pulsing backgrounds or controls.
- Gradient shimmer.
- Streak pressure or warning animation.
- Motion on safety warnings.

## New Surfaces

### Right Now

One-tap access to grounding from anywhere. Start with symptom-first choices, retain contact options, require no account, and do not require logging.

### Weekly Reflection

Show check-in days, a mood pattern, one neutral summary, and one reflection prompt. Include an optional partner preview generated from the exact aggregate object exposed to the partner.

### Accountability Privacy Sheet

Before opt-in, show exactly what is shared and never shared. Sharing is user-controlled and database-enforced. The partner projection can contain counts and streak state only. It must never contain journal text, AI chat history, assessment scores, mood notes, goal text, or habit names.

### Today

A focused Home surface combining today's check-in state, one suggested practice, and an affirmation. This replaces the existing quick-action grid instead of adding another dashboard card.

## Implementation Priority

### P0: Trust and Access

- Add Right Now access without burying it in navigation.
- Establish the five-tab architecture.
- Implement and verify the aggregate-only accountability projection and privacy preview.
- Correct the Focus Start state.
- Reduce AI Chat to one concise boundary disclosure.

### P1: Clarity and Core Loop

- Apply Riverstone typography, color, spacing, and card tokens.
- Consolidate Home.
- Remove Journal duplication.
- Simplify Library filtering.
- Add the Mood weekly pattern.
- Replace cryptic assessment labels.

### P2: Polish

- Surface Meditation practices before filtering.
- Simplify Grounding choices.
- Apply motion and reduced-motion behavior.
- Add the single launch stone-settle animation.
- Connect Weekly Reflection to Journal.

## Design Rule

When a screen contains two heroes, two primary actions, or a boxed grid, remove one. Do not add another card to balance it.
