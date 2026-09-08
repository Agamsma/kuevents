import {
  EVENT_CATEGORIES,
  TRACK_LABELS,
  type EventCategory,
  type EventTrack,
} from "@/lib/types";

/**
 * Validation for an event payload from an untrusted client.
 *
 * Lives here rather than in `app/api/events/route.ts`, where it started, for a
 * structural reason: a route module may only export route handlers and their
 * config. Exporting a helper alongside them type-checks under Turbopack but
 * fails the webpack build with `Property 'parseEventInput' is incompatible with
 * index signature` — the same constraint, enforced by only one of the two
 * bundlers. `/api/events/propose` imports it, so it needs a home that is not a
 * route.
 */

const VALID_TRACKS = Object.keys(TRACK_LABELS) as EventTrack[];

export interface EventInput {
  title: string;
  description: string;
  venue: string;
  starts_at: number;
  ends_at: number;
  track: EventTrack;
  category: EventCategory;
  expected_footfall: number;
  capacity: number;
  cover_image_url: string | null;
  /**
   * Issue rotating passes for this event.
   *
   * A checkbox, so anything not exactly true is false - an absent field, a
   * string, a stray null. Defaulting a security setting ON from malformed
   * input would be the wrong direction to fail.
   */
  rotating_qr: boolean;
}

/**
 * Returns either the cleaned input or a human-readable reason.
 *
 * Every message is written to be shown directly to whoever submitted the form —
 * "Pick a start date and time", not "starts_at must be a positive finite
 * number".
 */
export function parseEventInput(
  body: Record<string, unknown>,
): { ok: true; value: EventInput } | { ok: false; error: string } {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const venue = typeof body.venue === "string" ? body.venue.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";

  if (title.length < 3) {
    return { ok: false, error: "Give the event a title of at least 3 characters." };
  }
  if (title.length > 120) {
    return { ok: false, error: "Titles are capped at 120 characters." };
  }
  if (!venue) {
    return { ok: false, error: "Say where it is happening." };
  }
  if (description.length > 2000) {
    return { ok: false, error: "Descriptions are capped at 2000 characters." };
  }

  const startsAt = Number(body.starts_at);
  const endsAt = Number(body.ends_at);

  if (!Number.isFinite(startsAt) || startsAt <= 0) {
    return { ok: false, error: "Pick a start date and time." };
  }
  if (!Number.isFinite(endsAt) || endsAt <= startsAt) {
    return { ok: false, error: "The event has to end after it starts." };
  }

  const track = String(body.track) as EventTrack;
  if (!VALID_TRACKS.includes(track)) {
    return { ok: false, error: "Pick which school or club is running this." };
  }

  const category = String(body.category) as EventCategory;
  if (!EVENT_CATEGORIES.includes(category)) {
    return { ok: false, error: "Pick a category." };
  }

  const expectedFootfall = Math.max(0, Math.floor(Number(body.expected_footfall) || 0));
  const capacity = Math.max(0, Math.floor(Number(body.capacity) || 0));

  const coverImageUrl =
    typeof body.cover_image_url === "string" && body.cover_image_url
      ? body.cover_image_url
      : null;

  // Only accept images we put in our own Storage bucket. A cover URL pointing
  // anywhere else would let a proposal embed a tracking pixel — or worse — on
  // the public directory.
  if (coverImageUrl && !/^https:\/\/firebasestorage\.googleapis\.com\//.test(coverImageUrl)) {
    return { ok: false, error: "Cover image must be uploaded through this form." };
  }

  return {
    ok: true,
    value: {
      title,
      description,
      venue,
      starts_at: startsAt,
      ends_at: endsAt,
      track,
      category,
      expected_footfall: expectedFootfall,
      capacity,
      cover_image_url: coverImageUrl,
      rotating_qr: body.rotating_qr === true,
    },
  };
}
