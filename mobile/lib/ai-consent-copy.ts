/** Pure copy module so the wording can be unit tested. Keep imports relative. */
// Names the providers each feature really uses: text chat and Advisor go to
// Anthropic Claude or Google Gemini (lib/ai/model-router.ts), affirmations to
// Anthropic Claude, voice to Google Gemini with OpenAI as backup, and live
// voice audio straight from the phone to OpenAI (lib/ai/realtime.ts).
export const AI_DATA_SHARING_DISCLOSURE =
  'To answer you, MHtoolkit sends what you choose to outside AI services:\n\n' +
  '• Chat and Advisor: your messages and any context you turn on (such as mood notes, assessments, goals, habits, journal entries, library notes, plans, or focus sessions) go through the MHtoolkit server to Anthropic Claude or Google Gemini.\n' +
  '• Affirmations: recent mood emojis, assessment scores, and how many goals you finished go to Anthropic Claude. Mood notes and goal text are not sent.\n' +
  '• Voice: tap-to-talk and voice journal recordings go through the server to Google Gemini for transcription, with OpenAI as a backup. Live voice streams your audio straight from your phone to OpenAI. Replies are read aloud using response text sent to Google Gemini or OpenAI for generated speech, or your device speech service may be used.\n' +
  '• Apple Health: a derived Apple Health summary is sent only after you preview and confirm that request. Raw Health samples are never sent.\n\n' +
  'This is used only to make your reply. It is not sold or used for advertising.\n\n' +
  'Do you agree to this AI processing?';
