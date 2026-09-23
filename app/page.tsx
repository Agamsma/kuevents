import type { Metadata } from "next";

import { fetchLandingData } from "@/lib/events-server";
import { SiteHeader } from "@/components/site-header";
import { Hero } from "@/components/landing/hero";
import { EventDirectory } from "@/components/landing/event-directory";
import { SiteFooter } from "@/components/site-footer";
import { AmbientPaper } from "@/components/motion/ambient";

export const metadata: Metadata = {
  title: "KU Events — everything happening on campus",
};

/**
 * Rendered per request, so `proxy.ts` can hand it a fresh CSP nonce — ISR and
 * nonces are mutually exclusive, because a page generated once cannot carry a
 * value that changes on every visit.
 *
 * The 60-second life did not go away with `export const revalidate = 60`; it
 * moved onto the query, in `fetchLandingData`. The poster board and the
 * directory's client fetch still age at the same rate as `s-maxage=60` on
 * `/api/events/public`, so a visitor still cannot see a hero advertising an
 * event the calendar below has already dropped. What changed is that the HTML
 * is rebuilt each time and Firestore is not re-read.
 */

/**
 * The front door.
 *
 * Deliberately NOT wrapped in <AuthGuard>: the hero renders for everyone, and
 * only the directory asks for an account. Gating the whole page behind a login
 * wall would mean a first-time visitor sees a spinner and a sign-in button with
 * no idea what they are signing in to.
 *
 * The events are fetched here rather than inside <Hero> because the poster
 * board is the largest element above the fold — a client fetch would render a
 * hole and then fill it. `fetchLandingData` swallows its own failures and
 * returns zeroes, which puts the hero on its empty state; a missing service
 * account must not turn the front door into an error page.
 */
export default async function LandingPage() {
  const landing = await fetchLandingData();

  return (
    // The front door is paper. The gate is the only surface that stays dark,
    // and it opts out by simply never carrying this attribute.
    // `isolate` is load-bearing: it makes this div the stacking context, so
    // <AmbientPaper>'s -z-10 layer paints above `bg-paper` instead of under it.
    <div data-theme="paper" className="isolate min-h-dvh bg-paper text-ink">
      <AmbientPaper />
      <SiteHeader />
      <main id="main" tabIndex={-1} className="outline-none">
        <Hero landing={landing} />
        <EventDirectory />
      </main>
      <SiteFooter />
    </div>
  );
}
