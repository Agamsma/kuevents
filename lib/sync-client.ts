"use client";

import {
  claimPendingScans,
  clearSyncedScans,
  gateDb,
  pendingScanCount,
  recoverStrandedScans,
  releaseScans,
} from "@/lib/db/indexeddb";
import type { SyncResponse, SyncScanPayload } from "@/lib/types";

const BATCH_SIZE = 200;

/** Stops two flushes racing when `online` and the poll timer fire together. */
let flushing = false;

export interface FlushResult {
  uploaded: number;
  duplicates: number;
  rejected: number;
  remaining: number;
  /** Set when the flush aborted; the queue is intact and will retry. */
  error?: string;
}

/**
 * Drains the outbox to `/api/sync`.
 *
 * Safe to call as often as you like: batches are claimed under a transaction,
 * only deleted after the server confirms them, and returned to the queue on any
 * failure. The server treats replays as idempotent, so a batch that succeeded
 * but whose response was lost does no damage on retry.
 */
export async function flushSyncQueue(
  getIdToken: () => Promise<string | null>,
): Promise<FlushResult> {
  if (flushing) {
    return { uploaded: 0, duplicates: 0, rejected: 0, remaining: await pendingScanCount() };
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return {
      uploaded: 0,
      duplicates: 0,
      rejected: 0,
      remaining: await pendingScanCount(),
      error: "offline",
    };
  }

  flushing = true;

  let uploaded = 0;
  let duplicates = 0;
  let rejected = 0;

  try {
    const token = await getIdToken();
    if (!token) {
      return {
        uploaded: 0,
        duplicates: 0,
        rejected: 0,
        remaining: await pendingScanCount(),
        error: "Not signed in.",
      };
    }

    // Loop so a gate that was offline for hours empties in one go.
    for (;;) {
      const batch = await claimPendingScans(BATCH_SIZE);
      if (!batch.length) break;

      const ids = batch.map((scan) => scan.id!);
      const scans: SyncScanPayload[] = batch.map((scan) => ({
        ticket_id: scan.ticket_id,
        event_id: scan.event_id,
        qr_hash: scan.qr_hash,
        scanned_by: scan.scanned_by,
        check_in_time: scan.check_in_time,
        device_id: scan.device_id,
        offline: true,
        manual: scan.manual === 1,
      }));

      let response: Response;
      try {
        response = await fetch("/api/sync", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ scans }),
        });
      } catch (error) {
        await releaseScans(ids);
        return {
          uploaded,
          duplicates,
          rejected,
          remaining: await pendingScanCount(),
          error: error instanceof Error ? error.message : "Network error.",
        };
      }

      if (!response.ok) {
        await releaseScans(ids);
        const detail = await response.text().catch(() => "");
        return {
          uploaded,
          duplicates,
          rejected,
          remaining: await pendingScanCount(),
          error: `Sync failed (${response.status}). ${detail.slice(0, 160)}`,
        };
      }

      const body = (await response.json()) as SyncResponse;

      uploaded += body.accepted;
      duplicates += body.duplicates;
      rejected += body.rejected;

      // The server has recorded every scan in the batch — accepted, duplicate
      // and rejected alike — so none of them should be uploaded again.
      await clearSyncedScans(ids);

      // Reconcile: a ticket the server says was already used elsewhere should
      // show as checked-in on this device too, so the roster view stops lying.
      await reconcileLocalRoster(body);

      if (batch.length < BATCH_SIZE) break;
    }

    return { uploaded, duplicates, rejected, remaining: await pendingScanCount() };
  } finally {
    flushing = false;
  }
}

/** Applies server truth for duplicates back onto the cached roster. */
async function reconcileLocalRoster(body: SyncResponse): Promise<void> {
  const corrections = body.results.filter(
    (item) => item.result === "duplicate" && item.existing_check_in_time,
  );
  if (!corrections.length) return;

  await gateDb.transaction("rw", gateDb.cached_tickets, async () => {
    for (const item of corrections) {
      const row = await gateDb.cached_tickets
        .where("ticket_id")
        .equals(item.ticket_id)
        .first();

      if (row) {
        await gateDb.cached_tickets.put({
          ...row,
          checked_in: 1,
          // Keep the earliest admission — that is the one that counts.
          check_in_time: Math.min(
            row.check_in_time ?? Number.POSITIVE_INFINITY,
            item.existing_check_in_time!,
          ),
        });
      }
    }
  });
}

/**
 * Wires up automatic syncing: fires on regaining connectivity, when the tab
 * comes back to the foreground, and on a slow poll as a backstop for browsers
 * whose `online` event is unreliable on mobile networks.
 *
 * Returns a teardown function.
 */
export function startAutoSync(
  getIdToken: () => Promise<string | null>,
  onResult: (result: FlushResult) => void,
  pollMs = 30_000,
): () => void {
  const run = () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    void flushSyncQueue(getIdToken).then(onResult);
  };

  // Reclaim anything a previous session left mid-upload before the first flush.
  // Nothing else can be in flight yet, so this cannot race a live request.
  const started = recoverStrandedScans().then((recovered) => {
    if (recovered > 0) {
      console.warn(`[sync] recovered ${recovered} scan(s) stranded in-flight`);
    }
  });

  const onVisible = () => {
    if (document.visibilityState === "visible") run();
  };

  window.addEventListener("online", run);
  document.addEventListener("visibilitychange", onVisible);
  const timer = window.setInterval(run, pollMs);

  void started.then(run);

  return () => {
    window.removeEventListener("online", run);
    document.removeEventListener("visibilitychange", onVisible);
    window.clearInterval(timer);
  };
}
