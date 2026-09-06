"use client";

import type { EventDoc } from "@/lib/types";

/**
 * Books a pass and resolves with the new ticket id.
 *
 * Every event is free at this stage, so this is a single authenticated POST.
 * The seam is kept as its own module because ticketing is the one action that
 * happens from three places — the directory, the event page and (eventually)
 * a deep link — and they must not drift on how they handle failure.
 */
/**
 * A failure whose message was written to be read by a student.
 *
 * The distinction matters at the toast: anything that is *not* one of these is
 * an internal fault, and its text — a parse error, a stack frame, a Firebase
 * code — explains nothing to the person holding the phone. Typed rather than
 * sniffed from the message string, so the boundary cannot rot.
 */
export class BookingFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingFailure";
  }
}

export async function bookPass({
  event,
  token,
}: {
  event: EventDoc;
  token: string;
}): Promise<string> {
  const response = await fetch("/api/tickets/issue", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ event_id: event.id }),
  });

  const body = await readJsonResponse(response);

  if (!response.ok) {
    throw new BookingFailure(body?.error ?? failureMessage(response.status));
  }

  const ticketId = body?.ticket_id;
  if (typeof ticketId !== "string" || !ticketId) {
    // A 200 with no ticket id means the contract changed underneath us. Better
    // to say so than to navigate to `/tickets/undefined`.
    throw new BookingFailure(
      "The pass was not returned. Check My passes before retrying.",
    );
  }

  return ticketId;
}

/**
 * Parses a response body that *should* be JSON, returning null when it is not.
 *
 * A server that fails before reaching the route handler — a crashed function, a
 * platform 502, an HTML error page from a proxy — sends back something that is
 * not JSON, and often nothing at all. Calling `.json()` on that throws
 * `Unexpected end of JSON input`, which then surfaces to a student as the
 * explanation for why they have no pass. The status code is the honest signal;
 * this keeps it reachable.
 */
async function readJsonResponse(
  response: Response,
): Promise<{ error?: string; ticket_id?: unknown } | null> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    console.error(
      `[booking] ${response.status} with a non-JSON body:`,
      text.slice(0, 500),
    );
    return null;
  }
}

/** What to tell someone when the server did not explain itself. */
function failureMessage(status: number): string {
  if (status === 401 || status === 403) {
    return "Your session has expired. Sign in again and retry.";
  }
  if (status === 404) {
    return "That event is no longer available.";
  }
  if (status === 409) {
    return "You already have a pass for this event.";
  }
  if (status >= 500) {
    return "The booking service is down right now. Nothing was charged and no pass was issued — try again shortly.";
  }
  return `Booking failed (${status}).`;
}
