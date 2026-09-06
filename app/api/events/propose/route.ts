import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";

import { ApiError, apiRoute, readJson } from "@/lib/api-handler";
import { adminDb } from "@/lib/firebase-admin";
import { requireCaller } from "@/lib/server-auth";
import { parseEventInput } from "@/app/api/events/route";
import type { EventDoc } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How many proposals one student may have awaiting review at once. */
const MAX_OPEN_PROPOSALS = 3;

/**
 * Any signed-in student may propose an event.
 *
 * The proposal lands as `status: "pending"` with no `organizer_uid` — it is not
 * yet anybody's event, and it is invisible on the public directory until an
 * organizer approves it. The status is hardcoded here rather than read from the
 * body: a student who could set their own status could self-publish.
 */
export const POST = apiRoute("propose", async (request) => {
  // No role restriction — proposing is the one thing every student can do.
  const caller = await requireCaller(request);

  const body = await readJson<Record<string, unknown>>(request);

  const parsed = parseEventInput(body);
  if (!parsed.ok) {
    throw new ApiError(parsed.error, 400);
  }

  if (parsed.value.starts_at < Date.now()) {
    throw new ApiError("Pick a date in the future.", 400);
  }

  const db = adminDb();

  // Rate limit by open proposals rather than by time. A student with three
  // ideas awaiting review does not need a fourth; one whose proposals have all
  // been reviewed is not spamming anyone.
  const open = await db
    .collection("events")
    .where("created_by", "==", caller.uid)
    .where("status", "==", "pending")
    .get();

  if (open.size >= MAX_OPEN_PROPOSALS) {
    throw new ApiError(
      `You already have ${open.size} proposals waiting on a review. Wait for one to be decided before sending another.`,
      429,
    );
  }

  const ref = db.collection("events").doc();

  const event: Omit<EventDoc, "id"> = {
    ...parsed.value,
    status: "pending",
    // Capacity is the approving organizer's decision, not the proposer's.
    capacity: 0,
    tickets_issued: 0,
    created_by: caller.uid,
    organizer_uid: null,
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
    // Denormalised so the review board can show who asked without a second read.
    proposer_name: caller.name,
    proposer_email: caller.email,
  });

  return NextResponse.json({ ok: true, event_id: ref.id });
});
