import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";

import { ApiError, apiRoute, readJson } from "@/lib/api-handler";
import { adminDb } from "@/lib/firebase-admin";
import { requireCaller } from "@/lib/server-auth";
import {
  EVENT_CATEGORIES,
  TRACK_LABELS,
  type EventCategory,
  type EventDoc,
  type EventStatus,
  type EventTrack,
} from "@/lib/types";

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

const VALID_TRACKS = Object.keys(TRACK_LABELS) as EventTrack[];

export interface EventInput {
  title: string;
  description: string;
  venue: string;
  starts_at: number;
  ends_at: number;
  track: EventTrack;
  category: EventCategory;
  expected_footfall: number;
  capacity: number;
  cover_image_url: string | null;
}

/**
 * Validates an event payload from an untrusted client.
 *
 * Returns either the cleaned input or a human-readable reason. Every message is
 * written to be shown directly to whoever submitted the form — "Pick a start
 * date and time", not "starts_at must be a positive finite number".
 */
export function parseEventInput(
  body: Record<string, unknown>,
): { ok: true; value: EventInput } | { ok: false; error: string } {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const venue = typeof body.venue === "string" ? body.venue.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";

  if (title.length < 3) {
    return { ok: false, error: "Give the event a title of at least 3 characters." };
  }
  if (title.length > 120) {
    return { ok: false, error: "Titles are capped at 120 characters." };
  }
  if (!venue) {
    return { ok: false, error: "Say where it is happening." };
  }
  if (description.length > 2000) {
    return { ok: false, error: "Descriptions are capped at 2000 characters." };
  }

  const startsAt = Number(body.starts_at);
  const endsAt = Number(body.ends_at);

  if (!Number.isFinite(startsAt) || startsAt <= 0) {
    return { ok: false, error: "Pick a start date and time." };
  }
  if (!Number.isFinite(endsAt) || endsAt <= startsAt) {
    return { ok: false, error: "The event has to end after it starts." };
  }

  const track = String(body.track) as EventTrack;
  if (!VALID_TRACKS.includes(track)) {
    return { ok: false, error: "Pick which school or club is running this." };
  }

  const category = String(body.category) as EventCategory;
  if (!EVENT_CATEGORIES.includes(category)) {
    return { ok: false, error: "Pick a category." };
  }

  const expectedFootfall = Math.max(0, Math.floor(Number(body.expected_footfall) || 0));
  const capacity = Math.max(0, Math.floor(Number(body.capacity) || 0));

  const coverImageUrl =
    typeof body.cover_image_url === "string" && body.cover_image_url
      ? body.cover_image_url
      : null;

  // Only accept images we put in our own Storage bucket. A cover URL pointing
  // anywhere else would let a proposal embed a tracking pixel — or worse — on
  // the public directory.
  if (coverImageUrl && !/^https:\/\/firebasestorage\.googleapis\.com\//.test(coverImageUrl)) {
    return { ok: false, error: "Cover image must be uploaded through this form." };
  }

  return {
    ok: true,
    value: {
      title,
      description,
      venue,
      starts_at: startsAt,
      ends_at: endsAt,
      track,
      category,
      expected_footfall: expectedFootfall,
      capacity,
      cover_image_url: coverImageUrl,
    },
  };
}

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
    typeof body.status === "string" && VALID_STATUS.includes(body.status as EventStatus)
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
  const ref = adminDb().collection("events").doc(body.event_id);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new ApiError("Event not found.", 404);
  }

  const event = snap.data() as EventDoc;

  // An organizer owns the events they created or approved. A pending proposal
  // has no owner yet, so any organizer may review it. Superadmins may touch any.
  const isPendingReview = event.status === "pending";
  const ownsIt = event.organizer_uid === caller.uid;

  if (caller.role !== "superadmin" && !ownsIt && !isPendingReview) {
    throw new ApiError("That is not your event.", 403);
  }

  const update: Record<string, unknown> = {
    status: nextStatus,
    reviewed_by: caller.uid,
    reviewed_at: Date.now(),
  };

  if (typeof body.review_note === "string" && body.review_note.trim()) {
    update.review_note = body.review_note.trim().slice(0, 500);
  }

  if (isPendingReview && nextStatus === "published") {
    update.organizer_uid = caller.uid;

    // A proposal only carries an expected footfall. Turning that into a real
    // capacity is the approving organizer's call, so accept an override and
    // otherwise fall back to what the student estimated.
    const capacity = Number(body.capacity);
    update.capacity = Number.isFinite(capacity) && capacity >= 0
      ? Math.floor(capacity)
      : (event.expected_footfall ?? 0);
  }

  await ref.update(update);

  return NextResponse.json({ ok: true, status: nextStatus });
});
