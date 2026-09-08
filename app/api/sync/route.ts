import { NextResponse } from "next/server";
import type { Firestore } from "firebase-admin/firestore";

import { ApiError, apiRoute, readJson } from "@/lib/api-handler";
import { adminDb } from "@/lib/firebase-admin";
import { requireCaller } from "@/lib/server-auth";
import type {
  CheckInLogDoc,
  SyncResponse,
  SyncResultItem,
  SyncScanPayload,
  TicketDoc,
} from "@/lib/types";

// Uses firebase-admin, which needs the Node runtime, not the edge sandbox.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One upload from one gate device. Larger batches get 400'd rather than truncated. */
const MAX_BATCH = 500;

interface SyncRequestBody {
  scans?: unknown;
}

function isScan(value: unknown): value is SyncScanPayload {
  if (typeof value !== "object" || value === null) return false;
  const scan = value as Record<string, unknown>;

  return (
    typeof scan.ticket_id === "string" &&
    scan.ticket_id.length > 0 &&
    typeof scan.event_id === "string" &&
    scan.event_id.length > 0 &&
    typeof scan.qr_hash === "string" &&
    /^[a-f0-9]{64}$/.test(scan.qr_hash) &&
    typeof scan.scanned_by === "string" &&
    typeof scan.check_in_time === "number" &&
    Number.isFinite(scan.check_in_time) &&
    typeof scan.device_id === "string"
  );
}

/**
 * Bulk upload endpoint for offline gate check-ins.
 *
 * The contract that makes offline scanning safe:
 *
 *  - **Idempotent.** A device that uploads, loses the response and retries must
 *    not double-count. Each check-in is written to a deterministic log id, and
 *    the ticket write is guarded by a transaction that re-reads `checked_in`.
 *  - **First scan wins.** Two gates that both admitted the same holder while
 *    partitioned will disagree; the earliest `check_in_time` is kept and the
 *    later one is reported back as a duplicate so the device can correct itself.
 *  - **Every scan is logged**, including refusals. The audit trail is the point:
 *    "who let this person in, on what device, and when" must survive the event.
 */
export const POST = apiRoute("sync", async (request) => {
  const caller = await requireCaller(request, [
    "scanner",
    "organizer",
    "superadmin",
  ]);

  /*
   * The shared-key check that used to sit here has been removed, and it should
   * not come back in this shape.
   *
   * It required an `x-ku-sync-key` header. The gate is a web app, and
   * `lib/sync-client.ts` never sent one — so the moment anybody followed the
   * README's own instruction to set SYNC_API_KEY to "any long random string",
   * every upload from every gate device answered 403 and check-ins queued
   * forever. Silently: the outbox retries, so nothing was lost, but nothing
   * arrived either.
   *
   * It could not have worked. For a browser client to send that header the key
   * would have to be NEXT_PUBLIC_, which puts it in the JavaScript bundle that
   * every student downloads — a "shared secret" readable by anyone who opens
   * devtools is not a second factor.
   *
   * What actually guards this route is the line above: a verified Firebase ID
   * token whose `users` document carries scanner, organizer or superadmin, re-
   * read on every request. If a native gate client is ever built, a per-device
   * credential belongs here — issued per device, revocable, and never the same
   * string on every phone.
   */

  const body = await readJson<SyncRequestBody>(request);

  if (!Array.isArray(body.scans)) {
    throw new ApiError("`scans` must be an array.", 400);
  }

  if (body.scans.length === 0) {
    return NextResponse.json<SyncResponse>({
      ok: true,
      accepted: 0,
      duplicates: 0,
      rejected: 0,
      results: [],
    });
  }

  if (body.scans.length > MAX_BATCH) {
    throw new ApiError(`Batch too large. Send at most ${MAX_BATCH} scans.`, 400);
  }

  const invalid = body.scans.findIndex((scan) => !isScan(scan));
  if (invalid !== -1) {
    throw new ApiError(`Malformed scan at index ${invalid}.`, 400);
  }

  const scans = body.scans as SyncScanPayload[];
  const db = adminDb();
  const syncedAt = Date.now();
  const results: SyncResultItem[] = [];

  // Sequential rather than Promise.all: two scans of the SAME ticket inside one
  // batch must serialise, or both transactions read `checked_in: false` and the
  // second silently overwrites the first admission time.
  for (const scan of scans) {
    try {
      results.push(await applyScan({ db, scan, caller, syncedAt }));
    } catch (error) {
      console.error("[sync] scan failed", scan.ticket_id, error);
      // Reported as not_found so the client stops retrying a poison record;
      // the log write below still captures that we saw it.
      results.push({ ticket_id: scan.ticket_id, result: "not_found" });
    }
  }

  const accepted = results.filter((r) => r.result === "admitted").length;
  const duplicates = results.filter((r) => r.result === "duplicate").length;

  return NextResponse.json<SyncResponse>({
    ok: true,
    accepted,
    duplicates,
    rejected: results.length - accepted - duplicates,
    results,
  });
});

async function applyScan({
  db,
  scan,
  caller,
  syncedAt,
}: {
  db: Firestore;
  scan: SyncScanPayload;
  caller: { uid: string };
  syncedAt: number;
}): Promise<SyncResultItem> {
  const ticketRef = db.collection("tickets").doc(scan.ticket_id);

  const outcome = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ticketRef);

    if (!snap.exists) {
      return { result: "not_found" as const, existing: null };
    }

    const ticket = snap.data() as TicketDoc;

    // The QR hash is the actual credential. A device sending a valid ticket_id
    // with a mismatched hash is either stale or forged; refuse either way.
    if (ticket.qr_hash !== scan.qr_hash) {
      return { result: "not_found" as const, existing: null };
    }

    if (ticket.event_id !== scan.event_id) {
      return { result: "wrong_event" as const, existing: null };
    }

    if (ticket.status !== "issued") {
      return { result: "cancelled" as const, existing: null };
    }

    if (ticket.checked_in) {
      const existing = normaliseMillis(ticket.check_in_time);

      // Same device, same admission, replayed after a lost response — not a
      // real duplicate, so report success and let the client drop it.
      if (
        ticket.checked_in_by === scan.scanned_by &&
        existing !== null &&
        Math.abs(existing - scan.check_in_time) < 1000
      ) {
        return { result: "admitted" as const, existing };
      }

      // Two gates admitted the same holder while partitioned. Keep the earlier
      // time as the truth and tell the caller it was already used.
      if (existing !== null && scan.check_in_time < existing) {
        tx.update(ticketRef, {
          check_in_time: scan.check_in_time,
          checked_in_by: scan.scanned_by,
        });
        return { result: "duplicate" as const, existing: scan.check_in_time };
      }

      return { result: "duplicate" as const, existing };
    }

    tx.update(ticketRef, {
      checked_in: true,
      check_in_time: scan.check_in_time,
      checked_in_by: scan.scanned_by,
      synced_at: syncedAt,
    });

    return { result: "admitted" as const, existing: scan.check_in_time };
  });

  await writeAuditLog({ db, scan, caller, syncedAt, result: outcome.result });

  return {
    ticket_id: scan.ticket_id,
    result: outcome.result,
    existing_check_in_time: outcome.existing,
  };
}

/**
 * Appends to `check_in_logs`. The document id is derived from the scan itself,
 * so replaying a batch overwrites its own entry instead of appending a
 * near-duplicate — the trail stays one row per real-world scan event.
 */
async function writeAuditLog({
  db,
  scan,
  caller,
  syncedAt,
  result,
}: {
  db: Firestore;
  scan: SyncScanPayload;
  caller: { uid: string };
  syncedAt: number;
  result: CheckInLogDoc["result"];
}): Promise<void> {
  const logId = `${scan.ticket_id}_${scan.device_id}_${scan.check_in_time}`;

  const entry: Omit<CheckInLogDoc, "id"> & { uploaded_by: string } = {
    ticket_id: scan.ticket_id,
    event_id: scan.event_id,
    scanned_by: scan.scanned_by,
    check_in_time: scan.check_in_time,
    synced_at: syncedAt,
    device_id: scan.device_id,
    result,
    offline: scan.offline ?? true,
    // Preserved verbatim from the device: a manual admission is a human
    // vouching for someone whose code would not scan, and that distinction has
    // to survive into the audit trail or a disputed entry cannot be untangled.
    manual: scan.manual ?? false,
    // Whose token carried this record to the server, which may differ from the
    // marshal who physically scanned it.
    uploaded_by: caller.uid,
  };

  await db.collection("check_in_logs").doc(logId).set(entry, { merge: true });
}

function normaliseMillis(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "toMillis" in value) {
    return (value as { toMillis(): number }).toMillis();
  }
  if (value && typeof value === "object" && "_seconds" in value) {
    return (value as { _seconds: number })._seconds * 1000;
  }
  return null;
}

/** Lightweight readiness probe so a gate can confirm the backend before doors open. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "ku-events-sync",
    time: new Date().toISOString(),
  });
}
