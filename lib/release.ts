"use client";

/**
 * Releases a pass and resolves when the seat is back.
 *
 * Deliberately shaped like `lib/booking.ts`, down to the failure class and the
 * non-JSON handling. Booking and releasing are the two halves of the same
 * promise to a student — you can take a seat, and you can give it back — and a
 * pair that reports failure differently is a pair where one half quietly gets
 * worse than the other.
 */

/**
 * A failure whose message was written to be read by a student.
 *
 * Anything that is NOT one of these is an internal fault whose text — a parse
 * error, a stack frame, a Firebase code — explains nothing to the person
 * holding the phone. Typed rather than sniffed from the message string, so the
 * boundary cannot rot.
 */
export class ReleaseFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReleaseFailure";
  }
}

export async function releasePass({
  ticketId,
  token,
}: {
  ticketId: string;
  token: string;
}): Promise<void> {
  const response = await fetch("/api/tickets/release", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ticket_id: ticketId }),
  });

  if (response.ok) return;

  const body = await readJsonResponse(response);
  throw new ReleaseFailure(body?.error ?? failureMessage(response.status));
}

/**
 * Parses a response body that *should* be JSON, returning null when it is not.
 *
 * A server that fails before reaching the route handler — a crashed function, a
 * platform 502, an HTML error page from a proxy — sends back something that is
 * not JSON, and often nothing at all. Calling `.json()` on that throws
 * `Unexpected end of JSON input`, which then surfaces to a student as the
 * explanation for why their pass is still there.
 */
async function readJsonResponse(
  response: Response,
): Promise<{ error?: string } | null> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    console.error(
      `[release] ${response.status} with a non-JSON body:`,
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
    return "That pass no longer exists.";
  }
  if (status === 409) {
    return "That pass can no longer be released.";
  }
  if (status >= 500) {
    return "Could not reach the booking service. Your pass is unchanged — try again shortly.";
  }
  return `Could not release the pass (${status}).`;
}
