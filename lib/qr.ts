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

/** Encoded as `KUE1:<64 hex chars>`. */
const QR_PAYLOAD_RE = new RegExp(`^${QR_PREFIX}:([a-f0-9]{64})$`);

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
