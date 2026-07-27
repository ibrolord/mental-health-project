# App Review Response Notes - May 12, 2026

## Rejection Addressed

Submission ID: 416226a1-16ae-422d-93a8-edb47fbfe654
Version reviewed: 1.0 (24)
Review device: iPad Air 11-inch (M3)

Apple cited:

- Guideline 1.4.1: App description needed a medical disclaimer reminding users to seek a doctor's advice in addition to using the app and before making medical decisions.
- Guideline 1.4.1: The Assess section needed easy-to-find citations for medical or health information, including recommendations, calculations, wellness reports, and assessment references.

Changes made:

- Updated the App Store description and promotional text with a direct medical disclaimer: MHtoolkit does not provide diagnoses or treatment advice, and users should seek a doctor's or licensed professional's advice before medical decisions.
- Added visible clinical source citations in the mobile Assess list, before each screener begins, and on each result screen.
- Updated result copy to describe "symptom ranges" from screeners instead of diagnostic conclusions.
- Retained the previous AI data-sharing consent and anonymous review access fixes.

## Reviewer Notes Draft

No login is required to review MHtoolkit. Full functionality is available in anonymous mode.

Suggested review path:

1. Launch the app and continue anonymously.
2. Open Assess. Each tool identifies its recall period, measure type, and published source.
3. Start PHQ-9, GAD-7, or the CBI Personal Burnout measure. The app explains the medical limitations before questions begin. PHQ-9 and GAD-7 include the published daily-functioning follow-up, which is shown separately and is not added to the total score.
4. Complete a tool. The result page shows the scoring limitation, published source, and non-diagnostic wording.
5. On PHQ-9 item 9, choose any option above "Not at all" to verify that immediate safety guidance and U.S./Canada 988 actions appear before the result.
6. Use mood tracking, goals, habits, library, and settings without an account.
7. Open AI Chat. The app shows an AI data-sharing disclosure and asks for consent before sending any chat text or personalized context to third-party AI providers.
8. Turn on Personalized Responses only if you want to verify that recent moods, assessment results, goals, and habits can be included in AI requests after consent.
9. Open Voice Support. The app explains voice AI data sharing and asks for consent before requesting microphone permission or sending audio for transcription.
10. Open Daily Affirmations and tap "Generate AI Affirmation with My Data." The app asks for consent before sending mood, assessment, and goal context for AI generation.
11. Settings > Privacy & Data Protection shows AI consent status and allows consent revocation.
12. Settings > Support & Feedback shows the developer email and links directly to the public support and crisis-resources page.

Assessment sources shown in app:

- PHQ-9: Kroenke K, Spitzer RL, Williams JB. The PHQ-9: validity of a brief depression severity measure. J Gen Intern Med. 2001. https://pubmed.ncbi.nlm.nih.gov/11556941/
- GAD-7: Spitzer RL, Kroenke K, Williams JB, Lowe B. A brief measure for assessing generalized anxiety disorder: the GAD-7. Arch Intern Med. 2006. https://pubmed.ncbi.nlm.nih.gov/16717171/
- CBI Personal Burnout: Kristensen TS, Borritz M, Villadsen E, Christensen KB. The Copenhagen Burnout Inventory: A new tool for the assessment of burnout. Work & Stress. 2005. https://nfa.dk/media/hl5nbers/cbi-first-edition.pdf

The PSS-4 is not exposed in this release because MHtoolkit does not have a documented usage permission from the rights administrator. Historical stored PSS-4 results remain part of user exports.

AI data-sharing update:

- Chat messages are sent through the MHtoolkit backend to Google Gemini or Anthropic Claude to generate responses.
- Voice recordings/transcripts are sent through the MHtoolkit backend to OpenAI for transcription and spoken playback, and transcripts are sent to an AI provider for responses.
- Personalized AI features can include recent moods, assessment scores, goals, and habits.
- MHtoolkit does not sell user data or share it for advertising.
- The privacy policy at https://mhtoolkit.vercel.app/privacy now identifies the AI providers, data categories, purposes, and consent/revocation path.

Support contact:

- Email: bolajiag10@gmail.com
- Support URL: https://mhtoolkit.vercel.app/support
