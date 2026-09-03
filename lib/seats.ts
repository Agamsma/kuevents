import type { EventDoc } from "@/lib/types";

/**
 * Seat arithmetic, in one place.
 *
 * "How many are left, is it full, is it nearly gone" was computed inline in the
 * directory card, on the event detail page and now in the hero marquee — three
 * copies of the same `<= 20`, which is exactly the kind of number that drifts
 * apart one screen at a time until "4 left" is urgent on one page and ordinary
 * on another.
 *
 * This is display logic only. The authoritative capacity check happens inside
 * the booking transaction in `lib/tickets-server.ts`, because anything computed
 * from a read here is already stale by the time a student taps reserve.
 */

/** At or below this many remaining, a seat count is worth shouting about. */
export const LOW_SEATS_THRESHOLD = 20;

export interface SeatState {
  /** Seats remaining, or null when the event has no capacity limit set. */
  seatsLeft: number | null;
  full: boolean;
  /** Some seats left, but at or under the threshold. Never true when full. */
  low: boolean;
}

type CapacityFields = Pick<EventDoc, "capacity"> & {
  tickets_issued?: number | null;
};

export function seatState(event: CapacityFields): SeatState {
  const capacity = event.capacity ?? 0;

  // No capacity set means uncapped, not sold out — an event with capacity 0
  // has simply never had a limit configured, and reporting it as "full" would
  // hide it behind a refusal it never earned.
  if (capacity <= 0) {
    return { seatsLeft: null, full: false, low: false };
  }

  const seatsLeft = Math.max(capacity - (event.tickets_issued ?? 0), 0);

  return {
    seatsLeft,
    full: seatsLeft === 0,
    low: seatsLeft > 0 && seatsLeft <= LOW_SEATS_THRESHOLD,
  };
}
