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
export type EventTrack = "UIT" | "UWSL" | "UID" | "CLUB";

export const TRACK_LABELS: Record<EventTrack, string> = {
  UIT: "UIT",
  UWSL: "UWSL",
  UID: "UID",
  CLUB: "Student Clubs",
};

export const TRACK_FULL_NAMES: Record<EventTrack, string> = {
  UIT: "Unitedworld Institute of Technology",
  UWSL: "Unitedworld School of Law",
  UID: "Unitedworld Institute of Design",
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
