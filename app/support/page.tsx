import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support - MHtoolkit",
  description:
    "Get help with MHtoolkit, your mental health companion app. Contact us, report issues, and find answers.",
};

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <article className="mx-auto max-w-3xl bg-white rounded-2xl shadow-sm p-8 sm:p-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Support</h1>
        <p className="text-sm text-gray-500 mb-8">
          We&apos;re here to help you get the most out of MHtoolkit.
        </p>

        <p className="text-gray-700 mb-6 leading-relaxed">
          MHtoolkit is a free mental health companion app designed to help you
          track your mood, build healthy habits, and access supportive
          resources. If you have questions, feedback, or need assistance,
          please reach out using any of the methods below.
        </p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            Contact Us
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            For any questions, concerns, or feedback about MHtoolkit, you can
            contact us directly:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2">
            <li>
              <strong>Email:</strong>{" "}
              <a
                href="mailto:bolajiag10@gmail.com"
                className="text-blue-600 hover:underline"
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
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            Frequently Asked Questions
          </h2>

          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-gray-900">
                Is MHtoolkit free to use?
              </h3>
              <p className="text-gray-700 mt-1">
                Yes. MHtoolkit is completely free with no hidden fees or
                in-app purchases.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-gray-900">
                Is my data private?
              </h3>
              <p className="text-gray-700 mt-1">
                Absolutely. Your mood entries, journal notes, and personal data
                are private. We do not sell or share your data with third
                parties. See our{" "}
                <a href="/privacy" className="text-blue-600 hover:underline">
                  Privacy Policy
                </a>{" "}
                for details.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-gray-900">
                Can I use MHtoolkit without creating an account?
              </h3>
              <p className="text-gray-700 mt-1">
                Yes. You can use most features anonymously. Creating an account
                lets you sync data across devices and access additional features.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-gray-900">
                How do I delete my data or account?
              </h3>
              <p className="text-gray-700 mt-1">
                Go to Settings in the app and select &quot;Delete All Data&quot;
                or, if you created an account, &quot;Delete Account&quot; to
                permanently remove your account and associated data. You can also email us at{" "}
                <a
                  href="mailto:bolajiag10@gmail.com"
                  className="text-blue-600 hover:underline"
                >
                  bolajiag10@gmail.com
                </a>{" "}
                to request data deletion.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-gray-900">
                Is MHtoolkit a replacement for therapy?
              </h3>
              <p className="text-gray-700 mt-1">
                No. MHtoolkit is a self-help tool designed to support your
                mental wellness. It is not a substitute for professional
                therapy or medical advice. If you are in crisis, please
                contact your local emergency services or a crisis helpline.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            Report a Bug
          </h2>
          <p className="text-gray-700 leading-relaxed">
            If you encounter a bug or the app isn&apos;t working as expected,
            please email us at{" "}
            <a
              href="mailto:bolajiag10@gmail.com"
              className="text-blue-600 hover:underline"
            >
              bolajiag10@gmail.com
            </a>{" "}
            with a description of the issue, the device you&apos;re using, and
            any screenshots if possible.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            Crisis Resources
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            If you or someone you know is in crisis, please reach out to one of
            these resources:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2">
            <li>
              <strong>988 Suicide &amp; Crisis Lifeline:</strong> Call or text{" "}
              <strong>988</strong> (US)
            </li>
            <li>
              <strong>Crisis Text Line:</strong> Text <strong>HOME</strong> to{" "}
              <strong>741741</strong> (US/Canada)
            </li>
            <li>
              <strong>International Association for Suicide Prevention:</strong>{" "}
              <a
                href="https://www.iasp.info/resources/Crisis_Centres/"
                className="text-blue-600 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Find a crisis center
              </a>
            </li>
          </ul>
        </section>

        <footer className="pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            MHtoolkit is developed by Bolaji Agunbiade. Thank you for using
            the app and for caring about your mental health.
          </p>
        </footer>
      </article>
    </main>
  );
}
