import "server-only";

import { adminDb } from "@/lib/firebase-admin";
import { seatState } from "@/lib/seats";
import type { EventDoc, EventTrack } from "@/lib/types";

/**
 * Server-side event reads and the public field allowlist.
 *
 * Extracted from `/api/events/public` so the landing page can render the hero's
 * featured events during SSR without going through its own HTTP round trip —
 * and, more importantly, so there is exactly ONE place that decides which event
 * fields are safe to hand to an anonymous visitor. Event documents carry
 * `organizer_uid`, `created_by`, `reviewed_by` and `review_note`; a second
 * hand-written projection elsewhere is how one of those eventually ships.
 */

/** Exactly what public surfaces render. Nothing else leaves the server. */
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

function millis(value: unknown): number {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "toMillis" in value) {
    return (value as { toMillis(): number }).toMillis();
  }
  return 0;
}

function project(id: string, data: EventDoc): PublicEvent {
  return {
    id,
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
}

/**
 * Every published event, soonest first.
 *
 * Single-field `where` plus an in-memory sort, the same shape as everything in
 * `lib/firestore-queries.ts` — no composite index to deploy, so this cannot
 * start throwing at runtime because someone forgot to run
 * `firebase deploy --only firestore:indexes`.
 */
export async function fetchPublicEvents(limit = 200): Promise<PublicEvent[]> {
  const snap = await adminDb()
    .collection("events")
    .where("status", "==", "published")
    .limit(limit)
    .get();

  return snap.docs
    .map((doc) => project(doc.id, doc.data() as EventDoc))
    .sort((a, b) => a.starts_at - b.starts_at);
}

/**
 * The one to three events the hero puts a poster to.
 *
 * Soonest first, already started ones dropped, full ones dropped — a marquee
 * whose whole purpose is "go and get a seat" should not lead with something
 * nobody can get into.
 *
 * Never throws. The Admin SDK constructor fails hard when
 * FIREBASE_SERVICE_ACCOUNT_KEY is missing or malformed, and the landing page is
 * the one page that has to render for a stranger regardless. An empty array
 * puts the hero back on its static fallback, which is a page that still says
 * what the product is.
 */
export async function fetchFeaturedEvents(count = 3): Promise<PublicEvent[]> {
  try {
    const events = await fetchPublicEvents();
    const now = Date.now();

    return events
      .filter((event) => event.starts_at > now && !seatState(event).full)
      .slice(0, count);
  } catch (error) {
    console.error("[featured events] failed", error);
    return [];
  }
}
