import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase-admin";
import type { EventDoc, EventTrack } from "@/lib/types";

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
 *     `review_note`. A public Firestore rule would expose all of them. This
 *     projects to a strict allowlist of display fields.
 *  2. A rule cannot filter fields, only documents — so there would be no way to
 *     publish the calendar without also publishing its internals.
 *
 * Booking still requires a session; this is a read-only shop window.
 */

/** Exactly what the directory renders. Nothing else leaves the server. */
export interface PublicEvent {
  id: string;
  title: string;
  description: string;
  venue: string;
  starts_at: number;
  ends_at: number;
  track: EventTrack;
  category: string;
  cover_image_url: string | null;
  capacity: number;
  tickets_issued: number;
}

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
    const snap = await adminDb()
      .collection("events")
      .where("status", "==", "published")
      .limit(200)
      .get();

    const events: PublicEvent[] = snap.docs
      .map((doc) => {
        const data = doc.data() as EventDoc;

        return {
          id: doc.id,
          title: data.title ?? "",
          description: data.description ?? "",
          venue: data.venue ?? "",
          starts_at: millis(data.starts_at),
          ends_at: millis(data.ends_at),
          track: data.track,
          category: data.category,
          cover_image_url: data.cover_image_url ?? null,
          capacity: data.capacity ?? 0,
          tickets_issued: data.tickets_issued ?? 0,
        };
      })
      .sort((a, b) => a.starts_at - b.starts_at);

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

function millis(value: unknown): number {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "toMillis" in value) {
    return (value as { toMillis(): number }).toMillis();
  }
  return 0;
}
