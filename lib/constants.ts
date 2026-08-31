/**
 * Values that were previously string literals in three or four files each.
 *
 * Storage keys especially: a typo in one of them does not fail loudly, it
 * silently reads `null` and the gate console quietly forgets which event it was
 * working. Naming them once makes that class of bug impossible.
 */

/** Every timestamp in the product is displayed in campus time. */
export const CAMPUS_TIMEZONE = "Asia/Kolkata";

/** Locale for dates, numbers and name sorting. */
export const CAMPUS_LOCALE = "en-IN";

/* ── Browser storage keys ─────────────────────────────────────────────────── */

/**
 * Mirrors "there is a session" for the proxy. Holds no identity and is
 * client-writable, so nothing security-relevant may branch on it.
 */
export const SIGNED_IN_HINT_COOKIE = "ku_signed_in";

/** Which event the gate console was working when the tab last closed. */
export const ACTIVE_EVENT_KEY = "ku_events_active_event";

/** Stable per-device id, so the audit trail can name the phone that scanned. */
export const DEVICE_ID_KEY = "ku_events_device_id";

/* ── Timings ──────────────────────────────────────────────────────────────── */

/** How long a live badge code on a pass stays valid before it rolls over. */
export const LIVE_WINDOW_MS = 30_000;

/** How often the gate retries its outbox when nothing else has woken it. */
export const SYNC_POLL_MS = 30_000;
