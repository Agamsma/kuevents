/**
 * Shared domain types for KU Events.
 *
 * Firestore timestamps are normalised to epoch milliseconds (`number`) at every
 * read boundary so that the same object can be written to IndexedDB, sent over
 * the wire as JSON, and rendered on the server without a `Timestamp` import.
 */

/**
 * Roles, least to most privileged.
 *
 * `superadmin` is the only role that can change anyone else's role, and it is
 * never granted through the app — see `firestore.rules` and the note in the
 * README on promoting the first one by hand.
 */
export type UserRole = "student" | "scanner" | "organizer" | "superadmin";

export const ROLE_LABELS: Record<UserRole, string> = {
  student: "Student",
  scanner: "Gate marshal",
  organizer: "Organizer",
  superadmin: "Super admin",
};

export interface UserProfile {
  uid: string;
  email: string;
  full_name: string;
  role: UserRole;
  photo_url?: string | null;
  created_at: number;
  updated_at: number;
}

/**
 * The lifecycle of an event.
 *
 *   pending  → a student proposed it; waiting on an organizer
 *   rejected → an organizer turned it down (kept, not deleted, so the proposer
 *              can see what happened and the decision stays auditable)
 *   draft    → an organizer created it but has not opened bookings
 *   published→ open for booking, visible on the directory
 *   live     → happening right now
 *   ended    → over
 *   cancelled→ called off after being published
 */
export type EventStatus =
  | "pending"
  | "rejected"
  | "draft"
  | "published"
  | "live"
  | "ended"
  | "cancelled";

/** Which school or body is putting the event on. Drives the directory tabs. */
/**
 * All seven of the university's schools, plus student clubs.
 *
 * `CLUB` is not a school — it is where a society's own event goes when it
 * belongs to no faculty. Kept in the same list because the directory filters on
 * one axis, and "whose event is this" is that axis.
 *
 * Order is deliberate and is what every list in the product renders in: the
 * schools alphabetically by code, then CLUB last. A list this long re-sorted
 * per screen is a list nobody can scan twice.
 */
export type EventTrack =
  | "KSD"
  | "KSR"
  | "UID"
  | "UIT"
  | "USLM"
  | "UWSB"
  | "UWSL"
  | "CLUB";

/** Canonical render order. Iterate this rather than `Object.keys`. */
export const TRACKS: readonly EventTrack[] = [
  "KSD",
  "KSR",
  "UID",
  "UIT",
  "USLM",
  "UWSB",
  "UWSL",
  "CLUB",
] as const;

export const TRACK_LABELS: Record<EventTrack, string> = {
  KSD: "KSD",
  KSR: "KSR",
  UID: "UID",
  UIT: "UIT",
  USLM: "USLM",
  UWSB: "UWSB",
  UWSL: "UWSL",
  CLUB: "Student Clubs",
};

export const TRACK_FULL_NAMES: Record<EventTrack, string> = {
  KSD: "Karnavati School of Dentistry",
  KSR: "Karnavati School of Research",
  UID: "Unitedworld Institute of Design",
  UIT: "Unitedworld Institute of Technology",
  USLM: "Unitedworld School of Liberal Arts & Mass Communication",
  UWSB: "Unitedworld School of Business",
  UWSL: "Unitedworld School of Law",
  CLUB: "Student Clubs & Societies",
};

/**
 * Categories stay a closed union on purpose.
 *
 * Making them editable at runtime was considered and rejected: it would turn
 * this into a plain `string`, and the compile-time exhaustiveness here is what
 * catches a whole class of bug — when the university's four missing schools
 * were added to `EventTrack`, the directory's hardcoded tab list silently
 * omitted them and nothing failed to build. A closed union means the compiler
 * finds every switch and every map that needs updating.
 *
 * `Other` is the escape hatch instead. It carries a free-text
 * `category_other` label on the event, so a one-off event describes itself
 * without anyone needing a deploy or an admin screen — and without the type
 * losing its shape.
 */
export type EventCategory =
  | "Hackathon"
  | "Cultural"
  | "Workshop"
  | "Unofficial"
  | "Other";

export const EVENT_CATEGORIES: EventCategory[] = [
  "Hackathon",
  "Cultural",
  "Workshop",
  "Unofficial",
  "Other",
];

/** How long a free-text category may be. Long enough to name a thing, short
 *  enough to fit the chip on a poster card without truncating. */
export const CATEGORY_OTHER_MAX = 24;

/**
 * What a card should print for an event's category.
 *
 * One helper rather than the same ternary in the five places a category is
 * rendered — a card, an expanded poster, the hero marquee, the roster and the
 * review queue. Falls back to "Other" if the label is missing, so a malformed
 * document renders a word rather than an empty chip.
 */
export function categoryLabel(event: {
  // `string`, not `EventCategory`: the card types are structural and widen it,
  // and this only ever compares against one literal.
  category: string;
  category_other?: string | null;
}): string {
  if (event.category !== "Other") return event.category;
  return event.category_other?.trim() || "Other";
}

/**
 * Whether an event still belongs on the calendar.
 *
 * Measured against `ends_at`, not `starts_at`. An event that began an hour ago
 * and runs until midnight is the single most relevant thing on campus, and
 * dropping it the moment it starts would take it off the directory exactly when
 * people are deciding whether to walk over. It leaves when it is over.
 *
 * This exists because "published" and "on" had quietly become the same thing.
 * Nothing filtered by date, so the directory — under a heading reading "What's
 * coming up" — listed every event ever published, including ones from the
 * previous term. The hero's own read DID filter, so the front page could show
 * an empty-calendar notice directly above four cards for events that had
 * already happened.
 *
 * Takes the loose shape rather than EventDoc so the public projection, which
 * carries no status or ids, can use the same rule.
 */
export function isOn(event: { ends_at: number }, now: number = Date.now()): boolean {
  return event.ends_at > now;
}

export interface EventDoc {
  id: string;
  title: string;
  description: string;
  venue: string;
  /** Epoch millis. */
  starts_at: number;
  /** Epoch millis. */
  ends_at: number;
  cover_image_url?: string | null;
  status: EventStatus;
  track: EventTrack;
  category: EventCategory;
  /**
   * The written category, when `category` is `"Other"`.
   *
   * Ignored for every other category, so a proposer who picks "Other", types
   * something, then switches back to "Workshop" does not leave a stray label
   * behind on the card.
   */
  category_other?: string | null;
  /** What the proposer expects to turn up. Capacity is set on approval. */
  expected_footfall: number;
  capacity: number;
  tickets_issued: number;
  /** UID of whoever proposed it — a student for pending events. */
  created_by: string;
  /** UID of the organizer who owns it once approved. */
  organizer_uid: string | null;
  /** Set when an organizer rejects, so the proposer learns why. */
  review_note?: string | null;
  /**
   * Issue rotating passes for this event.
   *
   * Off by default, and worth leaving off for most things. Rotation makes a
   * screenshot stop scanning after about a minute, at the cost of clock
   * tolerance at the gate - useful when a pass being forwarded to a group chat
   * is a real problem, pointless for an open lecture.
   */
  rotating_qr?: boolean;
  /**
   * Bookings are paused: the event stays on the directory and every pass
   * already issued stays valid, but no new ones are cut.
   *
   * Distinct from unpublishing. Unpublishing hides the event and strands the
   * people already holding passes with no page to open; pausing is the thing
   * an organizer actually wants when the venue capacity is in doubt an hour
   * before doors.
   */
  bookings_paused?: boolean;
  reviewed_by?: string | null;
  reviewed_at?: number | null;
  created_at: number;
}

export type TicketStatus = "issued" | "cancelled" | "refunded";

export interface TicketDoc {
  id: string;
  event_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  /** HMAC of `ticket_id:event_id:user_id`. Indexed — this is the scan key. */
  qr_hash: string;
  status: TicketStatus;
  checked_in: boolean;
  /** Epoch millis of the first successful scan; null until then. */
  check_in_time: number | null;
  /** UID of the scanner account that admitted this holder. */
  checked_in_by: string | null;
  seat_label?: string | null;
  /**
   * Per-ticket key for rotating passes. Present only when the event asked for
   * them.
   *
   * NEVER goes into the QR. It reaches the holder's own device (Firestore
   * rules let you read your own ticket and nobody else's) and the gate's
   * roster download (organizer-only). That asymmetry is the entire security
   * property: a photograph of a pass captures one code, and cannot produce the
   * next one.
   */
  rotation_secret?: string | null;
  created_at: number;
  /**
   * When the holder gave the pass back. Absent on a pass that was never
   * released.
   *
   * Kept beside `status` rather than inferred from it: "cancelled" will one day
   * also mean an organizer voided it, and the two need telling apart when an
   * attendee list is reconciled after the event.
   */
  released_at?: number | null;
}

/** Append-only audit trail. One document per accepted or rejected scan. */
export interface CheckInLogDoc {
  id: string;
  ticket_id: string;
  event_id: string;
  scanned_by: string;
  /** When the gate device recorded the scan (may predate the sync by hours). */
  check_in_time: number;
  /** When the server actually persisted it. */
  synced_at: number;
  device_id: string;
  result: "admitted" | "duplicate" | "not_found" | "wrong_event" | "cancelled";
  /** True when the scan happened with no connectivity and was queued locally. */
  offline: boolean;
  /**
   * True when a marshal admitted this holder by hand rather than by scanning.
   * A manual admission is a human judgement call — if a pass is disputed later,
   * the organizer needs to tell vouched-for entries from verified ones.
   */
  manual: boolean;
}

/** One entry in a bulk `/api/sync` upload. */
export interface SyncScanPayload {
  ticket_id: string;
  event_id: string;
  qr_hash: string;
  scanned_by: string;
  check_in_time: number;
  device_id: string;
  offline: boolean;
  manual: boolean;
}

export interface SyncResultItem {
  ticket_id: string;
  result: CheckInLogDoc["result"];
  /** Set when the ticket was already checked in — the ORIGINAL admission time. */
  existing_check_in_time?: number | null;
}

export interface SyncResponse {
  ok: boolean;
  accepted: number;
  duplicates: number;
  rejected: number;
  results: SyncResultItem[];
}
