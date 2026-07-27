import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support - MHtoolkit",
  description:
    "Get help with MHtoolkit. Contact us, report issues, and find answers.",
};

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <article className="mx-auto max-w-3xl bg-card rounded-2xl shadow-sm p-8 sm:p-12">
        <h1 className="text-3xl font-bold text-foreground mb-2">Support</h1>
        <p className="text-sm text-muted-foreground mb-8">
          We&apos;re here to help you get the most out of MHtoolkit.
        </p>

        <p className="text-foreground mb-6 leading-relaxed">
          MHtoolkit is a free self-reflection tool designed to help you track
          your mood and notice patterns. If you have questions, feedback, or
          need assistance, please reach out using the contact details below.
        </p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-3">
            Contact Us
          </h2>
          <p className="text-foreground leading-relaxed mb-4">
            For any questions, concerns, or feedback about MHtoolkit, you can
            contact us directly:
          </p>
          <ul className="list-disc pl-6 text-foreground space-y-2">
            <li>
              <strong>Email:</strong>{" "}
              <a
                href="mailto:bolajiag10@gmail.com"
                className="text-primary hover:underline"
              >
                bolajiag10@gmail.com
              </a>
            </li>
            <li>
              <strong>Response time:</strong> We aim to respond within 48 hours.
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-3">
            Frequently Asked Questions
          </h2>

          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-foreground">
                Is MHtoolkit free to use?
              </h3>
              <p className="text-foreground mt-1">
                Yes. MHtoolkit is completely free with no hidden fees or
                in-app purchases.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-foreground">
                Is my data private?
              </h3>
              <p className="text-foreground mt-1">
                Your mood entries, journal notes, and personal data are private.
                We do not sell your data or share it for advertising. Optional
                AI features ask for consent before sending chat text, voice
                audio/transcripts, or personalized context to AI providers. See
                our{" "}
                <a href="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </a>{" "}
                for details.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-foreground">
                Can I use MHtoolkit without creating an account?
              </h3>
              <p className="text-foreground mt-1">
                Yes. You can use most features anonymously without providing an
                email address. Existing account holders can still sign in; new
                account creation is temporarily unavailable while we upgrade the
                verification flow.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-foreground">
                How do I delete my data or account?
              </h3>
              <p className="text-foreground mt-1">
                Go to Settings in the app and select &quot;Delete All Data&quot;
                or, if you created an account, &quot;Delete Account&quot; to
                permanently remove your account and associated data. You can also email us at{" "}
                <a
                  href="mailto:bolajiag10@gmail.com"
                  className="text-primary hover:underline"
                >
                  bolajiag10@gmail.com
                </a>{" "}
                to request data deletion.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-foreground">
                Is MHtoolkit a replacement for therapy?
              </h3>
              <p className="text-foreground mt-1">
                No. MHtoolkit is a self-help tool designed to support your
                mental wellness. It is not a substitute for professional
                therapy or medical advice. If you are in crisis, please
                contact your local emergency services or a crisis helpline.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-3">
            Report a Bug
          </h2>
          <p className="text-foreground leading-relaxed">
            If you encounter a bug or the app isn&apos;t working as expected,
            please email us at{" "}
            <a
              href="mailto:bolajiag10@gmail.com"
              className="text-primary hover:underline"
            >
              bolajiag10@gmail.com
            </a>{" "}
            with a description of the issue, the device you&apos;re using, and
            any screenshots if possible.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-3">
            Urgent Support
          </h2>
          <p className="text-foreground leading-relaxed">
            MHtoolkit does not provide crisis care. If you or someone else is
            in immediate danger, contact the emergency services where you are
            located or go to the nearest emergency department. For urgent
            emotional support, use an official crisis service published for
            your country or region, or{" "}
            <a
              href="https://findahelpline.com/"
              className="text-primary hover:underline"
            >
              find a verified local helpline
            </a>
            .
          </p>
        </section>

        <footer className="pt-6 border-t border-gray-200">
          <p className="text-sm text-muted-foreground">
            MHtoolkit is developed by Bolaji Agunbiade. Thank you for using
            the app and for caring about your mental health.
          </p>
        </footer>
      </article>
    </main>
  );
}
