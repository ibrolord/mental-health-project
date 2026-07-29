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
  },
  twitter: {
    card: "summary_large_image",
    title: "Notice how you're doing. Without the noise.",
    description:
      "A private 30-second mental-wellness check-in. Try it for seven days, with no signup required.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${display.variable} font-sans`}>
        <ServiceWorkerRegistration />
        <CampaignCapture />
        <AuthProvider>
          <AiConsentProvider>
            <Navigation />
            <AppShell>{children}</AppShell>
          </AiConsentProvider>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
