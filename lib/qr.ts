/**
 * Ticket QR cryptography.
 *
 * A ticket's QR encodes an HMAC-SHA256 over `ticket_id:event_id:user_id`, keyed
 * by `TICKET_QR_SECRET`. Two properties matter at the gate:
 *
 *  1. Unforgeable — a student cannot mint a QR for a ticket they do not own,
 *     because they never see the key.
 *  2. Offline-verifiable — the gate scanner matches the scanned hash against a
 *     roster it downloaded earlier, so it needs no network and no key.
 *
 * The hash is stable for the life of the ticket. Screenshot sharing is deterred
 * separately, by the live badge on the pass (see `liveWindowCode`), not by this
 * hash — see the note there for exactly how far that goes.
 */

const QR_PREFIX = "KUE1";

/**
 * Encoded as `KUE1:<64 hex chars>`.
 *
 * Case-insensitive, and that flag is load-bearing rather than defensive:
 * `parseQrPayload` lowercases the scanned string before matching, so a
 * case-sensitive pattern built from the uppercase `QR_PREFIX` could never
 * match its own output. Every prefixed pass was refused at the gate as "Not a
 * pass"; only the bare-hash fallback below still scanned. Keep the flag if
 * either the prefix or that `toLowerCase()` ever changes.
 */
const QR_PAYLOAD_RE = new RegExp(`^${QR_PREFIX}:([a-f0-9]{64})$`, "i");

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Computes the ticket's QR hash. Runs on the Web Crypto API, which is present
 * both in Node 18+ and in the browser — but the secret means this must only
 * ever be called on the server.
 */
export async function computeQrHash(params: {
  secret: string;
  ticketId: string;
  eventId: string;
  userId: string;
}): Promise<string> {
  const { secret, ticketId, eventId, userId } = params;

  if (!secret) {
    throw new Error("TICKET_QR_SECRET is not set — cannot issue ticket QR codes.");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${ticketId}:${eventId}:${userId}`),
  );

  return toHex(signature);
}

/** Wraps a raw hash into the scannable payload string. */
export function buildQrPayload(qrHash: string): string {
  return `${QR_PREFIX}:${qrHash}`;
}

/**
 * Extracts the hash from a scanned string, or null if it is not one of ours.
 * Tolerates the raw hash on its own so that older passes still scan.
 */
export function parseQrPayload(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();

  const prefixed = QR_PAYLOAD_RE.exec(trimmed);
  if (prefixed) return prefixed[1];

  if (/^[a-f0-9]{64}$/.test(trimmed)) return trimmed;

  return null;
}

/** How long a live badge code stays valid before it rolls over. */
export const LIVE_WINDOW_MS = 30_000;

/**
 * Derives the 6-character code shown on the live badge of a digital pass.
 *
 * This is a *liveness* signal for the human at the gate, not a second factor:
 * it is computed from data already inside the QR, so it proves the pass is
 * being rendered right now rather than photographed earlier. A marshal who sees
 * a code that does not match the code on their own device — or a clock that
 * never ticks — is looking at a screenshot. It does not stop a holder from
 * screen-sharing a live pass, which is what the one-scan check-in is for.
 */
export function liveWindowCode(qrHash: string, nowMs: number = Date.now()): string {
  const windowIndex = Math.floor(nowMs / LIVE_WINDOW_MS);

  // FNV-1a over the hash plus the window index. Deliberately not cryptographic:
  // this value is public and derived from public material.
  let acc = 0x811c9dc5;
  const material = `${qrHash}:${windowIndex}`;
  for (let i = 0; i < material.length; i += 1) {
    acc ^= material.charCodeAt(i);
    acc = Math.imul(acc, 0x01000193) >>> 0;
  }

  return acc.toString(36).toUpperCase().padStart(6, "0").slice(-6);
}

/** Milliseconds until the current live window rolls over. */
export function msUntilNextWindow(nowMs: number = Date.now()): number {
  return LIVE_WINDOW_MS - (nowMs % LIVE_WINDOW_MS);
}

/* ───────────────────────────────────────────────────────────────────────────
   Rotating passes — opt-in, per event
   ───────────────────────────────────────────────────────────────────────────
   For events where a screenshot passed around a group chat is a real problem.
   Off by default: rotation costs clock tolerance at the gate, and most campus
   events do not need it.

   THE PART THAT MATTERS. The rotating code is keyed by `rotation_secret`, a
   per-ticket random value that is NEVER inside the QR. It reaches exactly two
   places: the holder's own device, which may read its own ticket document, and
   the gate's roster download, which is organizer-only.

   Deriving it from `qr_hash` instead — which IS in the QR, in plaintext — would
   be forgeable by anyone who photographs a pass: decode the hash, run the
   public derivation, mint a fresh valid code forever. That is worse than a
   static QR, because it looks protected and is not.

   What this actually buys: a screenshot captures one code, and that code dies
   at the end of its window. It does not stop someone screen-sharing a live
   pass — nothing does except the pass admitting exactly once, which still
   holds.
   ─────────────────────────────────────────────────────────────────────────── */

const ROTATING_PREFIX = "KUE2";

/** Encoded as `KUE2:<64 hex>:<window>:<8 hex>`. Case-insensitive, as KUE1 is. */
const ROTATING_RE = new RegExp(
  `^${ROTATING_PREFIX}:([a-f0-9]{64}):(\\d+):([a-f0-9]{8})$`,
  "i",
);

/** Which 30-second window a moment falls in. */
export function windowIndex(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / LIVE_WINDOW_MS);
}

/**
 * The rotating code for one window, keyed by the ticket's secret.
 *
 * FNV-1a over `secret:window`. Not cryptographic, and it does not need to be:
 * the secret is the only thing withheld, the value is short-lived, and the
 * unforgeable half of the pass is still the HMAC in `qr_hash`. This exists to
 * make a *stale* code detectable, not to be a second signature.
 */
export function rotatingCode(secret: string, window: number): string {
  let acc = 0x811c9dc5;
  const material = `${secret}:${window}`;

  for (let i = 0; i < material.length; i += 1) {
    acc ^= material.charCodeAt(i);
    acc = Math.imul(acc, 0x01000193) >>> 0;
  }

  return acc.toString(16).padStart(8, "0");
}

/** Wraps a rotating pass into its scannable payload. */
export function buildRotatingPayload(
  qrHash: string,
  secret: string,
  nowMs: number = Date.now(),
): string {
  const window = windowIndex(nowMs);
  return `${ROTATING_PREFIX}:${qrHash}:${window}:${rotatingCode(secret, window)}`;
}

export interface RotatingScan {
  qrHash: string;
  window: number;
  code: string;
}

/** Extracts a rotating payload's parts, or null if it is not one. */
export function parseRotatingPayload(raw: string): RotatingScan | null {
  const match = ROTATING_RE.exec(raw.trim().toLowerCase());
  if (!match) return null;

  return { qrHash: match[1], window: Number(match[2]), code: match[3] };
}

/**
 * How many windows either side of "now" a gate will still accept.
 *
 * One window each way, so a pass is valid for 30–60 seconds depending where in
 * the window it was rendered. This is clock tolerance, not generosity: a
 * marshal's phone and a student's phone are two unsynchronised clocks, and a
 * gate that refuses a valid pass because one of them drifted twenty seconds is
 * a gate that gets switched off.
 */
export const WINDOW_TOLERANCE = 1;

/** Whether a scanned rotating code is current, given the ticket's secret. */
export function isRotatingCodeCurrent(
  // Only the window and the code are needed. Taking the full RotatingScan
  // would force the gate to carry a hash it has already used to find the
  // ticket.
  scan: Pick<RotatingScan, "window" | "code">,
  secret: string,
  nowMs: number = Date.now(),
): boolean {
  const now = windowIndex(nowMs);
  if (Math.abs(scan.window - now) > WINDOW_TOLERANCE) return false;

  // Recompute for the window the pass claims, then compare. Comparing against
  // "now" instead would reject a pass rendered a second before a rollover.
  return rotatingCode(secret, scan.window) === scan.code.toLowerCase();
}
