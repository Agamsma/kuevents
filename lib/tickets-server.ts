import "server-only";

import { randomBytes } from "node:crypto";

import { Timestamp, type Firestore } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebase-admin";
import { computeQrHash } from "@/lib/qr";
import type { EventDoc, TicketDoc } from "@/lib/types";

export class BookingError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409,
  ) {
    super(message);
    this.name = "BookingError";
  }
}

export interface IssueTicketInput {
  eventId: string;
  user: { uid: string; email: string; name: string };
}

/**
 * Issues one ticket, atomically.
 *
 * Capacity and the one-ticket-per-student rule are enforced inside the same
 * transaction that increments `tickets_issued` — checking them beforehand would
 * let two simultaneous bookings both pass the check and oversell the venue.
 *
 * The QR hash is computed here and nowhere else: it needs `TICKET_QR_SECRET`,
 * which never leaves the server.
 */
export async function issueTicket(input: IssueTicketInput): Promise<TicketDoc> {
  const db: Firestore = adminDb();
  const eventRef = db.collection("events").doc(input.eventId);
  const ticketRef = db.collection("tickets").doc();

  const now = Date.now();

  const ticket = await db.runTransaction(async (tx) => {
    const eventSnap = await tx.get(eventRef);
    if (!eventSnap.exists) {
      throw new BookingError("That event does not exist.", 404);
    }

    const event = eventSnap.data() as EventDoc;

    if (event.status !== "published" && event.status !== "live") {
      throw new BookingError("Bookings are not open for this event.", 409);
    }

    const issued = event.tickets_issued ?? 0;
    if (event.capacity > 0 && issued >= event.capacity) {
      throw new BookingError("This event is full.", 409);
    }

    // One pass per student per event. Read inside the transaction so a
    // double-tapped booking button cannot slip a second ticket through.
    //
    // Filtered on `user_id` alone — served by the automatic single-field index
    // — with event and status narrowed in memory. Stacking three equality
    // filters here would work in production but needs a deployed composite
    // index, and a booking that 500s because nobody ran `firebase deploy` is a
    // bad way to find that out. One student's ticket list is tiny.
    const owned = await tx.get(
      db.collection("tickets").where("user_id", "==", input.user.uid),
    );

    const clash = owned.docs.some((doc) => {
      const t = doc.data() as TicketDoc;
      return t.event_id === input.eventId && t.status === "issued";
    });

    if (clash) {
      throw new BookingError("You already have a pass for this event.", 409);
    }

    const qrHash = await computeQrHash({
      secret: process.env.TICKET_QR_SECRET ?? "",
      ticketId: ticketRef.id,
      eventId: input.eventId,
      userId: input.user.uid,
    });

    /*
     * A rotation key, only when the event asked for rotating passes.
     *
     * Minted server-side and never derived from anything in the QR — deriving
     * it from `qr_hash` would let anyone who photographed a pass compute every
     * future code from the photograph alone.
     *
     * Absent (not empty-string) on ordinary events, so `rotation_secret` being
     * present is itself the signal that this pass rotates. One source of truth
     * beats the pass and the gate each re-reading the event to decide.
     */
    const rotationSecret = event.rotating_qr
      ? randomBytes(32).toString("hex")
      : null;

    const doc: TicketDoc = {
      id: ticketRef.id,
      event_id: input.eventId,
      user_id: input.user.uid,
      user_name: input.user.name,
      user_email: input.user.email,
      qr_hash: qrHash,
      status: "issued",
      checked_in: false,
      check_in_time: null,
      checked_in_by: null,
      seat_label: null,
      rotation_secret: rotationSecret,
      created_at: now,
    };

    tx.set(ticketRef, { ...doc, created_at: Timestamp.fromMillis(now) });
    tx.update(eventRef, { tickets_issued: issued + 1 });

    return doc;
  });

  return ticket;
}

/** Loads an event as plain JSON-safe data. */
export async function getEvent(eventId: string): Promise<EventDoc | null> {
  const snap = await adminDb().collection("events").doc(eventId).get();
  if (!snap.exists) return null;

  const data = snap.data() as EventDoc;
  return {
    ...data,
    id: snap.id,
    starts_at: toMillis(data.starts_at),
    ends_at: toMillis(data.ends_at),
    created_at: toMillis(data.created_at),
  };
}

function toMillis(value: unknown): number {
  if (typeof value === "number") return value;
  if (value instanceof Timestamp) return value.toMillis();
  return 0;
}
