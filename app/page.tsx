import type { Metadata } from "next";

import { fetchFeaturedEvents } from "@/lib/events-server";
import { SiteHeader } from "@/components/site-header";
import { Hero } from "@/components/landing/hero";
import { EventDirectory } from "@/components/landing/event-directory";
import { SiteFooter } from "@/components/site-footer";
import { AmbientPaper } from "@/components/motion/ambient";

export const metadata: Metadata = {
  title: "KU Events — everything happening on campus",
};

/**
 * Matches the `s-maxage=60` on `/api/events/public`, so the two public read
 * paths — this page's featured posters and the directory's client fetch — age
 * at the same rate. A visitor cannot see a hero advertising an event the
 * calendar below has already dropped.
 */
export const revalidate = 60;

/**
 * The front door.
 *
 * Deliberately NOT wrapped in <AuthGuard>: the hero renders for everyone, and
 * only the directory asks for an account. Gating the whole page behind a login
 * wall would mean a first-time visitor sees a spinner and a sign-in button with
 * no idea what they are signing in to.
 *
 * The featured events are fetched here rather than inside <Hero> because the
 * poster is the largest element above the fold — a client fetch would render a
 * hole and then fill it. `fetchFeaturedEvents` swallows its own failures and
 * returns [], which puts the hero on its static fallback; a missing service
 * account must not turn the front door into an error page.
 */
export default async function LandingPage() {
  const featured = await fetchFeaturedEvents();

  return (
    // The front door is paper. The gate is the only surface that stays dark,
    // and it opts out by simply never carrying this attribute.
    <div data-theme="paper" className="min-h-dvh bg-paper text-ink">
      <AmbientPaper />
      <SiteHeader />
      <main id="main" tabIndex={-1} className="outline-none">
        <Hero featured={featured} />
        <EventDirectory />
      </main>
      <SiteFooter />
    </div>
  );
}
