import { NextResponse } from "next/server";

import { ApiError, apiRoute, readJson } from "@/lib/api-handler";
import { adminDb } from "@/lib/firebase-admin";
import { requireCaller } from "@/lib/server-auth";
import { canRelease } from "@/lib/ticket-release";
import type { EventDoc, TicketDoc } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Gives a pass back.
 *
 * Until this existed, `tickets_issued` only ever went up. Nothing in the app
 * wrote `cancelled` or `refunded`, even though the type carried them, the gate
 * refused them and the attendee list counted them — so a student who booked and
 * could not attend held that seat until the event was over. On a capped event
 * every no-show permanently shrank the venue, and the only remedy was editing
 * Firestore by hand, which made it worse: the decrement did not happen, and the
 * one-pass-per-student check only counts `issued`, so the same person could
 * book again and put the counter up a second time.
 *
 * Both halves move together here or not at all.
 */
export const POST = apiRoute("ticket release", async (request) => {
  const caller = await requireCaller(request);

  const body = await readJson<{ ticket_id?: unknown }>(request);

  if (typeof body.ticket_id !== "string" || !body.ticket_id) {
    throw new ApiError("`ticket_id` is required.", 400);
  }

  const db = adminDb();
  const ticketRef = db.collection("tickets").doc(body.ticket_id);

  await db.runTransaction(async (tx) => {
    /*
     * Both reads first. Firestore requires every read in a transaction to
     * precede every write, and the event has to be read anyway — the decision
     * depends on whether it has finished.
     */
    const ticketSnap = await tx.get(ticketRef);

    // Same answer as a ticket belonging to someone else, deliberately. See the
    // note on ownership in `lib/ticket-release.ts`.
    if (!ticketSnap.exists) {
      throw new ApiError("No such pass.", 404);
    }

    const ticket = ticketSnap.data() as TicketDoc;
    const eventRef = db.collection("events").doc(ticket.event_id);
    const eventSnap = await tx.get(eventRef);
    const event = eventSnap.exists ? (eventSnap.data() as EventDoc) : null;

    const decision = canRelease({
      ticket,
      event: event ? { ends_at: toMillis(event.ends_at) } : null,
      callerUid: caller.uid,
    });

    if (!decision.ok) {
      throw new ApiError(decision.refusal.message, decision.refusal.status);
    }

    /*
     * Cancelled, not deleted.
     *
     * The pass is the holder's side of an audit trail that has to survive the
     * event — `check_in_logs` references ticket ids, and a gate that scans a
     * released pass must be able to say "cancelled" rather than "not found".
     * Those are different things to a marshal: one is a pass someone gave up,
     * the other is a code that was never ours.
     */
    tx.update(ticketRef, {
      status: "cancelled",
      released_at: Date.now(),
    });

    /*
     * The seat goes back, floored at zero.
     *
     * `Math.max` rather than a bare decrement because `tickets_issued` is the
     * only number here that a hand-edit in the Firestore console can put out of
     * step with reality, and a negative capacity count would read as an
     * unlimited event in `seatState` — turning a bookkeeping slip into an
     * oversold venue.
     */
    if (event) {
      tx.update(eventRef, {
        tickets_issued: Math.max((event.tickets_issued ?? 0) - 1, 0),
      });
    }
  });

  return NextResponse.json({ ok: true, ticket_id: body.ticket_id });
});

/** Firestore hands `ends_at` back as a Timestamp or a number depending on age. */
function toMillis(value: unknown): number {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "toMillis" in value) {
    return (value as { toMillis(): number }).toMillis();
  }
  return 0;
}
