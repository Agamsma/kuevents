import "server-only";

import { adminDb } from "@/lib/firebase-admin";
import { isOn, type EventDoc, type EventTrack } from "@/lib/types";

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
  /** The written label, when category is "Other". Public: it prints on the card. */
  category_other?: string | null;
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
    category_other: data.category_other ?? null,
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

  // Over events, not upcoming ones, are dropped here — see `isOn`. A direct
  // link to a finished event still resolves; it just stops being listed as
  // something you could go to.
  const now = Date.now();

  return snap.docs
    .map((doc) => project(doc.id, doc.data() as EventDoc))
    .filter((event) => isOn(event, now))
    .sort((a, b) => a.starts_at - b.starts_at);
}

/** What the landing page needs, in one read. */
export interface LandingData {
  /**
   * Upcoming events for the hero's noticeboard, soonest first. The first is the
   * one the wall features.
   *
   * Full events are NOT filtered out here, unlike `fetchFeaturedEvents`. The
   * wall is a picture of what is on this month, not a list of things to book —
   * an event everybody already got into still belongs on the board.
   */
  wall: PublicEvent[];
  /** Upcoming published events in total. Printed on the hero, so it is real. */
  upcoming: number;
  /** How many distinct schools have something on. Also printed. */
  schools: number;
}

const EMPTY_LANDING: LandingData = { wall: [], upcoming: 0, schools: 0 };

/**
 * The landing page's whole server read.
 *
 * Never throws, for the same reason `fetchFeaturedEvents` does not: the Admin
 * SDK constructor fails hard on a missing or malformed
 * FIREBASE_SERVICE_ACCOUNT_KEY, and the front door is the one page that has to
 * render for a stranger regardless. Zeroes put the hero on its own empty state,
 * which still says what the product is.
 *
 * The counts are derived from the same array the wall is built from rather than
 * queried separately, so the number printed under the headline can never
 * disagree with the bills pasted above it.
 */
export async function fetchLandingData(wallSize = 7): Promise<LandingData> {
  try {
    // Already date-filtered by `fetchPublicEvents`, so the hero and the
    // directory below it are reading the same calendar through the same rule.
    // They were not, which is how the front page came to show an
    // empty-calendar notice above four cards.
    const on = await fetchPublicEvents();

    return {
      wall: on.slice(0, wallSize),
      upcoming: on.length,
      schools: new Set(on.map((event) => event.track)).size,
    };
  } catch (error) {
    console.error("[landing] failed", error);
    return EMPTY_LANDING;
  }
}
