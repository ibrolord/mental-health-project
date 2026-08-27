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
  title: "MHtoolkit - Daily Mental-Health Support",
  description:
    "Check in, understand your patterns, build routines, and stay accountable with free, open-source daily mental-health support.",
  openGraph: {
    title: "Daily mental-health support that meets you where you are.",
    description:
      "MHtoolkit helps students and early-career adults check in, build routines, find useful next steps, and stay accountable.",
    type: "website",
    url: "/",
    siteName: "MHtoolkit",
    images: [
      {
        url: "/launch-hero-2026-1200x630.png",
        width: 1200,
        height: 630,
        alt: "Young adults using MHtoolkit for check-ins, journaling, and accountability",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Daily mental-health support that meets you where you are.",
    description:
      "Check in, understand your patterns, build routines, and stay accountable with MHtoolkit.",
    images: ["/launch-hero-2026-1200x630.png"],
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
