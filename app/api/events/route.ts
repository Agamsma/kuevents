import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";

import { ApiError, apiRoute, readJson } from "@/lib/api-handler";
import { parseEventInput } from "@/lib/event-input";
import { adminDb } from "@/lib/firebase-admin";
import { requireCaller } from "@/lib/server-auth";
import type { EventDoc, EventStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUS: EventStatus[] = [
  "pending",
  "rejected",
  "draft",
  "published",
  "live",
  "ended",
  "cancelled",
];

/**
 * Creates an event directly, as an organizer.
 *
 * Goes through the server rather than a client write so `tickets_issued` starts
 * at a trusted zero and `organizer_uid` comes from the verified token — never
 * from the body, which would let anyone create events in someone else's name.
 */
export const POST = apiRoute("events create", async (request) => {
  const caller = await requireCaller(request, ["organizer", "superadmin"]);

  const body = await readJson<Record<string, unknown>>(request);

  const parsed = parseEventInput(body);
  if (!parsed.ok) {
    throw new ApiError(parsed.error, 400);
  }

  const status: EventStatus =
    typeof body.status === "string" &&
    VALID_STATUS.includes(body.status as EventStatus)
      ? (body.status as EventStatus)
      : "draft";

  const ref = adminDb().collection("events").doc();

  const event: Omit<EventDoc, "id"> = {
    ...parsed.value,
    status,
    tickets_issued: 0,
    created_by: caller.uid,
    organizer_uid: caller.uid,
    review_note: null,
    reviewed_by: null,
    reviewed_at: null,
    created_at: Date.now(),
  };

  await ref.set({
    ...event,
    starts_at: Timestamp.fromMillis(event.starts_at),
    ends_at: Timestamp.fromMillis(event.ends_at),
    created_at: Timestamp.now(),
  });

  return NextResponse.json({
    ok: true,
    event_id: ref.id,
    event: { ...event, id: ref.id },
  });
});

/**
 * Moves an event through its lifecycle, including approving and rejecting
 * student proposals.
 *
 * Approving a proposal is the one transition that changes ownership: the
 * organizer who approves becomes `organizer_uid`, because from that point they
 * are the one accountable for the gate, the roster and the venue.
 */
export const PATCH = apiRoute("events patch", async (request) => {
  const caller = await requireCaller(request, ["organizer", "superadmin"]);

  const body = await readJson<{
    event_id?: unknown;
    status?: unknown;
    review_note?: unknown;
    capacity?: unknown;
    rotating_qr?: unknown;
    bookings_paused?: unknown;
  }>(request);

  if (typeof body.event_id !== "string" || !body.event_id) {
    throw new ApiError("`event_id` is required.", 400);
  }
  if (
    typeof body.status !== "string" ||
    !VALID_STATUS.includes(body.status as EventStatus)
  ) {
    throw new ApiError("Unknown status.", 400);
  }

  const nextStatus = body.status as EventStatus;
  const db = adminDb();
  const ref = db.collection("events").doc(body.event_id);

  /*
   * The whole decision runs in a transaction, and that is what closes the
   * two-organizer race.
   *
   * The read and the write used to be separate awaits. Two organizers opening
   * the same proposal - which the review board positively invites, since it is
   * a shared queue - could both read `status: "pending"`, both pass the
   * ownership check, and both call `update()`. Neither failed. The second write
   * simply won, so the proposal ended up owned by whoever's request landed
   * last, while BOTH organizers saw a success toast and believed they were
   * accountable for the venue, the roster and the gate. An event with two
   * people each certain it is theirs is worse than one with none.
   *
   * Inside a transaction Firestore aborts and retries the loser when the
   * document changes underneath it, so on the retry it reads the status the
   * winner just wrote and falls through to the "already decided" branch below.
   */
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);

    if (!snap.exists) {
      throw new ApiError("Event not found.", 404);
    }

    const event = snap.data() as EventDoc;

    // An organizer owns the events they created or approved. A pending proposal
    // has no owner yet, so any organizer may review it. Superadmins may touch any.
    const isPendingReview = event.status === "pending";
    const ownsIt = event.organizer_uid === caller.uid;

    if (caller.role !== "superadmin" && !ownsIt && !isPendingReview) {
      /*
       * Two different refusals, because they send the organizer to two different
       * places.
       *
       * A proposal that already carries a review stamp was decided by a colleague
       * moments ago, most likely out of the same queue. Telling that person "that
       * is not your event" is both confusing and wrong - it was everyone's event
       * until someone took it - and it leaves them wondering whether their click
       * did something. Naming what happened lets them refresh and move on.
       */
      if (event.reviewed_at) {
        throw new ApiError(
          "Another organizer has already reviewed this proposal. Refresh the queue to see their decision.",
          409,
        );
      }

      throw new ApiError("That is not your event.", 403);
    }

    const update: Record<string, unknown> = { status: nextStatus };

    /*
     * The review stamp records a DECISION, so only a real transition writes it.
     *
     * It used to be set on every PATCH. Pausing bookings sends the event's
     * current status back unchanged - there is no pause-only endpoint - so every
     * pause and every resume rewrote `reviewed_by` and `reviewed_at`. Two things
     * broke quietly:
     *
     *   - the proposer's own page prints that timestamp under "What the organizer
     *     said" (my-proposals.tsx), so the moment an organizer paused bookings
     *     months later, the student's rejection appeared to have been decided
     *     that afternoon
     *   - `reviewed_by` decayed from "who approved this" into "who touched it
     *     last", which is the one field a disputed approval would be settled with
     */
    if (nextStatus !== event.status) {
      update.reviewed_by = caller.uid;
      update.reviewed_at = Date.now();
    }

    /*
     * Pausing is separate from the status transition, and may be sent on its own.
     *
     * An organizer pausing bookings an hour before doors is not changing the
     * event's lifecycle - it stays published, it stays on the directory, and
     * every pass already issued stays valid. Only an explicit boolean moves it,
     * so a PATCH that says nothing about pausing leaves it alone.
     */
    if (typeof body.bookings_paused === "boolean") {
      update.bookings_paused = body.bookings_paused;
    }

    if (typeof body.review_note === "string" && body.review_note.trim()) {
      update.review_note = body.review_note.trim().slice(0, 500);
    }

    if (isPendingReview && nextStatus === "published") {
      update.organizer_uid = caller.uid;

      // A proposal only carries an expected footfall. Turning that into a real
      // capacity is the approving organizer's call, so accept an override and
      // otherwise fall back to what the student estimated.
      const capacity = Number(body.capacity);
      update.capacity =
        Number.isFinite(capacity) && capacity >= 0
          ? Math.floor(capacity)
          : (event.expected_footfall ?? 0);

      /*
       * Rotating passes are the approving organizer's call, alongside capacity.
       *
       * Only read on approval, and only `=== true` counts: an absent or malformed
       * field leaves rotation off. A security setting that could be switched on
       * by a stray value is one nobody can reason about — and switching it on
       * mid-event would strand every pass already issued without a secret.
       */
      update.rotating_qr = body.rotating_qr === true;
    }

    tx.update(ref, update);
  });

  // Built after the transaction rather than returned from inside it: the body
  // is retried on contention, and nothing in it should be constructing the
  // reply that the one surviving attempt happens to hand back.
  return NextResponse.json({ ok: true, status: nextStatus });
});
