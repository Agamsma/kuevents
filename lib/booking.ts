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

  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Booking failed.");

  return body.ticket_id as string;
}
