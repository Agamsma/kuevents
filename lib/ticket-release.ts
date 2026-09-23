import { isOn } from "./types.ts";
import type { TicketDoc } from "./types.ts";

/**
 * Whether a holder may give a pass back, separated from the I/O that acts on it.
 *
 * Same split as `lib/auth-decision.ts`, for the same reason: the interesting
 * part of releasing a pass is the list of things that must NOT happen, and each
 * of those is a refusal that has to be right whether or not anyone remembers to
 * test it against a live Firestore. The route keeps the transaction; this keeps
 * the rules.
 *
 * Relative imports with extensions: `node --test` resolves neither the `@/`
 * alias nor a bare specifier, and `types.ts` has no runtime imports of its own.
 */

/** A refusal, shaped so the route can throw it as an `ApiError`. */
export interface ReleaseRefusal {
  status: 404 | 409;
  message: string;
}

/**
 * The event fields this decision needs. Structural rather than `EventDoc`, so a
 * caller holding only a projection can still ask.
 */
export interface ReleasableEvent {
  ends_at: number;
}

export function canRelease(params: {
  ticket: Pick<TicketDoc, "user_id" | "status" | "checked_in">;
  event: ReleasableEvent | null;
  callerUid: string;
  now?: number;
}): { ok: true } | { ok: false; refusal: ReleaseRefusal } {
  const { ticket, event, callerUid, now = Date.now() } = params;

  /*
   * Someone else's pass is reported as missing, not as forbidden.
   *
   * A 403 here would confirm that a given ticket id exists, which is a fact
   * this endpoint has no reason to hand out — ids are the scan key, and
   * `firestore.rules` already refuses to let anyone read a ticket that is not
   * theirs. The API should not be looser than the database.
   */
  if (ticket.user_id !== callerUid) {
    return { ok: false, refusal: { status: 404, message: "No such pass." } };
  }

  if (ticket.status !== "issued") {
    return {
      ok: false,
      refusal: { status: 409, message: "This pass has already been released." },
    };
  }

  /*
   * A pass that got someone through the gate is spent, and the seat it used is
   * not coming back. Releasing it would decrement `tickets_issued` for a person
   * who is standing inside the venue — handing their seat to someone else while
   * they are still in it.
   */
  if (ticket.checked_in) {
    return {
      ok: false,
      refusal: {
        status: 409,
        message: "This pass has already been used at the gate.",
      },
    };
  }

  /*
   * Refused once the event is over, even though nothing would break.
   *
   * `tickets_issued` on a finished event is a record of how many passes it
   * actually gave out. Letting it move afterwards would quietly rewrite that
   * number months later, and it is the figure an organizer reconciles against
   * the gate's audit trail. Nothing is gained: the seat cannot be reused.
   *
   * A missing event is treated the same way rather than as an error. The pass
   * is for something that no longer exists, so there is no capacity to give
   * back, and the holder does not need to be told about our data integrity.
   */
  if (!event || !isOn(event, now)) {
    return {
      ok: false,
      refusal: {
        status: 409,
        message: "This event has already finished.",
      },
    };
  }

  return { ok: true };
}
