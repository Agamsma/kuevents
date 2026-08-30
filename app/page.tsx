import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { Hero } from "@/components/landing/hero";
import { EventDirectory } from "@/components/landing/event-directory";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "KU Events — everything happening on campus",
};

/**
 * The front door.
 *
 * Deliberately NOT wrapped in <AuthGuard>: the hero renders for everyone, and
 * only the directory asks for an account. Gating the whole page behind a login
 * wall would mean a first-time visitor sees a spinner and a sign-in button with
 * no idea what they are signing in to.
 */
export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <EventDirectory />
      </main>
      <SiteFooter />
    </>
  );
}
