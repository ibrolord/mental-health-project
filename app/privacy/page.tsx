import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - MHtoolkit",
  description: "Privacy policy for MHtoolkit, your mental health companion app.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <article className="mx-auto max-w-3xl bg-white rounded-2xl shadow-sm p-8 sm:p-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          Effective date: March 5, 2026
        </p>

        <p className="text-gray-700 mb-6 leading-relaxed">
          MHtoolkit (&quot;the App&quot;) is a free mental health companion
          developed by Bolaji Agunbiade. Your privacy matters deeply to us. This
          policy explains what data we collect, how we use it, and what rights
          you have over it.
        </p>

        {/* Data Collection */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            1. Data We Collect
          </h2>
          <p className="text-gray-700 mb-3 leading-relaxed">
            We collect only the data necessary to provide the App&apos;s
            features. This includes:
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2 ml-2">
            <li>
              <strong>Account information:</strong> Email address (only if you
              choose to create an account). Anonymous sessions are supported and
              require no personal information.
            </li>
            <li>
              <strong>Mood entries:</strong> Mood ratings, notes, and timestamps
              you submit through the mood tracker.
            </li>
            <li>
              <strong>Assessment responses:</strong> Answers to mental health
              self-assessments (e.g., PHQ-9, GAD-7).
            </li>
            <li>
              <strong>Goals and habits:</strong> Goals you set and habit tracking
              data.
            </li>
            <li>
              <strong>Chat history:</strong> Messages exchanged with the AI chat
              feature.
            </li>
            <li>
              <strong>Voice recordings:</strong> Audio recorded during voice
              therapy sessions, used temporarily for transcription and then
              discarded.
            </li>
            <li>
              <strong>Anonymous page view analytics:</strong> Collected via
              Vercel Analytics (no cookies, no personal identifiers).
            </li>
          </ul>
        </section>

        {/* How Data Is Used */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            2. How Your Data Is Used
          </h2>
          <p className="text-gray-700 mb-3 leading-relaxed">
            Your data is used solely to provide and improve the App&apos;s
            features:
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2 ml-2">
            <li>Displaying your mood history, trends, and progress.</li>
            <li>Powering AI chat conversations and generating affirmations.</li>
            <li>
              Transcribing voice recordings and generating spoken responses.
            </li>
            <li>Tracking your goals, habits, and streaks.</li>
            <li>
              Providing self-assessment scores and mental health resources.
            </li>
            <li>
              Understanding aggregate, anonymous usage patterns to improve the
              App.
            </li>
          </ul>
          <p className="text-gray-700 mt-3 leading-relaxed">
            We do <strong>not</strong> sell, rent, or share your personal data
            with third parties for advertising or marketing purposes. The App
            contains no ads.
          </p>
        </section>

        {/* AI Processing */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            3. AI Processing
          </h2>
          <p className="text-gray-700 mb-3 leading-relaxed">
            The App uses third-party AI services to power its features. When you
            interact with these features, relevant data is sent to the following
            providers for processing:
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2 ml-2">
            <li>
              <strong>Google Gemini:</strong> Processes standard chat messages
              and generates affirmations.
            </li>
            <li>
              <strong>Anthropic Claude:</strong> Handles complex or
              crisis-related chat interactions.
            </li>
            <li>
              <strong>OpenAI:</strong> Transcribes voice recordings
              (speech-to-text) and generates spoken responses
              (text-to-speech).
            </li>
          </ul>
          <p className="text-gray-700 mt-3 leading-relaxed">
            Data sent to these providers is used only to generate responses and
            is subject to each provider&apos;s respective data processing
            policies. We do not send your email address or account identifiers to
            AI providers. Voice recordings are processed in real time and are not
            stored permanently by us or the AI providers.
          </p>
        </section>

        {/* Data Storage & Security */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            4. Data Storage and Security
          </h2>
          <ul className="list-disc list-inside text-gray-700 space-y-2 ml-2">
            <li>
              Your data is stored in a PostgreSQL database hosted by{" "}
              <strong>Supabase</strong> in the <strong>EU West (Ireland)</strong>{" "}
              region.
            </li>
            <li>
              All data is transmitted over HTTPS and encrypted in transit using
              TLS.
            </li>
            <li>Data at rest is encrypted by Supabase&apos;s infrastructure.</li>
            <li>
              Row Level Security (RLS) policies ensure that users can only access
              their own data.
            </li>
            <li>
              Anonymous sessions use a locally generated identifier stored on
              your device. No server-side personal data is associated with
              anonymous sessions beyond what you explicitly enter.
            </li>
          </ul>
        </section>

        {/* Third-Party Services */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            5. Third-Party Services
          </h2>
          <p className="text-gray-700 mb-3 leading-relaxed">
            The App relies on the following third-party services:
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2 ml-2">
            <li>
              <strong>Supabase</strong> &mdash; Database hosting and
              authentication.
            </li>
            <li>
              <strong>Vercel</strong> &mdash; Application hosting and anonymous
              page view analytics (no cookies, no personal identifiers).
            </li>
            <li>
              <strong>Google (Gemini API)</strong> &mdash; AI chat and
              affirmation generation.
            </li>
            <li>
              <strong>Anthropic (Claude API)</strong> &mdash; AI chat for complex
              interactions.
            </li>
            <li>
              <strong>OpenAI (Whisper & TTS APIs)</strong> &mdash; Voice
              transcription and text-to-speech.
            </li>
          </ul>
          <p className="text-gray-700 mt-3 leading-relaxed">
            Each service processes data in accordance with its own privacy policy.
            We encourage you to review their respective policies.
          </p>
        </section>

        {/* Data Retention */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            6. Data Retention
          </h2>
          <ul className="list-disc list-inside text-gray-700 space-y-2 ml-2">
            <li>
              Your data is retained for as long as your account exists or your
              anonymous session remains active.
            </li>
            <li>
              Voice recordings are processed in real time for transcription and
              are not permanently stored.
            </li>
            <li>
              When you delete your data (see Section 7), it is permanently
              removed from our database.
            </li>
            <li>
              Anonymous session data that has not been accessed for an extended
              period may be periodically purged.
            </li>
          </ul>
        </section>

        {/* User Rights */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            7. Your Rights
          </h2>
          <p className="text-gray-700 mb-3 leading-relaxed">
            You have the following rights regarding your data:
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2 ml-2">
            <li>
              <strong>Access:</strong> You can view all your data within the App
              at any time.
            </li>
            <li>
              <strong>Export:</strong> You can export all your data from the
              Settings page in a portable format.
            </li>
            <li>
              <strong>Deletion:</strong> You can permanently delete all your data
              from the Settings page. This action is irreversible.
            </li>
            <li>
              <strong>Correction:</strong> You can edit or update your entries
              directly within the App.
            </li>
          </ul>
          <p className="text-gray-700 mt-3 leading-relaxed">
            If you need assistance exercising any of these rights, please contact
            us at the email address listed below.
          </p>
        </section>

        {/* Children's Privacy */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            8. Children&apos;s Privacy
          </h2>
          <p className="text-gray-700 leading-relaxed">
            MHtoolkit is not intended for use by children under the age of 13. We
            do not knowingly collect personal data from children under 13. If you
            believe a child under 13 has provided us with personal data, please
            contact us and we will promptly delete it.
          </p>
        </section>

        {/* Changes to This Policy */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            9. Changes to This Policy
          </h2>
          <p className="text-gray-700 leading-relaxed">
            We may update this Privacy Policy from time to time. When we do, we
            will revise the &quot;Effective date&quot; at the top of this page.
            We encourage you to review this policy periodically. Continued use of
            the App after changes constitutes acceptance of the updated policy.
          </p>
        </section>

        {/* Contact */}
        <section className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            10. Contact
          </h2>
          <p className="text-gray-700 leading-relaxed">
            If you have any questions or concerns about this Privacy Policy or
            your data, please contact:
          </p>
          <div className="mt-3 text-gray-700">
            <p>
              <strong>Bolaji Agunbiade</strong>
            </p>
            <p>
              Email:{" "}
              <a
                href="mailto:princebolajibreeze@gmail.com"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                princebolajibreeze@gmail.com
              </a>
            </p>
          </div>
        </section>
      </article>
    </main>
  );
}
