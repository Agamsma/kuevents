import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans, JetBrains_Mono } from "next/font/google";

import { AuthProvider } from "@/lib/auth-context";
import { MotionProvider } from "@/components/motion/motion-provider";
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

const SITE_URL = "https://kuevents.in";

const DESCRIPTION =
  "Everything happening on the Karnavati University campus. Reserve a pass in two taps — it lives on your phone and the gate reads it even with no signal.";

export const metadata: Metadata = {
  // Resolves every relative URL below, and any per-page openGraph image, to the
  // live domain. Without it Next warns and social cards resolve to localhost.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "KU Events — everything happening on campus",
    template: "%s · KU Events",
  },
  description: DESCRIPTION,
  applicationName: "KU Events",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "KU Events",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    type: "website",
    siteName: "KU Events",
    title: "KU Events — everything happening on campus",
    description: DESCRIPTION,
    url: SITE_URL,
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "KU Events — everything happening on campus",
    description: DESCRIPTION,
  },
  // Interior pages set their own noindex; the landing page is the only one
  // that should ever be crawled.
  robots: { index: true, follow: true },
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
        {/* Visible only once focused. Every page's header carries 5–7 nav links
            before the content starts; without this a keyboard user tabs through
            all of them on every single navigation. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-crimson focus:px-5 focus:py-3 focus:text-sm focus:font-medium focus:text-[#1a0207]"
        >
          Skip to content
        </a>

        <AuthProvider>
          <MotionProvider>
            {children}
            <Toaster />
            <ServiceWorkerRegistrar />
          </MotionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
