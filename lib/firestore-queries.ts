"use client";

import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { toMillis } from "@/lib/format";
import type { EventDoc, TicketDoc } from "@/lib/types";

/**
 * Client-side reads, deliberately shaped to need **no composite indexes**.
 *
 * Firestore builds single-field indexes automatically, but the moment you
 * combine a filter with an `orderBy` on a different field it demands a
 * hand-deployed composite index — and until someone runs
 * `firebase deploy --only firestore:indexes`, the query throws at runtime and
 * the page shows nothing. For collections this size (a university's events, one
 * student's tickets) sorting and secondary filtering in memory costs nothing
 * and removes that deployment tripwire entirely.
 *
 * If events ever grow past a few thousand, revisit this and add the composite
 * indexes in `firestore.indexes.json`.
 */

function normaliseEvent(id: string, data: Record<string, unknown>): EventDoc {
  return {
    ...(data as unknown as EventDoc),
    id,
    starts_at: toMillis(data.starts_at as never) ?? 0,
    ends_at: toMillis(data.ends_at as never) ?? 0,
    created_at: toMillis(data.created_at as never) ?? 0,
  };
}

function normaliseTicket(id: string, data: Record<string, unknown>): TicketDoc {
  return {
    ...(data as unknown as TicketDoc),
    id,
    check_in_time: toMillis(data.check_in_time as never),
    created_at: toMillis(data.created_at as never) ?? 0,
  };
}

/** Events open for booking, soonest first. Single-field filter + in-memory sort. */
export async function fetchOpenEvents(): Promise<EventDoc[]> {
  const snap = await getDocs(
    query(collection(db, "events"), where("status", "in", ["published", "live"])),
  );

  return snap.docs
    .map((d) => normaliseEvent(d.id, d.data()))
    .sort((a, b) => a.starts_at - b.starts_at);
}

/**
 * The public directory: strictly `published`.
 *
 * Narrower than `fetchOpenEvents` on purpose — the directory is the front door,
 * and an event that is already under way is not something to advertise a seat
 * for. The `where` clause also has to stay a provable constraint, because
 * `firestore.rules` only lets a student read events that are not proposals.
 */
export async function fetchPublishedEvents(): Promise<EventDoc[]> {
  const snap = await getDocs(
    query(collection(db, "events"), where("status", "==", "published")),
  );

  return snap.docs
    .map((d) => normaliseEvent(d.id, d.data()))
    .sort((a, b) => a.starts_at - b.starts_at);
}

/** Proposals awaiting an organizer's decision, oldest first — a review queue. */
export async function fetchPendingEvents(): Promise<EventDoc[]> {
  const snap = await getDocs(
    query(collection(db, "events"), where("status", "==", "pending")),
  );

  return snap.docs
    .map((d) => normaliseEvent(d.id, d.data()))
    .sort((a, b) => a.created_at - b.created_at);
}

/** Everything one student has proposed, so they can track their own requests. */
export async function fetchMyProposals(uid: string): Promise<EventDoc[]> {
  const snap = await getDocs(
    query(collection(db, "events"), where("created_by", "==", uid)),
  );

  return snap.docs
    .map((d) => normaliseEvent(d.id, d.data()))
    .sort((a, b) => b.created_at - a.created_at);
}

/** Every event, for the organizer view. Drafts and past events included. */
export async function fetchAllEvents(): Promise<EventDoc[]> {
  const snap = await getDocs(collection(db, "events"));

  return snap.docs
    .map((d) => normaliseEvent(d.id, d.data()))
    .sort((a, b) => b.starts_at - a.starts_at);
}

/** A single event. Null when it does not exist. */
export async function fetchEvent(eventId: string): Promise<EventDoc | null> {
  const snap = await getDoc(doc(db, "events", eventId));
  if (!snap.exists()) return null;

  return normaliseEvent(snap.id, snap.data());
}

/** Every pass belonging to one student, newest first. */
export async function fetchMyTickets(uid: string): Promise<TicketDoc[]> {
  const snap = await getDocs(
    query(collection(db, "tickets"), where("user_id", "==", uid)),
  );

  return snap.docs
    .map((d) => normaliseTicket(d.id, d.data()))
    .sort((a, b) => b.created_at - a.created_at);
}

/** The full roster for one event, for the gate scanner's offline cache. */
export async function fetchEventTickets(eventId: string): Promise<TicketDoc[]> {
  const snap = await getDocs(
    query(collection(db, "tickets"), where("event_id", "==", eventId)),
  );

  return snap.docs.map((d) => normaliseTicket(d.id, d.data()));
}
