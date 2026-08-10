import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - MHtoolkit",
  description: "Privacy policy for the MHtoolkit self-reflection app.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <article className="mx-auto max-w-3xl bg-card rounded-2xl shadow-sm p-8 sm:p-12">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Effective date: August 9, 2026
        </p>

        <p className="text-foreground mb-6 leading-relaxed">
          MHtoolkit (&quot;the App&quot;) is a free self-reflection tool
          developed by Bolaji Agunbiade. Your privacy matters deeply to us.
          This policy explains what data we collect, how we use it, and what
          rights you have over it.
        </p>

        {/* Data Collection */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-3">
            1. Data We Collect
          </h2>
          <p className="text-foreground mb-3 leading-relaxed">
            We collect only the data necessary to provide the App&apos;s
            features. This includes:
          </p>
          <ul className="list-disc list-inside text-foreground space-y-2 ml-2">
            <li>
              <strong>Account information:</strong> Email address for people who
              create an account or sign in. Anonymous sessions require no
              personal information.
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
              <strong>Goals, habits, and routines:</strong> Goals you set,
              habit definitions, daily completion history, streaks, cues, tiny
              steps, and optional reward milestones.
            </li>
            <li>
              <strong>Planning and focus:</strong> Life-plan items, reflections,
              next steps, time horizons, and focus-session configuration and
              completion history.
            </li>
            <li>
              <strong>Reminders:</strong> Reminder schedules, timezone, generic
              delivery history, and an optional browser push subscription. We do
              not put private journal, mood-note, assessment, goal, habit, or AI
              content in push notification text.
            </li>
            <li>
              <strong>Chat history:</strong> Messages exchanged with the AI chat
              feature.
            </li>
            <li>
              <strong>Journal and library notes:</strong> Private writing and
              notes you save on books or videos.
            </li>
            <li>
              <strong>Voice recordings and transcripts:</strong> Audio recorded
              during voice support conversations and the resulting transcript,
              used to provide transcription and AI responses.
            </li>
            <li>
              <strong>AI personalization context:</strong> If you turn on
              individual context categories, recent moods, mood notes,
              assessment scores, goals, habits, journal entries, private library
              notes, and related timestamps may be included with that AI request.
              Every category is off by default. On iOS, Apple Health summaries
              require a separate preview and confirmation for each request.
            </li>
            <li>
              <strong>AI response reports:</strong> If you report an AI response,
              we collect that response, your selected reason, app version, and
              platform. We do not attach the rest of your conversation or your
              optional personalization context to the report.
            </li>
            <li>
              <strong>Apple Health data (iOS only):</strong> If you enable Apple
              Health insights, the App reads only the categories you choose:
              steps, exercise minutes, workouts, sleep, mindful sessions, and
              State of Mind. Raw Apple Health samples, dates, source devices, and
              identifiers stay on your device. If you explicitly choose Apple
              Health summary in AI Chat, the App shows the exact derived 7-day and
              30-day aggregate first and sends it through the MHtoolkit backend to
              the selected AI provider only after you choose Share once. The
              aggregate payload is not stored in Supabase, shared with
              accountability partners, or used for analytics, advertising, or
              marketing. The AI response may reflect the summary and is stored
              only if you choose to save that chat or report the response.
            </li>
            <li>
              <strong>Anonymous page view analytics:</strong> Collected via
              Vercel Analytics (no cookies, no personal identifiers).
            </li>
            <li>
              <strong>Campaign attribution:</strong> After your first saved
              check-in, we may store allowlisted labels from an MHtoolkit link,
              such as source, medium, campaign, content variant, and platform.
              We do not store the referring URL, advertising identifiers, your
              mood value, notes, assessments, or AI content with these labels.
            </li>
            <li>
              <strong>Operational events:</strong> For authenticated web and iOS
              sessions, we may store a fixed event name, the web or iOS source,
              and a server timestamp when an app error boundary appears or an
              allowlisted notification step succeeds or fails. These events do
              not contain journal, chat, assessment, mood, note, tag, title, or
              prompt values; route URLs; related record IDs; exception messages
              or stacks; device IDs; email addresses; or arbitrary metadata. We
              do not record Android operational events or crisis and grounding
              tool usage events.
            </li>
          </ul>
        </section>

        {/* How Data Is Used */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-3">
            2. How Your Data Is Used
          </h2>
          <p className="text-foreground mb-3 leading-relaxed">
            Your data is used solely to provide and improve the App&apos;s
            features:
          </p>
          <ul className="list-disc list-inside text-foreground space-y-2 ml-2">
            <li>Displaying your mood history, trends, and progress.</li>
            <li>
              Showing optional, on-device Apple Health context beside your mood
              check-ins without claiming that a relationship is causal or
              diagnostic.
            </li>
            <li>
              Generating an optional, non-diagnostic reflection from a derived
              Apple Health aggregate after you preview and approve that single AI
              request.
            </li>
            <li>
              Powering AI chat conversations and generating affirmations after
              you consent to AI data sharing in the App.
            </li>
            <li>
              Transcribing voice recordings and playing responses aloud on your
              device.
            </li>
            <li>Tracking your goals, habits, and streaks.</li>
            <li>
              Saving life plans, focus sessions, routine templates, and optional
              reminder schedules.
            </li>
            <li>
              Sharing only the accountability counts you turn on and delivering
              fixed-format partner cheers or reward ideas.
            </li>
            <li>
              Providing self-assessment scores and mental health resources.
            </li>
            <li>
              Understanding aggregate, anonymous usage patterns to improve the
              App.
            </li>
            <li>
              Measuring aggregate activation and repeat check-in rates by
              campaign so we can focus on useful, permission-based distribution.
            </li>
            <li>Reviewing user-reported AI responses for safety and quality.</li>
            <li>
              Detecting app-boundary and notification reliability problems from
              the fixed, content-free operational event taxonomy.
            </li>
          </ul>
          <p className="text-foreground mt-3 leading-relaxed">
            We do <strong>not</strong> sell, rent, or share your personal data
            with third parties for advertising or marketing purposes. The App
            contains no ads. Third-party AI sharing is limited to the optional
            AI features described below and requires in-app consent before data
            is sent.
          </p>
        </section>

        {/* AI Processing */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-3">
            3. AI Processing
          </h2>
          <p className="text-foreground mb-3 leading-relaxed">
            The App uses third-party AI services to power optional AI features.
            Before your first AI request, the App asks for permission to send
            selected data to AI providers through the MHtoolkit backend. If you
            decline, chat messages, voice recordings/transcripts, and
            personalized context are not sent for AI processing.
          </p>
          <ul className="list-disc list-inside text-foreground space-y-2 ml-2">
            <li>
              <strong>Google Gemini:</strong> Processes standard chat messages,
              may generate personalized affirmations, and transcribes push-to-talk
              recordings. It also generates spoken audio from AI response text.
            </li>
            <li>
              <strong>Anthropic Claude:</strong> Handles complex or
              crisis-related chat interactions.
            </li>
            <li>
              <strong>OpenAI:</strong> Powers live voice transcription and is a
              fallback for compatible push-to-talk recordings and generated spoken
              playback.
            </li>
          </ul>
          <p className="text-foreground mt-3 leading-relaxed">
            Data sent to these providers can include the message or audio you
            submit, the generated transcript, and only the optional context
            categories you select for that conversation. Journal entries and
            private library notes are not sent unless you select those categories
            explicitly. On iOS, an Apple Health aggregate is never part of the
            reusable full-context choice: you must preview and confirm it for each
            request. It includes averages and counts only, not raw samples, dates,
            source devices, or identifiers. We do not intentionally send your
            email address or account identifiers to AI providers. AI providers
            process data according to their own data processing terms and privacy
            policies.
          </p>
        </section>

        {/* Data Storage & Security */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-3">
            4. Data Storage and Security
          </h2>
          <ul className="list-disc list-inside text-foreground space-y-2 ml-2">
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
              their own private rows. Accountability partners can call only a
              database function that returns enabled counts; they cannot select
              journal entries, AI chat history, assessment scores, or mood notes.
            </li>
            <li>
              Growth reports contain cohort counts only. They do not expose user
              IDs or any mental-health content.
            </li>
            <li>
              Anonymous use is assigned a random Supabase Auth user ID without
              requiring an email address or other direct identifier. On the
              mobile app, its session credential is stored using the device&apos;s
              protected credential storage.
            </li>
            <li>
              Life-plan text, focus sessions, push subscriptions, reminders, and
              dismissed notice preferences use the same owner-scoped Row Level
              Security model.
            </li>
            <li>
              Operational events are written directly to Supabase through an
              authenticated, fixed-input database function. We do not send these
              events to Sentry or another crash-reporting provider.
            </li>
          </ul>
        </section>

        {/* Third-Party Services */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-3">
            5. Third-Party Services
          </h2>
          <p className="text-foreground mb-3 leading-relaxed">
            The App relies on the following third-party services:
          </p>
          <ul className="list-disc list-inside text-foreground space-y-2 ml-2">
            <li>
              <strong>Supabase</strong> &mdash; Database hosting and
              authentication.
            </li>
            <li>
              <strong>Vercel</strong> &mdash; Application hosting and anonymous
              page view analytics (no cookies, no personal identifiers).
            </li>
            <li>
              <strong>Google (Gemini API)</strong> &mdash; AI chat,
              affirmation generation, push-to-talk transcription, and generated
              spoken playback of AI response text.
            </li>
            <li>
              <strong>Anthropic (Claude API)</strong> &mdash; AI chat for complex
              interactions.
            </li>
            <li>
              <strong>OpenAI</strong> &mdash; Live voice transcription, fallback
              transcription for compatible push-to-talk recordings, and fallback
              generated spoken playback.
            </li>
            <li>
              <strong>Operating-system speech services</strong> &mdash; Voice
              responses may use a voice configured on the device if generated
              playback is unavailable.
            </li>
            <li>
              <strong>Browser push services</strong> &mdash; If you explicitly
              enable background reminders, the push service selected by your
              browser or operating system delivers a generic encrypted
              notification payload to that browser installation.
            </li>
          </ul>
          <p className="text-foreground mt-3 leading-relaxed">
            Each service processes data in accordance with its own privacy policy.
            We encourage you to review their respective policies.
          </p>
        </section>

        {/* Data Retention */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-3">
            6. Data Retention
          </h2>
          <ul className="list-disc list-inside text-foreground space-y-2 ml-2">
            <li>
              Your data is retained for as long as your account exists or your
              anonymous session remains active.
            </li>
            <li>
              Voice recordings are processed after each turn for transcription and
              are not permanently stored by MHtoolkit.
            </li>
            <li>
              AI provider retention is governed by each provider&apos;s data
              processing terms and privacy policy.
            </li>
            <li>
              User-submitted AI response reports are retained for safety review
              for up to 90 days, unless you delete your data sooner.
            </li>
            <li>
              Campaign attribution is retained with your anonymous or signed-in
              account and is deleted when you delete your data or account.
            </li>
            <li>
              Operational events are retained with your authenticated account,
              included in your export, and removed when you delete your data or
              account.
            </li>
            <li>
              A browser push subscription is retained until you turn it off,
              delete your data, or the browser reports that the subscription has
              expired.
            </li>
            <li>
              When you delete your data (see Section 7), it is permanently
              removed from our database.
            </li>
            <li>
              Anonymous sessions are not automatically purged. Their data remains
              available until you delete it from Settings.
            </li>
          </ul>
        </section>

        {/* User Rights */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-3">
            7. Your Rights
          </h2>
          <p className="text-foreground mb-3 leading-relaxed">
            You have the following rights regarding your data:
          </p>
          <ul className="list-disc list-inside text-foreground space-y-2 ml-2">
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
              or your full account from the Settings page. This action is
              irreversible.
            </li>
            <li>
              <strong>AI consent:</strong> You can decline AI data sharing before
              using AI features, and you can revoke prior AI consent from the
              Settings page. AI features will ask again before sending data.
            </li>
            <li>
              <strong>Correction:</strong> You can edit or update your entries
              directly within the App.
            </li>
          </ul>
          <p className="text-foreground mt-3 leading-relaxed">
            If you need assistance exercising any of these rights, please contact
            us at the email address listed below.
          </p>
        </section>

        {/* Children's Privacy */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-3">
            8. Children&apos;s Privacy
          </h2>
          <p className="text-foreground leading-relaxed">
            MHtoolkit is not intended for use by children under the age of 13. We
            do not knowingly collect personal data from children under 13. If you
            believe a child under 13 has provided us with personal data, please
            contact us and we will promptly delete it.
          </p>
        </section>

        {/* Changes to This Policy */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-3">
            9. Changes to This Policy
          </h2>
          <p className="text-foreground leading-relaxed">
            We may update this Privacy Policy from time to time. When we do, we
            will revise the &quot;Effective date&quot; at the top of this page.
            We encourage you to review this policy periodically. Continued use of
            the App after changes constitutes acceptance of the updated policy.
          </p>
        </section>

        {/* Contact */}
        <section className="mb-4">
          <h2 className="text-xl font-semibold text-foreground mb-3">
            10. Contact
          </h2>
          <p className="text-foreground leading-relaxed">
            If you have any questions or concerns about this Privacy Policy or
            your data, please contact:
          </p>
          <div className="mt-3 text-foreground">
            <p>
              <strong>Bolaji Agunbiade</strong>
            </p>
            <p>
              Email:{" "}
              <a
                href="mailto:bolajiag10@gmail.com"
                className="text-primary hover:text-blue-800 underline"
              >
                bolajiag10@gmail.com
              </a>
            </p>
          </div>
        </section>
      </article>
    </main>
  );
}
