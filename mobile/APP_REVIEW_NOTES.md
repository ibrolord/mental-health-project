# App Review Notes - Version 1.0.1

Last updated: August 6, 2026

## Build Under Review

- Version: 1.0.1
- iOS build: 34
- Bundle ID: `com.mhtoolkit.app`
- Support URL: https://mhtoolkit.vercel.app/support
- Support email: bolajiag10@gmail.com

No login is required for the core review path. MHtoolkit creates a private
anonymous session so check-ins and other entries can be saved. Accountability
partner features require a permanent account because two verified accounts are
needed to establish a partnership.

## Suggested Review Path

1. Launch the app and continue anonymously.
2. Save a mood check-in, return to the dashboard, and reopen the mood tracker.
   The new entry appears in mood history.
3. Open Assess. PHQ-9, GAD-7, and CBI identify their recall period, scoring
   method, limitations, and published source before questions begin and again
   on the result screen.
4. Add goals and habits. Repeated taps are guarded and duplicate active entries
   are rejected by the database.
5. Open Library. The release contains books, videos, and original in-app
   profiles of public figures, with citations and actions that can be added to
   goals, habits, or private notes.
6. Review Journal, Life Planner, Focus Mode, Meditation, Mind Games, and Ground
   Me. These tools work without an account.
   Focus Mode includes optional bundled ambient audio. A selected focus sound
   continues through the timer and while the device is locked, and stops when
   the user chooses Quiet or leaves Focus Mode.
7. Open AI Chat. Sending a message first displays the AI data-sharing consent
   flow. Personal context is off by default and can be enabled category by
   category from the collapsible "Context for this chat" panel.
8. Open Settings. The user can revoke AI consent, export data, delete saved
   data, delete a permanent account, contact support, and open crisis resources.

## Medical And Safety Boundaries

MHtoolkit is a self-management and reflection tool. It does not diagnose,
treat, or replace a doctor or licensed professional. Users are told to seek
professional advice before medical decisions.

Assessment sources shown in the app:

- PHQ-9: Kroenke K, Spitzer RL, Williams JB. The PHQ-9: validity of a brief
  depression severity measure. J Gen Intern Med. 2001.
  https://pubmed.ncbi.nlm.nih.gov/11556941/
- GAD-7: Spitzer RL, Kroenke K, Williams JB, Lowe B. A brief measure for
  assessing generalized anxiety disorder: the GAD-7. Arch Intern Med. 2006.
  https://pubmed.ncbi.nlm.nih.gov/16717171/
- CBI Personal Burnout: Kristensen TS, Borritz M, Villadsen E, Christensen KB.
  The Copenhagen Burnout Inventory: a new tool for the assessment of burnout.
  Work & Stress. 2005.
  https://nfa.dk/media/hl5nbers/cbi-first-edition.pdf

PSS-4 is not exposed because MHtoolkit does not have documented usage
permission from the rights administrator. Historical stored PSS-4 results
remain available in user exports.

If PHQ-9 item 9 is above "Not at all," the app shows immediate safety guidance
and crisis-resource actions before the result. AI chat also intercepts explicit
crisis language with a deterministic safety response instead of relying on a
model-generated answer.

## AI Data Sharing

- Chat messages are sent through the MHtoolkit backend to Anthropic Claude or
  Google Gemini to generate a response.
- Live voice audio is sent through the backend to OpenAI for transcription.
  Push-to-talk audio is sent to Google Gemini; compatible recordings may use
  OpenAI as a fallback. The transcript is then handled like a chat message.
  AI response text is sent to Google Gemini for generated spoken playback, with
  OpenAI and then the operating-system speech service used as fallbacks.
- Optional chat context can include recent mood patterns, mood notes,
  assessment names and scores, goals and reflections, habit names and streaks,
  journal entries, private library notes, life-planner items, and focus
  sessions.
- Context is off by default, each category has its own toggle, and the current
  toggles are reapplied immediately before every request.
- AI consent can be revoked from Settings. AI features ask again before sending
  new data after revocation.
- MHtoolkit does not sell user data or share it for advertising.

The privacy policy at https://mhtoolkit.vercel.app/privacy identifies the AI
providers, data categories, purposes, and consent controls.

## Accountability Partner Privacy

Partners receive only user-enabled activity counts and fixed-format
celebrations. Database authorization prevents a partner from reading raw mood
notes, journal text, AI chat history, assessment scores or responses, goal
text, habit names, planner text, focus-task text, or library notes.

## iPad Compatibility

The app is distributed as iPhone-only and requires fullscreen. It has also been
tested in iPhone compatibility mode on an iPad Air 11-inch (M3) simulator. The
iOS native build excludes the notification and device modules that caused the
earlier iPad launch crash; notification reminders remain available on Android.
