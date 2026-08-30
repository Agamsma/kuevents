import { NextResponse } from "next/server";

import { AuthError, requireCaller } from "@/lib/server-auth";
import { BookingError, getEvent, issueTicket } from "@/lib/tickets-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Books a pass.
 *
 * Every event is free at this stage. Capacity and the one-pass-per-student rule
 * are enforced inside `issueTicket`'s transaction, not here — checking first
 * and writing after would let two simultaneous taps both pass.
 */
export async function POST(request: Request) {
  let caller;
  try {
    caller = await requireCaller(request);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  let body: { event_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  if (typeof body.event_id !== "string" || !body.event_id) {
    return NextResponse.json({ error: "`event_id` is required." }, { status: 400 });
  }

  const event = await getEvent(body.event_id);
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  try {
    const ticket = await issueTicket({
      eventId: event.id,
      user: { uid: caller.uid, email: caller.email, name: caller.name },
    });

    return NextResponse.json({ ok: true, ticket_id: ticket.id });
  } catch (error) {
    if (error instanceof BookingError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[issue] failed", error);
    return NextResponse.json({ error: "Could not issue a pass." }, { status: 500 });
  }
}
