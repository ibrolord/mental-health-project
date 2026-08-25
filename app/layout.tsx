import type { Metadata } from "next";
import { DM_Sans, Newsreader } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { Navigation } from "@/components/navigation";
import { AppShell } from "@/components/app-shell";
import { Analytics } from "@vercel/analytics/react";
import { CampaignCapture } from "@/components/launch/campaign-capture";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { AiConsentProvider } from "@/components/ai-consent-provider";
import { I18nProvider } from "@/components/i18n-provider";

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});
const display = Newsreader({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://mhtoolkit.vercel.app"),
  title: "MHtoolkit - The 7-Day Private Check-In",
  description:
    "A private 30-second mental-wellness check-in. No signup required. Notice patterns over seven days.",
  openGraph: {
    title: "Notice how you're doing. Without the noise.",
    description:
      "A private 30-second mental-wellness check-in. Try it for seven days, with no signup required.",
    type: "website",
    url: "/",
    siteName: "MHtoolkit",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "MHtoolkit - private tools for steadier days",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Notice how you're doing. Without the noise.",
    description:
      "A private 30-second mental-wellness check-in. Try it for seven days, with no signup required.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png", sizes: "48x48" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-CA">
      <body className={`${sans.variable} ${display.variable} font-sans`}>
        <ServiceWorkerRegistration />
        <CampaignCapture />
        <AuthProvider>
          <I18nProvider>
            <AiConsentProvider>
              <Navigation />
              <AppShell>{children}</AppShell>
            </AiConsentProvider>
          </I18nProvider>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
