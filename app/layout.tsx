import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans, JetBrains_Mono } from "next/font/google";

import { AuthProvider } from "@/lib/auth-context";
import { ServiceWorkerRegistrar } from "@/components/service-worker-registrar";
import { Toaster } from "@/components/ui/toast";
import "./globals.css";

/*
 * Three faces, three jobs.
 *
 * Fraunces carries the brand voice — a soft, high-contrast serif with optical
 * sizing and a "wonk" axis, which is what keeps it warm at display sizes
 * instead of stiff and institutional. Set large and tight, it reads as a
 * university that takes itself seriously without shouting.
 *
 * Instrument Sans reads quietly underneath it. JetBrains Mono is the ticket
 * vernacular: every field label, seat code, count and timestamp is monospaced,
 * the way it is on a printed stub or a departure board.
 */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "KU Events",
    template: "%s · KU Events",
  },
  description:
    "Event passes and gate check-in for Karnavati University. Your pass lives on your phone; the gate works without signal.",
  applicationName: "KU Events",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "KU Events",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0708",
  width: "device-width",
  initialScale: 1,
  // The scanner is a fixed-viewport kiosk surface; pinch-zooming the camera
  // frame while aiming at a QR only ever gets in the way.
  maximumScale: 1,
  viewportFit: "cover",
};

/**
 * `data-scroll-behavior="smooth"` tells Next that the smooth scroll set in
 * globals.css is intentional — it is there for the hero's in-page jump to the
 * directory. Without it, Next warns because smooth scrolling also applies to
 * route transitions, where an animated scroll to the top reads as lag.
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body
        className={`${fraunces.variable} ${instrument.variable} ${jetbrains.variable} antialiased`}
      >
        <AuthProvider>
          {children}
          <Toaster />
          <ServiceWorkerRegistrar />
        </AuthProvider>
      </body>
    </html>
  );
}
