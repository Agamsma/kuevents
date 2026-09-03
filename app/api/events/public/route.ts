import { NextResponse } from "next/server";

import { fetchPublicEvents, type PublicEvent } from "@/lib/events-server";

export const runtime = "nodejs";

/**
 * The public campus calendar.
 *
 * The landing page promises "everything happening on campus" — so it has to
 * show something to a visitor who has not signed in yet. Promising a directory
 * and then serving a login wall is a bait-and-switch, and it makes the site
 * unshareable: a link to kuevents.in shows a stranger nothing.
 *
 * This route exists instead of loosening `firestore.rules` to allow anonymous
 * reads. Two reasons that matters:
 *
 *  1. Event documents carry `organizer_uid`, `created_by`, `reviewed_by` and
 *     `review_note`. A public Firestore rule would expose all of them. The
 *     projection in `lib/events-server.ts` narrows to display fields only.
 *  2. A rule cannot filter fields, only documents — so there would be no way to
 *     publish the calendar without also publishing its internals.
 *
 * The query and that projection live in `lib/events-server.ts` because the
 * landing page renders featured events during SSR from the same source. One
 * allowlist, two callers.
 *
 * Booking still requires a session; this is a read-only shop window.
 */

/** Re-exported so existing importers of the response shape keep working. */
export type { PublicEvent };

/**
 * Cached at the edge for a minute, and served stale for ten while it revalidates.
 *
 * The calendar changes a few times a day at most, and this is the first request
 * of every cold visit — so it should almost never touch Firestore. `s-maxage`
 * rather than `max-age`: a student who books a pass must see their own change
 * immediately, and that read goes through the authenticated client path.
 */
const CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=600";

export async function GET() {
  try {
    const events = await fetchPublicEvents();

    return NextResponse.json(
      { ok: true, events },
      { headers: { "cache-control": CACHE_CONTROL } },
    );
  } catch (error) {
    console.error("[public events] failed", error);

    // The landing page treats this as "no events" rather than an error screen:
    // a visitor who has never seen the site does not need our stack trace, and
    // the hero above it is still worth reading.
    return NextResponse.json(
      { ok: false, events: [], error: "The calendar is unavailable right now." },
      { status: 503 },
    );
  }
}
