"use client";

import Dexie, { type EntityTable } from "dexie";

// Relative, with the extension: this module is also loaded directly by
// `node --test`, which resolves neither the `@/` alias nor a bare specifier.
import { DEVICE_ID_KEY } from "../constants.ts";

/**
 * Local roster + outbox for the gate scanner.
 *
 * The scanner is assumed to be offline: gates at Karnavati sit in basements and
 * marquees with no usable signal. Every scan is decided against IndexedDB alone
 * — no await on the network is allowed on the scan path — and the resulting
 * check-in is parked in `sync_queue` until connectivity returns.
 */

export interface CachedTicket {
  /** Primary key. The HMAC carried inside the QR code. */
  qr_hash: string;
  ticket_id: string;
  event_id: string;
  user_name: string;
  user_email: string;
  seat_label: string | null;
  /** Tickets that were cancelled/refunded before roster download. */
  status: "issued" | "cancelled" | "refunded";
  /**
   * 0 = outside, 1 = admitted.
   *
   * Deliberately not a boolean: IndexedDB cannot index booleans, so a `true`
   * here would be silently dropped from the `[event_id+checked_in]` index and
   * the live "N of M admitted" counter would always read zero.
   */
  checked_in: 0 | 1;
  /** Epoch millis of the admission this device knows about; null if never. */
  check_in_time: number | null;
}

export interface QueuedScan {
  /** Auto-incremented outbox sequence number. */
  id?: number;
  ticket_id: string;
  event_id: string;
  qr_hash: string;
  scanned_by: string;
  check_in_time: number;
  device_id: string;
  /**
   * 1 when a marshal admitted this holder by hand instead of scanning their
   * code. Carried all the way to `check_in_logs` — a manual admission is a
   * human judgement call, and if a pass is later disputed the organizer needs
   * to see which admissions were vouched for rather than verified.
   */
  manual: 0 | 1;
  /** Set once an upload attempt is in flight, so a second flush skips it. */
  in_flight: 0 | 1;
  attempts: number;
}

export interface RosterMeta {
  /** Primary key — the event this roster belongs to. */
  event_id: string;
  event_title: string;
  event_venue: string;
  downloaded_at: number;
  ticket_count: number;
}

class KuEventsDexie extends Dexie {
  cached_tickets!: EntityTable<CachedTicket, "qr_hash">;
  sync_queue!: EntityTable<QueuedScan, "id">;
  roster_meta!: EntityTable<RosterMeta, "event_id">;

  constructor() {
    super("ku_events_gate");

    this.version(1).stores({
      // Indexes chosen for the two hot reads: scan lookup by qr_hash (the PK)
      // and the "who's still outside?" roster view filtered by event.
      cached_tickets: "qr_hash, ticket_id, event_id, checked_in, [event_id+checked_in]",
      sync_queue: "++id, ticket_id, event_id, in_flight",
      roster_meta: "event_id",
    });
  }
}

export const gateDb = new KuEventsDexie();

/**
 * Stable per-device identifier, so the audit trail can say *which* gate phone
 * admitted a holder. Survives reloads; resets if the user clears site data.
 */
export function getDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;

  const id = `gate_${crypto.randomUUID()}`;
  localStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

/** Replaces the cached roster for one event. Old rows for that event are dropped. */
export async function replaceRoster(
  eventId: string,
  tickets: CachedTicket[],
  meta: Omit<RosterMeta, "ticket_count">,
): Promise<void> {
  await gateDb.transaction(
    "rw",
    gateDb.cached_tickets,
    gateDb.roster_meta,
    async () => {
      await gateDb.cached_tickets.where("event_id").equals(eventId).delete();
      await gateDb.cached_tickets.bulkPut(tickets);
      await gateDb.roster_meta.put({ ...meta, ticket_count: tickets.length });
    },
  );
}

export type ScanOutcome =
  | { kind: "admitted"; ticket: CachedTicket; at: number; manual?: boolean }
  | { kind: "duplicate"; ticket: CachedTicket; originalCheckIn: number | null }
  | { kind: "cancelled"; ticket: CachedTicket }
  | { kind: "wrong_event"; ticket: CachedTicket; expectedEventId: string }
  | { kind: "not_found"; qrHash: string }
  | { kind: "unreadable"; raw: string };

/**
 * The scan decision, start to finish, in one IndexedDB transaction.
 *
 * Admitting a ticket and enqueuing its upload must be atomic — a crash between
 * the two would either double-admit or silently lose the check-in. Dexie gives
 * us that across both tables.
 */
export async function resolveScan(params: {
  qrHash: string;
  eventId: string;
  scannedBy: string;
  deviceId: string;
  now?: number;
  /** True when a marshal admitted this holder by hand, not by camera. */
  manual?: boolean;
}): Promise<ScanOutcome> {
  const { qrHash, eventId, scannedBy, deviceId, manual = false } = params;
  const now = params.now ?? Date.now();

  return gateDb.transaction(
    "rw",
    gateDb.cached_tickets,
    gateDb.sync_queue,
    async (): Promise<ScanOutcome> => {
      const ticket = await gateDb.cached_tickets.get(qrHash);

      if (!ticket) return { kind: "not_found", qrHash };

      if (ticket.event_id !== eventId) {
        return { kind: "wrong_event", ticket, expectedEventId: eventId };
      }

      if (ticket.status !== "issued") {
        return { kind: "cancelled", ticket };
      }

      if (ticket.checked_in) {
        return {
          kind: "duplicate",
          ticket,
          originalCheckIn: ticket.check_in_time,
        };
      }

      const admitted: CachedTicket = {
        ...ticket,
        checked_in: 1,
        check_in_time: now,
      };

      await gateDb.cached_tickets.put(admitted);
      await gateDb.sync_queue.add({
        ticket_id: ticket.ticket_id,
        event_id: ticket.event_id,
        qr_hash: ticket.qr_hash,
        scanned_by: scannedBy,
        check_in_time: now,
        device_id: deviceId,
        manual: manual ? 1 : 0,
        in_flight: 0,
        attempts: 0,
      });

      return { kind: "admitted", ticket: admitted, at: now, manual };
    },
  );
}

/**
 * Finds people on the cached roster by name, email or pass number.
 *
 * The fallback for when a code will not scan — a cracked screen, a phone that
 * died in the queue, a display too dim for the camera. Without this the marshal
 * has no way through and the holder is turned away at the door despite holding
 * a valid pass.
 *
 * Filtered in memory: IndexedDB has no substring index, and a roster is at most
 * a few thousand rows on a device that is doing nothing else.
 */
export async function searchRoster(
  eventId: string,
  term: string,
  limit = 12,
): Promise<CachedTicket[]> {
  const needle = term.trim().toLowerCase();
  if (needle.length < 2) return [];

  const matches = await gateDb.cached_tickets
    .where("event_id")
    .equals(eventId)
    .filter(
      (ticket) =>
        ticket.user_name.toLowerCase().includes(needle) ||
        ticket.user_email.toLowerCase().includes(needle) ||
        ticket.ticket_id.toLowerCase().endsWith(needle),
    )
    .limit(limit)
    .toArray();

  // People still outside first — they are who the marshal is looking for.
  return matches.sort((a, b) => a.checked_in - b.checked_in);
}

/** Claims up to `limit` pending scans, marking them in-flight. */
export async function claimPendingScans(limit = 200): Promise<QueuedScan[]> {
  return gateDb.transaction("rw", gateDb.sync_queue, async () => {
    const batch = await gateDb.sync_queue
      .where("in_flight")
      .equals(0)
      .limit(limit)
      .toArray();

    if (batch.length) {
      await gateDb.sync_queue.bulkUpdate(
        batch.map((scan) => ({ key: scan.id!, changes: { in_flight: 1 as const } })),
      );
    }

    return batch;
  });
}

/** Drops successfully-synced scans from the outbox. */
export async function clearSyncedScans(ids: number[]): Promise<void> {
  if (!ids.length) return;
  await gateDb.sync_queue.bulkDelete(ids);
}

/**
 * Returns scans stranded mid-upload to the queue.
 *
 * `claimPendingScans` marks a batch in-flight before the network call. If the
 * tab is killed, the phone dies, or the browser evicts the page while that call
 * is outstanding, those rows would stay in-flight forever and never retry —
 * check-ins silently lost. Call this once on startup, when no flush can be
 * running, to reclaim them.
 */
export async function recoverStrandedScans(): Promise<number> {
  return gateDb.sync_queue.where("in_flight").equals(1).modify({ in_flight: 0 });
}

/** Returns a failed batch to the queue so the next flush retries it. */
export async function releaseScans(ids: number[]): Promise<void> {
  if (!ids.length) return;

  await gateDb.transaction("rw", gateDb.sync_queue, async () => {
    const rows = await gateDb.sync_queue.bulkGet(ids);
    await gateDb.sync_queue.bulkUpdate(
      rows
        .filter((row): row is QueuedScan => Boolean(row))
        .map((row) => ({
          key: row.id!,
          changes: { in_flight: 0 as const, attempts: row.attempts + 1 },
        })),
    );
  });
}

export async function pendingScanCount(): Promise<number> {
  return gateDb.sync_queue.count();
}

export interface RosterStats {
  total: number;
  checkedIn: number;
}

export async function rosterStats(eventId: string): Promise<RosterStats> {
  const [total, checkedIn] = await Promise.all([
    gateDb.cached_tickets.where("event_id").equals(eventId).count(),
    gateDb.cached_tickets.where("[event_id+checked_in]").equals([eventId, 1]).count(),
  ]);

  return { total, checkedIn };
}

/** Wipes everything for an event — used by "clear cached roster". */
export async function purgeEvent(eventId: string): Promise<void> {
  await gateDb.transaction(
    "rw",
    gateDb.cached_tickets,
    gateDb.sync_queue,
    gateDb.roster_meta,
    async () => {
      await gateDb.cached_tickets.where("event_id").equals(eventId).delete();
      await gateDb.sync_queue.where("event_id").equals(eventId).delete();
      await gateDb.roster_meta.delete(eventId);
    },
  );
}
