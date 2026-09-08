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

export type EventCategory =
  | "Hackathon"
  | "Cultural"
  | "Workshop"
  | "Unofficial";

export const EVENT_CATEGORIES: EventCategory[] = [
  "Hackathon",
  "Cultural",
  "Workshop",
  "Unofficial",
];

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
