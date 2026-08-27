# App Review Notes - Version 1.0.7

Last updated: August 27, 2026

## Build Under Review

- Version: 1.0.7
- iOS build: assigned by EAS at production build time
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
   category from the collapsible "Context for this chat" panel. Apple Health is
   excluded from "Use all my app context." If enabled separately, the App shows
   the exact derived summary and requires "Share once" before every request.
8. Open Settings. The user can revoke AI consent, export data, delete saved
   data, delete a permanent account, contact support, and open crisis resources.
9. On an iPhone with Apple Health available, open Settings and select "Set up
   Apple Health." The app requests read-only access to steps, exercise minutes,
   workouts, sleep, mindful sessions, and State of Mind. Return to Mood and
   expand "Apple Health context" to view permitted 7-day and 30-day summaries.
   The integration remains usable when access is partial or declined.

## Apple Health Privacy

- Apple Health integration is optional and read-only. MHtoolkit does not write
  samples to HealthKit.
- `NSHealthUpdateUsageDescription` is present because App Store processing
  requires it for the HealthKit-linked binary. Its copy states that MHtoolkit
  does not add or change Apple Health data; authorization requests contain read
  types only.
- Raw HealthKit samples, dates, source devices, and identifiers remain on the
  device and are never included in a network request.
- A user may separately enable an aggregate-only Apple Health summary in AI
  Chat. The App previews the exact 7-day and 30-day averages/counts and requires
  "Share once" for every request. The aggregate is processed transiently through
  the MHtoolkit backend and selected AI provider. A user may also explicitly add
  the aggregate to a Visit Brief and choose its recipient through the iOS share
  sheet. The aggregate payload is not persisted to Supabase, automatically
  included in partner sharing, operational events, analytics, advertising, or
  marketing. An AI response may reflect the summary and is stored only if the
  user saves the chat or reports that response.
- This path is fail-closed behind matching mobile and backend release flags. It
  is enabled in a submitted build only after the production provider's
  no-training data handling and App Store privacy answers have been verified.
- The only persisted setting is an account-scoped local boolean indicating
  whether the person chose to show Apple Health insights in MHtoolkit.
- HealthKit access can be changed at any time in the Apple Health app.

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
- Voice journal recordings are stored in a private, owner-scoped Supabase
  Storage bucket when the user saves the journal entry. The original audio can
  be played, replaced, deleted, and exported with the account. A recording is
  sent through the backend for transcription only after AI data-sharing
  consent; the resulting transcript remains editable journal text.
- Optional chat context can include recent mood patterns, mood notes,
  assessment names and scores, goals and reflections, habit names and streaks,
  journal entries, private library notes, life-planner items, and focus
  sessions.
- On iOS, a derived Apple Health summary can be added separately. It is never
  included by the full-context switch and requires a one-time preview and
  confirmation before every request.
- Context is off by default, each category has its own toggle, and the current
  toggles are reapplied immediately before every request.
- AI consent can be revoked from Settings. AI features ask again before sending
  new data after revocation.
- MHtoolkit does not sell user data or share it for advertising.

Live voice sessions are audio-only. The bundled WebRTC framework references
camera APIs, so the signed app includes Apple's required camera purpose string.
MHtoolkit does not request camera permission or capture or transmit camera data.

The privacy policy at https://mhtoolkit.vercel.app/privacy identifies the AI
providers, data categories, purposes, and consent controls.

## Accountability Partner Privacy

Partners receive only user-enabled activity counts and fixed-format
celebrations. Database authorization prevents a partner from reading raw mood
notes, journal text, AI chat history, assessment scores or responses, goal
text, habit names, planner text, focus-task text, or library notes.

## iPad Compatibility

The app is distributed as iPhone-only and requires fullscreen. It is also
tested in iPhone compatibility mode on iPad. The earlier notification launch
crash occurred on `expo-notifications` 0.32.16. This release uses 0.32.17, which
contains Expo's iOS notification-serializer thread-safety fix, and does not
include the unnecessary `expo-device` module. Local reminders are available on
iPhone and Android. The exact TestFlight artifact must pass cold-launch stress
and notification permission, delivery, tap-routing, and force-quit checks on a
physical iPhone and in iPad compatibility mode before submission.
