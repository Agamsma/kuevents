import { NextResponse } from "next/server";

import { ApiError, apiRoute, readJson } from "@/lib/api-handler";
import { requireCaller } from "@/lib/server-auth";
import { getEvent, issueTicket } from "@/lib/tickets-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Books a pass.
 *
 * Every event is free at this stage. Capacity and the one-pass-per-student rule
 * are enforced inside `issueTicket`'s transaction, not here — checking first
 * and writing after would let two simultaneous taps both pass.
 */
export const POST = apiRoute("issue", async (request) => {
  // `AuthError` and `BookingError` both carry a `status`, so the wrapper turns
  // them into their intended response. Only genuine bugs reach its 500 branch.
  const caller = await requireCaller(request);

  const body = await readJson<{ event_id?: unknown }>(request);

  if (typeof body.event_id !== "string" || !body.event_id) {
    throw new ApiError("`event_id` is required.", 400);
  }

  const event = await getEvent(body.event_id);
  if (!event) {
    throw new ApiError("Event not found.", 404);
  }

  const ticket = await issueTicket({
    eventId: event.id,
    user: { uid: caller.uid, email: caller.email, name: caller.name },
  });

  return NextResponse.json({ ok: true, ticket_id: ticket.id });
});
